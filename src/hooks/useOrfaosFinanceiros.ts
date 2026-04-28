import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

/**
 * Detecta TODOS os valores "órfãos" no sistema:
 *  - cash_transactions sem bank_account_id (excluindo transferências internas já realocadas)
 *  - accounts_payable / accounts_receivable pagos sem conta
 *  - contas_bancarias INATIVAS (soft-deleted) com snapshots > 0:
 *      saldo_sincronizado, investimento_sincronizado, fatura_aberto_sincronizada,
 *      limite_credito_disponivel_sincronizado, limite_cheque_especial_sincronizado
 *
 * Retorna o detalhamento por categoria para realocação consciente.
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
      // 1. Cash transactions órfãs (não internas)
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
      const saldoLiquidoLancamentos = lancamentos.reduce((sum, t) => {
        const v = Number(t.amount || 0);
        return sum + (t.type === "income" ? v : -v);
      }, 0);

      // 2. Payables / receivables pagos sem conta (informativo)
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

      // 3. contas_bancarias INATIVAS (soft-deleted) com snapshots
      let cq = supabase
        .from("contas_bancarias")
        .select(
          "id, nome, banco, saldo_inicial, saldo_sincronizado, saldo_ajuste_manual, investimento_sincronizado, investimento_ajuste_manual, saldo_investimento, fatura_aberto_sincronizada, fatura_aberto_ajuste_manual, limite_credito_disponivel_sincronizado, limite_credito_disponivel_ajuste_manual, limite_cheque_especial, limite_cheque_especial_sincronizado"
        )
        .eq("ativo", false);
      if (empresaId) cq = cq.eq("empresa_id", empresaId);
      else cq = cq.eq("user_id", targetUserId!);
      const { data: contasInativas } = await cq;

      const contasComSnapshot = (contasInativas ?? []).filter((c: any) => {
        const saldo = Number(c.saldo_inicial || 0) + Number(c.saldo_sincronizado || 0) + Number(c.saldo_ajuste_manual || 0);
        const inv = Number(c.investimento_sincronizado || 0) + Number(c.investimento_ajuste_manual || 0) + Number(c.saldo_investimento || 0);
        const fat = Number(c.fatura_aberto_sincronizada || 0) + Number(c.fatura_aberto_ajuste_manual || 0);
        const lim = Number(c.limite_credito_disponivel_sincronizado || 0) + Number(c.limite_credito_disponivel_ajuste_manual || 0);
        const ce = Number(c.limite_cheque_especial || 0) + Number(c.limite_cheque_especial_sincronizado || 0);
        return saldo + inv + fat + lim + ce > 0;
      });

      // Detalhamento por categoria
      const totalSaldoOrfao = contasComSnapshot.reduce(
        (s: number, c: any) =>
          s +
          Number(c.saldo_inicial || 0) +
          Number(c.saldo_sincronizado || 0) +
          Number(c.saldo_ajuste_manual || 0),
        0
      );
      const totalInvestimentoOrfao = contasComSnapshot.reduce(
        (s: number, c: any) =>
          s +
          Number(c.investimento_sincronizado || 0) +
          Number(c.investimento_ajuste_manual || 0) +
          Number(c.saldo_investimento || 0),
        0
      );
      const totalFaturaOrfa = contasComSnapshot.reduce(
        (s: number, c: any) =>
          s +
          Number(c.fatura_aberto_sincronizada || 0) +
          Number(c.fatura_aberto_ajuste_manual || 0),
        0
      );
      const totalLimiteCreditoOrfao = contasComSnapshot.reduce(
        (s: number, c: any) =>
          s +
          Number(c.limite_credito_disponivel_sincronizado || 0) +
          Number(c.limite_credito_disponivel_ajuste_manual || 0),
        0
      );
      const totalChequeEspecialOrfao = contasComSnapshot.reduce(
        (s: number, c: any) =>
          s + Number(c.limite_cheque_especial || 0) + Number(c.limite_cheque_especial_sincronizado || 0),
        0
      );

      const totalAbsoluto = lancamentos.reduce((s, t) => s + Math.abs(Number(t.amount || 0)), 0);

      // Saldo líquido total disponível para realocação:
      //  = saldoLiquido de cash_transactions + saldo + investimento de contas inativas
      //  (fatura e limites são informativos — não realocados como "saldo")
      const saldoLiquidoTotal = saldoLiquidoLancamentos + totalSaldoOrfao + totalInvestimentoOrfao;

      // Total geral absoluto (para banner: inclui TUDO — saldo, invest, fatura, limites, cheque especial)
      const totalGeralAbsoluto =
        Math.abs(saldoLiquidoLancamentos) +
        Math.abs(totalSaldoOrfao) +
        Math.abs(totalInvestimentoOrfao) +
        Math.abs(totalFaturaOrfa) +
        Math.abs(totalLimiteCreditoOrfao) +
        Math.abs(totalChequeEspecialOrfao);

      const temValorRealocavel =
        (lancamentos.length > 0 && Math.abs(saldoLiquidoLancamentos) > 0.01) ||
        (contasComSnapshot.length > 0 && totalGeralAbsoluto > 0.01);

      const temVinculosFaltando =
        (payables?.length ?? 0) > 0 || (receivables?.length ?? 0) > 0;

      const totalCount =
        lancamentos.length +
        (payables?.length ?? 0) +
        (receivables?.length ?? 0) +
        contasComSnapshot.length;

      return {
        lancamentos,
        payablesOrfaos: payables ?? [],
        receivablesOrfaos: receivables ?? [],
        contasInativasComSnapshot: contasComSnapshot,
        // Saldos detalhados (para mostrar no modal)
        breakdown: {
          saldoLancamentos: saldoLiquidoLancamentos,
          saldoContasInativas: totalSaldoOrfao,
          investimentos: totalInvestimentoOrfao,
          faturasCartao: totalFaturaOrfa,
          limiteCredito: totalLimiteCreditoOrfao,
          chequeEspecial: totalChequeEspecialOrfao,
        },
        // Compatibilidade
        saldoLiquido: saldoLiquidoTotal,
        totalAbsoluto,
        totalGeralAbsoluto,
        // Há valor real para realocar (mostra CTA "Realocar agora")
        temValorRealocavel,
        // Há vínculos faltando (informativo apenas — botão "Revisar")
        temVinculosFaltando,
        // Compat: qualquer um dos 2 ⇒ banner aparece
        temOrfaos: temValorRealocavel || temVinculosFaltando,
        totalCount,
      };
    },
  });
}
