import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, stripe-signature",
};

const log = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[STRIPE-WEBHOOK] ${step}${d}`);
};

const stripeKey = Deno.env.get("STRIPE_SECRET_KEY")!;
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET")!;
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  { auth: { persistSession: false } }
);
const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

async function upsertSubscription(sub: Stripe.Subscription, customerEmail: string, customerId: string) {
  // Encontra user_id pelo email
  const { data: userData } = await supabase.auth.admin.listUsers();
  const user = userData.users.find((u) => u.email?.toLowerCase() === customerEmail.toLowerCase());
  if (!user) {
    log("User not found for email", { email: customerEmail });
    return;
  }

  const item = sub.items.data[0];
  const payload = {
    user_id: user.id,
    email: customerEmail,
    stripe_customer_id: customerId,
    stripe_subscription_id: sub.id,
    status: sub.status,
    product_id: typeof item.price.product === "string" ? item.price.product : item.price.product.id,
    price_id: item.price.id,
    current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
    trial_end: sub.trial_end ? new Date(sub.trial_end * 1000).toISOString() : null,
    cancel_at_period_end: sub.cancel_at_period_end,
    last_synced_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from("subscribers")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    log("Upsert error", { error: error.message });
    throw error;
  }
  log("Subscription upserted", { userId: user.id, status: sub.status });
}

async function clearSubscription(customerId: string) {
  const { error } = await supabase
    .from("subscribers")
    .update({
      status: "canceled",
      cancel_at_period_end: false,
      stripe_subscription_id: null,
      last_synced_at: new Date().toISOString(),
    })
    .eq("stripe_customer_id", customerId);
  if (error) log("Clear error", { error: error.message });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing signature", { status: 400, headers: corsHeaders });
  }

  const body = await req.text();
  let event: Stripe.Event;

  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("Signature verification failed", { error: msg });
    return new Response(`Webhook Error: ${msg}`, { status: 400, headers: corsHeaders });
  }

  log("Event received", { type: event.type, id: event.id });

  // Idempotência
  const { data: existing } = await supabase
    .from("stripe_webhooks_log")
    .select("id, processed")
    .eq("stripe_event_id", event.id)
    .maybeSingle();

  if (existing?.processed) {
    log("Event already processed", { id: event.id });
    return new Response(JSON.stringify({ received: true, duplicate: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  }

  await supabase.from("stripe_webhooks_log").upsert(
    {
      stripe_event_id: event.id,
      event_type: event.type,
      payload: event as any,
      processed: false,
    },
    { onConflict: "stripe_event_id" }
  );

  try {
    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.trial_will_end": {
        const sub = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(sub.customer as string);
        if (!customer.deleted && customer.email) {
          await upsertSubscription(sub, customer.email, customer.id);
        }
        break;
      }
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        await clearSubscription(sub.customer as string);
        break;
      }
      case "invoice.payment_succeeded":
      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const sub = await stripe.subscriptions.retrieve(invoice.subscription as string);
          const customer = await stripe.customers.retrieve(sub.customer as string);
          if (!customer.deleted && customer.email) {
            await upsertSubscription(sub, customer.email, customer.id);
          }
        }
        break;
      }
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.subscription && session.customer) {
          const sub = await stripe.subscriptions.retrieve(session.subscription as string);
          const customer = await stripe.customers.retrieve(session.customer as string);
          if (!customer.deleted && customer.email) {
            await upsertSubscription(sub, customer.email, customer.id);
          }
        }
        break;
      }
      default:
        log("Unhandled event type", { type: event.type });
    }

    await supabase
      .from("stripe_webhooks_log")
      .update({ processed: true })
      .eq("stripe_event_id", event.id);

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("Handler error", { error: msg });
    await supabase
      .from("stripe_webhooks_log")
      .update({ processed: false, error_message: msg })
      .eq("stripe_event_id", event.id);
    return new Response(JSON.stringify({ error: 'Erro interno ao processar evento.' }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
