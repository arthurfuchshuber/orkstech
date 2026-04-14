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
  /** Hierarchical number like "1.", "1.1.", "1.1.1." */
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

/** Build tree from flat list */
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

/** Resolve dre_group: explicit or inferred from tipo */
function resolveDreGroup(cat: CatRow): string {
  if (cat.dre_group) return cat.dre_group;
  switch (cat.tipo) {
    case "receita": return "revenue";
    case "despesa": return "operational_expenses";
    case "custo": return "costs";
    case "ajuste": return "deductions";
    default: return "operational_expenses";
  }
}

/** DRE group ordering and labels */
const DRE_SECTIONS: { group: string; label: string; prefix: string; txType: string }[] = [
  { group: "revenue", label: "RECEITAS", prefix: "", txType: "income" },
  { group: "deductions", label: "(-) DEDUÇÕES", prefix: "(-) ", txType: "expense" },
  { group: "costs", label: "(-) CUSTOS", prefix: "(-) ", txType: "expense" },
  { group: "operational_expenses", label: "(-) DESPESAS OPERACIONAIS", prefix: "(-) ", txType: "expense" },
  { group: "financial_expenses", label: "(-) DESPESAS FINANCEIRAS", prefix: "(-) ", txType: "expense" },
  { group: "financial_revenue", label: "(+) RECEITAS FINANCEIRAS", prefix: "(+) ", txType: "income" },
  { group: "taxes", label: "(-) IMPOSTOS", prefix: "(-) ", txType: "expense" },
];

