import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
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

  // Helper to log admin actions with email
  async function logAdminAction(evento: string, descricao: string, contexto: any = {}) {
    if (!caller) return;
    await supabaseAdmin.from("historico_sistema").insert({
      user_id: caller.id,
      evento,
      descricao,
      contexto: { ...contexto, admin_email: caller.email },
    });
  }

  try {
    const body = await req.json();
    const { action } = body;

    // ============= OVERVIEW (real numbers, only existing data) =============
    if (action === "overview") {
      // Real empresas count
      const { count: totalEmpresas } = await supabaseAdmin.from("empresas").select("id", { count: "exact", head: true });

      // Identify Super Admin user_ids to EXCLUDE from user counts (they are SaaS operators, not customers)
      const { data: saNivel } = await supabaseAdmin.from("niveis_permissao").select("id").eq("nome", "Super Admin").single();
      const { data: saProfiles } = await supabaseAdmin.from("profiles").select("user_id").eq("nivel_permissao_id", saNivel?.id);
      const superAdminIds = new Set((saProfiles ?? []).map((p) => p.user_id));

      // Identify owners (users that created at least one empresa) and team members (profiles with empresa_id)
      const { data: empresasOwners } = await supabaseAdmin.from("empresas").select("user_id");
      const ownerIds = new Set((empresasOwners ?? []).map((e) => e.user_id));

      const { data: allProfiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, empresa_id, created_at");

      // Real users = profiles that are owners OR linked to an empresa, excluding Super Admins
      const realProfiles = (allProfiles ?? []).filter((p) =>
        !superAdminIds.has(p.user_id) && (ownerIds.has(p.user_id) || !!p.empresa_id)
      );
      const totalProfiles = realProfiles.length;

      // Recent (last 30d) — same filter
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentUsers = realProfiles.filter((p) => new Date(p.created_at).getTime() >= thirtyDaysAgo).length;

      // Growth (last 6 months) — same filter
      const growthMap: Record<string, number> = {};
      for (let i = 5; i >= 0; i--) {
        const d = new Date();
        d.setMonth(d.getMonth() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        growthMap[key] = 0;
      }
      const sixMonthsAgo = Date.now() - 180 * 24 * 60 * 60 * 1000;
      for (const p of realProfiles) {
        if (new Date(p.created_at).getTime() < sixMonthsAgo) continue;
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        if (key in growthMap) growthMap[key]++;
      }
      const growth = Object.entries(growthMap).map(([month, count]) => ({ month, count }));


      // Top empresas by activity (sum of payable + receivable counts)
      const { data: empresas } = await supabaseAdmin.from("empresas").select("id, razao_social, nome_fantasia");
      const topEmpresas: { id: string; nome: string; total: number }[] = [];
      for (const e of empresas ?? []) {
        const { count: pay } = await supabaseAdmin.from("accounts_payable").select("id", { count: "exact", head: true }).eq("empresa_id", e.id);
        const { count: rec } = await supabaseAdmin.from("accounts_receivable").select("id", { count: "exact", head: true }).eq("empresa_id", e.id);
        topEmpresas.push({
          id: e.id,
          nome: e.nome_fantasia || e.razao_social,
          total: (pay ?? 0) + (rec ?? 0),
        });
      }
      topEmpresas.sort((a, b) => b.total - a.total);

      // Stripe metrics
      let mrr = 0, arr = 0, activeSubscriptions = 0, trialingSubscriptions = 0, canceledLast30d = 0;
      let planBreakdown: Record<string, number> = {};
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      const stripeTrialUserIds = new Set<string>();
      if (stripeKey) {
        const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

        const subs = await stripe.subscriptions.list({ status: "all", limit: 100 });
        for (const sub of subs.data) {
          const amount = sub.items.data[0]?.price?.unit_amount ?? 0;
          const interval = sub.items.data[0]?.price?.recurring?.interval;
          const intervalCount = sub.items.data[0]?.price?.recurring?.interval_count ?? 1;
          const productId = sub.items.data[0]?.price?.product as string;

          let monthly = amount;
          if (interval === "year") monthly = Math.round(amount / 12);
          else if (interval === "month" && intervalCount > 1) monthly = Math.round(amount / intervalCount);

          if (sub.status === "active") {
            mrr += monthly;
            activeSubscriptions++;
            planBreakdown[productId] = (planBreakdown[productId] || 0) + 1;
          } else if (sub.status === "trialing") {
            trialingSubscriptions++;
          } else if (sub.status === "canceled" && sub.canceled_at) {
            const canceledMs = sub.canceled_at * 1000;
            if (canceledMs > Date.now() - 30 * 24 * 60 * 60 * 1000) canceledLast30d++;
          }
        }
        arr = mrr * 12;
      }

      // Manual trials (definidos pelo admin) — somente os ativos (não expirados)
      // e que não estejam já contados via Stripe trialing
      const { data: manualTrials } = await supabaseAdmin
        .from("subscribers")
        .select("user_id, trial_end")
        .eq("is_manual_trial", true)
        .gt("trial_end", new Date().toISOString());
      for (const mt of manualTrials ?? []) {
        if (!stripeTrialUserIds.has(mt.user_id)) trialingSubscriptions++;
      }

      // Empresas marcadas como "Sem cobranças" (acesso liberado pelo SaaS admin)
      const { count: complimentaryCount } = await supabaseAdmin
        .from("subscribers")
        .select("user_id", { count: "exact", head: true })
        .eq("is_complimentary", true);

      const churnRate = activeSubscriptions + canceledLast30d > 0
        ? (canceledLast30d / (activeSubscriptions + canceledLast30d)) * 100
        : 0;

      return new Response(JSON.stringify({
        totalEmpresas: totalEmpresas ?? 0,
        totalUsers: totalProfiles ?? 0,
        recentUsers: recentUsers ?? 0,
        activeSubscriptions,
        trialingSubscriptions,
        complimentaryCount: complimentaryCount ?? 0,
        canceledLast30d,
        churnRate: Math.round(churnRate * 10) / 10,
        mrr,
        arr,
        planBreakdown,
        growth,
        topEmpresas: topEmpresas.slice(0, 5),
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============= LIST COMPANIES (detailed for Empresas tab) =============
    if (action === "list_companies") {
      const { data: empresas } = await supabaseAdmin.from("empresas").select("*").order("created_at", { ascending: false });
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const { data: subscribersAll } = await supabaseAdmin
        .from("subscribers")
        .select("user_id, trial_end, is_manual_trial, is_complimentary, status");

      const subByUser = new Map((subscribersAll ?? []).map((s) => [s.user_id, s]));

      const result: any[] = [];
      for (const e of empresas ?? []) {
        const owner = users?.find((u) => u.id === e.user_id);
        const sub = subByUser.get(e.user_id);
        const { count: payCount } = await supabaseAdmin.from("accounts_payable").select("id", { count: "exact", head: true }).eq("empresa_id", e.id);
        const { count: recCount } = await supabaseAdmin.from("accounts_receivable").select("id", { count: "exact", head: true }).eq("empresa_id", e.id);
        const { count: clientesCount } = await supabaseAdmin.from("clientes").select("id", { count: "exact", head: true }).eq("empresa_id", e.id);
        result.push({
          ...e,
          owner_email: owner?.email ?? "—",
          owner_last_sign_in: owner?.last_sign_in_at ?? null,
          trial_end: sub?.trial_end ?? null,
          is_manual_trial: sub?.is_manual_trial ?? false,
          is_complimentary: sub?.is_complimentary ?? false,
          subscription_status: sub?.status ?? null,
          stats: {
            payables: payCount ?? 0,
            receivables: recCount ?? 0,
            clientes: clientesCount ?? 0,
          },
        });
      }

      return new Response(JSON.stringify({ companies: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= SET COMPLIMENTARY (admin libera "Sem cobranças" para uma empresa) =============
    if (action === "set_complimentary") {
      const { empresa_id, enabled } = body;
      if (!empresa_id || typeof enabled !== "boolean") {
        return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: empresa } = await supabaseAdmin
        .from("empresas")
        .select("id, user_id, razao_social, nome_fantasia")
        .eq("id", empresa_id)
        .single();
      if (!empresa) {
        return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(empresa.user_id);
      const ownerEmail = ownerUser?.email ?? "";

      await supabaseAdmin.from("subscribers").upsert(
        {
          user_id: empresa.user_id,
          email: ownerEmail,
          is_complimentary: enabled,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );

      await logAdminAction(
        enabled ? "complimentary_set" : "complimentary_cleared",
        `${enabled ? "Liberado" : "Removido"} acesso "Sem cobranças" para ${empresa.nome_fantasia || empresa.razao_social}`,
        { empresa_id, owner_email: ownerEmail }
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= SET MANUAL TRIAL (admin define período de teste para uma empresa) =============
    if (action === "set_manual_trial") {
      const { empresa_id, days } = body;
      if (!empresa_id || typeof days !== "number" || days < 0 || days > 3650) {
        return new Response(JSON.stringify({ error: "Parâmetros inválidos (days deve ser 0-3650)" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: empresa } = await supabaseAdmin
        .from("empresas")
        .select("id, user_id, razao_social, nome_fantasia")
        .eq("id", empresa_id)
        .single();
      if (!empresa) {
        return new Response(JSON.stringify({ error: "Empresa não encontrada" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: { user: ownerUser } } = await supabaseAdmin.auth.admin.getUserById(empresa.user_id);
      const ownerEmail = ownerUser?.email ?? "";

      if (days === 0) {
        // Encerra o trial manual imediatamente
        await supabaseAdmin.from("subscribers").upsert(
          {
            user_id: empresa.user_id,
            email: ownerEmail,
            is_manual_trial: false,
            trial_end: null,
            status: null,
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        await logAdminAction(
          "manual_trial_cleared",
          `Trial manual removido para ${empresa.nome_fantasia || empresa.razao_social}`,
          { empresa_id, owner_email: ownerEmail }
        );
      } else {
        const trialEnd = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        await supabaseAdmin.from("subscribers").upsert(
          {
            user_id: empresa.user_id,
            email: ownerEmail,
            is_manual_trial: true,
            trial_end: trialEnd,
            status: "trialing",
            last_synced_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
        await logAdminAction(
          "manual_trial_set",
          `Trial manual de ${days} dias definido para ${empresa.nome_fantasia || empresa.razao_social}`,
          { empresa_id, days, trial_end: trialEnd, owner_email: ownerEmail }
        );
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= LIST ALL USERS =============
    if (action === "list_all_users") {
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, nome, ativo, nivel_permissao_id, empresa_id, cpf, telefone, data_nascimento");
      const { data: empresas } = await supabaseAdmin.from("empresas").select("id, user_id, razao_social, nome_fantasia, cnpj, email, telefone, created_at");
      const { data: niveis } = await supabaseAdmin.from("niveis_permissao").select("id, nome");

      const profileUserIds = new Set((profiles ?? []).map((p) => p.user_id));
      const validUsers = (users ?? []).filter((u) => profileUserIds.has(u.id));

      const companiesByUser: Record<string, typeof empresas> = {};
      for (const e of empresas ?? []) {
        const ownerId = e.user_id;
        if (!ownerId) continue;
        if (!companiesByUser[ownerId]) companiesByUser[ownerId] = [];
        companiesByUser[ownerId]!.push(e);
      }

      const result = validUsers.map((u) => {
        const profile = profiles?.find((p) => p.user_id === u.id);
        const empresa = empresas?.find((e) => e.id === profile?.empresa_id) || empresas?.find((e) => e.user_id === u.id);
        const nivel = niveis?.find((n) => n.id === profile?.nivel_permissao_id);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          nome: profile?.nome ?? null,
          cpf: profile?.cpf ?? null,
          telefone: profile?.telefone ?? null,
          data_nascimento: profile?.data_nascimento ?? null,
          ativo: profile?.ativo ?? true,
          nivel: nivel?.nome ?? "—",
          nivel_permissao_id: profile?.nivel_permissao_id ?? null,
          empresa: empresa?.nome_fantasia || empresa?.razao_social || "—",
          empresa_id: empresa?.id ?? null,
          is_owner: !!(companiesByUser[u.id]?.length),
          empresas: (companiesByUser[u.id] ?? []).map((e) => ({
            id: e.id,
            razao_social: e.razao_social,
            nome_fantasia: e.nome_fantasia,
            cnpj: e.cnpj,
            email: e.email,
            telefone: e.telefone,
            created_at: e.created_at,
          })),
        };
      });

      return new Response(JSON.stringify({ users: result, niveis: niveis ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= LIST LOGS (general system logs) =============
    if (action === "list_logs") {
      const { data: logs } = await supabaseAdmin
        .from("historico_sistema")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      // Enrich with user emails
      const userIds = [...new Set((logs ?? []).map((l) => l.user_id).filter(Boolean))];
      const emailMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
        for (const u of users ?? []) {
          if (userIds.includes(u.id)) emailMap[u.id] = u.email ?? "—";
        }
      }
      const enriched = (logs ?? []).map((l) => ({ ...l, user_email: emailMap[l.user_id] ?? "—" }));

      return new Response(JSON.stringify({ logs: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= LIST ADMIN LOGS (only super admin actions, with email) =============
    if (action === "list_admin_logs") {
      // Get all super admin user_ids
      const { data: saNivel } = await supabaseAdmin.from("niveis_permissao").select("id").eq("nome", "Super Admin").single();
      const { data: saProfiles } = await supabaseAdmin.from("profiles").select("user_id").eq("nivel_permissao_id", saNivel?.id);
      const adminIds = (saProfiles ?? []).map((p) => p.user_id);

      let query = supabaseAdmin
        .from("historico_sistema")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);

      if (adminIds.length > 0) {
        query = query.in("user_id", adminIds);
      }

      const { data: logs } = await query;

      // Enrich with emails
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const emailMap: Record<string, string> = {};
      for (const u of users ?? []) emailMap[u.id] = u.email ?? "—";

      const enriched = (logs ?? []).map((l) => ({
        ...l,
        user_email: emailMap[l.user_id] ?? "—",
        target_email: l.contexto?.target_email ?? null,
      }));

      return new Response(JSON.stringify({ logs: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= LIST SUBSCRIPTIONS (Stripe) =============
    if (action === "list_subscriptions") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) return new Response(JSON.stringify({ subscriptions: [] }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

      const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
      const subs = await stripe.subscriptions.list({ status: "all", limit: 100, expand: ["data.customer"] });

      const result = subs.data.map((s: Stripe.Subscription) => {
        const customer = typeof s.customer === "object" ? s.customer : null;
        const item = s.items.data[0];
        return {
          id: s.id,
          status: s.status,
          customer_email: (customer as any)?.email ?? null,
          customer_name: (customer as any)?.name ?? null,
          customer_id: typeof s.customer === "string" ? s.customer : (s.customer as any)?.id,
          product_id: item?.price?.product as string,
          price_id: item?.price?.id,
          amount: item?.price?.unit_amount ?? 0,
          interval: item?.price?.recurring?.interval ?? null,
          interval_count: item?.price?.recurring?.interval_count ?? 1,
          current_period_end: s.current_period_end ? new Date(s.current_period_end * 1000).toISOString() : null,
          trial_end: s.trial_end ? new Date(s.trial_end * 1000).toISOString() : null,
          cancel_at_period_end: s.cancel_at_period_end,
          canceled_at: s.canceled_at ? new Date(s.canceled_at * 1000).toISOString() : null,
          created: new Date(s.created * 1000).toISOString(),
        };
      });

      return new Response(JSON.stringify({ subscriptions: result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= INTEGRATIONS HEALTH =============
    if (action === "integrations_health") {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      const pluggyClientId = Deno.env.get("PLUGGY_CLIENT_ID");
      const clicksignToken = Deno.env.get("CLICKSIGN_API_TOKEN");

      // Stripe webhooks
      const { data: stripeHooks } = await supabaseAdmin
        .from("stripe_webhooks_log")
        .select("processed, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      const stripeFailed = (stripeHooks ?? []).filter((h) => !h.processed || h.error_message).length;

      // Pluggy webhooks
      const { data: pluggyHooks } = await supabaseAdmin
        .from("pluggy_webhooks_log")
        .select("processed, error_message, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      const pluggyFailed = (pluggyHooks ?? []).filter((h) => !h.processed || h.error_message).length;

      let stripeStatus: "ok" | "warn" | "error" | "not_configured" = "not_configured";
      if (stripeKey) {
        try {
          const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
          await stripe.products.list({ limit: 1 });
          stripeStatus = stripeFailed > 5 ? "warn" : "ok";
        } catch {
          stripeStatus = "error";
        }
      }

      return new Response(JSON.stringify({
        stripe: {
          status: stripeStatus,
          configured: !!stripeKey,
          recent_webhooks: stripeHooks?.length ?? 0,
          failed_webhooks: stripeFailed,
        },
        pluggy: {
          status: !pluggyClientId ? "not_configured" : (pluggyFailed > 5 ? "warn" : "ok"),
          configured: !!pluggyClientId,
          recent_webhooks: pluggyHooks?.length ?? 0,
          failed_webhooks: pluggyFailed,
        },
        clicksign: {
          status: !clicksignToken ? "not_configured" : "ok",
          configured: !!clicksignToken,
        },
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ============= LIST DELETION REQUESTS =============
    if (action === "list_deletion_requests") {
      const { data: logs } = await supabaseAdmin
        .from("historico_sistema")
        .select("*")
        .eq("evento", "conta.exclusao_solicitada")
        .order("created_at", { ascending: false })
        .limit(100);

      // Enrich with user emails and check if account still exists
      const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      const enriched = (logs ?? []).map((l) => {
        const userExists = users?.some((u) => u.id === l.user_id);
        return {
          ...l,
          user_email: l.contexto?.email ?? users?.find((u) => u.id === l.user_id)?.email ?? "—",
          status: userExists ? "pending" : "completed",
        };
      });

      return new Response(JSON.stringify({ requests: enriched }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= LIST PLAN OVERRIDES =============
    if (action === "list_plan_overrides") {
      const { data: overrides } = await supabaseAdmin.from("plan_overrides").select("*");
      return new Response(JSON.stringify({ overrides: overrides ?? [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= UPSERT PLAN OVERRIDE =============
    if (action === "upsert_plan_override") {
      const { product_id, display_name, tagline, description, features, highlight } = body;
      if (!product_id) {
        return new Response(JSON.stringify({ error: "product_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { error } = await supabaseAdmin.from("plan_overrides").upsert({
        product_id, display_name, tagline, description, features: features ?? [], highlight: !!highlight,
      }, { onConflict: "product_id" });
      if (error) throw error;

      await logAdminAction("admin.plano_editado", `Plano ${display_name || product_id} editado pelo admin`, { product_id });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= TOGGLE / UPDATE / DELETE USERS & COMPANIES =============
    if (action === "toggle_user_active") {
      const { user_id, ativo } = body;
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Não pode desativar a si mesmo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("profiles").update({ ativo }).eq("user_id", user_id);
      const { data: { user: target } } = await supabaseAdmin.auth.admin.getUserById(user_id);
      await logAdminAction(
        ativo ? "admin.usuario_ativado" : "admin.usuario_desativado",
        `Usuário ${target?.email ?? user_id} ${ativo ? "ativado" : "desativado"}`,
        { target_user_id: user_id, target_email: target?.email }
      );
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_user") {
      const { user_id, nome, cpf, telefone, data_nascimento, nivel_permissao_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updateData: Record<string, any> = {};
      if (nome !== undefined) updateData.nome = nome;
      if (cpf !== undefined) updateData.cpf = cpf;
      if (telefone !== undefined) updateData.telefone = telefone;
      if (data_nascimento !== undefined) updateData.data_nascimento = data_nascimento;
      if (nivel_permissao_id !== undefined) updateData.nivel_permissao_id = nivel_permissao_id;

      const { error } = await supabaseAdmin.from("profiles").update(updateData).eq("user_id", user_id);
      if (error) throw error;

      const { data: { user: target } } = await supabaseAdmin.auth.admin.getUserById(user_id);
      await logAdminAction("admin.usuario_editado", `Usuário ${target?.email ?? user_id} editado`, { target_user_id: user_id, target_email: target?.email });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_user") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Não pode excluir a si mesmo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: { user: target } } = await supabaseAdmin.auth.admin.getUserById(user_id);
      const targetEmail = target?.email;
      const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
      if (error) throw error;

      await logAdminAction("admin.usuario_excluido", `Usuário ${targetEmail ?? user_id} excluído`, { target_user_id: user_id, target_email: targetEmail });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_company") {
      const {
        empresa_id, razao_social, nome_fantasia, cnpj, email, telefone,
        inscricao_estadual, inscricao_municipal, cep, logradouro, bairro, cidade, estado, observacoes,
      } = body;
      if (!empresa_id) {
        return new Response(JSON.stringify({ error: "empresa_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const updateData: Record<string, any> = {};
      if (razao_social !== undefined) updateData.razao_social = razao_social;
      if (nome_fantasia !== undefined) updateData.nome_fantasia = nome_fantasia;
      if (cnpj !== undefined) updateData.cnpj = cnpj;
      if (email !== undefined) updateData.email = email;
      if (telefone !== undefined) updateData.telefone = telefone;
      if (inscricao_estadual !== undefined) updateData.inscricao_estadual = inscricao_estadual;
      if (inscricao_municipal !== undefined) updateData.inscricao_municipal = inscricao_municipal;
      if (cep !== undefined) updateData.cep = cep;
      if (logradouro !== undefined) updateData.logradouro = logradouro;
      if (bairro !== undefined) updateData.bairro = bairro;
      if (cidade !== undefined) updateData.cidade = cidade;
      if (estado !== undefined) updateData.estado = estado;
      if (observacoes !== undefined) updateData.observacoes = observacoes;

      const { error } = await supabaseAdmin.from("empresas").update(updateData).eq("id", empresa_id);
      if (error) throw error;

      await logAdminAction("admin.empresa_editada", `Empresa ${nome_fantasia || razao_social || empresa_id} editada`, { empresa_id });

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_company_active") {
      const { empresa_id, ativo } = body;
      if (!empresa_id || typeof ativo !== "boolean") {
        return new Response(JSON.stringify({ error: "Parâmetros inválidos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: emp } = await supabaseAdmin
        .from("empresas")
        .select("razao_social, nome_fantasia, user_id")
        .eq("id", empresa_id)
        .single();

      // Update empresa
      const { error: empErr } = await supabaseAdmin
        .from("empresas")
        .update({ ativo })
        .eq("id", empresa_id);
      if (empErr) throw empErr;

      // Cascade: ativar/inativar todos os perfis vinculados (membros e o próprio dono)
      await supabaseAdmin.from("profiles").update({ ativo }).eq("empresa_id", empresa_id);
      if (emp?.user_id) {
        await supabaseAdmin.from("profiles").update({ ativo }).eq("user_id", emp.user_id);
      }

      // Cascade adicional: ao INATIVAR, desabilitar tudo que pode "continuar rodando"
      // sozinho mesmo com a empresa inativa (integrações, automações, regras, etc.)
      const cascadeStats: Record<string, number> = {};

      if (!ativo) {
        // Tabelas com flag `ativo` vinculadas por empresa_id que devem ser desligadas
        const cascadeTables = [
          "integracoes_credenciais", // Asaas, ClickSign, Pluggy creds (interrompe webhooks/cobranças)
          "automacoes",              // motor de automações por gatilho
          "dre_regras",              // regras automáticas de classificação
          "automacao_gatilhos",
          "automacao_acoes_tipo",
        ];
        for (const tbl of cascadeTables) {
          const { count, error } = await supabaseAdmin
            .from(tbl)
            .update({ ativo: false }, { count: "exact" })
            .eq("empresa_id", empresa_id)
            .eq("ativo", true);
          if (!error) cascadeStats[tbl] = count ?? 0;
        }

        // Pluggy: conexões bancárias rodam por user_id (não empresa_id).
        // Marca como "disabled" para impedir auto-sync de continuar puxando dados.
        if (emp?.user_id) {
          const { count: pluggyCount } = await supabaseAdmin
            .from("pluggy_connections")
            .update({ status: "disabled" }, { count: "exact" })
            .eq("user_id", emp.user_id)
            .neq("status", "disabled");
          cascadeStats["pluggy_connections"] = pluggyCount ?? 0;
        }
      } else {
        // Ao REATIVAR: religar apenas integrações de credenciais (não reativa
        // automações/regras automaticamente — o usuário precisa revisar antes)
        const { count } = await supabaseAdmin
          .from("integracoes_credenciais")
          .update({ ativo: true }, { count: "exact" })
          .eq("empresa_id", empresa_id)
          .eq("ativo", false);
        cascadeStats["integracoes_credenciais"] = count ?? 0;
      }

      await logAdminAction(
        ativo ? "admin.empresa_ativada" : "admin.empresa_inativada",
        `Empresa ${emp?.nome_fantasia || emp?.razao_social || empresa_id} ${ativo ? "reativada" : "inativada"} (cascade em usuários, integrações e automações)`,
        { empresa_id, cascade: cascadeStats }
      );

      return new Response(JSON.stringify({ success: true, cascade: cascadeStats }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete_company") {
      const { empresa_id } = body;
      if (!empresa_id) {
        return new Response(JSON.stringify({ error: "empresa_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: emp } = await supabaseAdmin
        .from("empresas")
        .select("razao_social, nome_fantasia, user_id, cnpj")
        .eq("id", empresa_id)
        .single();

      // 1) Coletar todos user_ids vinculados à empresa (dono + membros)
      const userIdsToDelete = new Set<string>();
      if (emp?.user_id) userIdsToDelete.add(emp.user_id);
      const { data: linkedProfiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id")
        .eq("empresa_id", empresa_id);
      for (const p of linkedProfiles ?? []) {
        if (p.user_id) userIdsToDelete.add(p.user_id);
      }
      // Nunca excluir o próprio admin que executa a ação (proteção)
      userIdsToDelete.delete(caller.id);

      // Coletar emails antes para log
      const userEmails: string[] = [];
      for (const uid of userIdsToDelete) {
        const { data: { user: u } } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (u?.email) userEmails.push(u.email);
      }

      // 2a) Limpar tabelas Pluggy (referenciam por user_id, não empresa_id)
      const pluggyUserIds = new Set<string>(userIdsToDelete);
      if (emp?.user_id) pluggyUserIds.add(emp.user_id); // dono mesmo se for o caller
      const pluggyTables = [
        "pluggy_transactions",
        "pluggy_investments",
        "pluggy_bank_accounts",
        "pluggy_connections",
      ];
      for (const tbl of pluggyTables) {
        for (const uid of pluggyUserIds) {
          const { error: delErr } = await supabaseAdmin.from(tbl).delete().eq("user_id", uid);
          if (delErr && delErr.code !== "42P01") {
            console.error(`Erro ao limpar ${tbl} para user ${uid}:`, delErr);
          }
        }
      }

      // 2b) Cascade delete de todas as tabelas que referenciam empresa_id
      const dependentTables = [
        "cash_transactions",
        "cashflow_forecasts",
        "cashflow_imports",
        "manual_bank_transactions",
        "asaas_cobrancas",
        "clicksign_documentos",
        "cliente_documentos",
        "cliente_interacoes",
        "cliente_interacao_tipos",
        "accounts_payable",
        "accounts_receivable",
        "dre_regras",
        "categorias_financeiras",
        "categorias_cadastro",
        "centros_custo",
        "formas_pagamento",
        "tipos_forma_pagamento",
        "bancos",
        "contas_bancarias",
        "produtos",
        "colaboradores",
        "fornecedores",
        "clientes",
        "automacoes",
        "automacao_acoes_tipo",
        "automacao_gatilhos",
        "notificacoes_sistema",
        "historico_sistema",
        "integracoes_credenciais",
        "user_permissions",
        "menu_permissions",
        "menus",
        "profiles",
      ];

      for (const tbl of dependentTables) {
        const { error: delErr } = await supabaseAdmin.from(tbl).delete().eq("empresa_id", empresa_id);
        if (delErr && delErr.code !== "42P01") {
          console.error(`Erro ao limpar ${tbl}:`, delErr);
        }
      }

      // 3) Excluir a empresa
      const { error } = await supabaseAdmin.from("empresas").delete().eq("id", empresa_id);
      if (error) throw error;

      // 4) Excluir os usuários do auth (depois de limpar profiles para evitar FK)
      const deletedUsers: string[] = [];
      const failedUsers: { user_id: string; error: string }[] = [];
      for (const uid of userIdsToDelete) {
        const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(uid);
        if (authErr) {
          failedUsers.push({ user_id: uid, error: authErr.message });
          console.error(`Falha ao excluir auth user ${uid}:`, authErr);
        } else {
          deletedUsers.push(uid);
        }
      }

      await logAdminAction(
        "admin.empresa_excluida",
        `Empresa ${emp?.nome_fantasia || emp?.razao_social || empresa_id} excluída (${deletedUsers.length} usuário(s) removido(s))`,
        {
          empresa_id,
          empresa_cnpj: emp?.cnpj,
          empresa_nome: emp?.nome_fantasia || emp?.razao_social,
          deleted_user_ids: deletedUsers,
          deleted_user_emails: userEmails,
          failed_user_deletions: failedUsers,
        }
      );

      return new Response(JSON.stringify({
        success: true,
        deleted_users: deletedUsers.length,
        failed_users: failedUsers.length,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= CREATE SUPER ADMIN (do zero, sem onboarding de empresa) =============
    if (action === "create_super_admin") {
      const { email, password, nome } = body;
      if (!email || !password || !nome) {
        return new Response(JSON.stringify({ error: "email, password e nome são obrigatórios" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (typeof password !== "string" || password.length < 8) {
        return new Response(JSON.stringify({ error: "Senha deve ter pelo menos 8 caracteres" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get Super Admin level id
      const { data: saNivel } = await supabaseAdmin
        .from("niveis_permissao").select("id").eq("nome", "Super Admin").single();
      if (!saNivel?.id) {
        return new Response(JSON.stringify({ error: "Nível 'Super Admin' não encontrado no sistema" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create auth user (email already confirmed, no onboarding needed)
      const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: nome },
      });
      if (createErr) {
        const msg = createErr.message?.includes("already been registered")
          ? "Este e-mail já está cadastrado"
          : createErr.message;
        return new Response(JSON.stringify({ error: msg }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Promote profile to Super Admin (handle_new_user trigger criou perfil como Admin)
      const { error: profErr } = await supabaseAdmin
        .from("profiles")
        .update({ nome, nivel_permissao_id: saNivel.id, ativo: true })
        .eq("user_id", created.user.id);
      if (profErr) {
        // Rollback auth user on failure
        await supabaseAdmin.auth.admin.deleteUser(created.user.id);
        throw profErr;
      }

      await logAdminAction(
        "admin.super_admin_criado",
        `Novo Super Admin criado: ${email}`,
        { target_user_id: created.user.id, target_email: email, target_nome: nome }
      );

      return new Response(JSON.stringify({ success: true, user_id: created.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============= PROMOTE EXISTING USER TO SUPER ADMIN =============
    if (action === "promote_to_super_admin") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id obrigatório" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: saNivel } = await supabaseAdmin
        .from("niveis_permissao").select("id").eq("nome", "Super Admin").single();
      if (!saNivel?.id) {
        return new Response(JSON.stringify({ error: "Nível 'Super Admin' não encontrado" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ nivel_permissao_id: saNivel.id, ativo: true })
        .eq("user_id", user_id);
      if (error) throw error;

      const { data: { user: target } } = await supabaseAdmin.auth.admin.getUserById(user_id);
      await logAdminAction(
        "admin.super_admin_promovido",
        `Usuário ${target?.email ?? user_id} promovido a Super Admin`,
        { target_user_id: user_id, target_email: target?.email }
      );

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "request_account_deletion") {
      await supabaseAdmin.from("historico_sistema").insert({
        user_id: caller.id,
        evento: "conta.exclusao_solicitada",
        descricao: `Usuário ${caller.email} solicitou exclusão total da conta e empresa.`,
        contexto: { email: caller.email, requested_at: new Date().toISOString() },
      });

      const { data: superAdminNivel } = await supabaseAdmin
        .from("niveis_permissao").select("id").eq("nome", "Super Admin").single();

      if (superAdminNivel) {
        const { data: superAdminProfiles } = await supabaseAdmin
          .from("profiles").select("user_id").eq("nivel_permissao_id", superAdminNivel.id);

        for (const sa of superAdminProfiles ?? []) {
          await supabaseAdmin.from("notificacoes_sistema").insert({
            user_id: sa.user_id,
            titulo: "Solicitação de exclusão de conta",
            descricao: `O usuário ${caller.email} solicitou a exclusão total da sua conta e empresa vinculada.`,
            tipo: "alerta",
          });
        }
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    // Extract a useful message from Error, PostgrestError, or any object
    let msg = "Erro interno";
    if (error instanceof Error) {
      msg = error.message;
    } else if (error && typeof error === "object") {
      msg = error.message || error.error_description || error.error || error.details || error.hint || JSON.stringify(error);
    } else {
      msg = String(error);
    }
    console.error("[admin-dashboard] error:", msg, error);
    return new Response(JSON.stringify({ error: msg, details: error?.details ?? null, hint: error?.hint ?? null, code: error?.code ?? null }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
