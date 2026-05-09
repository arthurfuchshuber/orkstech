import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useMemo } from "react";
import { startOfMonth, endOfMonth, subDays, subMonths, startOfYear, endOfYear, startOfDay, endOfDay } from "date-fns";

export type PeriodPreset = "today" | "7d" | "30d" | "this_month" | "last_month" | "this_year" | "custom";

export interface DREFilters {
  period: PeriodPreset;
  customStart?: Date;
  customEnd?: Date;
  bankAccountId?: string;
  costCenterId?: string;
  categoriaFinanceiraId?: string;
  tipo?: "all" | "income" | "expense";
  /** Filtra por unidade de negócio. "all" ou undefined = consolidado. */
  businessUnitId?: string | "all";
}

export interface DRELine {
  id: string;
  label: string;
  depth: number;
  amount: number;
  percentage: number;
  previousAmount: number;
  variation: number | null;
  isGroup: boolean;
  isSummary: boolean;
  isPercentual?: boolean;
  dreGroup?: string;
  tipo?: string;
  children?: DRELine[];
  categoryId?: string;
  number?: string;
}

interface CatRow {
  id: string;
  nome: string;
  tipo: string;
  categoria_pai_id: string | null;
  ordem: number;
  ativo: boolean;
  dre_group: string | null;
  tronco_slug: string | null;
  is_tronco_sistema: boolean;
}

interface CatNode extends CatRow {
  children: CatNode[];
}

