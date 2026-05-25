import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const log = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION] ${step}${d}`);
};

function jsonResponse(payload: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData?.user?.email) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const user = userData.user;
    log("User authenticated", { userId: user.id });

    // Force refresh: consulta direta ao Stripe e atualiza cache
    const force = new URL(req.url).searchParams.get("force") === "true";

    // ============ DETECTAR SE O CALLER É MEMBRO (não dono) ============
    // Buscar o profile do caller para ver se está vinculado a uma empresa de outro dono
    const { data: callerProfile } = await supabaseAdmin
      .from("profiles")
      .select("empresa_id")
      .eq("user_id", user.id)
      .maybeSingle();

    let ownerUserId: string = user.id;
    let isMember = false;
    let ownerEmail: string = user.email;

    if (callerProfile?.empresa_id) {
      const { data: empresaRow } = await supabaseAdmin
        .from("empresas")
        .select("user_id")
        .eq("id", callerProfile.empresa_id)
        .maybeSingle();
      if (empresaRow?.user_id && empresaRow.user_id !== user.id) {
        // Caller é membro da empresa de outro dono
        ownerUserId = empresaRow.user_id;
        isMember = true;
        const { data: ownerAuth } = await supabaseAdmin.auth.admin.getUserById(ownerUserId);
        if (ownerAuth?.user?.email) ownerEmail = ownerAuth.user.email;
      }
    }

    // 1) Tenta cache do DONO primeiro (rápido, sempre disponível)
    const { data: cached } = await supabaseAdmin
      .from("subscribers")
      .select("*")
      .eq("user_id", ownerUserId)
      .maybeSingle();

    // ============ COMPLIMENTARY (Sem cobranças, definido pelo SaaS admin) ============
    // Tem prioridade absoluta — libera acesso sem precisar de Stripe
    if (cached?.is_complimentary) {
      log("Returning complimentary access");
      return jsonResponse({
        subscribed: true,
        status: "complimentary",
        product_id: null,
        price_id: null,
        subscription_end: null,
        trial_end: null,
        cancel_at_period_end: false,
        is_member: isMember,
      });
    }

    // ============ TRIAL MANUAL (definido pelo admin) ============
    if (cached?.is_manual_trial && cached.trial_end) {
      const trialEndMs = new Date(cached.trial_end).getTime();
      if (trialEndMs > Date.now()) {
        log("Returning manual trial");
        return jsonResponse({
          subscribed: true,
          status: "trialing",
          product_id: cached.product_id,
          price_id: cached.price_id,
          subscription_end: cached.current_period_end,
          trial_end: cached.trial_end,
          cancel_at_period_end: false,
          is_member: isMember,
        });
      }
      // Trial manual expirado → limpa flag para que Stripe assuma novamente
      await supabaseAdmin
        .from("subscribers")
        .update({ is_manual_trial: false, status: null, last_synced_at: new Date().toISOString() })
        .eq("user_id", ownerUserId);
    }

    // Cache válido se foi sincronizado nos últimos 5 min E não é force
    const cacheValid =
      cached &&
      !force &&
      !cached.is_manual_trial &&
      new Date(cached.last_synced_at).getTime() > Date.now() - 5 * 60 * 1000;

    if (cacheValid) {
      log("Returning cached data");
      return jsonResponse({
        subscribed: ["active", "trialing"].includes(cached.status ?? ""),
        status: cached.status,
        product_id: cached.product_id,
        price_id: cached.price_id,
        subscription_end: cached.current_period_end,
        trial_end: cached.trial_end,
        cancel_at_period_end: cached.cancel_at_period_end,
        is_member: isMember,
      });
    }

    // 2) Sincroniza com Stripe (sempre olhando o e-mail do DONO)
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: ownerEmail, limit: 1 });

    if (customers.data.length === 0) {
      log("No Stripe customer for owner");
      await supabaseAdmin.from("subscribers").upsert(
        {
          user_id: ownerUserId,
          email: ownerEmail,
          status: null,
          stripe_customer_id: null,
          stripe_subscription_id: null,
          product_id: null,
          price_id: null,
          current_period_end: null,
          trial_end: null,
          cancel_at_period_end: false,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      return jsonResponse({
        subscribed: false,
        status: null,
        product_id: null,
        price_id: null,
        subscription_end: null,
        trial_end: null,
        cancel_at_period_end: false,
        is_member: isMember,
      });
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });

    // Prioriza ativa/trial; fallback para mais recente
    const sub =
      subscriptions.data.find((s: Stripe.Subscription) => ["active", "trialing"].includes(s.status)) ??
      subscriptions.data.find((s: Stripe.Subscription) => ["past_due", "unpaid"].includes(s.status)) ??
      subscriptions.data[0];

    if (!sub) {
      await supabaseAdmin.from("subscribers").upsert(
        {
          user_id: ownerUserId,
          email: ownerEmail,
          stripe_customer_id: customerId,
          stripe_subscription_id: null,
          status: null,
          product_id: null,
          price_id: null,
          current_period_end: null,
          trial_end: null,
          cancel_at_period_end: false,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
      return jsonResponse({
        subscribed: false,
        status: null,
        product_id: null,
        price_id: null,
        subscription_end: null,
        trial_end: null,
        cancel_at_period_end: false,
        is_member: isMember,
      });
    }

    const item = sub.items.data[0];
    const productId =
      typeof item.price.product === "string" ? item.price.product : item.price.product.id;
    const subEnd = new Date(sub.current_period_end * 1000).toISOString();
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;

    await supabaseAdmin.from("subscribers").upsert(
      {
        user_id: ownerUserId,
        email: ownerEmail,
        stripe_customer_id: customerId,
        stripe_subscription_id: sub.id,
        status: sub.status,
        product_id: productId,
        price_id: item.price.id,
        current_period_end: subEnd,
        trial_end: trialEnd,
        cancel_at_period_end: sub.cancel_at_period_end,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "user_id" }
    );

    log("Synced from Stripe", { status: sub.status, subId: sub.id });

    return jsonResponse({
      subscribed: ["active", "trialing"].includes(sub.status),
      status: sub.status,
      product_id: productId,
      price_id: item.price.id,
      subscription_end: subEnd,
      trial_end: trialEnd,
      cancel_at_period_end: sub.cancel_at_period_end,
      is_member: isMember,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
