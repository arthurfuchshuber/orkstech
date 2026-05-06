import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useMemo } from "react";
import { startOfYear, endOfYear, format, addMonths, startOfMonth, endOfMonth } from "date-fns";

export interface DREMonthlyFilters {
  year: number;
  bankAccountId?: string;
  costCenterId?: string;
}

export interface DREMonthlyLine {
  id: string;
  label: string;
  depth: number;
  isGroup: boolean;
  isSummary: boolean;
  isPercentual?: boolean;
  tipo?: string;
  number?: string;
  monthly: number[]; // length 12 (or N months)
  total: number;
  children?: DREMonthlyLine[];
  categoryId?: string;
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

export function useDREMonthly(filters: DREMonthlyFilters) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const empresaId = empresa?.id;

  const yearStart = startOfYear(new Date(filters.year, 0, 1));
  const yearEnd = endOfYear(yearStart);
  const startStr = format(yearStart, "yyyy-MM-dd");
  const endStr = format(yearEnd, "yyyy-MM-dd");

  const months = useMemo(() => {
    const arr: { idx: number; label: string; start: Date; end: Date }[] = [];
    for (let m = 0; m < 12; m++) {
      const s = startOfMonth(addMonths(yearStart, m));
      const e = endOfMonth(s);
      arr.push({ idx: m, label: format(s, "MMM"), start: s, end: e });
    }
    return arr;
  }, [filters.year]);

  const { data: categorias = [] } = useQuery({
    queryKey: ["dre-monthly-cats", targetUserId],
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
    queryKey: ["dre-monthly-tx", targetUserId, empresaId, filters.year, filters.bankAccountId, filters.costCenterId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      let qPay = supabase.from("accounts_payable")
        .select("amount, payment_date, categoria_financeira_id, bank_account_id, cost_center_id, empresa_id, user_id")
        .eq("status", "paid").gte("payment_date", startStr).lte("payment_date", endStr);
      if (empresaId) qPay = qPay.eq("empresa_id", empresaId); else qPay = qPay.eq("user_id", targetUserId!);
      if (filters.bankAccountId) qPay = qPay.eq("bank_account_id", filters.bankAccountId);
      if (filters.costCenterId) qPay = qPay.eq("cost_center_id", filters.costCenterId);

      let qRec = supabase.from("accounts_receivable")
        .select("amount, payment_date, categoria_financeira_id, bank_account_id, cost_center_id, empresa_id, user_id")
        .eq("status", "paid").gte("payment_date", startStr).lte("payment_date", endStr);
      if (empresaId) qRec = qRec.eq("empresa_id", empresaId); else qRec = qRec.eq("user_id", targetUserId!);
      if (filters.bankAccountId) qRec = qRec.eq("bank_account_id", filters.bankAccountId);
      if (filters.costCenterId) qRec = qRec.eq("cost_center_id", filters.costCenterId);

      let qPlu = supabase.from("pluggy_transactions")
        .select("amount, date, categoria_financeira_id, type, user_id")
        .eq("user_id", targetUserId!).eq("reconciled", false).eq("is_internal_transfer", false)
        .not("categoria_financeira_id", "is", null).gte("date", startStr).lte("date", endStr);

      const [payRes, recRes, pluRes] = await Promise.all([qPay, qRec, qPlu]);
      if (payRes.error) throw payRes.error;
      if (recRes.error) throw recRes.error;
      if (pluRes.error) throw pluRes.error;

      const out: { date: string; amount: number; categoria_financeira_id: string | null; type: "income" | "expense" }[] = [];
      (payRes.data ?? []).forEach((r: any) => out.push({ date: r.payment_date, amount: Math.abs(Number(r.amount)), categoria_financeira_id: r.categoria_financeira_id, type: "expense" }));
      (recRes.data ?? []).forEach((r: any) => out.push({ date: r.payment_date, amount: Math.abs(Number(r.amount)), categoria_financeira_id: r.categoria_financeira_id, type: "income" }));
      (pluRes.data ?? []).forEach((r: any) => out.push({ date: r.date, amount: Math.abs(Number(r.amount)), categoria_financeira_id: r.categoria_financeira_id, type: Number(r.amount) >= 0 ? "income" : "expense" }));
      return out;
    },
  });

