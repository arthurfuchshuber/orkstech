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
  /** Filtra por unidade de negócio. "all" ou undefined = consolidado. */
  businessUnitId?: string | "all";
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
  tronco_slug: string | null;
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
    queryKey: ["dre-monthly-tx", targetUserId, empresaId, filters.year, filters.bankAccountId, filters.costCenterId, filters.businessUnitId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      const buFilter = filters.businessUnitId && filters.businessUnitId !== "all" ? filters.businessUnitId : null;

      let qPay = supabase.from("accounts_payable")
        .select("amount, payment_date, categoria_financeira_id, bank_account_id, cost_center_id, business_unit_id, empresa_id, user_id")
        .eq("status", "paid").gte("payment_date", startStr).lte("payment_date", endStr);
      if (empresaId) qPay = qPay.eq("empresa_id", empresaId); else qPay = qPay.eq("user_id", targetUserId!);
      if (filters.bankAccountId) qPay = qPay.eq("bank_account_id", filters.bankAccountId);
      if (filters.costCenterId) qPay = qPay.eq("cost_center_id", filters.costCenterId);
      if (buFilter) qPay = qPay.eq("business_unit_id", buFilter);

      let qRec = supabase.from("accounts_receivable")
        .select("amount, payment_date, categoria_financeira_id, bank_account_id, cost_center_id, business_unit_id, empresa_id, user_id")
        .eq("status", "paid").gte("payment_date", startStr).lte("payment_date", endStr);
      if (empresaId) qRec = qRec.eq("empresa_id", empresaId); else qRec = qRec.eq("user_id", targetUserId!);
      if (filters.bankAccountId) qRec = qRec.eq("bank_account_id", filters.bankAccountId);
      if (filters.costCenterId) qRec = qRec.eq("cost_center_id", filters.costCenterId);
      if (buFilter) qRec = qRec.eq("business_unit_id", buFilter);

      let qPlu = supabase.from("pluggy_transactions")
        .select("amount, date, categoria_financeira_id, type, business_unit_id, user_id")
        .eq("user_id", targetUserId!).eq("reconciled", false).eq("is_internal_transfer", false)
        .not("categoria_financeira_id", "is", null).gte("date", startStr).lte("date", endStr);
      if (buFilter) qPlu = qPlu.eq("business_unit_id", buFilter);

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

    const troncoBy = (slug: string) => tree.find(n => n.tronco_slug === slug);
    const tReceita = troncoBy("receita_operacional");
    const tDeducoes = troncoBy("deducoes_receita");
    const tCustos = troncoBy("custos_diretos");
    const tDespOp = troncoBy("despesas_operacionais");
    const tDespCom = troncoBy("despesas_comerciais");
    const tResFin = troncoBy("resultado_financeiro");
    const tImpostos = troncoBy("impostos");
    const tDistribuicao = troncoBy("distribuicao_lucros");

    const sumMonthlyOf = (n: CatNode | undefined) => n ? sumMonthly(n) : new Array(12).fill(0);
    const sumMonthlyResFin = (node: CatNode | undefined): number[] => {
      const arr = new Array(12).fill(0);
      if (!node) return arr;
      const visit = (n: CatNode) => {
        const sign = n.tipo === "despesa_financeira" ? -1 : 1;
        const m = monthlyByCat.get(n.id);
        if (m) for (let i = 0; i < 12; i++) arr[i] += sign * m[i];
        n.children.forEach(visit);
      };
      visit(node);
      return arr;
    };

    const mReceita = sumMonthlyOf(tReceita);
    const mDeducoes = sumMonthlyOf(tDeducoes);
    const mCustos = sumMonthlyOf(tCustos);
    const mDespOp = sumMonthlyOf(tDespOp);
    const mDespCom = sumMonthlyOf(tDespCom);
    const mResFin = sumMonthlyResFin(tResFin);
    const mImpostos = sumMonthlyOf(tImpostos);
    const mDistribuicao = sumMonthlyOf(tDistribuicao);

    const sub = (a: number[], b: number[]) => a.map((v, i) => v - b[i]);
    const subMany = (a: number[], ...rest: number[][]) =>
      a.map((v, i) => rest.reduce((acc, arr) => acc - arr[i], v));
    const add = (a: number[], b: number[]) => a.map((v, i) => v + b[i]);

    const receitaLiquida = sub(mReceita, mDeducoes);
    const lucroBruto = sub(receitaLiquida, mCustos);
    const resultadoOperacional = subMany(lucroBruto, mDespOp, mDespCom);
    const ebitda = resultadoOperacional;
    const resultadoAntesImpostos = add(resultadoOperacional, mResFin);
    const lucroLiquido = sub(resultadoAntesImpostos, mImpostos);
    const lucroRetido = sub(lucroLiquido, mDistribuicao);

    let counter = 1;
    const num = () => `${counter++}.`;
    const sumArr = (a: number[]) => a.reduce((x, y) => x + y, 0);

    const tronco = (
      node: CatNode | undefined, label: string, depth = 0, signedSum = false,
    ): DREMonthlyLine => {
      const numLabel = num();
      if (!node) return { id: `placeholder-${label}`, label, depth, isGroup: false, isSummary: false, number: numLabel, monthly: new Array(12).fill(0), total: 0 };
      const monthly = signedSum ? sumMonthlyResFin(node) : sumMonthly(node);
      const total = monthly.reduce((a, b) => a + b, 0);
      const children = node.children.map((c, i) => buildLine(c, depth + 1, numLabel, i));
      return {
        id: node.id, label, depth, isGroup: children.length > 0, isSummary: false,
        tipo: node.tipo, number: numLabel, monthly, total,
        children: children.length > 0 ? children : undefined, categoryId: node.id,
      };
    };
    const indicator = (id: string, label: string, monthly: number[]): DREMonthlyLine => ({
      id, label, depth: 0, isGroup: false, isSummary: true,
      number: num(), monthly, total: sumArr(monthly),
    });
    const pctLine = (id: string, label: string, numArr: number[], den: number[]): DREMonthlyLine => ({
      id, label, depth: 0, isGroup: false, isSummary: false, isPercentual: true,
      number: num(),
      monthly: numArr.map((v, i) => den[i] > 0 ? (v / den[i]) * 100 : 0),
      total: sumArr(den) > 0 ? (sumArr(numArr) / sumArr(den)) * 100 : 0,
    });

    const isFiltered = !!(filters.businessUnitId && filters.businessUnitId !== "all");

    const lines: DREMonthlyLine[] = [
      tronco(tReceita, "Receita Operacional"),
      tronco(tDeducoes, "(-) Deduções da Receita"),
      indicator("receita-liquida", "(=) Receita Líquida", receitaLiquida),
      tronco(tCustos, "(-) Custos Diretos"),
      indicator("lucro-bruto", "(=) Lucro Bruto", lucroBruto),
      pctLine("margem-bruta", "(%) Margem Bruta", lucroBruto, mReceita),
      tronco(tDespOp, "(-) Despesas Operacionais"),
      tronco(tDespCom, "(-) Despesas Comerciais"),
      indicator("resultado-operacional", "(=) Resultado Operacional", resultadoOperacional),
      pctLine("margem-operacional", "(%) Margem Operacional", resultadoOperacional, mReceita),
      indicator("ebitda", "(=) EBITDA", ebitda),
      pctLine("margem-ebitda", "(%) Margem EBITDA", ebitda, mReceita),
      tronco(tResFin, "(+/-) Resultado Financeiro", 0, true),
      indicator("resultado-antes-impostos", "(=) Resultado antes dos Impostos", resultadoAntesImpostos),
      tronco(tImpostos, "(-) Impostos"),
      indicator("lucro-liquido", "(=) Lucro Líquido", lucroLiquido),
      pctLine("margem-liquida", "(%) Margem Líquida", lucroLiquido, mReceita),
      ...(isFiltered ? [] : [
        tronco(tDistribuicao, "(-) Distribuição de Lucros"),
        indicator("lucro-retido", "(=) Lucro Retido", lucroRetido),
      ]),
    ];

    return {
      lines,
      receitaTotalMonthly: mReceita,
    };
  }, [categorias, transactions, filters.businessUnitId]);

  return {
    ...data,
    months,
    isLoading,
  };
}
