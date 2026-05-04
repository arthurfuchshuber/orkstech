import { useState, useMemo, Fragment } from "react";
import { useDREMonthly, type DREMonthlyLine } from "@/hooks/useDREMonthly";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBankAccountOptions } from "@/hooks/useBankAccountOptions";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

const fmtBRL = (v: number) => {
  if (Math.abs(v) < 0.005) return "";
  const sign = v < 0 ? "-" : "";
  const abs = Math.abs(v);
  return sign + new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 0 }).format(Math.round(abs));
};
const fmtPct = (v: number) => {
  if (Math.abs(v) < 0.05) return "";
  return `${v.toFixed(0)}%`;
};

const monthLabels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

interface FlatLine {
  line: DREMonthlyLine;
  visible: boolean;
}

export default function DREMensalView() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;

  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0-indexed
  const [year, setYear] = useState(currentYear);
  const [bankAccountId, setBankAccountId] = useState<string | undefined>();
  const [costCenterId, setCostCenterId] = useState<string | undefined>();
  const [showAV, setShowAV] = useState(true);
  const [showAH, setShowAH] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Default: show last 3 months of current year (or all 12 if past year)
  const defaultStart = year === currentYear ? Math.max(0, currentMonth - 2) : 0;
  const defaultEnd = year === currentYear ? currentMonth : 11;
  const [monthRange, setMonthRange] = useState<[number, number]>([defaultStart, defaultEnd]);

  const { lines, receitaTotalMonthly, isLoading } = useDREMonthly({ year, bankAccountId, costCenterId });
  const { options: bankAccounts } = useBankAccountOptions();
  const { data: costCenters = [] } = useQuery({
    queryKey: ["dre-mensal-cc", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase.from("centros_custo").select("id, nome").eq("ativo", true).eq("user_id", targetUserId!);
      return data ?? [];
    },
  });

  const visibleMonths = useMemo(() => {
    const arr: number[] = [];
    for (let i = monthRange[0]; i <= monthRange[1]; i++) arr.push(i);
    return arr;
  }, [monthRange]);

  const toggle = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const flat = useMemo(() => {
    const out: FlatLine[] = [];
    const walk = (items: DREMonthlyLine[], parentVisible: boolean) => {
      for (const line of items) {
        out.push({ line, visible: parentVisible });
        if (line.children?.length) {
          walk(line.children, parentVisible && expanded.has(line.id));
        }
      }
    };
    walk(lines, true);
    return out;
  }, [lines, expanded]);

  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <Select value={String(year)} onValueChange={(v) => {
          const y = Number(v);
          setYear(y);
          if (y === currentYear) setMonthRange([Math.max(0, currentMonth - 2), currentMonth]);
          else setMonthRange([0, 11]);
        }}>
          <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>

        <Select value={`${monthRange[0]}-${monthRange[1]}`} onValueChange={(v) => {
          const [a, b] = v.split("-").map(Number);
          setMonthRange([a, b]);
        }}>
          <SelectTrigger className="w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="0-11">Ano completo</SelectItem>
            <SelectItem value={`${Math.max(0, (year === currentYear ? currentMonth : 11) - 2)}-${year === currentYear ? currentMonth : 11}`}>Últimos 3 meses</SelectItem>
            <SelectItem value={`${Math.max(0, (year === currentYear ? currentMonth : 11) - 5)}-${year === currentYear ? currentMonth : 11}`}>Últimos 6 meses</SelectItem>
            <SelectItem value="0-2">1º Trimestre</SelectItem>
            <SelectItem value="3-5">2º Trimestre</SelectItem>
            <SelectItem value="6-8">3º Trimestre</SelectItem>
            <SelectItem value="9-11">4º Trimestre</SelectItem>
          </SelectContent>
        </Select>

        <Select value={bankAccountId || "all"} onValueChange={(v) => setBankAccountId(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[220px] h-9 text-sm"><SelectValue placeholder="Conta bancária" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as contas</SelectItem>
            {bankAccounts.map((b) => (
              <SelectItem key={b.id} value={b.id}>
                <div className="flex flex-col leading-tight">
                  <span className="text-sm">{b.primaryLabel}</span>
                  {b.secondaryLabel && <span className="text-[10px] text-muted-foreground">{b.secondaryLabel}</span>}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={costCenterId || "all"} onValueChange={(v) => setCostCenterId(v === "all" ? undefined : v)}>
          <SelectTrigger className="w-[170px] h-9 text-sm"><SelectValue placeholder="Centro de custo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os centros</SelectItem>
            {costCenters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-4 ml-auto">
          <div className="flex items-center gap-2">
            <Switch id="av" checked={showAV} onCheckedChange={setShowAV} />
            <Label htmlFor="av" className="text-xs cursor-pointer">A.V. <span className="text-muted-foreground">(vertical)</span></Label>
          </div>
          <div className="flex items-center gap-2">
            <Switch id="ah" checked={showAH} onCheckedChange={setShowAH} />
            <Label htmlFor="ah" className="text-xs cursor-pointer">A.H. <span className="text-muted-foreground">(horizontal)</span></Label>
          </div>
        </div>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <div className="overflow-x-auto custom-scrollbar">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-border/40 bg-muted/20">
                    <th className="sticky left-0 z-10 bg-muted/20 text-left font-medium py-2.5 px-3 min-w-[280px]">Conta</th>
                    {visibleMonths.map((m) => (
                      <Fragment key={`h-${m}`}>
                        <th className="text-right font-medium py-2.5 px-2 min-w-[90px]">
                          {monthLabels[m]}
                        </th>
                        {showAV && <th className="text-right font-normal text-muted-foreground py-2.5 px-1 min-w-[44px]">A.V.</th>}
                        {showAH && <th className="text-right font-normal text-muted-foreground py-2.5 px-1 min-w-[44px]">A.H.</th>}
                      </Fragment>
                    ))}
                    <th className="text-right font-semibold py-2.5 px-3 min-w-[110px] bg-muted/30">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {flat.filter(f => f.visible).map(({ line }) => {
                    const hasChildren = !!line.children?.length;
                    const isOpen = expanded.has(line.id);
                    const isSummary = line.isSummary;
                    const isIndicator = isSummary || line.isPercentual;

                    const rowClass = isSummary
                      ? "bg-muted/40 border-t border-border/40 font-semibold"
                      : line.depth === 0
                      ? "font-medium"
                      : "";

                    const labelColor = isSummary
                      ? "text-foreground"
                      : line.depth === 0
                      ? "text-foreground"
                      : "text-muted-foreground";

                    const isResult = isSummary || line.isPercentual || line.id?.startsWith("lucro-") || line.id?.startsWith("resultado-") || line.id?.startsWith("ebitda") || line.id === "receita-liquida" || line.id?.startsWith("margem-");

                    const valueColor = (v: number) => {
                      if (Math.abs(v) < 0.005) return "text-muted-foreground/50";
                      // Resultados (lucros, margens, EBITDA, etc): verde se positivo, laranja se negativo
                      if (isResult) return v >= 0 ? "text-success" : "text-orange-500";
                      // Entradas de dinheiro: verde
                      if (line.tipo === "receita" || line.tipo === "receita_financeira") return "text-success";
                      // Saídas de dinheiro: amarelo
                      if (line.tipo === "despesa" || line.tipo === "custo" || line.tipo === "deducao" || line.tipo === "despesa_financeira" || line.tipo === "imposto") return "text-warning";
                      return "text-foreground";
                    };

                    return (
                      <tr key={line.id} className={cn("border-b border-border/15 hover:bg-muted/10 transition-colors", rowClass)}>
                        <td className={cn("sticky left-0 z-10 py-1.5 px-3", isSummary ? "bg-muted/40" : "bg-card")}>
                          <div
                            className="flex items-center gap-1.5 cursor-pointer select-none"
                            style={{ paddingLeft: `${line.depth * 16}px` }}
                            onClick={() => hasChildren && toggle(line.id)}
                          >
                            {hasChildren ? (
                              isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <span className="w-3.5 flex-shrink-0" />
                            )}
                            <span className={cn("text-xs", labelColor)}>{line.label}</span>
                          </div>
                        </td>
                        {visibleMonths.map((m) => {
                          const v = line.monthly[m] ?? 0;
                          const prev = m > 0 ? (line.monthly[m - 1] ?? 0) : 0;
                          const ah = prev !== 0 ? ((v - prev) / Math.abs(prev)) * 100 : null;
                          const av = receitaTotalMonthly[m] > 0 ? (v / receitaTotalMonthly[m]) * 100 : 0;
                          return (
                            <Fragment key={`c-${line.id}-${m}`}>
                              <td className={cn("text-right py-1.5 px-2 tabular-nums", valueColor(v))}>
                                {line.isPercentual ? fmtPct(v) : fmtBRL(v)}
                              </td>
                              {showAV && (
                                <td className="text-right py-1.5 px-1 text-muted-foreground tabular-nums text-[10px]">
                                  {line.isPercentual || Math.abs(v) < 0.005 ? "" : fmtPct(av)}
                                </td>
                              )}
                              {showAH && (
                                <td className="text-right py-1.5 px-1 tabular-nums text-[10px]">
                                  {ah == null || line.isPercentual ? "" : (
                                    <span className={ah >= 0 ? "text-success" : "text-destructive"}>{ah >= 0 ? "+" : ""}{ah.toFixed(0)}%</span>
                                  )}
                                </td>
                              )}
                            </Fragment>
                          );
                        })}
                        <td className={cn("text-right py-1.5 px-3 font-semibold tabular-nums bg-muted/20", valueColor(line.total))}>
                          {line.isPercentual ? fmtPct(line.total) : fmtBRL(line.total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
