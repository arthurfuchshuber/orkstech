import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map product IDs to plan keys and DEFAULT features (overridable via plan_overrides table)
const PLAN_META: Record<string, { key: string; order: number; defaultFeatures: string[]; defaultTagline: string }> = {
  "prod_UHtoiqW7tWCPEF": {
    key: "starter",
    order: 0,
    defaultTagline: "Para pequenos negócios começando a organizar a operação.",
    defaultFeatures: [
      "Até 3 usuários",
      "1 empresa",
      "Módulos básicos",
      "Suporte por e-mail",
    ],
  },
  "prod_UHto1LvIJ2L5Vs": {
    key: "pro",
    order: 1,
    defaultTagline: "Para empresas em crescimento que precisam de tudo integrado.",
    defaultFeatures: [
      "Até 10 usuários",
      "1 empresa",
      "Todos os módulos",
      "Integrações bancárias",
      "Suporte prioritário",
    ],
  },
  "prod_UHtoPH8PsTd5jB": {
    key: "enterprise",
    order: 2,
    defaultTagline: "Para operações complexas com múltiplas empresas e times.",
    defaultFeatures: [
      "Usuários ilimitados",
      "Multi-empresa",
      "Todos os módulos",
      "Integrações bancárias",
      "API & Webhooks",
      "Suporte dedicado",
    ],
  },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Load overrides from DB (Super Admin editable)
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );
    const { data: overrides } = await supabase.from("plan_overrides").select("*");
    const overrideMap: Record<string, any> = {};
    for (const o of overrides ?? []) overrideMap[o.product_id] = o;

    const productIds = Object.keys(PLAN_META);

    const prices = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
      limit: 100,
    });

    const plans = productIds.map((productId) => {
      const meta = PLAN_META[productId];
      const override = overrideMap[productId];
      const productPrices = prices.data.filter(
        (p) => (typeof p.product === "string" ? p.product : p.product?.id) === productId
      );

      const monthly = productPrices.find(
        (p) => p.recurring?.interval === "month" && p.recurring?.interval_count === 1
      );
      const semiannual = productPrices.find(
        (p) => p.recurring?.interval === "month" && p.recurring?.interval_count === 6
      );
      const annual = productPrices.find(
        (p) => p.recurring?.interval === "year" && p.recurring?.interval_count === 1
      );

      const product = productPrices.find((p) => typeof p.product === "object")?.product as any;

      const priceTrial = monthly?.recurring?.trial_period_days
        ?? semiannual?.recurring?.trial_period_days
        ?? annual?.recurring?.trial_period_days;
      const metaTrial = product?.metadata?.trial_period_days
        ? parseInt(product.metadata.trial_period_days, 10)
        : NaN;
      const trialDays = (typeof priceTrial === "number" && priceTrial > 0)
        ? priceTrial
        : (!isNaN(metaTrial) && metaTrial > 0 ? metaTrial : 7);

      // Override priority: plan_overrides > Stripe product > defaults
      const features: string[] = Array.isArray(override?.features) && override.features.length > 0
        ? override.features
        : meta.defaultFeatures;

      return {
        key: meta.key,
        order: meta.order,
        product_id: productId,
        name: override?.display_name || product?.name || meta.key,
        tagline: override?.tagline || meta.defaultTagline,
        description: override?.description || product?.description || "",
        features,
        highlight: !!override?.highlight,
        trial_days: trialDays,
        prices: {
          monthly: monthly ? { id: monthly.id, amount: monthly.unit_amount } : null,
          semiannual: semiannual ? { id: semiannual.id, amount: semiannual.unit_amount } : null,
          annual: annual ? { id: annual.id, amount: annual.unit_amount } : null,
        },
      };
    });

    plans.sort((a, b) => a.order - b.order);

    return new Response(JSON.stringify({ plans }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
