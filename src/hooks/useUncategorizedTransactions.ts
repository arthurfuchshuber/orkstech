import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEmpresa } from "./useEmpresa";

/**
 * Conta transações Pluggy sem categoria DRE (excluindo transferências internas).
 * Também dispara notificação no sino do usuário (deduplicada) para máxima visibilidade.
 */
export function useUncategorizedTransactions() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const notifiedRef = useRef<string | null>(null);

  const { data: count = 0, isLoading } = useQuery({
    queryKey: ["uncategorized_tx_count", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "contar_transacoes_sem_categoria" as any,
        { p_user_id: targetUserId }
      );
      if (error) throw error;
      return (data as number) ?? 0;
    },
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Dispara notificação no sino (1x por sessão por user, deduplicada no DB)
  useEffect(() => {
    if (!targetUserId || count === 0) return;
    if (notifiedRef.current === targetUserId) return;
    notifiedRef.current = targetUserId;
    supabase.rpc("notificar_transacoes_sem_categoria" as any, {
      p_user_id: targetUserId,
    }).then(() => {
      // silencioso
    });
  }, [targetUserId, count]);

  return { count, isLoading };
}
