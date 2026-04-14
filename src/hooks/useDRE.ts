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
}

function getDateRange(filters: DREFilters): { start: Date; end: Date } {
  const now = new Date();
  switch (filters.period) {
    case "today":
      return { start: startOfDay(now), end: endOfDay(now) };
    case "7d":
      return { start: startOfDay(subDays(now, 7)), end: endOfDay(now) };
    case "30d":
      return { start: startOfDay(subDays(now, 30)), end: endOfDay(now) };
    case "this_month":
      return { start: startOfMonth(now), end: endOfMonth(now) };
    case "last_month": {
      const lm = subMonths(now, 1);
      return { start: startOfMonth(lm), end: endOfMonth(lm) };
    }
    case "this_year":
      return { start: startOfYear(now), end: endOfYear(now) };
    case "custom":
      return {
        start: filters.customStart ? startOfDay(filters.customStart) : startOfMonth(now),
        end: filters.customEnd ? endOfDay(filters.customEnd) : endOfMonth(now),
      };
    default:
      return { start: startOfMonth(now), end: endOfMonth(now) };
  }
}

function getPreviousRange(start: Date, end: Date): { start: Date; end: Date } {
  const diff = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - diff);
  return { start: prevStart, end: prevEnd };
}

export function useDRE(filters: DREFilters) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const { start, end } = getDateRange(filters);
  const prev = getPreviousRange(start, end);

  const startStr = start.toISOString().split("T")[0];
  const endStr = end.toISOString().split("T")[0];
  const prevStartStr = prev.start.toISOString().split("T")[0];
  const prevEndStr = prev.end.toISOString().split("T")[0];

  // Fetch chart of accounts
  const { data: categorias = [] } = useQuery({
    queryKey: ["dre-categorias", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("categorias_financeiras").select("*").eq("ativo", true).order("ordem");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch cash_transactions for current period
  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["dre-transactions", user?.id, empresaId, startStr, endStr, filters.bankAccountId, filters.costCenterId, filters.tipo],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("cash_transactions")
        .select("*")
        .gte("transaction_date", startStr)
        .lte("transaction_date", endStr);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      if (filters.bankAccountId) q = q.eq("bank_account_id", filters.bankAccountId);
      if (filters.tipo === "income") q = q.eq("type", "income");
      if (filters.tipo === "expense") q = q.eq("type", "expense");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch cash_transactions for previous period (comparison)
  const { data: prevTransactions = [] } = useQuery({
    queryKey: ["dre-prev-transactions", user?.id, empresaId, prevStartStr, prevEndStr, filters.bankAccountId, filters.costCenterId, filters.tipo],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("cash_transactions")
        .select("*")
        .gte("transaction_date", prevStartStr)
        .lte("transaction_date", prevEndStr);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      if (filters.bankAccountId) q = q.eq("bank_account_id", filters.bankAccountId);
      if (filters.tipo === "income") q = q.eq("type", "income");
      if (filters.tipo === "expense") q = q.eq("type", "expense");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Fetch accounts_payable for drill-down
  const { data: payables = [] } = useQuery({
    queryKey: ["dre-payables", user?.id, empresaId, startStr, endStr],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("accounts_payable")
        .select("*, categoria_financeira_id")
        .gte("due_date", startStr)
        .lte("due_date", endStr);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Build DRE structure
  const dreData = useMemo(() => {
    const sumByType = (txs: any[], type: string) =>
      txs.filter((t) => t.type === type).reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    const sumByCatAndType = (txs: any[], catId: string, type: string) =>
      txs.filter((t) => t.type === type && t.categoria_financeira_id === catId)
        .reduce((s, t) => s + Math.abs(Number(t.amount)), 0);

    // Group categories by dre_group
    const dreGroupMap: Record<string, typeof categorias> = {};
    categorias.forEach((c) => {
      const group = (c as any).dre_group || mapTipToDreGroup(c.tipo);
      if (!dreGroupMap[group]) dreGroupMap[group] = [];
      dreGroupMap[group].push(c);
    });

    const totalRevenue = sumByType(transactions, "income");
    const totalExpense = sumByType(transactions, "expense");
    const prevRevenue = sumByType(prevTransactions, "income");
    const prevExpense = sumByType(prevTransactions, "expense");

    // Build structured lines
    const lines: DRELine[] = [];

    // Helper to build category lines within a group
    const buildCategoryLines = (cats: typeof categorias, type: string, depth: number): DRELine[] => {
      return cats
        .filter((c) => !c.categoria_pai_id)
        .map((cat) => {
          const amount = sumByCatAndType(transactions, cat.id, type);
          const prevAmount = sumByCatAndType(prevTransactions, cat.id, type);
          const children = cats
            .filter((c) => c.categoria_pai_id === cat.id)
            .map((sub) => {
              const subAmount = sumByCatAndType(transactions, sub.id, type);
              const subPrev = sumByCatAndType(prevTransactions, sub.id, type);
              return {
                id: sub.id,
                label: sub.nome,
                depth: depth + 1,
                amount: subAmount,
                percentage: totalRevenue > 0 ? (subAmount / totalRevenue) * 100 : 0,
                previousAmount: subPrev,
                variation: subPrev > 0 ? ((subAmount - subPrev) / subPrev) * 100 : null,
                isGroup: false,
                isSummary: false,
                categoryId: sub.id,
              };
            });

          const totalCatAmount = amount + children.reduce((s, c) => s + c.amount, 0);
          const totalCatPrev = prevAmount + children.reduce((s, c) => s + c.previousAmount, 0);

          return {
            id: cat.id,
            label: cat.nome,
            depth,
            amount: totalCatAmount,
            percentage: totalRevenue > 0 ? (totalCatAmount / totalRevenue) * 100 : 0,
            previousAmount: totalCatPrev,
            variation: totalCatPrev > 0 ? ((totalCatAmount - totalCatPrev) / totalCatPrev) * 100 : null,
            isGroup: children.length > 0,
            isSummary: false,
            children,
            categoryId: cat.id,
          };
        })
        .filter((l) => l.amount > 0 || l.children?.some((c) => c.amount > 0));
    };

    // RECEITAS
    const revenueCats = dreGroupMap["revenue"] || [];
    const revenueCatLines = buildCategoryLines(revenueCats, "income", 1);
    const categorizedRevenue = revenueCatLines.reduce((s, l) => s + l.amount, 0);
    const uncategorizedRevenue = totalRevenue - categorizedRevenue;

    lines.push({
      id: "revenue", label: "RECEITAS", depth: 0, amount: totalRevenue,
      percentage: 100, previousAmount: prevRevenue,
      variation: prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : null,
      isGroup: true, isSummary: false, dreGroup: "revenue",
      children: [
        ...revenueCatLines,
        ...(uncategorizedRevenue > 0
          ? [{
            id: "uncategorized-revenue", label: "Outras receitas", depth: 1,
            amount: uncategorizedRevenue, percentage: totalRevenue > 0 ? (uncategorizedRevenue / totalRevenue) * 100 : 0,
            previousAmount: 0, variation: null, isGroup: false, isSummary: false,
          }]
          : []),
      ],
    });

    // DEDUÇÕES
    const deductionCats = dreGroupMap["deductions"] || [];
    const deductionLines = buildCategoryLines(deductionCats, "expense", 1);
    const totalDeductions = deductionLines.reduce((s, l) => s + l.amount, 0);
    if (totalDeductions > 0 || deductionLines.length > 0) {
      lines.push({
        id: "deductions", label: "(-) DEDUÇÕES", depth: 0, amount: totalDeductions,
        percentage: totalRevenue > 0 ? (totalDeductions / totalRevenue) * 100 : 0,
        previousAmount: 0, variation: null, isGroup: true, isSummary: false, dreGroup: "deductions",
        children: deductionLines,
      });
    }

    // RECEITA LÍQUIDA
    const netRevenue = totalRevenue - totalDeductions;
    const prevNetRevenue = prevRevenue;
    lines.push({
      id: "net-revenue", label: "RECEITA LÍQUIDA", depth: 0, amount: netRevenue,
      percentage: totalRevenue > 0 ? (netRevenue / totalRevenue) * 100 : 0,
      previousAmount: prevNetRevenue,
      variation: prevNetRevenue > 0 ? ((netRevenue - prevNetRevenue) / prevNetRevenue) * 100 : null,
      isGroup: false, isSummary: true,
    });

    // CUSTOS
    const costCats = dreGroupMap["costs"] || [];
    const costLines = buildCategoryLines(costCats, "expense", 1);
    const totalCosts = costLines.reduce((s, l) => s + l.amount, 0);
    if (totalCosts > 0 || costLines.length > 0) {
      lines.push({
        id: "costs", label: "(-) CUSTOS", depth: 0, amount: totalCosts,
        percentage: totalRevenue > 0 ? (totalCosts / totalRevenue) * 100 : 0,
        previousAmount: 0, variation: null, isGroup: true, isSummary: false, dreGroup: "costs",
        children: costLines,
      });
    }

    // LUCRO BRUTO
    const grossProfit = netRevenue - totalCosts;
    lines.push({
      id: "gross-profit", label: "LUCRO BRUTO", depth: 0, amount: grossProfit,
      percentage: totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0,
      previousAmount: 0, variation: null, isGroup: false, isSummary: true,
    });

    // DESPESAS OPERACIONAIS
    const opExCats = dreGroupMap["operational_expenses"] || [];
    const opExLines = buildCategoryLines(opExCats, "expense", 1);
    const categorizedExpense = opExLines.reduce((s, l) => s + l.amount, 0);
    // Uncategorized expenses go to operational
    const uncategorizedExpense = totalExpense - categorizedExpense - totalDeductions - totalCosts;
    const totalOpEx = categorizedExpense + Math.max(0, uncategorizedExpense);

    lines.push({
      id: "operational-expenses", label: "(-) DESPESAS OPERACIONAIS", depth: 0, amount: totalOpEx,
      percentage: totalRevenue > 0 ? (totalOpEx / totalRevenue) * 100 : 0,
      previousAmount: prevExpense,
      variation: prevExpense > 0 ? ((totalOpEx - prevExpense) / prevExpense) * 100 : null,
      isGroup: true, isSummary: false, dreGroup: "operational_expenses",
      children: [
        ...opExLines,
        ...(uncategorizedExpense > 0
          ? [{
            id: "uncategorized-expense", label: "Outras despesas", depth: 1,
            amount: uncategorizedExpense, percentage: totalRevenue > 0 ? (uncategorizedExpense / totalRevenue) * 100 : 0,
            previousAmount: 0, variation: null, isGroup: false, isSummary: false,
          }]
          : []),
      ],
    });

    // RESULTADO OPERACIONAL
    const operatingResult = grossProfit - totalOpEx;
    lines.push({
      id: "operating-result", label: "RESULTADO OPERACIONAL", depth: 0, amount: operatingResult,
      percentage: totalRevenue > 0 ? (operatingResult / totalRevenue) * 100 : 0,
      previousAmount: 0, variation: null, isGroup: false, isSummary: true,
    });

    // DESPESAS FINANCEIRAS
    const finExpCats = dreGroupMap["financial_expenses"] || [];
    const finExpLines = buildCategoryLines(finExpCats, "expense", 1);
    const totalFinExp = finExpLines.reduce((s, l) => s + l.amount, 0);
    if (totalFinExp > 0) {
      lines.push({
        id: "financial-expenses", label: "(-) DESPESAS FINANCEIRAS", depth: 0, amount: totalFinExp,
        percentage: totalRevenue > 0 ? (totalFinExp / totalRevenue) * 100 : 0,
        previousAmount: 0, variation: null, isGroup: true, isSummary: false, dreGroup: "financial_expenses",
        children: finExpLines,
      });
    }

    // RECEITAS FINANCEIRAS
    const finRevCats = dreGroupMap["financial_revenue"] || [];
    const finRevLines = buildCategoryLines(finRevCats, "income", 1);
    const totalFinRev = finRevLines.reduce((s, l) => s + l.amount, 0);
    if (totalFinRev > 0) {
      lines.push({
        id: "financial-revenue", label: "(+) RECEITAS FINANCEIRAS", depth: 0, amount: totalFinRev,
        percentage: totalRevenue > 0 ? (totalFinRev / totalRevenue) * 100 : 0,
        previousAmount: 0, variation: null, isGroup: true, isSummary: false, dreGroup: "financial_revenue",
        children: finRevLines,
      });
    }

    // RESULTADO ANTES DOS IMPOSTOS
    const presTax = operatingResult - totalFinExp + totalFinRev;
    lines.push({
      id: "pre-tax", label: "RESULTADO ANTES DOS IMPOSTOS", depth: 0, amount: presTax,
      percentage: totalRevenue > 0 ? (presTax / totalRevenue) * 100 : 0,
      previousAmount: 0, variation: null, isGroup: false, isSummary: true,
    });

    // IMPOSTOS
    const taxCats = dreGroupMap["taxes"] || [];
    const taxLines = buildCategoryLines(taxCats, "expense", 1);
    const totalTaxes = taxLines.reduce((s, l) => s + l.amount, 0);
    if (totalTaxes > 0) {
      lines.push({
        id: "taxes", label: "(-) IMPOSTOS", depth: 0, amount: totalTaxes,
        percentage: totalRevenue > 0 ? (totalTaxes / totalRevenue) * 100 : 0,
        previousAmount: 0, variation: null, isGroup: true, isSummary: false, dreGroup: "taxes",
        children: taxLines,
      });
    }

    // LUCRO LÍQUIDO
    const netIncome = presTax - totalTaxes;
    const prevNet = prevRevenue - prevExpense;
    lines.push({
      id: "net-income", label: "LUCRO LÍQUIDO", depth: 0, amount: netIncome,
      percentage: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
      previousAmount: prevNet,
      variation: prevNet !== 0 ? ((netIncome - prevNet) / Math.abs(prevNet)) * 100 : null,
      isGroup: false, isSummary: true,
    });

    return {
      lines,
      totalRevenue,
      totalExpense,
      operatingResult,
      netIncome,
      profitMargin: totalRevenue > 0 ? (netIncome / totalRevenue) * 100 : 0,
    };
  }, [transactions, prevTransactions, categorias, filters]);

  return {
    ...dreData,
    transactions,
    payables,
    isLoading: loadingTx,
    dateRange: { start, end },
    prevRange: prev,
  };
}

function mapTipToDreGroup(tipo: string): string {
  switch (tipo) {
    case "receita": return "revenue";
    case "despesa": return "operational_expenses";
    case "custo": return "costs";
    case "ajuste": return "deductions";
    default: return "operational_expenses";
  }
}
