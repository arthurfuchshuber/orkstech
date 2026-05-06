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
    // 1) Contas a Pagar — pagas no período
    let qPay = supabase
      .from("accounts_payable")
      .select("id, amount, payment_date, categoria_financeira_id, description, bank_account_id, cost_center_id, empresa_id, user_id")
      .eq("status", "paid")
      .gte("payment_date", s)
      .lte("payment_date", e);
    if (empresaId) qPay = qPay.eq("empresa_id", empresaId);
    else qPay = qPay.eq("user_id", targetUserId!);
    if (filters.bankAccountId) qPay = qPay.eq("bank_account_id", filters.bankAccountId);
    if (filters.costCenterId) qPay = qPay.eq("cost_center_id", filters.costCenterId);

    // 2) Contas a Receber — recebidas no período
    let qRec = supabase
      .from("accounts_receivable")
      .select("id, amount, payment_date, categoria_financeira_id, description, bank_account_id, cost_center_id, empresa_id, user_id")
      .eq("status", "paid")
      .gte("payment_date", s)
      .lte("payment_date", e);
    if (empresaId) qRec = qRec.eq("empresa_id", empresaId);
    else qRec = qRec.eq("user_id", targetUserId!);
    if (filters.bankAccountId) qRec = qRec.eq("bank_account_id", filters.bankAccountId);
    if (filters.costCenterId) qRec = qRec.eq("cost_center_id", filters.costCenterId);

    // 3) Pluggy — não reconciliadas, com categoria, EXCLUI transferências internas (aplicações/resgates)
    let qPlu = supabase
      .from("pluggy_transactions")
      .select("id, amount, date, categoria_financeira_id, description, type, reconciled, user_id")
      .eq("user_id", targetUserId!)
      .eq("reconciled", false)
      .eq("is_internal_transfer", false)
      .not("categoria_financeira_id", "is", null)
      .gte("date", s)
      .lte("date", e);

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
    queryKey: ["dre-unified-tx", targetUserId, empresaId, startStr, endStr, filters.bankAccountId, filters.costCenterId],
    enabled: !!user && !!targetUserId,
    queryFn: () => fetchUnified(startStr, endStr),
  });

  const { data: prevTransactions = [] } = useQuery({
    queryKey: ["dre-unified-prev-tx", targetUserId, empresaId, prevStartStr, prevEndStr, filters.bankAccountId, filters.costCenterId],
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

    // Compute total revenue (sum of all root nodes with tipo=receita) – current and previous
    const revenueRoots = tree.filter(n => n.tipo === "receita");
    const totalRevenue = revenueRoots.reduce((s, n) => s + sumNode(n, txByCat), 0);
    const totalRevenuePrev = revenueRoots.reduce((s, n) => s + sumNode(n, prevTxByCat), 0);

    // Build lines directly from tree – same order as plano de contas
    const lines: DRELine[] = [];
    const totals = {
      receita: 0, deducao: 0, custo: 0, despesa: 0,
      receita_fin: 0, despesa_fin: 0, imposto: 0, distribuicao: 0,
    };
    const totalsPrev = {
      receita: 0, deducao: 0, custo: 0, despesa: 0,
      receita_fin: 0, despesa_fin: 0, imposto: 0, distribuicao: 0,
    };

    const accumulate = (root: CatNode, line: DRELine, prev: number) => {
      const map: Record<string, keyof typeof totals> = {
        receita: "receita", deducao: "deducao", custo: "custo", despesa: "despesa",
        receita_financeira: "receita_fin", despesa_financeira: "despesa_fin", imposto: "imposto",
        distribuicao_lucros: "distribuicao",
      };
      const key = map[root.tipo as string];
      if (key) {
        totals[key] += line.amount;
        totalsPrev[key] += prev;
      }
    };

    tree.forEach((root, idx) => {
      const line = buildNodeLine(root, 0, "", idx, totalRevenue);
      const prevAmount = sumNode(root, prevTxByCat);
      lines.push(line);
      accumulate(root, line, prevAmount);
    });

    // DRE completo baseado nos tipos – current
    const receitaLiquida = totals.receita - totals.deducao;
    const lucroBruto = receitaLiquida - totals.custo;
    const resultadoOperacional = lucroBruto - totals.despesa;
    const resultadoFinanceiro = totals.receita_fin - totals.despesa_fin;
    const resultadoAntesImpostos = resultadoOperacional + resultadoFinanceiro;
    const lucroLiquido = resultadoAntesImpostos - totals.imposto;
    const lucroRetido = lucroLiquido - totals.distribuicao;

    // DRE – previous period
    const receitaLiquidaPrev = totalsPrev.receita - totalsPrev.deducao;
    const lucroBrutoPrev = receitaLiquidaPrev - totalsPrev.custo;
    const resultadoOperacionalPrev = lucroBrutoPrev - totalsPrev.despesa;
    const resultadoFinanceiroPrev = totalsPrev.receita_fin - totalsPrev.despesa_fin;
    const resultadoAntesImpostosPrev = resultadoOperacionalPrev + resultadoFinanceiroPrev;
    const lucroLiquidoPrev = resultadoAntesImpostosPrev - totalsPrev.imposto;
    const lucroRetidoPrev = lucroLiquidoPrev - totalsPrev.distribuicao;

    const totalReceitaAmount = totals.receita;

    // Continue numbering from tree length
    let nextNum = lines.length + 1;

    const calcVar = (curr: number, prev: number): number | null => {
      if (prev === 0) return null;
      return ((curr - prev) / Math.abs(prev)) * 100;
    };

    const makeIndicator = (id: string, label: string, amount: number, prevAmount: number): DRELine => ({
      id, label, depth: 0, amount,
      percentage: totalReceitaAmount > 0 ? (amount / totalReceitaAmount) * 100 : 0,
      previousAmount: prevAmount,
      variation: calcVar(amount, prevAmount),
      isGroup: false, isSummary: false,
      number: `${nextNum++}.`,
    });

    const margemBrutaPct = totalReceitaAmount > 0 ? (lucroBruto / totalReceitaAmount) * 100 : 0;
    const margemBrutaPctPrev = totalsPrev.receita > 0 ? (lucroBrutoPrev / totalsPrev.receita) * 100 : 0;
    const margemOperacionalPct = totalReceitaAmount > 0 ? (resultadoOperacional / totalReceitaAmount) * 100 : 0;
    const margemOperacionalPctPrev = totalsPrev.receita > 0 ? (resultadoOperacionalPrev / totalsPrev.receita) * 100 : 0;
    const ebitda = resultadoOperacional; // simplificado (sem D&A separado)
    const ebitdaPrev = resultadoOperacionalPrev;
    const margemEbitdaPct = totalReceitaAmount > 0 ? (ebitda / totalReceitaAmount) * 100 : 0;
    const margemEbitdaPctPrev = totalsPrev.receita > 0 ? (ebitdaPrev / totalsPrev.receita) * 100 : 0;
    const margemLiquidaPct = totalReceitaAmount > 0 ? (lucroLiquido / totalReceitaAmount) * 100 : 0;
    const margemLiquidaPctPrev = totalsPrev.receita > 0 ? (lucroLiquidoPrev / totalsPrev.receita) * 100 : 0;

    const indicators: DRELine[] = [
      makeIndicator("receita-liquida", "(=) Receita Líquida", receitaLiquida, receitaLiquidaPrev),
      makeIndicator("lucro-bruto", "(=) Lucro Bruto", lucroBruto, lucroBrutoPrev),
      { ...makeIndicator("margem-bruta", "(%) Margem Bruta", margemBrutaPct, margemBrutaPctPrev), isPercentual: true },
      makeIndicator("resultado-operacional", "(=) Resultado Operacional", resultadoOperacional, resultadoOperacionalPrev),
      { ...makeIndicator("margem-operacional", "(%) Margem Operacional", margemOperacionalPct, margemOperacionalPctPrev), isPercentual: true },
      makeIndicator("ebitda", "(=) EBITDA", ebitda, ebitdaPrev),
      { ...makeIndicator("margem-ebitda", "(%) Margem EBITDA", margemEbitdaPct, margemEbitdaPctPrev), isPercentual: true },
      makeIndicator("resultado-financeiro", "(+/-) Resultado Financeiro", resultadoFinanceiro, resultadoFinanceiroPrev),
      makeIndicator("resultado-antes-impostos", "(=) Resultado antes dos Impostos", resultadoAntesImpostos, resultadoAntesImpostosPrev),
      makeIndicator("impostos", "(-) Impostos", totals.imposto, totalsPrev.imposto),
      makeIndicator("lucro-liquido", "(=) Lucro Líquido", lucroLiquido, lucroLiquidoPrev),
      { ...makeIndicator("margem-liquida", "(%) Margem Líquida", margemLiquidaPct, margemLiquidaPctPrev), isPercentual: true },
      makeIndicator("distribuicao-lucros", "(-) Distribuição de Lucros", totals.distribuicao, totalsPrev.distribuicao),
      makeIndicator("lucro-retido", "(=) Lucro Retido", lucroRetido, lucroRetidoPrev),
    ];

    return {
      lines: [...lines, ...indicators],
      totalRevenue: totalReceitaAmount,
      totalExpense: totals.despesa + totals.custo + totals.deducao + totals.imposto + totals.despesa_fin,
      grossProfit: lucroBruto,
      grossMargin: totalReceitaAmount > 0 ? (lucroBruto / totalReceitaAmount) * 100 : 0,
      ebitda: resultadoOperacional,
      operatingResult: resultadoOperacional,
      netIncome: lucroLiquido,
      profitMargin: totalReceitaAmount > 0 ? (lucroLiquido / totalReceitaAmount) * 100 : 0,
    };
  }, [transactions, prevTransactions, categorias, regrasVis]);

  return {
    ...dreData,
    transactions,
    isLoading: loadingTx,
    dateRange: { start, end },
    prevRange: prev,
  };
}
