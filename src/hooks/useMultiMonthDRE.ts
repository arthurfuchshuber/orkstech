import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useMemo } from "react";

export interface DRELine {
  id: string;
  label: string;
  depth: number;
  amounts: Record<string, number>;
  percentages: Record<string, number>;
  isGroup: boolean;
  isSummary: boolean;
  /** "category" = from plano de contas, "computed" = calculated DRE line */
  lineType: "category" | "computed";
  /** Sign prefix for display: "(+)", "(-)", "(=)" or "" */
  sign: string;
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

function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

/** Helper: sum amounts across months */
function sumAmounts(a: Record<string, number>, b: Record<string, number>, keys: string[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const k of keys) r[k] = (a[k] || 0) + (b[k] || 0);
  return r;
}

function subAmounts(a: Record<string, number>, b: Record<string, number>, keys: string[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const k of keys) r[k] = (a[k] || 0) - (b[k] || 0);
  return r;
}

function zeroAmounts(keys: string[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const k of keys) r[k] = 0;
  return r;
}

function pctAmounts(amounts: Record<string, number>, base: Record<string, number>, keys: string[]): Record<string, number> {
  const r: Record<string, number> = {};
  for (const k of keys) r[k] = base[k] > 0 ? (amounts[k] / base[k]) * 100 : 0;
  return r;
}

function makeLine(
  id: string, label: string, sign: string, amounts: Record<string, number>,
  revenueByMonth: Record<string, number>, keys: string[], opts?: Partial<DRELine>
): DRELine {
  return {
    id, label, sign, depth: 0, amounts,
    percentages: pctAmounts(amounts, revenueByMonth, keys),
    isGroup: false, isSummary: true, lineType: "computed",
    ...opts,
  };
}

export function useMultiMonthDRE(year: number, months: number[]) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;

