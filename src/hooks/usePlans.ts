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
  tagline: string;
  description: string;
  features: string[];
  highlight: boolean;
  /** Trial em dias retornado dinamicamente do Stripe (Price ou Product metadata). */
  trial_days: number;
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
    staleTime: 60 * 1000, // 1 min — overrides may change
    // Mantém o último estado válido enquanto refaz — evita "tela branca" em soluços do Edge Runtime
    placeholderData: (prev) => prev,
    // Tenta novamente até 3x quando o erro é transitório (5xx / runtime indisponível)
    retry: (failureCount, error: any) => {
      const msg = String(error?.message ?? error ?? "");
      const isTransient =
        msg.includes("503") ||
        msg.includes("temporarily unavailable") ||
        msg.includes("SUPABASE_EDGE_RUNTIME_ERROR") ||
        msg.includes("Failed to fetch") ||
        msg.includes("NetworkError");
      return isTransient && failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
    queryFn: async (): Promise<Plan[]> => {
      const { data, error } = await supabase.functions.invoke("list-plans");
      if (error) throw error;
      return data.plans as Plan[];
    },
  });
}
