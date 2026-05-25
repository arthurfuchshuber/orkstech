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
import { useBankAccountOptions } from "@/hooks/useBankAccountOptions";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import DREMensalView from "@/components/financas/DREMensalView";
import { CalendarDays } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

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

  // Extract key indicators for KPI cards (deduplicates redundant values)
  const findLine = (id: string) => lines.find((l) => l.id === id);
  const kpis = useMemo(() => {
    const receitaLiq = findLine("receita-liquida");
    const lucroBruto = findLine("lucro-bruto");
    const ebitdaLine = findLine("ebitda");
    const lucroLiq = findLine("lucro-liquido");
    const all = [
      { id: "receita", label: "Receita Líquida", line: receitaLiq, accent: "text-success", anchor: true },
      { id: "bruto", label: "Lucro Bruto", line: lucroBruto, accent: "text-success", anchor: false },
      { id: "ebitda", label: "EBITDA", line: ebitdaLine, accent: "text-primary", anchor: false },
      { id: "liquido", label: "Lucro Líquido", line: lucroLiq, accent: "text-success", anchor: true },
    ];
    // Hide non-anchor cards whose amount equals the previous visible card's amount
    const result: typeof all = [];
    for (const k of all) {
      const prev = result[result.length - 1];
      const amt = k.line?.amount ?? 0;
      const prevAmt = prev?.line?.amount ?? null;
      if (!k.anchor && prev && prevAmt !== null && Math.abs(amt - prevAmt) < 0.01) continue;
      result.push(k);
    }
    return result;
  }, [lines]);


  const { options: bankAccounts } = useBankAccountOptions();

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
      <PageHeader
        title="DRE & Analytics"
        description="Relatório baseado no plano de contas"
        actions={
          <Button variant="outline" size="sm" className="gap-2 h-10" onClick={exportCSV}>
            <Download className="w-4 h-4" /> <span className="whitespace-nowrap">Exportar CSV</span>
          </Button>
        }
      />

      <Tabs defaultValue="mensal" className="w-full">
        <TabsList>
          <TabsTrigger value="mensal" className="gap-1.5">
            <CalendarDays className="w-3.5 h-3.5" />
            DRE Mensal
          </TabsTrigger>
          <TabsTrigger value="personalizar" className="gap-1.5">
            <Settings2 className="w-3.5 h-3.5" />
            Personalize seu DRE
          </TabsTrigger>
        </TabsList>

        <TabsContent value="mensal" className="mt-4">
          <DREMensalView />
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