  const sortedMonths = useMemo(() => [...months].sort((a, b) => a - b), [months]);
  const mKeys = useMemo(() => sortedMonths.map(m => monthKey(year, m)), [year, sortedMonths]);

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
        .from("categorias_financeiras").select("*")
        .eq("user_id", targetUserId!).eq("ativo", true).order("ordem");
      if (error) throw error;
      return (data ?? []) as CatRow[];
    },
  });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["dre-multi-tx", targetUserId, startStr, endStr],
    enabled: !!user && !!targetUserId && sortedMonths.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("cash_transactions").select("*")
        .eq("user_id", targetUserId!)
        .gte("transaction_date", startStr).lte("transaction_date", endStr);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: availablePeriods = [] } = useQuery({
    queryKey: ["dre-available-periods", targetUserId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      const { data: txData } = await supabase
        .from("cash_transactions").select("transaction_date").eq("user_id", targetUserId!);
      const { data: apData } = await supabase
        .from("accounts_payable").select("due_date").eq("user_id", targetUserId!);
      const periods = new Set<string>();
      for (const r of (txData ?? [])) {
        const d = (r as any).transaction_date;
        if (d) periods.add(d.substring(0, 7));
      }
      for (const r of (apData ?? [])) {
        const d = (r as any).due_date;
        if (d) periods.add(d.substring(0, 7));
      }
      const now = new Date();
      periods.add(monthKey(now.getFullYear(), now.getMonth() + 1));
      return Array.from(periods).sort();
    },
  });

  const dreData = useMemo(() => {
    const tree = buildCatTree(categorias);

    // Index transactions by month+category
    const txByMonthCat = new Map<string, Map<string, number>>();
    for (const mk of mKeys) txByMonthCat.set(mk, new Map());
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
      return getAllIds(node).reduce((s, id) => s + (catMap.get(id) || 0), 0);
    };

    // Build category line
    function buildNodeLine(node: CatNode, depth: number, numPrefix: string, idx: number): DRELine {
      const num = numPrefix ? `${numPrefix}${idx + 1}.` : `${idx + 1}.`;
      const amounts: Record<string, number> = {};
      for (const mk of mKeys) amounts[mk] = sumNode(node, txByMonthCat.get(mk) || new Map());
      const childLines = node.children.map((child, i) => buildNodeLine(child, depth + 1, num, i));
      return {
        id: node.id, label: node.nome, depth, amounts,
        percentages: zeroAmounts(mKeys), // will be filled later
        isGroup: childLines.length > 0, isSummary: false, lineType: "category",
        sign: "", tipo: node.tipo,
        children: childLines.length > 0 ? childLines : undefined,
        categoryId: node.id, number: num,
      };
    }

    // Separate roots by tipo
    const receitaRoots = tree.filter(n => n.tipo === "receita");
    const custoRoots = tree.filter(n => n.tipo === "custo");
    const despesaRoots = tree.filter(n => n.tipo === "despesa");
    const ajusteRoots = tree.filter(n => n.tipo === "ajuste");

    // Compute totals by tipo per month
    function sumRoots(roots: CatNode[]): Record<string, number> {
      const r = zeroAmounts(mKeys);
      for (const mk of mKeys) {
        const catMap = txByMonthCat.get(mk) || new Map();
        for (const root of roots) r[mk] += sumNode(root, catMap);
      }
      return r;
    }

    const receitaTotal = sumRoots(receitaRoots);
    const custoTotal = sumRoots(custoRoots);
    const despesaTotal = sumRoots(despesaRoots);
    const ajusteTotal = sumRoots(ajusteRoots);

    // DRE computed lines
    const receitaLiquida = subAmounts(receitaTotal, ajusteTotal, mKeys);
    const margemBruta = subAmounts(receitaLiquida, custoTotal, mKeys);
    // For now despesas variáveis = 0 (no separate classification yet)
    const despesasVariaveis = zeroAmounts(mKeys);
    const margemContribuicao = subAmounts(margemBruta, despesasVariaveis, mKeys);
    const ebitda = subAmounts(margemContribuicao, despesaTotal, mKeys);
    // Depreciação = 0 (no separate classification yet)
    const depreciacao = zeroAmounts(mKeys);
    const resultadoOperacional = subAmounts(ebitda, depreciacao, mKeys);

    // Build the full DRE lines array
    const lines: DRELine[] = [];
    let catCounter = 0;

    // --- (+) RECEITA BRUTA (group with category children)
    const receitaCatLines = receitaRoots.map((root, i) => {
      const line = buildNodeLine(root, 1, `${catCounter + 1}.`, i);
      // Fill percentages based on receita bruta
      fillPercentages(line, receitaTotal);
      return line;
    });
    lines.push({
      id: "receita-bruta", label: "RECEITA BRUTA", sign: "(+)", depth: 0,
      amounts: receitaTotal, percentages: pctAmounts(receitaTotal, receitaTotal, mKeys),
      isGroup: true, isSummary: false, lineType: "computed",
      children: receitaCatLines,
    });
    catCounter++;

    // --- (-) DEDUÇÕES DA RECEITA
    const ajusteCatLines = ajusteRoots.map((root, i) => {
      const line = buildNodeLine(root, 1, `${catCounter + 1}.`, i);
      fillPercentages(line, receitaTotal);
      return line;
    });
    lines.push({
      id: "deducoes-receita", label: "DEDUÇÕES DA RECEITA", sign: "(-)", depth: 0,
      amounts: ajusteTotal, percentages: pctAmounts(ajusteTotal, receitaTotal, mKeys),
      isGroup: ajusteCatLines.length > 0, isSummary: false, lineType: "computed",
      children: ajusteCatLines.length > 0 ? ajusteCatLines : undefined,
    });
    catCounter++;

    // --- (=) RECEITA LÍQUIDA
    lines.push(makeLine("receita-liquida", "RECEITA VENDAS LÍQUIDA", "(=)", receitaLiquida, receitaTotal, mKeys));

    // --- (-) CUSTO DOS PRODUTOS/SERVIÇOS VENDIDOS
    const custoCatLines = custoRoots.map((root, i) => {
      const line = buildNodeLine(root, 1, `${catCounter + 1}.`, i);
      fillPercentages(line, receitaTotal);
      return line;
    });
    lines.push({
      id: "cpv", label: "CUSTO DOS PRODUTOS E SERVIÇOS VENDIDOS", sign: "(-)", depth: 0,
      amounts: custoTotal, percentages: pctAmounts(custoTotal, receitaTotal, mKeys),
      isGroup: custoCatLines.length > 0, isSummary: false, lineType: "computed",
      children: custoCatLines.length > 0 ? custoCatLines : undefined,
    });
    catCounter++;

    // --- (=) MARGEM BRUTA
    lines.push(makeLine("margem-bruta", "MARGEM BRUTA", "(=)", margemBruta, receitaTotal, mKeys));

    // --- DESPESAS VARIÁVEIS (placeholder)
    lines.push(makeLine("despesas-variaveis", "DESPESAS VARIÁVEIS", "", despesasVariaveis, receitaTotal, mKeys, { isSummary: false }));

    // --- (=) MARGEM DE CONTRIBUIÇÃO
    lines.push(makeLine("margem-contribuicao", "MARGEM DE CONTRIBUIÇÃO", "(=)", margemContribuicao, receitaTotal, mKeys));

    // --- (-) GASTOS E DESPESAS (group with category children)
    const despesaCatLines = despesaRoots.map((root, i) => {
      const line = buildNodeLine(root, 1, `${catCounter + 1}.`, i);
      fillPercentages(line, receitaTotal);
      return line;
    });
    lines.push({
      id: "gastos-despesas", label: "GASTOS E DESPESAS", sign: "(-)", depth: 0,
      amounts: despesaTotal, percentages: pctAmounts(despesaTotal, receitaTotal, mKeys),
      isGroup: despesaCatLines.length > 0, isSummary: false, lineType: "computed",
      children: despesaCatLines.length > 0 ? despesaCatLines : undefined,
    });
    catCounter++;

    // --- (=) EBITDA
    lines.push(makeLine("ebitda", "EBITDA", "(=)", ebitda, receitaTotal, mKeys));

    // --- (-) DEPRECIAÇÃO
    lines.push(makeLine("depreciacao", "DEPRECIAÇÃO", "(-)", depreciacao, receitaTotal, mKeys, { isSummary: false }));

    // --- (=) RESULTADO OPERACIONAL
    lines.push(makeLine("resultado-operacional", "RESULTADO OPERACIONAL", "(=)", resultadoOperacional, receitaTotal, mKeys));

    // Fill percentages recursively
    function fillPercentages(line: DRELine, base: Record<string, number>) {
      line.percentages = pctAmounts(line.amounts, base, mKeys);
      if (line.children) line.children.forEach(c => fillPercentages(c, base));
    }

    return { lines, monthKeys: mKeys, totalRevenueByMonth: receitaTotal };
  }, [transactions, categorias, mKeys]);

  return {
    ...dreData,
    transactions,
    isLoading,
    availablePeriods,
  };
}
