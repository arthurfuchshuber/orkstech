import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "./useEmpresa";
import { useAuth } from "./useAuth";

export type OnboardingStepKey =
  | "empresa"
  | "conta"
  | "saldo"
  | "centro_custo"
  | "categoria"
  | "forma_pagamento"
  | "cliente"
  | "fornecedor"
  | "lancamento";

export interface OnboardingStatus {
  wizard_completed_at: string | null;
  checklist_dismissed: boolean;
  steps: Record<OnboardingStepKey, boolean>;
}

export function useOnboarding() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  const empresaId = empresa?.id ?? null;

  const query = useQuery({
    queryKey: ["onboarding-status", user?.id, empresaId],
    enabled: !!user && !!empresaId,
    refetchOnWindowFocus: false,
    queryFn: async (): Promise<OnboardingStatus | null> => {
      if (!empresaId) return null;
      const { data, error } = await supabase.rpc("get_onboarding_status", { _empresa_id: empresaId });
      if (error) throw error;
      return data as unknown as OnboardingStatus;
    },
  });

  const completeWizard = useMutation({
    mutationFn: async () => {
      if (!empresaId) return;
      const { error } = await supabase.rpc("marcar_wizard_concluido", { _empresa_id: empresaId });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-status"] }),
  });

  const dismissChecklist = useMutation({
    mutationFn: async (dismiss: boolean = true) => {
      if (!empresaId) return;
      const { error } = await supabase.rpc("dispensar_checklist_onboarding", {
        _empresa_id: empresaId,
        _dismiss: dismiss,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["onboarding-status"] }),
  });

  const status = query.data ?? null;
  const steps = status?.steps;
  const totalSteps = steps ? Object.keys(steps).length : 0;
  const doneSteps = steps ? Object.values(steps).filter(Boolean).length : 0;
  const progress = totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 0;
  const isComplete = totalSteps > 0 && doneSteps === totalSteps;

  return {
    status,
    steps,
    progress,
    doneSteps,
    totalSteps,
    isComplete,
    isDismissed: !!status?.checklist_dismissed,
    isLoading: query.isLoading,
    completeWizard: completeWizard.mutate,
    dismissChecklist: dismissChecklist.mutate,
    refetch: query.refetch,
  };
}
