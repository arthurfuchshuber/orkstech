import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useMemo } from "react";

export interface DRELine {
  id: string;
  label: string;
  depth: number;
  /** amount per month key "YYYY-MM" */
  amounts: Record<string, number>;
  /** percentage per month key */
  percentages: Record<string, number>;
  isGroup: boolean;
  isSummary: boolean;
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
}

interface CatNode extends CatRow {
  children: CatNode[];
}

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

function getAllIds(node: CatNode): string[] {
  const ids = [node.id];
  node.children.forEach(c => ids.push(...getAllIds(c)));
  return ids;
}

/** Build a "YYYY-MM" key */
function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function useMultiMonthDRE(year: number, months: number[]) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;

  const sortedMonths = useMemo(() => [...months].sort((a, b) => a - b), [months]);
  const monthKeys = useMemo(() => sortedMonths.map(m => monthKey(year, m)), [year, sortedMonths]);

  // Date range spanning all selected months
  const startStr = useMemo(() => {
    if (sortedMonths.length === 0) return "";
    return `${year}-${String(sortedMonths[0]).padStart(2, "0")}-01`;
  }, [year, sortedMonths]);

  const endStr = useMemo(() => {
    if (sortedMonths.length === 0) return "";
    const lastMonth = sortedMonths[sortedMonths.length - 1];
    const lastDay = new Date(year, lastMonth, 0).getDate();
    return `${year}-${String(lastMonth).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  }, [year, sortedMonths]);

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

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["dre-multi-tx", targetUserId, startStr, endStr],
    enabled: !!user && !!targetUserId && sortedMonths.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_transactions")
        .select("*")
        .eq("user_id", targetUserId!)
        .gte("transaction_date", startStr)
        .lte("transaction_date", endStr);
      if (error) throw error;
      return data ?? [];
    },
  });

  // Available years/months from transactions + accounts_payable
  const { data: availablePeriods = [] } = useQuery({
    queryKey: ["dre-available-periods", targetUserId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_dre_available_periods" as any);
      // Fallback: query directly
      if (error) {
        const { data: txData } = await supabase
          .from("cash_transactions")
          .select("transaction_date")
          .eq("user_id", targetUserId!);
        const { data: apData } = await supabase
          .from("accounts_payable")
          .select("due_date")
          .eq("user_id", targetUserId!);
        const periods = new Set<string>();
        for (const r of (txData ?? [])) {
          const d = (r as any).transaction_date;
          if (d) periods.add(d.substring(0, 7));
        }
        for (const r of (apData ?? [])) {
          const d = (r as any).due_date;
          if (d) periods.add(d.substring(0, 7));
        }
        // Also add current month so there's always something
        const now = new Date();
        periods.add(monthKey(now.getFullYear(), now.getMonth() + 1));
        return Array.from(periods).sort();
      }
      return (data ?? []) as string[];
    },
  });

  const dreData = useMemo(() => {
    const tree = buildCatTree(categorias);

    // Index transactions by month+category
    // Map<monthKey, Map<catId, amount>>
    const txByMonthCat = new Map<string, Map<string, number>>();
    for (const mk of monthKeys) {
      txByMonthCat.set(mk, new Map());
    }
    for (const t of transactions) {
      const catId = (t as any).categoria_financeira_id;
      const date = (t as any).transaction_date as string;
      if (!catId || !date) continue;
      const mk = date.substring(0, 7);
      if (!txByMonthCat.has(mk)) continue;
      const catMap = txByMonthCat.get(mk)!;
      catMap.set(catId, (catMap.get(catId) || 0) + Math.abs(Number((t as any).amount)));
    }

    const sumNode = (node: CatNode, catMap: Map<string, number>): number => {
      const ids = getAllIds(node);
      return ids.reduce((s, id) => s + (catMap.get(id) || 0), 0);
    };

    // Compute total revenue per month
    const revenueRoots = tree.filter(n => n.tipo === "receita");
    const totalRevenueByMonth: Record<string, number> = {};
    for (const mk of monthKeys) {
      const catMap = txByMonthCat.get(mk) || new Map();
      totalRevenueByMonth[mk] = revenueRoots.reduce((s, n) => s + sumNode(n, catMap), 0);
    }

    function buildNodeLine(node: CatNode, depth: number, numPrefix: string, idx: number): DRELine {
      const num = numPrefix ? `${numPrefix}${idx + 1}.` : `${idx + 1}.`;
      const amounts: Record<string, number> = {};
      const percentages: Record<string, number> = {};
      for (const mk of monthKeys) {
        const catMap = txByMonthCat.get(mk) || new Map();
        const amt = sumNode(node, catMap);
        amounts[mk] = amt;
        const rev = totalRevenueByMonth[mk];
        percentages[mk] = rev > 0 ? (amt / rev) * 100 : 0;
      }
      const childLines = node.children.map((child, i) => buildNodeLine(child, depth + 1, num, i));
      return {
        id: node.id,
        label: node.nome,
        depth,
        amounts,
        percentages,
        isGroup: childLines.length > 0,
        isSummary: false,
        tipo: node.tipo,
        children: childLines.length > 0 ? childLines : undefined,
        categoryId: node.id,
        number: num,
      };
    }

    const lines: DRELine[] = [];
    const totalsByTipoMonth: Record<string, Record<string, number>> = { receita: {}, despesa: {}, custo: {} };
    for (const mk of monthKeys) {
      totalsByTipoMonth.receita[mk] = 0;
      totalsByTipoMonth.despesa[mk] = 0;
      totalsByTipoMonth.custo[mk] = 0;
    }

    tree.forEach((root, idx) => {
      const line = buildNodeLine(root, 0, "", idx);
      lines.push(line);
      for (const mk of monthKeys) {
        if (root.tipo === "receita") totalsByTipoMonth.receita[mk] += line.amounts[mk];
        else if (root.tipo === "despesa") totalsByTipoMonth.despesa[mk] += line.amounts[mk];
        else if (root.tipo === "custo") totalsByTipoMonth.custo[mk] += line.amounts[mk];
      }
    });

    // Summary lines
    const makeSummary = (id: string, label: string, calcAmounts: Record<string, number>): DRELine => {
      const percentages: Record<string, number> = {};
      for (const mk of monthKeys) {
        const rev = totalRevenueByMonth[mk];
        percentages[mk] = rev > 0 ? (calcAmounts[mk] / rev) * 100 : 0;
      }
      return { id, label, depth: 0, amounts: calcAmounts, percentages, isGroup: false, isSummary: true };
    };

    const hasData = monthKeys.some(mk =>
      totalsByTipoMonth.receita[mk] > 0 || totalsByTipoMonth.despesa[mk] > 0 || totalsByTipoMonth.custo[mk] > 0
    );

    if (hasData || tree.length > 0) {
      lines.push(makeSummary("total-receitas", "TOTAL RECEITAS", totalsByTipoMonth.receita));

      const hasCusto = monthKeys.some(mk => totalsByTipoMonth.custo[mk] > 0);
      if (hasCusto) {
        lines.push(makeSummary("total-custos", "(-) TOTAL CUSTOS", totalsByTipoMonth.custo));
        const lucBruto: Record<string, number> = {};
        for (const mk of monthKeys) lucBruto[mk] = totalsByTipoMonth.receita[mk] - totalsByTipoMonth.custo[mk];
        lines.push(makeSummary("lucro-bruto", "LUCRO BRUTO", lucBruto));
      }

      const hasDespesa = monthKeys.some(mk => totalsByTipoMonth.despesa[mk] > 0);
      if (hasDespesa) {
        lines.push(makeSummary("total-despesas", "(-) TOTAL DESPESAS", totalsByTipoMonth.despesa));
      }

      const resultado: Record<string, number> = {};
      for (const mk of monthKeys) {
        resultado[mk] = totalsByTipoMonth.receita[mk] - totalsByTipoMonth.despesa[mk] - totalsByTipoMonth.custo[mk];
      }
      lines.push(makeSummary("resultado-liquido", "RESULTADO LÍQUIDO", resultado));
    }

    return { lines, monthKeys, totalRevenueByMonth };
  }, [transactions, categorias, monthKeys]);

  return {
    ...dreData,
    transactions,
    isLoading,
    availablePeriods,
  };
}