function getDateRange(filters: DREFilters): { start: Date; end: Date } {
  const now = new Date();
  switch (filters.period) {
    case "today": return { start: startOfDay(now), end: endOfDay(now) };
    case "7d": return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    case "30d": return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    case "this_month": return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": { const lm = subMonths(now, 1); return { start: startOfMonth(lm), end: endOfMonth(lm) }; }
    case "this_year": return { start: startOfYear(now), end: endOfYear(now) };
    case "custom": return {
      start: filters.customStart ? startOfDay(filters.customStart) : startOfMonth(now),
      end: filters.customEnd ? endOfDay(filters.customEnd) : endOfMonth(now),
    };
    default: return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function getPreviousRange(start: Date, end: Date): { start: Date; end: Date } {
  const diff = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { start: prevStart, end: prevEnd };
}

/** Build tree from flat list – preserves exact order from plano de contas */
function buildCatTree(cats: CatRow[]): CatNode[] {
  const map = new Map<string, CatNode>();
  const roots: CatNode[] = [];
  cats.forEach(c => map.set(c.id, { ...c, children: [] }));
  cats.forEach(c => {
    const node = map.get(c.id)!;
    if (c.categoria_pai_id && map.has(c.categoria_pai_id)) {
      map.get(c.categoria_pai_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  const sortNodes = (nodes: CatNode[]) => {
    nodes.sort((a, b) => a.ordem - b.ordem);
    nodes.forEach(n => sortNodes(n.children));
  };
  sortNodes(roots);
  return roots;
}

/** Get all descendant IDs (including self) */
function getAllIds(node: CatNode): string[] {
  const ids = [node.id];
  node.children.forEach(c => ids.push(...getAllIds(c)));
  return ids;
}

export function useDRE(filters: DREFilters) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;

  const { start, end } = getDateRange(filters);
  const prev = getPreviousRange(start, end);
  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];
  const prevStartStr = prev.start.toISOString().split("T")[0];
  const prevEndStr = prev.end.toISOString().split("T")[0];

  const { data: categorias = [] } = useQuery({
    queryKey: ["dre-categorias", targetUserId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("*")
        .eq("user_id", targetUserId!)
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as CatRow[];
    },
  });

  const { data: regrasVis = [] } = useQuery({
    queryKey: ["dre-regras-vis", targetUserId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("dre_regras" as any)
        .select("*")
        .eq("user_id", targetUserId!)
        .eq("ativo", true)
        .eq("escopo", "visualizacao")
        .order("ordem");
      return (data ?? []) as any[];
    },
  });

  const empresaId = empresa?.id;

  // Fetch unified transactions: AP paid + AR paid + Pluggy (não reconciliado, com categoria)
  const fetchUnified = async (s: string, e: string) => {
    const buFilter = filters.businessUnitId && filters.businessUnitId !== "all" ? filters.businessUnitId : null;

    // 1) Contas a Pagar — pagas no período
    let qPay = supabase
      .from("accounts_payable")
      .select("id, amount, payment_date, categoria_financeira_id, description, bank_account_id, cost_center_id, business_unit_id, empresa_id, user_id")
      .eq("status", "paid")
      .gte("payment_date", s)
      .lte("payment_date", e);
    if (empresaId) qPay = qPay.eq("empresa_id", empresaId);
    else qPay = qPay.eq("user_id", targetUserId!);
    if (filters.bankAccountId) qPay = qPay.eq("bank_account_id", filters.bankAccountId);
    if (filters.costCenterId) qPay = qPay.eq("cost_center_id", filters.costCenterId);
    if (buFilter) qPay = qPay.eq("business_unit_id", buFilter);

    // 2) Contas a Receber — recebidas no período
    let qRec = supabase
      .from("accounts_receivable")
      .select("id, amount, payment_date, categoria_financeira_id, description, bank_account_id, cost_center_id, business_unit_id, empresa_id, user_id")
      .eq("status", "paid")
      .gte("payment_date", s)
      .lte("payment_date", e);
    if (empresaId) qRec = qRec.eq("empresa_id", empresaId);
    else qRec = qRec.eq("user_id", targetUserId!);
    if (filters.bankAccountId) qRec = qRec.eq("bank_account_id", filters.bankAccountId);
    if (filters.costCenterId) qRec = qRec.eq("cost_center_id", filters.costCenterId);
    if (buFilter) qRec = qRec.eq("business_unit_id", buFilter);

    // 3) Pluggy — não reconciliadas, com categoria, EXCLUI transferências internas
    let qPlu = supabase
      .from("pluggy_transactions")
      .select("id, amount, date, categoria_financeira_id, description, type, reconciled, business_unit_id, user_id")
      .eq("user_id", targetUserId!)
      .eq("reconciled", false)
      .eq("is_internal_transfer", false)
      .not("categoria_financeira_id", "is", null)
      .gte("date", s)
      .lte("date", e);
    if (buFilter) qPlu = qPlu.eq("business_unit_id", buFilter);

    const [payRes, recRes, pluRes] = await Promise.all([qPay, qRec, qPlu]);
    if (payRes.error) throw payRes.error;
    if (recRes.error) throw recRes.error;
    if (pluRes.error) throw pluRes.error;

    const unified: any[] = [];
    (payRes.data ?? []).forEach((r: any) => unified.push({
      id: r.id, source: "ap",
      transaction_date: r.payment_date,
      amount: r.amount,
      categoria_financeira_id: r.categoria_financeira_id,
      description: r.description,
      type: "expense",
    }));
    (recRes.data ?? []).forEach((r: any) => unified.push({
      id: r.id, source: "ar",
      transaction_date: r.payment_date,
      amount: r.amount,
      categoria_financeira_id: r.categoria_financeira_id,
      description: r.description,
      type: "income",
    }));
    (pluRes.data ?? []).forEach((r: any) => unified.push({
      id: r.id, source: "pluggy",
      transaction_date: r.date,
      amount: r.amount,
      categoria_financeira_id: r.categoria_financeira_id,
      description: r.description,
      type: Number(r.amount) >= 0 ? "income" : "expense",
    }));
    return unified;
  };

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["dre-unified-tx", targetUserId, empresaId, startStr, endStr, filters.bankAccountId, filters.costCenterId, filters.businessUnitId],
    enabled: !!user && !!targetUserId,
    queryFn: () => fetchUnified(startStr, endStr),
  });

  const { data: prevTransactions = [] } = useQuery({
    queryKey: ["dre-unified-prev-tx", targetUserId, empresaId, prevStartStr, prevEndStr, filters.bankAccountId, filters.costCenterId, filters.businessUnitId],
    enabled: !!user && !!targetUserId,
    queryFn: () => fetchUnified(prevStartStr, prevEndStr),
  });

  const dreData = useMemo(() => {
    const tree = buildCatTree(categorias);

    // Helper: avalia se uma transação casa com uma regra de visualização
    const evalRegra = (regra: any, t: any): boolean => {
      const conds = regra.condicoes ?? [];
      if (!conds.length) return false;
      const results = conds.map((c: any) => {
        const desc = String(t.description ?? "").toLowerCase();
        const val = String(c.valor ?? "").toLowerCase();
        const amt = Number(t.amount ?? 0);
        switch (c.campo) {
          case "description":
            if (c.operador === "contains") return desc.includes(val);
            if (c.operador === "equals") return desc === val;
            if (c.operador === "starts_with") return desc.startsWith(val);
            return false;
          case "amount":
            if (c.operador === "equals") return amt === Number(c.valor);
            if (c.operador === "gte") return amt >= Number(c.valor);
            if (c.operador === "lte") return amt <= Number(c.valor);
            if (c.operador === "between") return amt >= Number(c.valor) && amt <= Number(c.valor2);
            return false;
          default:
            return false;
        }
      });
      return regra.condicao_logica === "OR" ? results.some(Boolean) : results.every(Boolean);
    };

    // Reclassifica transações em memória conforme regras de visualização (ordem de prioridade)
    const reclassify = (t: any): string | null => {
      const orig = t.categoria_financeira_id;
      for (const regra of regrasVis) {
        const tipoTx = t.type === "income" ? "receber" : "pagar";
        if (regra.aplicar_em !== "ambos" && regra.aplicar_em !== tipoTx) continue;
        if (evalRegra(regra, t)) return regra.categoria_destino_id;
      }
      return orig;
    };

    // Index transactions by categoria_financeira_id (com regras aplicadas)
    const txByCat = new Map<string, number>();
    const prevTxByCat = new Map<string, number>();
    for (const t of transactions) {
      const catId = reclassify(t);
      if (catId) txByCat.set(catId, (txByCat.get(catId) || 0) + Math.abs(Number(t.amount)));
    }
    for (const t of prevTransactions) {
      const catId = reclassify(t);
      if (catId) prevTxByCat.set(catId, (prevTxByCat.get(catId) || 0) + Math.abs(Number(t.amount)));
    }

    const sumNode = (node: CatNode, map: Map<string, number>): number => {
      const ids = getAllIds(node);
      return ids.reduce((s, id) => s + (map.get(id) || 0), 0);
    };

    // Build DRELine tree directly from plano de contas tree (same structure, same order, same numbering)
    function buildNodeLine(node: CatNode, depth: number, numberPrefix: string, idx: number, totalRevenue: number): DRELine {
      const num = numberPrefix ? `${numberPrefix}${idx + 1}.` : `${idx + 1}.`;
      const amount = sumNode(node, txByCat);
      const prevAmount = sumNode(node, prevTxByCat);
      const childLines = node.children.map((child, i) =>
        buildNodeLine(child, depth + 1, num, i, totalRevenue)
      );

      return {
        id: node.id,
        label: node.nome,
        depth,
        amount,
        percentage: totalRevenue > 0 ? (amount / totalRevenue) * 100 : 0,
        previousAmount: prevAmount,
        variation: prevAmount > 0 ? ((amount - prevAmount) / prevAmount) * 100 : null,
        isGroup: childLines.length > 0,
        isSummary: false,
        dreGroup: node.tipo,
        tipo: node.tipo,
        children: childLines.length > 0 ? childLines : undefined,
        categoryId: node.id,
        number: num,
      };
    }

    // Compute total revenue from tronco "receita_operacional"
    const troncoBy = (slug: string) => tree.find(n => n.tronco_slug === slug);
    const tReceita = troncoBy("receita_operacional");
    const tDeducoes = troncoBy("deducoes_receita");
    const tCustos = troncoBy("custos_diretos");
    const tDespOp = troncoBy("despesas_operacionais");
    const tDespCom = troncoBy("despesas_comerciais");
    const tResFin = troncoBy("resultado_financeiro");
    const tImpostos = troncoBy("impostos");
    const tDistribuicao = troncoBy("distribuicao_lucros");

    const sumOf = (n: CatNode | undefined, m: Map<string, number>) => n ? sumNode(n, m) : 0;

    // Resultado Financeiro: signed sum (receita_financeira+, despesa_financeira-)
    const sumResultadoFinanceiro = (node: CatNode | undefined, m: Map<string, number>): number => {
      if (!node) return 0;
      let total = 0;
      const visit = (n: CatNode) => {
        const own = m.get(n.id) || 0;
        const sign = n.tipo === "despesa_financeira" ? -1 : 1;
        total += sign * own;
        n.children.forEach(visit);
      };
      visit(node);
      return total;
    };

    const totReceita = sumOf(tReceita, txByCat);
    const totDeducoes = sumOf(tDeducoes, txByCat);
    const totCustos = sumOf(tCustos, txByCat);
    const totDespOp = sumOf(tDespOp, txByCat);
    const totDespCom = sumOf(tDespCom, txByCat);
    const totResFin = sumResultadoFinanceiro(tResFin, txByCat);
    const totImpostos = sumOf(tImpostos, txByCat);
    const totDistribuicao = sumOf(tDistribuicao, txByCat);

    const totReceitaPrev = sumOf(tReceita, prevTxByCat);
    const totDeducoesPrev = sumOf(tDeducoes, prevTxByCat);
    const totCustosPrev = sumOf(tCustos, prevTxByCat);
    const totDespOpPrev = sumOf(tDespOp, prevTxByCat);
    const totDespComPrev = sumOf(tDespCom, prevTxByCat);
    const totResFinPrev = sumResultadoFinanceiro(tResFin, prevTxByCat);
    const totImpostosPrev = sumOf(tImpostos, prevTxByCat);
    const totDistribuicaoPrev = sumOf(tDistribuicao, prevTxByCat);

    const receitaLiquida = totReceita - totDeducoes;
    const lucroBruto = receitaLiquida - totCustos;
    const resultadoOperacional = lucroBruto - totDespOp - totDespCom;
    const ebitda = resultadoOperacional;
    const resultadoAntesImpostos = resultadoOperacional + totResFin;
    const lucroLiquido = resultadoAntesImpostos - totImpostos;
    const lucroRetido = lucroLiquido - totDistribuicao;

    const receitaLiquidaPrev = totReceitaPrev - totDeducoesPrev;
    const lucroBrutoPrev = receitaLiquidaPrev - totCustosPrev;
    const resultadoOperacionalPrev = lucroBrutoPrev - totDespOpPrev - totDespComPrev;
    const ebitdaPrev = resultadoOperacionalPrev;
    const resultadoAntesImpostosPrev = resultadoOperacionalPrev + totResFinPrev;
    const lucroLiquidoPrev = resultadoAntesImpostosPrev - totImpostosPrev;
    const lucroRetidoPrev = lucroLiquidoPrev - totDistribuicaoPrev;

    const calcVar = (curr: number, prev: number): number | null =>
      prev === 0 ? null : ((curr - prev) / Math.abs(prev)) * 100;

    let counter = 1;
    const num = () => `${counter++}.`;

    const buildTroncoLine = (
      tronco: CatNode | undefined,
      labelOverride: string,
      depth = 0,
      signedSum = false,
    ): DRELine => {
      const numLabel = num();
      if (!tronco) {
        return {
          id: `placeholder-${labelOverride}`, label: labelOverride, depth, amount: 0, percentage: 0,
          previousAmount: 0, variation: null, isGroup: false, isSummary: false, number: numLabel,
        };
      }
      const amount = signedSum ? sumResultadoFinanceiro(tronco, txByCat) : sumNode(tronco, txByCat);
      const prevAmount = signedSum ? sumResultadoFinanceiro(tronco, prevTxByCat) : sumNode(tronco, prevTxByCat);
      const childLines = tronco.children.map((c, i) => buildNodeLine(c, depth + 1, numLabel, i, totReceita));
      return {
        id: tronco.id, label: labelOverride, depth, amount,
        percentage: totReceita > 0 ? (amount / totReceita) * 100 : 0,
        previousAmount: prevAmount, variation: calcVar(amount, prevAmount),
        isGroup: childLines.length > 0, isSummary: false,
        dreGroup: tronco.tipo, tipo: tronco.tipo,
        children: childLines.length > 0 ? childLines : undefined,
        categoryId: tronco.id, number: numLabel,
      };
    };

    const indicator = (id: string, label: string, amount: number, prevAmount: number, isPercentual = false): DRELine => ({
      id, label, depth: 0, amount,
      percentage: isPercentual ? amount : (totReceita > 0 ? (amount / totReceita) * 100 : 0),
      previousAmount: prevAmount, variation: calcVar(amount, prevAmount),
      isGroup: false, isSummary: true, isPercentual, number: num(),
    });

    const margemBrutaPct = totReceita > 0 ? (lucroBruto / totReceita) * 100 : 0;
    const margemBrutaPctPrev = totReceitaPrev > 0 ? (lucroBrutoPrev / totReceitaPrev) * 100 : 0;
    const margemOpPct = totReceita > 0 ? (resultadoOperacional / totReceita) * 100 : 0;
    const margemOpPctPrev = totReceitaPrev > 0 ? (resultadoOperacionalPrev / totReceitaPrev) * 100 : 0;
    const margemEbitdaPct = totReceita > 0 ? (ebitda / totReceita) * 100 : 0;
    const margemEbitdaPctPrev = totReceitaPrev > 0 ? (ebitdaPrev / totReceitaPrev) * 100 : 0;
    const margemLiquidaPct = totReceita > 0 ? (lucroLiquido / totReceita) * 100 : 0;
    const margemLiquidaPctPrev = totReceitaPrev > 0 ? (lucroLiquidoPrev / totReceitaPrev) * 100 : 0;

    const isFiltered = !!(filters.businessUnitId && filters.businessUnitId !== "all");

    const ordered: DRELine[] = [
      buildTroncoLine(tReceita, "Receita Operacional"),
      buildTroncoLine(tDeducoes, "(-) Deduções da Receita"),
      indicator("receita-liquida", "(=) Receita Líquida", receitaLiquida, receitaLiquidaPrev),
      buildTroncoLine(tCustos, "(-) Custos Diretos"),
      indicator("lucro-bruto", "(=) Lucro Bruto", lucroBruto, lucroBrutoPrev),
      indicator("margem-bruta", "(%) Margem Bruta", margemBrutaPct, margemBrutaPctPrev, true),
      buildTroncoLine(tDespOp, "(-) Despesas Operacionais"),
      buildTroncoLine(tDespCom, "(-) Despesas Comerciais"),
      indicator("resultado-operacional", "(=) Resultado Operacional", resultadoOperacional, resultadoOperacionalPrev),
      indicator("margem-operacional", "(%) Margem Operacional", margemOpPct, margemOpPctPrev, true),
      indicator("ebitda", "(=) EBITDA", ebitda, ebitdaPrev),
      indicator("margem-ebitda", "(%) Margem EBITDA", margemEbitdaPct, margemEbitdaPctPrev, true),
      buildTroncoLine(tResFin, "(+/-) Resultado Financeiro", 0, true),
      indicator("resultado-antes-impostos", "(=) Resultado antes dos Impostos", resultadoAntesImpostos, resultadoAntesImpostosPrev),
      buildTroncoLine(tImpostos, "(-) Impostos"),
      indicator("lucro-liquido", "(=) Lucro Líquido", lucroLiquido, lucroLiquidoPrev),
      indicator("margem-liquida", "(%) Margem Líquida", margemLiquidaPct, margemLiquidaPctPrev, true),
      ...(isFiltered ? [] : [
        buildTroncoLine(tDistribuicao, "(-) Distribuição de Lucros"),
        indicator("lucro-retido", "(=) Lucro Retido", lucroRetido, lucroRetidoPrev),
      ]),
    ];

    return {
      lines: ordered,
      totalRevenue: totReceita,
      totalExpense: totDespOp + totDespCom + totCustos + totDeducoes + totImpostos,
      grossProfit: lucroBruto,
      grossMargin: margemBrutaPct,
      ebitda,
      operatingResult: resultadoOperacional,
      netIncome: lucroLiquido,
      profitMargin: margemLiquidaPct,
    };
  }, [transactions, prevTransactions, categorias, regrasVis, filters.businessUnitId]);

  return {
    ...dreData,
    transactions,
    isLoading: loadingTx,
    dateRange: { start, end },
    prevRange: prev,
  };
}
