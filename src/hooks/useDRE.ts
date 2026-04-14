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

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["dre-transactions", targetUserId, startStr, endStr, filters.bankAccountId, filters.costCenterId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      let q = supabase
        .from("cash_transactions")
        .select("*")
        .eq("user_id", targetUserId!)
        .gte("transaction_date", startStr)
        .lte("transaction_date", endStr);
      if (filters.bankAccountId) q = q.eq("bank_account_id", filters.bankAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: prevTransactions = [] } = useQuery({
    queryKey: ["dre-prev-transactions", targetUserId, prevStartStr, prevEndStr, filters.bankAccountId, filters.costCenterId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      let q = supabase
        .from("cash_transactions")
        .select("*")
        .eq("user_id", targetUserId!)
        .gte("transaction_date", prevStartStr)
        .lte("transaction_date", prevEndStr);
      if (filters.bankAccountId) q = q.eq("bank_account_id", filters.bankAccountId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const dreData = useMemo(() => {
    const tree = buildCatTree(categorias);

    // Index transactions by categoria_financeira_id
    const txByCat = new Map<string, number>();
    const prevTxByCat = new Map<string, number>();
    for (const t of transactions) {
      const catId = (t as any).categoria_financeira_id;
      if (catId) txByCat.set(catId, (txByCat.get(catId) || 0) + Math.abs(Number(t.amount)));
    }
    for (const t of prevTransactions) {
      const catId = (t as any).categoria_financeira_id;
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

    // Compute total revenue (sum of all root nodes with tipo=receita)
    const revenueRoots = tree.filter(n => n.tipo === "receita");
    const totalRevenue = revenueRoots.reduce((s, n) => s + sumNode(n, txByCat), 0);

    // Build lines directly from tree – same order as plano de contas
    const lines: DRELine[] = [];
    let totalReceitaAmount = 0;
    let totalDespesaAmount = 0;
    let totalCustoAmount = 0;

    tree.forEach((root, idx) => {
      const line = buildNodeLine(root, 0, "", idx, totalRevenue);
      lines.push(line);

      // Accumulate totals by tipo
      if (root.tipo === "receita") totalReceitaAmount += line.amount;
      else if (root.tipo === "despesa") totalDespesaAmount += line.amount;
      else if (root.tipo === "custo") totalCustoAmount += line.amount;
    });

    // Add summary lines at the end
    const netIncome = totalReceitaAmount - totalDespesaAmount - totalCustoAmount;

    // Insert summary lines
    const summaryLines: DRELine[] = [];
    
    // Always show summary/indicator lines
    summaryLines.push({
      id: "receita-liquida",
      label: "RECEITA LÍQUIDA",
      depth: 0, amount: totalReceitaAmount,
      percentage: totalRevenue > 0 ? (totalReceitaAmount / totalRevenue) * 100 : 0,
      previousAmount: 0, variation: null, isGroup: false, isSummary: true,
    });

    summaryLines.push({
      id: "total-custos",
      label: "(-) TOTAL CUSTOS",
      depth: 0, amount: totalCustoAmount,
      percentage: totalRevenue > 0 ? (totalCustoAmount / totalRevenue) * 100 : 0,
      previousAmount: 0, variation: null, isGroup: false, isSummary: true,
    });

    const grossProfitVal = totalReceitaAmount - totalCustoAmount;
    const grossMarginPct = totalReceitaAmount > 0 ? (grossProfitVal / totalReceitaAmount) * 100 : 0;

    summaryLines.push({
      id: "margem-bruta",
      label: "MARGEM BRUTA",
      depth: 0, amount: grossProfitVal, percentage: grossMarginPct,
      previousAmount: 0, variation: null, isGroup: false, isSummary: true,
    });

    summaryLines.push({
      id: "total-despesas",
      label: "(-) TOTAL DESPESAS",
      depth: 0, amount: totalDespesaAmount,
      percentage: totalRevenue > 0 ? (totalDespesaAmount / totalRevenue) * 100 : 0,
      previousAmount: 0, variation: null, isGroup: false, isSummary: true,
    });

    const ebitdaVal = grossProfitVal - totalDespesaAmount;

    summaryLines.push({
      id: "ebitda",
      label: "EBITDA",
      depth: 0, amount: ebitdaVal,
      percentage: totalRevenue > 0 ? (ebitdaVal / totalRevenue) * 100 : 0,
      previousAmount: 0, variation: null, isGroup: false, isSummary: true,
    });

    summaryLines.push({
      id: "resultado",
      label: "RESULTADO",
      depth: 0, amount: netIncome,
      percentage: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
      previousAmount: 0, variation: null, isGroup: false, isSummary: true,
    });

    const grossProfit = totalReceitaAmount - totalCustoAmount;

    return {
      lines: [...lines, ...summaryLines],
      totalRevenue: totalReceitaAmount,
      totalExpense: totalDespesaAmount + totalCustoAmount,
      grossProfit,
      grossMargin: totalReceitaAmount > 0 ? (grossProfit / totalReceitaAmount) * 100 : 0,
      ebitda: grossProfit - totalDespesaAmount,
      operatingResult: totalReceitaAmount - totalCustoAmount - totalDespesaAmount,
      netIncome,
      profitMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    };
  }, [transactions, prevTransactions, categorias]);

  return {
    ...dreData,
    transactions,
    isLoading: loadingTx,
    dateRange: { start, end },
    prevRange: prev,
  };
}
