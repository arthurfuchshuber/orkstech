import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

/**
 * Detecta valores "órfãos" — lançamentos cujo `bank_account_id` ficou NULL
 * porque a conta bancária/cartão foi excluída (ON DELETE SET NULL).
 *
 * Retorna o saldo líquido órfão (entradas - saídas) em cash_transactions
 * e contagens auxiliares em accounts_payable/receivable pagos sem conta.
 */
export function useOrfaosFinanceiros() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const empresaId = empresa?.id;

  return useQuery({
    queryKey: ["orfaos-financeiros", targetUserId, empresaId],
    enabled: !!targetUserId,
    queryFn: async () => {
      // cash_transactions órfãos (não internas, ainda não realocadas)
      let q = supabase
        .from("cash_transactions")
        .select("id, amount, type, description, transaction_date, is_internal_transfer")
        .is("bank_account_id", null)
        .eq("is_internal_transfer", false);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      else q = q.eq("user_id", targetUserId!);
      const { data: txs, error } = await q;
      if (error) throw error;

      const lancamentos = (txs ?? []) as any[];
      const saldoLiquido = lancamentos.reduce((sum, t) => {
        const v = Number(t.amount || 0);
        return sum + (t.type === "income" ? v : -v);
      }, 0);

      // payables/receivables pagos sem conta (informativo apenas)
      let pq = supabase
        .from("accounts_payable")
        .select("id, amount, description, payment_date")
        .is("bank_account_id", null)
        .eq("status", "paid");
      if (empresaId) pq = pq.eq("empresa_id", empresaId);
      else pq = pq.eq("user_id", targetUserId!);
      const { data: payables } = await pq;

      let rq = supabase
        .from("accounts_receivable")
        .select("id, amount, description, payment_date")
        .is("bank_account_id", null)
        .eq("status", "paid");
      if (empresaId) rq = rq.eq("empresa_id", empresaId);
      else rq = rq.eq("user_id", targetUserId!);
      const { data: receivables } = await rq;

      const totalAbsoluto = lancamentos.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);

      return {
        lancamentos,
        payablesOrfaos: payables ?? [],
        receivablesOrfaos: receivables ?? [],
        saldoLiquido,
        totalAbsoluto,
        temOrfaos: lancamentos.length > 0 || (payables?.length ?? 0) > 0 || (receivables?.length ?? 0) > 0,
        totalCount: lancamentos.length + (payables?.length ?? 0) + (receivables?.length ?? 0),
      };
    },
  });
}