  const data = useMemo(() => {
    const tree = buildCatTree(categorias);

    // map[catId] = number[12]
    const monthlyByCat = new Map<string, number[]>();
    for (const t of transactions) {
      if (!t.categoria_financeira_id) continue;
      const m = new Date(t.date + "T12:00:00").getMonth();
      const arr = monthlyByCat.get(t.categoria_financeira_id) ?? new Array(12).fill(0);
      arr[m] += t.amount;
      monthlyByCat.set(t.categoria_financeira_id, arr);
    }

    const sumMonthly = (node: CatNode): number[] => {
      const arr = new Array(12).fill(0);
      const ids = getAllIds(node);
      for (const id of ids) {
        const m = monthlyByCat.get(id);
        if (!m) continue;
        for (let i = 0; i < 12; i++) arr[i] += m[i];
      }
      return arr;
    };

    function buildLine(node: CatNode, depth: number, numberPrefix: string, idx: number): DREMonthlyLine {
      const num = numberPrefix ? `${numberPrefix}${idx + 1}.` : `${idx + 1}.`;
      const monthly = sumMonthly(node);
      const total = monthly.reduce((a, b) => a + b, 0);
      const children = node.children.map((c, i) => buildLine(c, depth + 1, num, i));
      return {
        id: node.id,
        label: node.nome,
        depth,
        isGroup: children.length > 0,
        isSummary: false,
        tipo: node.tipo,
        number: num,
        monthly,
        total,
        children: children.length > 0 ? children : undefined,
        categoryId: node.id,
      };
    }

    const lines: DREMonthlyLine[] = [];
    const totals = {
      receita: new Array(12).fill(0), deducao: new Array(12).fill(0),
      custo: new Array(12).fill(0), despesa: new Array(12).fill(0),
      receita_fin: new Array(12).fill(0), despesa_fin: new Array(12).fill(0),
      imposto: new Array(12).fill(0), distribuicao: new Array(12).fill(0),
    };
    const map: Record<string, keyof typeof totals> = {
      receita: "receita", deducao: "deducao", custo: "custo", despesa: "despesa",
      receita_financeira: "receita_fin", despesa_financeira: "despesa_fin", imposto: "imposto",
      distribuicao_lucros: "distribuicao",
    };

    tree.forEach((root, idx) => {
      const line = buildLine(root, 0, "", idx);
      const key = map[root.tipo];
      if (key) for (let i = 0; i < 12; i++) totals[key][i] += line.monthly[i];
      lines.push(line);
    });

    const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
    const add = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);

    const receitaLiquida = sub(totals.receita, totals.deducao);
    const lucroBruto = sub(receitaLiquida, totals.custo);
    const resultadoOperacional = sub(lucroBruto, totals.despesa);
    const resultadoFinanceiro = sub(totals.receita_fin, totals.despesa_fin);
    const resultadoAntesImpostos = add(resultadoOperacional, resultadoFinanceiro);
    const lucroLiquido = sub(resultadoAntesImpostos, totals.imposto);
    const lucroRetido = sub(lucroLiquido, totals.distribuicao);

    let nextNum = lines.length + 1;
    const sumArr = (a: number[]) => a.reduce((x, y) => x + y, 0);
    const indicator = (id: string, label: string, monthly: number[], isSummary = true): DREMonthlyLine => ({
      id, label, depth: 0, isGroup: false, isSummary,
      number: `${nextNum++}.`, monthly, total: sumArr(monthly),
    });
    const pctLine = (id: string, label: string, num: number[], den: number[]): DREMonthlyLine => ({
      id, label, depth: 0, isGroup: false, isSummary: false, isPercentual: true,
      number: `${nextNum++}.`,
      monthly: num.map((v, i) => den[i] > 0 ? (v / den[i]) * 100 : 0),
      total: sumArr(den) > 0 ? (sumArr(num) / sumArr(den)) * 100 : 0,
    });

    const indicators: DREMonthlyLine[] = [
      indicator("receita-liquida", "(=) Receita Líquida", receitaLiquida),
      indicator("lucro-bruto", "(=) Lucro Bruto", lucroBruto),
      pctLine("margem-bruta", "(%) Margem Bruta", lucroBruto, totals.receita),
      indicator("resultado-operacional", "(=) Resultado Operacional", resultadoOperacional),
      pctLine("margem-operacional", "(%) Margem Operacional", resultadoOperacional, totals.receita),
      indicator("ebitda", "(=) EBITDA", resultadoOperacional),
      pctLine("margem-ebitda", "(%) Margem EBITDA", resultadoOperacional, totals.receita),
      indicator("resultado-financeiro", "(+/-) Resultado Financeiro", resultadoFinanceiro),
      indicator("resultado-antes-impostos", "(=) Resultado antes dos Impostos", resultadoAntesImpostos),
      indicator("impostos", "(-) Impostos", totals.imposto),
      indicator("lucro-liquido", "(=) Lucro Líquido", lucroLiquido),
      pctLine("margem-liquida", "(%) Margem Líquida", lucroLiquido, totals.receita),
      indicator("distribuicao-lucros", "(-) Distribuição de Lucros", totals.distribuicao),
      indicator("lucro-retido", "(=) Lucro Retido", lucroRetido),
    ];

    return {
      lines: [...lines, ...indicators],
      receitaTotalMonthly: totals.receita,
    };
  }, [categorias, transactions]);

  return {
    ...data,
    months,
    isLoading,
  };
}
