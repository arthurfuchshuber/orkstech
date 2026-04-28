import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";

/**
 * Calcula a divergência total entre o "saldo efetivo" exibido nos cards e o
 * "saldo esperado" (saldo_inicial/sincronizado + Σ lançamentos).
 *
 * Divergência > 0 significa: cards mostram mais dinheiro do que o extrato comprova.
 * Divergência < 0 significa: extrato tem mais lançamentos do que o card mostra.
 */
export function useSaldoDivergencias() {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  return useQuery({
    queryKey: ["saldo-divergencias", empresaId],
    enabled: !!empresaId,
    queryFn: async () => {
      // 1. Busca todas as contas ativas
      const { data: contas } = await supabase
        .from("contas_bancarias")
        .select("id, nome, saldo_inicial, saldo_sincronizado, saldo_ajuste_manual, origem")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true);

      if (!contas || contas.length === 0) {
        return { total: 0, porConta: [] as Array<{ id: string; nome: string; delta: number }> };
      }

      // 2. Soma cash_transactions agrupada por conta
      const { data: txs } = await supabase
        .from("cash_transactions")
        .select("bank_account_id, type, amount")
        .in("bank_account_id", contas.map((c) => c.id));

      const somaPorConta = new Map<string, number>();
      (txs ?? []).forEach((t: any) => {
        const cur = somaPorConta.get(t.bank_account_id) || 0;
        const sign = t.type === "income" ? 1 : -1;
        somaPorConta.set(t.bank_account_id, cur + sign * Number(t.amount || 0));
      });

      // 3. Calcula delta por conta
      const porConta = contas.map((c: any) => {
        const isPluggy = c.origem === "pluggy" || c.origem === "hibrido";
        const efetivo =
          Number(c.saldo_inicial || 0) +
          Number(c.saldo_sincronizado || 0) +
          Number(c.saldo_ajuste_manual || 0);
        const cashSum = somaPorConta.get(c.id) || 0;
        const esperado = isPluggy
          ? Number(c.saldo_sincronizado || 0) + cashSum
          : Number(c.saldo_inicial || 0) + cashSum;
        const delta = efetivo - esperado;
        return { id: c.id, nome: c.nome, delta };
      });

      const total = porConta.reduce((acc, p) => acc + p.delta, 0);
      return { total, porConta };
    },
    staleTime: 30_000,
  });
}