const SUMMARIES_AFTER: Record<string, { id: string; label: string; calc: (totals: Record<string, number>) => number }[]> = {
  "deductions": [{ id: "net-revenue", label: "RECEITA LÍQUIDA", calc: t => (t["revenue"] || 0) - (t["deductions"] || 0) }],
  "costs": [{ id: "gross-profit", label: "LUCRO BRUTO", calc: t => (t["revenue"] || 0) - (t["deductions"] || 0) - (t["costs"] || 0) }],
  "operational_expenses": [{ id: "operating-result", label: "RESULTADO OPERACIONAL", calc: t => (t["revenue"] || 0) - (t["deductions"] || 0) - (t["costs"] || 0) - (t["operational_expenses"] || 0) }],
  "financial_revenue": [{ id: "pre-tax", label: "RESULTADO ANTES DOS IMPOSTOS", calc: t => (t["revenue"] || 0) - (t["deductions"] || 0) - (t["costs"] || 0) - (t["operational_expenses"] || 0) - (t["financial_expenses"] || 0) + (t["financial_revenue"] || 0) }],
  "taxes": [{ id: "net-income", label: "LUCRO LÍQUIDO", calc: t => (t["revenue"] || 0) - (t["deductions"] || 0) - (t["costs"] || 0) - (t["operational_expenses"] || 0) - (t["financial_expenses"] || 0) + (t["financial_revenue"] || 0) - (t["taxes"] || 0) }],
};

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

  // Fetch full chart of accounts
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

  // Fetch cash_transactions for current period
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

  // Fetch previous period
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

  // Build DRE from chart of accounts tree
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

    // Sum all IDs under a node
    const sumNode = (node: CatNode, map: Map<string, number>): number => {
      const ids = getAllIds(node);
      return ids.reduce((s, id) => s + (map.get(id) || 0), 0);
    };

    // Group root nodes by dre_group
    const rootsByGroup = new Map<string, CatNode[]>();
    for (const root of tree) {
      const group = resolveDreGroup(root);
      if (!rootsByGroup.has(group)) rootsByGroup.set(group, []);
      rootsByGroup.get(group)!.push(root);
    }

    // Build DRELine tree for a category node
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
        dreGroup: resolveDreGroup(node),
        tipo: node.tipo,
        children: childLines.length > 0 ? childLines : undefined,
        categoryId: node.id,
        number: num,
      };
    }

    // First pass: compute total revenue for percentage calculations
    const revenueRoots = rootsByGroup.get("revenue") || [];
    const finRevRoots = rootsByGroup.get("financial_revenue") || [];
    const totalRevenue = [...revenueRoots].reduce((s, n) => s + sumNode(n, txByCat), 0);
    const prevTotalRevenue = [...revenueRoots].reduce((s, n) => s + sumNode(n, prevTxByCat), 0);

    // Build all lines following DRE section order
    const lines: DRELine[] = [];
    const groupTotals: Record<string, number> = {};
    let sectionCounter = 0;

    for (const section of DRE_SECTIONS) {
      const roots = rootsByGroup.get(section.group) || [];
      if (roots.length === 0) {
        groupTotals[section.group] = 0;
        // Still emit summaries even if section is empty
        const summaries = SUMMARIES_AFTER[section.group];
        if (summaries) {
          for (const sum of summaries) {
            const val = sum.calc(groupTotals);
            lines.push({
              id: sum.id, label: sum.label, depth: 0, amount: val,
              percentage: totalRevenue > 0 ? (val / totalRevenue) * 100 : 0,
              previousAmount: 0, variation: null, isGroup: false, isSummary: true,
            });
          }
        }
        continue;
      }

      sectionCounter++;
      const sectionPrefix = `${sectionCounter}.`;

      // Build child lines from the chart of accounts
      const childLines = roots.map((root, i) =>
        buildNodeLine(root, 1, sectionPrefix, i, totalRevenue)
      );

      const sectionTotal = childLines.reduce((s, l) => s + l.amount, 0);
      const prevSectionTotal = roots.reduce((s, n) => s + sumNode(n, prevTxByCat), 0);
      groupTotals[section.group] = sectionTotal;

      lines.push({
        id: section.group,
        label: section.label,
        depth: 0,
        amount: sectionTotal,
        percentage: totalRevenue > 0 ? (sectionTotal / totalRevenue) * 100 : 0,
        previousAmount: prevSectionTotal,
        variation: prevSectionTotal > 0 ? ((sectionTotal - prevSectionTotal) / prevSectionTotal) * 100 : null,
        isGroup: true,
        isSummary: false,
        dreGroup: section.group,
        children: childLines,
        number: `${sectionCounter}.`,
      });

      // Insert summary lines after this group
      const summaries = SUMMARIES_AFTER[section.group];
      if (summaries) {
        for (const sum of summaries) {
          const val = sum.calc(groupTotals);
          const prevVal = sum.calc(
            Object.fromEntries(
              Object.entries(groupTotals).map(([k]) => {
                const pRoots = rootsByGroup.get(k) || [];
                return [k, pRoots.reduce((s, n) => s + sumNode(n, prevTxByCat), 0)];
              })
            )
          );
          lines.push({
            id: sum.id, label: sum.label, depth: 0, amount: val,
            percentage: totalRevenue > 0 ? (val / totalRevenue) * 100 : 0,
            previousAmount: prevVal,
            variation: prevVal !== 0 ? ((val - prevVal) / Math.abs(prevVal)) * 100 : null,
            isGroup: false, isSummary: true,
          });
        }
      }
    }

    const netIncome = (groupTotals["revenue"] || 0) - (groupTotals["deductions"] || 0) - (groupTotals["costs"] || 0) - (groupTotals["operational_expenses"] || 0) - (groupTotals["financial_expenses"] || 0) + (groupTotals["financial_revenue"] || 0) - (groupTotals["taxes"] || 0);

    return {
      lines,
      totalRevenue,
      totalExpense: Object.entries(groupTotals).filter(([k]) => k !== "revenue" && k !== "financial_revenue").reduce((s, [, v]) => s + v, 0),
      operatingResult: (groupTotals["revenue"] || 0) - (groupTotals["deductions"] || 0) - (groupTotals["costs"] || 0) - (groupTotals["operational_expenses"] || 0),
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
