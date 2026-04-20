import { useState, useMemo } from "react";
import { useDRE, type DREFilters, type DRELine, type PeriodPreset } from "@/hooks/useDRE";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, ChevronRight, ChevronDown, Download, Settings2, CalendarIcon, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PlanoDeContasSection } from "@/components/financas/PlanoDeContasSection";
import { DRERegrasSection } from "@/components/financas/DRERegrasSection";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const periodLabels: Record<PeriodPreset, string> = {
  today: "Hoje", "7d": "Últimos 7 dias", "30d": "Últimos 30 dias",
  this_month: "Este mês", last_month: "Mês anterior", this_year: "Este ano", custom: "Personalizado",
};

interface FlatLine {
  line: DRELine;
  visible: boolean;
}

export default function DREPage() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;

  const [filters, setFilters] = useState<DREFilters>({ period: "this_month", tipo: "all" });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [drillDownCategory, setDrillDownCategory] = useState<{ id: string; label: string } | null>(null);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [tempStart, setTempStart] = useState<Date | undefined>(filters.customStart);
  const [tempEnd, setTempEnd] = useState<Date | undefined>(filters.customEnd);

  const { lines, totalRevenue, grossMargin, ebitda, netIncome, transactions, isLoading, dateRange } = useDRE(filters);

  // Extract key indicators for KPI cards
  const findLine = (id: string) => lines.find((l) => l.id === id);
  const kpis = useMemo(() => {
    const receitaLiq = findLine("receita-liquida");
    const lucroBruto = findLine("lucro-bruto");
    const ebitdaLine = findLine("ebitda");
    const lucroLiq = findLine("lucro-liquido");
    return [
      { id: "receita", label: "Receita Líquida", line: receitaLiq, accent: "text-success" },
      { id: "bruto", label: "Lucro Bruto", line: lucroBruto, accent: "text-success" },
      { id: "ebitda", label: "EBITDA", line: ebitdaLine, accent: "text-primary" },
      { id: "liquido", label: "Lucro Líquido", line: lucroLiq, accent: "text-success" },
    ];
  }, [lines]);

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["dre-bank-accounts", targetUserId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase.from("contas_bancarias").select("id, nome").eq("ativo", true).eq("user_id", targetUserId!);
      return data ?? [];
    },
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["dre-cost-centers", targetUserId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase.from("centros_custo").select("id, nome").eq("ativo", true).eq("user_id", targetUserId!);
      return data ?? [];
    },
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const drillDownData = useMemo(() => {
    if (!drillDownCategory) return [];
    return transactions.filter((t) => (t as any).categoria_financeira_id === drillDownCategory.id);
  }, [drillDownCategory, transactions]);

  const flatLines = useMemo(() => {
    const result: FlatLine[] = [];
    function walk(items: DRELine[], parentVisible: boolean) {
      for (const line of items) {
        result.push({ line, visible: parentVisible });
        if (line.children?.length) {
          const isOpen = expandedGroups.has(line.id);
          walk(line.children, parentVisible && isOpen);
        }
      }
    }
    walk(lines, true);
    return result;
  }, [lines, expandedGroups]);

  const exportCSV = () => {
    const allLines = flatLines.map(f => f.line);
    const csvRows = [
      ["Número", "Conta", "Valor", "% Receita", "Período anterior", "Variação %"].join(";"),
      ...allLines.map((l) =>
        [
          l.number || "",
          l.label,
          l.amount.toFixed(2),
          l.percentage.toFixed(1),
          l.previousAmount.toFixed(2),
          l.variation == null ? "" : l.variation.toFixed(1),
        ].join(";")
      ),
    ];
    const blob = new Blob([csvRows.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE_${format(dateRange.start, "yyyy-MM-dd")}_${format(dateRange.end, "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">DRE & Analytics</h1>
          <p className="text-sm text-muted-foreground">Relatório baseado no plano de contas</p>
        </div>
        <Button variant="outline" size="sm" className="gap-2" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      <Tabs defaultValue="dre" className="w-full">
        <TabsList>
          <TabsTrigger value="dre" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            DRE
          </TabsTrigger>
          <TabsTrigger value="personalizar" className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            Personalize seu DRE
          </TabsTrigger>
        </TabsList>

        <TabsContent value="dre" className="mt-4 space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <Select
              value={filters.period}
              onValueChange={(v) => {
                const period = v as PeriodPreset;
                if (period === "custom") {
                  setTempStart(filters.customStart);
                  setTempEnd(filters.customEnd);
                  setCustomDialogOpen(true);
                } else {
                  setFilters((f) => ({ ...f, period, customStart: undefined, customEnd: undefined }));
                }
              }}
            >
              <SelectTrigger className="w-[170px] h-9 text-sm"><SelectValue placeholder="Período" /></SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
            {filters.period === "custom" && filters.customStart && filters.customEnd && (
              <Button variant="outline" size="sm" className="h-9 gap-2" onClick={() => setCustomDialogOpen(true)}>
                <CalendarIcon className="w-3.5 h-3.5" />
                {format(filters.customStart, "dd/MM/yyyy")} — {format(filters.customEnd, "dd/MM/yyyy")}
              </Button>
            )}
            <Select value={filters.bankAccountId || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, bankAccountId: v === "all" ? undefined : v }))}>
              <SelectTrigger className="w-[170px] h-9 text-sm"><SelectValue placeholder="Conta bancária" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {bankAccounts.map((b) => <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.costCenterId || "all"} onValueChange={(v) => setFilters((f) => ({ ...f, costCenterId: v === "all" ? undefined : v }))}>
              <SelectTrigger className="w-[170px] h-9 text-sm"><SelectValue placeholder="Centro de custo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os centros</SelectItem>
                {costCenters.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* KPI Cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((k) => {
              const amount = k.line?.amount ?? 0;
              const prev = k.line?.previousAmount ?? 0;
              const variation = k.line?.variation;
              const positive = amount >= 0;
              const VarIcon = variation == null ? Minus : variation >= 0 ? TrendingUp : TrendingDown;
              const varColor = variation == null
                ? "text-muted-foreground"
                : variation >= 0 ? "text-success" : "text-destructive";
              return (
                <Card key={k.id} className="border-border/50">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className={cn("text-2xl font-bold mt-1", positive ? k.accent : "text-destructive")}>
                      {fmt(Math.abs(amount))}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <VarIcon className={cn("w-3 h-3", varColor)} />
                      <span className={cn("text-[11px] font-medium", varColor)}>
                        {variation == null ? "—" : `${variation >= 0 ? "+" : ""}${variation.toFixed(1)}%`}
                      </span>
                      <span className="text-[11px] text-muted-foreground">vs período anterior ({fmt(Math.abs(prev))})</span>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* DRE Table */}
          <div className="w-full">
            <Card className="border-border/50">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  DRE
                  <Badge variant="outline" className="text-[10px] ml-2 font-normal">
                    {format(dateRange.start, "dd/MM/yyyy")} — {format(dateRange.end, "dd/MM/yyyy")}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {isLoading ? (
                  <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow className="border-border/30">
                        <TableHead className="w-[44%] text-xs">Conta</TableHead>
                        <TableHead className="text-right text-xs">Valor</TableHead>
                        <TableHead className="text-right text-xs">% Receita</TableHead>
                        <TableHead className="text-right text-xs">Período anterior</TableHead>
                        <TableHead className="text-right text-xs">Variação</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {flatLines.filter(f => f.visible).map((f) => {
                        const { line } = f;
                        const hasChildren = line.children && line.children.length > 0;
                        const isExpanded = expandedGroups.has(line.id);
                        const isSummary = line.isSummary;
                        const isRevenue = line.tipo === "receita";

                        const rowBg = isSummary ? "bg-muted/30 border-t border-border/40" : "";
                        const labelColor = isSummary
                          ? "font-semibold text-foreground"
                          : line.depth === 0 ? "font-medium text-foreground" : "text-muted-foreground";

                        // Dynamic color: green = positive/good, red = negative/bad
                        // Zero values use neutral color
                        const getValueColor = () => {
                          const bold = isSummary ? " font-semibold" : "";
                          if (line.amount === 0) return "text-muted-foreground" + bold;

                          // Percentual indicators follow their sign
                          if (line.isPercentual) {
                            return (line.amount > 0 ? "text-success" : "text-destructive") + bold;
                          }
                          // Summary/indicator lines follow their sign (positive = good)
                          if (isSummary || line.id?.startsWith("receita-liquida") || line.id?.startsWith("lucro-") || line.id?.startsWith("resultado-") || line.id?.startsWith("ebitda")) {
                            return (line.amount > 0 ? "text-success" : "text-destructive") + bold;
                          }
                          // Revenue types = green (money coming in)
                          if (line.tipo === "receita" || line.tipo === "receita_financeira") {
                            return "text-success" + bold;
                          }
                          // Expense/cost/deduction/tax = red (money going out)
                          if (line.tipo === "despesa" || line.tipo === "custo" || line.tipo === "deducao" || line.tipo === "despesa_financeira" || line.tipo === "imposto") {
                            return "text-destructive" + bold;
                          }
                          return (line.amount > 0 ? "text-success" : "text-destructive") + bold;
                        };
                        const valueColor = getValueColor();

                        return (
                          <TableRow key={line.id} className={`${rowBg} border-border/15 hover:bg-muted/10 transition-colors`}>
                            <TableCell className="py-1.5 pr-0">
                              <div
                                className="flex items-center gap-1.5 cursor-pointer select-none"
                                style={{ paddingLeft: `${line.depth * 20}px` }}
                                onClick={() => {
                                  if (hasChildren) toggleGroup(line.id);
                                  else if (line.categoryId) setDrillDownCategory({ id: line.categoryId, label: line.label });
                                }}
                              >
                                {hasChildren && !isSummary ? (
                                  isExpanded
                                    ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                    : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                ) : (
                                  !isSummary && <span className="w-3.5 flex-shrink-0" />
                                )}
                                {line.number && (
                                  <span className="text-[10px] text-muted-foreground/60 font-mono min-w-[2.5rem]">
                                    {line.number}
                                  </span>
                                )}
                                <span className={`text-xs ${labelColor}`}>{line.label}</span>
                              </div>
                            </TableCell>
                            <TableCell className={`text-right text-xs py-1.5 ${valueColor}`}>
                              {line.isPercentual
                                ? fmtPct(line.amount)
                                : isSummary && line.amount < 0 ? `(${fmt(Math.abs(line.amount))})` : fmt(Math.abs(line.amount))}
                            </TableCell>
                            <TableCell className="text-right text-xs py-1.5 text-muted-foreground">
                              {line.isPercentual ? "" : fmtPct(line.percentage)}
                            </TableCell>
                            <TableCell className="text-right text-xs py-1.5 text-muted-foreground/80">
                              {line.isPercentual ? "—" : fmt(Math.abs(line.previousAmount))}
                            </TableCell>
                            <TableCell className="text-right text-xs py-1.5">
                              {line.variation == null || line.isPercentual ? (
                                <span className="text-muted-foreground/60">—</span>
                              ) : (
                                <span className={cn("font-medium", line.variation >= 0 ? "text-success" : "text-destructive")}>
                                  {line.variation >= 0 ? "+" : ""}{line.variation.toFixed(1)}%
                                </span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="personalizar" className="mt-4 space-y-4">
          <PlanoDeContasSection />
          <DRERegrasSection />
        </TabsContent>
      </Tabs>

      {/* Drill Down Dialog */}
      <Dialog open={!!drillDownCategory} onOpenChange={() => setDrillDownCategory(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Detalhamento: {drillDownCategory?.label}</DialogTitle>
          </DialogHeader>
          {drillDownData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhum lançamento encontrado para esta categoria no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {drillDownData.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell className="text-xs">{format(new Date(t.transaction_date + "T12:00:00"), "dd/MM/yyyy")}</TableCell>
                    <TableCell className="text-xs">{t.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${t.type === "income" ? "text-emerald-500 border-emerald-500/30" : "text-destructive border-destructive/30"}`}>
                        {t.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">{fmt(Math.abs(Number(t.amount)))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>

      {/* Custom Period Dialog */}
      <Dialog open={customDialogOpen} onOpenChange={setCustomDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Selecione o período</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data inicial</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal h-9 text-sm", !tempStart && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempStart ? format(tempStart, "dd/MM/yyyy") : <span>Escolher</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempStart}
                      onSelect={setTempStart}
                      disabled={(d) => (tempEnd ? d > tempEnd : false)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Data final</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn("w-full justify-start text-left font-normal h-9 text-sm", !tempEnd && "text-muted-foreground")}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {tempEnd ? format(tempEnd, "dd/MM/yyyy") : <span>Escolher</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={tempEnd}
                      onSelect={setTempEnd}
                      disabled={(d) => (tempStart ? d < tempStart : false)}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" size="sm" onClick={() => setCustomDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                disabled={!tempStart || !tempEnd}
                onClick={() => {
                  setFilters((f) => ({ ...f, period: "custom", customStart: tempStart, customEnd: tempEnd }));
                  setCustomDialogOpen(false);
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
