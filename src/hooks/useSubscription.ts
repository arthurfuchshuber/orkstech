import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

// Stripe product/price mapping
export const PLANS = {
  starter: {
    product_id: "prod_UHtoiqW7tWCPEF",
    prices: {
      monthly: "price_1TJK26J633HWAlBjHR1tEWyb",   // R$ 399/mês
      semiannual: "price_1TJK26J633HWAlBjBun9T8gT", // R$ 2.154/6 meses
      annual: "price_1TJK26J633HWAlBjaFb2ySqb",     // R$ 3.830/ano
    },
    name: "Starter",
    monthlyPrice: 399_00,
  },
  pro: {
    product_id: "prod_UHto1LvIJ2L5Vs",
    prices: {
      monthly: "price_1TJK26J633HWAlBj9gwdwI7Q",   // R$ 699/mês
      semiannual: "price_1TJK26J633HWAlBjzRgeoqdN", // R$ 3.774/6 meses
      annual: "price_1TJK26J633HWAlBjKlxdA4bG",     // R$ 6.710/ano
    },
    name: "Pro",
    monthlyPrice: 699_00,
  },
  enterprise: {
    product_id: "prod_UHtoPH8PsTd5jB",
    prices: {
      monthly: "price_1TJK26J633HWAlBjs7tMsyEq",   // R$ 999/mês
      semiannual: "price_1TJK26J633HWAlBj1pB3wcUf", // R$ 5.394/6 meses
      annual: "price_1TJK26J633HWAlBj9KAK9urd",     // R$ 9.590/ano
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

interface SubscriptionData {
  subscribed: boolean;
  product_id: string | null;
  price_id: string | null;
  subscription_end: string | null;
}

export function useSubscription() {
  const { user } = useAuth();

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["subscription", user?.id],
    enabled: !!user,
    refetchInterval: 60_000, // every minute
    queryFn: async (): Promise<SubscriptionData> => {
      const { data, error } = await supabase.functions.invoke("check-subscription");
      if (error) throw error;
      return data as SubscriptionData;
    },
  });

  const currentPlan = data?.product_id ? getPlanByProductId(data.product_id) : null;

  return {
    subscribed: data?.subscribed ?? false,
    currentPlan,
    productId: data?.product_id ?? null,
    priceId: data?.price_id ?? null,
    subscriptionEnd: data?.subscription_end ?? null,
    isLoading,
    refetch,
  };
}
