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
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    log("User authenticated", { userId: user.id });

    // Force refresh: consulta direta ao Stripe e atualiza cache
    const force = new URL(req.url).searchParams.get("force") === "true";

    // 1) Tenta cache primeiro (rápido, sempre disponível)
    const { data: cached } = await supabaseAdmin
      .from("subscribers")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    // ============ TRIAL MANUAL (definido pelo admin) ============
    // Se há um trial manual ativo, ele tem prioridade absoluta sobre o Stripe
    if (cached?.is_manual_trial && cached.trial_end) {
      const trialEndMs = new Date(cached.trial_end).getTime();
      if (trialEndMs > Date.now()) {
        log("Returning manual trial");
        return new Response(
          JSON.stringify({
            subscribed: true,
            status: "trialing",
            product_id: cached.product_id,
            price_id: cached.price_id,
            subscription_end: cached.current_period_end,
            trial_end: cached.trial_end,
            cancel_at_period_end: false,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
        );
      }
      // Trial manual expirado → limpa flag para que Stripe assuma novamente
      await supabaseAdmin
        .from("subscribers")
        .update({ is_manual_trial: false, status: null, last_synced_at: new Date().toISOString() })
        .eq("user_id", user.id);
    }

    // Cache válido se foi sincronizado nos últimos 5 min E não é force
    const cacheValid =
      cached &&
      !force &&
      !cached.is_manual_trial &&
      new Date(cached.last_synced_at).getTime() > Date.now() - 5 * 60 * 1000;

    if (cacheValid) {
      log("Returning cached data");
      return new Response(
        JSON.stringify({
          subscribed: ["active", "trialing"].includes(cached.status ?? ""),
          status: cached.status,
          product_id: cached.product_id,
          price_id: cached.price_id,
          subscription_end: cached.current_period_end,
          trial_end: cached.trial_end,
          cancel_at_period_end: cached.cancel_at_period_end,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    // 2) Sincroniza com Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });

    if (customers.data.length === 0) {
      log("No Stripe customer");
      await supabaseAdmin.from("subscribers").upsert(
        {
          user_id: user.id,
          email: user.email,
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
      return new Response(
        JSON.stringify({
          subscribed: false,
          status: null,
          product_id: null,
          price_id: null,
          subscription_end: null,
          trial_end: null,
          cancel_at_period_end: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const customerId = customers.data[0].id;
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: "all",
      limit: 5,
    });

    // Prioriza ativa/trial; fallback para mais recente
    const sub =
      subscriptions.data.find((s) => ["active", "trialing"].includes(s.status)) ??
      subscriptions.data.find((s) => ["past_due", "unpaid"].includes(s.status)) ??
      subscriptions.data[0];

    if (!sub) {
      await supabaseAdmin.from("subscribers").upsert(
        {
          user_id: user.id,
          email: user.email,
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
      return new Response(
        JSON.stringify({
          subscribed: false,
          status: null,
          product_id: null,
          price_id: null,
          subscription_end: null,
          trial_end: null,
          cancel_at_period_end: false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const item = sub.items.data[0];
    const productId =
      typeof item.price.product === "string" ? item.price.product : item.price.product.id;
    const subEnd = new Date(sub.current_period_end * 1000).toISOString();
    const trialEnd = sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null;

    await supabaseAdmin.from("subscribers").upsert(
      {
        user_id: user.id,
        email: user.email,
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

    return new Response(
      JSON.stringify({
        subscribed: ["active", "trialing"].includes(sub.status),
        status: sub.status,
        product_id: productId,
        price_id: item.price.id,
        subscription_end: subEnd,
        trial_end: trialEnd,
        cancel_at_period_end: sub.cancel_at_period_end,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    log("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
