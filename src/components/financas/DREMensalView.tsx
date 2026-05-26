import { useState, useMemo, useEffect, Fragment } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { useDREMonthly, type DREMonthlyLine } from "@/hooks/useDREMonthly";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useBankAccountOptions } from "@/hooks/useBankAccountOptions";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { DRECategoriaMovimentacoesModal } from "./dre/DRECategoriaMovimentacoesModal";

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
  const [businessUnitId, setBusinessUnitId] = useState<string>("all");
  const [showAV, setShowAV] = useState(true);
  const [showAH, setShowAH] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [movModal, setMovModal] = useState<{ open: boolean; categoryId: string | null; label: string }>({ open: false, categoryId: null, label: "" });
  // Default: show last 3 months of current year (or all 12 if past year)
  const defaultStart = year === currentYear ? Math.max(0, currentMonth - 2) : 0;
  const defaultEnd = year === currentYear ? currentMonth : 11;
  const [monthRange, setMonthRange] = useState<[number, number]>([defaultStart, defaultEnd]);

  const { lines, receitaTotalMonthly, isLoading } = useDREMonthly({ year, bankAccountId, costCenterId, businessUnitId });
  const { options: bankAccounts } = useBankAccountOptions();
  const { businessUnits } = useBusinessUnits();
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

  const isMobile = useIsMobile();
  // Mobile pagination: 1 month per page if A.V. or A.H. on, else 2 months
  const monthsPerPage = isMobile ? ((showAV || showAH) ? 1 : 2) : visibleMonths.length;
  const [monthPage, setMonthPage] = useState(0);
  const totalPages = Math.max(1, Math.ceil(visibleMonths.length / Math.max(1, monthsPerPage)));
  // Default: abrir na página que contém o mês atual (quando ano = ano atual)
  useEffect(() => {
    if (year === currentYear) {
      const idx = visibleMonths.indexOf(currentMonth);
      if (idx >= 0) {
        setMonthPage(Math.floor(idx / Math.max(1, monthsPerPage)));
        return;
      }
    }
    setMonthPage(0);
  }, [monthRange, showAV, showAH, isMobile, year, currentMonth, currentYear, visibleMonths, monthsPerPage]);
  const safePage = Math.min(monthPage, totalPages - 1);
  const pagedMonths = isMobile
    ? visibleMonths.slice(safePage * monthsPerPage, safePage * monthsPerPage + monthsPerPage)
    : visibleMonths;

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
    <div className="space-y-3">
      {/* Filters — mobile: 2-col grid; desktop: inline */}
      <div className="grid grid-cols-2 gap-2 md:flex md:flex-wrap md:items-center md:gap-3">
        <Select value={String(year)} onValueChange={(v) => {
          const y = Number(v);
          setYear(y);
          if (y === currentYear) setMonthRange([Math.max(0, currentMonth - 2), currentMonth]);
          else setMonthRange([0, 11]);
        }}>
          <SelectTrigger className="w-full md:w-[120px] h-9 text-sm"><SelectValue /></SelectTrigger>
          <SelectContent>{years.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}</SelectContent>
        </Select>

        <Select value={`${monthRange[0]}-${monthRange[1]}`} onValueChange={(v) => {
          const [a, b] = v.split("-").map(Number);
          setMonthRange([a, b]);
        }}>
          <SelectTrigger className="w-full md:w-[180px] h-9 text-sm"><SelectValue /></SelectTrigger>
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
          <SelectTrigger className="w-full md:w-[220px] h-9 text-sm"><SelectValue placeholder="Conta bancária" /></SelectTrigger>
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
          <SelectTrigger className="w-full md:w-[170px] h-9 text-sm"><SelectValue placeholder="Centro de custo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os centros</SelectItem>
            {costCenters.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
          </SelectContent>
        </Select>

        <Select value={businessUnitId} onValueChange={setBusinessUnitId}>
          <SelectTrigger className="col-span-2 w-full md:w-[200px] h-9 text-sm">
            <SelectValue placeholder="Unidade de negócio" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as unidades (consolidado)</SelectItem>
            {businessUnits.map((u) => (
              <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="col-span-2 flex items-center justify-between gap-4 rounded-md border border-border/40 bg-muted/10 px-3 py-2 md:ml-auto md:justify-end md:border-0 md:bg-transparent md:p-0">
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

      {/* Mobile month pager */}
      {isMobile && totalPages > 1 && (
        <div className="flex items-center justify-between rounded-md border border-border/40 bg-muted/10 px-2 py-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={safePage === 0}
            onClick={() => setMonthPage(p => Math.max(0, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="text-xs font-medium text-foreground">
            {pagedMonths.map(m => `${monthLabels[m]} ${year}`).join(" · ")}
            <span className="text-muted-foreground ml-2">({safePage + 1}/{totalPages})</span>
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2"
            disabled={safePage >= totalPages - 1}
            onClick={() => setMonthPage(p => Math.min(totalPages - 1, p + 1))}
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      )}

      <Card className="border-border/50">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
          ) : (
            <div className={cn(isMobile ? "" : "overflow-x-auto custom-scrollbar")}>
              <table className="w-full text-xs border-collapse table-auto">
                <thead>
                  <tr className="border-b border-border/40">
                    <th className={cn("sticky left-0 z-20 bg-background text-left font-medium py-2.5 px-3 shadow-[1px_0_0_0_hsl(var(--border))]", isMobile ? "w-auto max-w-[60vw]" : "min-w-[280px]")}>Conta</th>
                    {pagedMonths.map((m) => (
                      <Fragment key={`h-${m}`}>
                        <th className={cn("text-right font-medium py-2.5 px-2 bg-muted/20", isMobile ? "" : "min-w-[90px]")}>
                          {monthLabels[m]}
                        </th>
                        {showAV && <th className={cn("text-right font-normal text-muted-foreground py-2.5 px-1 bg-muted/20", isMobile ? "" : "min-w-[44px]")}>A.V.</th>}
                        {showAH && <th className={cn("text-right font-normal text-muted-foreground py-2.5 px-1 bg-muted/20", isMobile ? "" : "min-w-[44px]")}>A.H.</th>}
                      </Fragment>
                    ))}
                    {!isMobile && <th className="text-right font-semibold py-2.5 px-3 min-w-[110px] bg-muted/30">Total</th>}
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
                      if (line.tipo === "despesa" || line.tipo === "custo" || line.tipo === "deducao" || line.tipo === "despesa_financeira" || line.tipo === "imposto" || line.tipo === "distribuicao_lucros") return "text-warning";
                      return "text-foreground";
                    };

                    return (
                      <tr key={line.id} className={cn("group border-b border-border/15 transition-colors", rowClass)}>
                        <td className={cn("sticky left-0 z-10 py-1.5 px-3 transition-colors group-hover:!bg-primary/20 shadow-[1px_0_0_0_hsl(var(--border))]", isMobile && "max-w-[60vw]", isSummary ? "bg-muted" : "bg-background")}>
                          <div
                            className={cn(
                              "flex items-center gap-1.5 select-none",
                              (hasChildren || (line.categoryId && !isIndicator)) && "cursor-pointer",
                            )}
                            style={{ paddingLeft: `${line.depth * 16}px` }}
                            onClick={() => {
                              if (hasChildren) {
                                toggle(line.id);
                              } else if (line.categoryId && !isIndicator) {
                                setMovModal({ open: true, categoryId: line.categoryId, label: line.label });
                              }
                            }}
                          >
                            {hasChildren ? (
                              isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                            ) : (
                              <span className="w-3.5 flex-shrink-0" />
                            )}
                            <span className={cn("text-[11px] md:text-xs whitespace-nowrap overflow-hidden text-ellipsis", labelColor, line.categoryId && !isIndicator && "hover:text-primary transition-colors")}>{line.label}</span>
                          </div>
                        </td>
                        {pagedMonths.map((m) => {
                          const v = line.monthly[m] ?? 0;
                          const prev = m > 0 ? (line.monthly[m - 1] ?? 0) : 0;
                          const ah = prev !== 0 ? ((v - prev) / Math.abs(prev)) * 100 : null;
                          const av = receitaTotalMonthly[m] > 0 ? (v / receitaTotalMonthly[m]) * 100 : 0;
                          return (
                            <Fragment key={`c-${line.id}-${m}`}>
                              <td className={cn("text-right py-1.5 px-2 tabular-nums transition-colors group-hover:bg-primary/20", valueColor(v))}>
                                {line.isPercentual ? fmtPct(v) : fmtBRL(v)}
                              </td>
                              {showAV && (
                                <td className="text-right py-1.5 px-1 text-muted-foreground tabular-nums text-[10px] transition-colors group-hover:bg-primary/20">
                                  {line.isPercentual || Math.abs(v) < 0.005 ? "" : fmtPct(av)}
                                </td>
                              )}
                              {showAH && (
                                <td className="text-right py-1.5 px-1 tabular-nums text-[10px] transition-colors group-hover:bg-primary/20">
                                  {ah == null || line.isPercentual ? "" : (
                                    <span className={ah >= 0 ? "text-success" : "text-destructive"}>{ah >= 0 ? "+" : ""}{ah.toFixed(0)}%</span>
                                  )}
                                </td>
                              )}
                            </Fragment>
                          );
                        })}
                        {!isMobile && (
                          <td className={cn("text-right py-1.5 px-3 font-semibold tabular-nums bg-muted/20 transition-colors group-hover:!bg-primary/20", valueColor(line.total))}>
                            {line.isPercentual ? fmtPct(line.total) : fmtBRL(line.total)}
                          </td>
                        )}
                      </tr>

                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <DRECategoriaMovimentacoesModal
        open={movModal.open}
        onOpenChange={(v) => setMovModal((s) => ({ ...s, open: v }))}
        categoryId={movModal.categoryId}
        categoryLabel={movModal.label}
        year={year}
        monthFrom={monthRange[0]}
        monthTo={monthRange[1]}
        bankAccountId={bankAccountId}
        costCenterId={costCenterId}
      />
    </div>
  );
}
