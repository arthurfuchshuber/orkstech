import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Authenticate caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !caller) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Verify Super Admin
  const { data: profile } = await supabaseAdmin.from("profiles").select("nivel_permissao_id").eq("user_id", caller.id).single();
  const { data: nivel } = await supabaseAdmin.from("niveis_permissao").select("nome").eq("id", profile?.nivel_permissao_id).single();
  if (nivel?.nome !== "Super Admin") {
    return new Response(JSON.stringify({ error: "Acesso negado" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "overview") {
      // Total empresas
      const { count: totalEmpresas } = await supabaseAdmin.from("empresas").select("id", { count: "exact", head: true });
      // Total users
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const totalUsers = users?.length ?? 0;
      // Total profiles
      const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, nome, ativo, created_at");

      // Stripe metrics
      let mrr = 0;
      let activeSubscriptions = 0;
      let planBreakdown: Record<string, number> = {};
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
        const subs = await stripe.subscriptions.list({ status: "active", limit: 100 });
        activeSubscriptions = subs.data.length;
        for (const sub of subs.data) {
          const amount = sub.items.data[0]?.price?.unit_amount ?? 0;
          const interval = sub.items.data[0]?.price?.recurring?.interval;
          const productId = sub.items.data[0]?.price?.product as string;
          
          // Normalize to monthly
          let monthly = amount;
          if (interval === "year") monthly = Math.round(amount / 12);
          else if (interval === "month") monthly = amount;
          mrr += monthly;

          planBreakdown[productId] = (planBreakdown[productId] || 0) + 1;
        }
      }

      // Recent signups (last 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const recentUsers = users?.filter((u) => u.created_at > thirtyDaysAgo).length ?? 0;

      return new Response(JSON.stringify({
        totalEmpresas: totalEmpresas ?? 0,
        totalUsers,
        recentUsers,
        activeSubscriptions,
        mrr,
        planBreakdown,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (action === "list_companies") {
      const { data: empresas } = await supabaseAdmin.from("empresas").select("*").order("created_at", { ascending: false });
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      
      const result = (empresas ?? []).map((e) => {
        const owner = users?.find((u) => u.id === e.user_id);
        return { ...e, owner_email: owner?.email ?? "—" };
      });

      return new Response(JSON.stringify({ companies: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_all_users") {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, nome, ativo, nivel_permissao_id");
      const { data: empresas } = await supabaseAdmin.from("empresas").select("user_id, razao_social, nome_fantasia");
      const { data: niveis } = await supabaseAdmin.from("niveis_permissao").select("id, nome");

      const result = (users ?? []).map((u) => {
        const profile = profiles?.find((p) => p.user_id === u.id);
        const empresa = empresas?.find((e) => e.user_id === u.id);
        const nivel = niveis?.find((n) => n.id === profile?.nivel_permissao_id);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          nome: profile?.nome ?? null,
          ativo: profile?.ativo ?? true,
          nivel: nivel?.nome ?? "—",
          empresa: empresa?.nome_fantasia || empresa?.razao_social || "—",
        };
      });

      return new Response(JSON.stringify({ users: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list_logs") {
      const { data: logs } = await supabaseAdmin
        .from("historico_sistema")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      return new Response(JSON.stringify({ logs: logs ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_user_active") {
      const { user_id, ativo } = body;
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Não pode desativar a si mesmo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("profiles").update({ ativo }).eq("user_id", user_id);
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
