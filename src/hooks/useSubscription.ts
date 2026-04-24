import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Stripe product/price mapping
export const PLANS = {
  starter: {
    product_id: "prod_UHtoiqW7tWCPEF",
    prices: {
      monthly: "price_1TJK26J633HWAlBjHR1tEWyb",
      semiannual: "price_1TJK26J633HWAlBjBun9T8gT",
      annual: "price_1TJK26J633HWAlBjaFb2ySqb",
    },
    name: "Starter",
    monthlyPrice: 399_00,
  },
  pro: {
    product_id: "prod_UHto1LvIJ2L5Vs",
    prices: {
      monthly: "price_1TJK26J633HWAlBj9gwdwI7Q",
      semiannual: "price_1TJK26J633HWAlBjzRgeoqdN",
      annual: "price_1TJK26J633HWAlBjKlxdA4bG",
    },
    name: "Pro",
    monthlyPrice: 699_00,
  },
  enterprise: {
    product_id: "prod_UHtoPH8PsTd5jB",
    prices: {
      monthly: "price_1TJK26J633HWAlBjs7tMsyEq",
      semiannual: "price_1TJK26J633HWAlBj1pB3wcUf",
      annual: "price_1TJK26J633HWAlBj9KAK9urd",
    },
    name: "Enterprise",
    monthlyPrice: 999_00,
  },
} as const;

export type PlanKey = keyof typeof PLANS;

export function getPlanByProductId(productId: string): PlanKey | null {
  for (const [key, plan] of Object.entries(PLANS)) {
    if (plan.product_id === productId) return key as PlanKey;
  }
  return null;
}

export type SubscriptionStatus =
  | "active"
  | "trialing"
  | "complimentary"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "incomplete"
  | "incomplete_expired"
  | "paused"
  | null;

interface SubscriptionData {
  subscribed: boolean;
  status: SubscriptionStatus;
  product_id: string | null;
  price_id: string | null;
  subscription_end: string | null;
  trial_end: string | null;
  cancel_at_period_end: boolean;
  is_member?: boolean;
}

export function useSubscription() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user,
    refetchInterval: 60_000,
    queryFn: async (): Promise<SubscriptionData> => {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      return data as SubscriptionData;
    },
  });

  const currentPlan = data?.product_id ? getPlanByProductId(data.product_id) : null;
  const status = data?.status ?? null;
  const isMember = data?.is_member ?? false;
  const hasAccess = status === "active" || status === "trialing" || status === "complimentary";

  const blockReason:
    | "no_subscription"
    | "owner_no_subscription"
    | "past_due"
    | "canceled"
    | "trial_expired"
    | "incomplete"
    | null =
    hasAccess
      ? null
      : status === "past_due" || status === "unpaid"
      ? "past_due"
      : status === "canceled"
      ? "canceled"
      : status === "incomplete" || status === "incomplete_expired"
      ? "incomplete"
      : !status
      ? (isMember ? "owner_no_subscription" : "no_subscription")
      : "trial_expired";

  return {
    subscribed: data?.subscribed ?? false,
    status,
    isMember,
    isComplimentary: status === "complimentary",
    isTrialing: status === "trialing",
    hasAccess,
    blockReason,
    currentPlan,
    productId: data?.product_id ?? null,
    priceId: data?.price_id ?? null,
    subscriptionEnd: data?.subscription_end ?? null,
    trialEnd: data?.trial_end ?? null,
    cancelAtPeriodEnd: data?.cancel_at_period_end ?? false,
    isLoading,
    refetch,
  };
}
