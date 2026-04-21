import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Map product IDs to plan keys and features
const PLAN_META: Record<string, { key: string; order: number; features: string[] }> = {
  "prod_UHtoiqW7tWCPEF": {
    key: "starter",
    order: 0,
    features: [
      "Até 3 usuários",
      "1 empresa",
      "Módulos básicos",
      "Suporte por e-mail",
    ],
  },
  "prod_UHto1LvIJ2L5Vs": {
    key: "pro",
    order: 1,
    features: [
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
    features: [
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

    const productIds = Object.keys(PLAN_META);

    // Fetch all active prices for our products
    const prices = await stripe.prices.list({
      active: true,
      expand: ["data.product"],
      limit: 100,
    });

    const plans = productIds.map((productId) => {
      const meta = PLAN_META[productId];
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

      // Trial dinâmico: prioriza Price.recurring.trial_period_days do plano mensal,
      // depois product.metadata.trial_period_days, e por fim fallback de 7 dias
      const priceTrial = monthly?.recurring?.trial_period_days
        ?? semiannual?.recurring?.trial_period_days
        ?? annual?.recurring?.trial_period_days;
      const metaTrial = product?.metadata?.trial_period_days
        ? parseInt(product.metadata.trial_period_days, 10)
        : NaN;
      const trialDays = (typeof priceTrial === "number" && priceTrial > 0)
        ? priceTrial
        : (!isNaN(metaTrial) && metaTrial > 0 ? metaTrial : 7);

      return {
        key: meta.key,
        order: meta.order,
        product_id: productId,
        name: product?.name || meta.key,
        description: product?.description || "",
        features: meta.features,
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
