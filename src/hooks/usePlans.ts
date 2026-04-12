import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanPrice {
  id: string;
  amount: number; // cents
}

export interface Plan {
  key: string;
  product_id: string;
  name: string;
  description: string;
  features: string[];
  prices: {
    monthly: PlanPrice | null;
    semiannual: PlanPrice | null;
    annual: PlanPrice | null;
  };
}

export type BillingInterval = "monthly" | "semiannual" | "annual";

export function usePlans() {
  return useQuery({
    queryKey: ["stripe-plans"],
    staleTime: 5 * 60 * 1000, // cache 5 min
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase.functions.invoke("list-plans");
      if (error) throw error;
      return data.plans as Plan[];
    },
  });
}
