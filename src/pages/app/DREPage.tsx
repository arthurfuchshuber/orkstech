import { useState, useMemo } from "react";
import { useMultiMonthDRE, type DRELine } from "@/hooks/useMultiMonthDRE";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, ChevronRight, ChevronDown, Download, Settings2 } from "lucide-react";
import { PlanoDeContasSection } from "@/components/financas/PlanoDeContasSection";
import { Checkbox } from "@/components/ui/checkbox";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function DREPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { lines, monthKeys, isLoading, availablePeriods } = useMultiMonthDRE(selectedYear, selectedMonths);

  // Derive available years and months from availablePeriods
  const { availableYears, monthsForYear } = useMemo(() => {
    const yearsSet = new Set<number>();
    const monthsByYear = new Map<number, Set<number>>();
    for (const p of availablePeriods) {
      const [y, m] = p.split("-").map(Number);
      yearsSet.add(y);
      if (!monthsByYear.has(y)) monthsByYear.set(y, new Set());
      monthsByYear.get(y)!.add(m);
    }
    // Always include current year
    yearsSet.add(now.getFullYear());
    if (!monthsByYear.has(now.getFullYear())) {
      monthsByYear.set(now.getFullYear(), new Set([now.getMonth() + 1]));
    }
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    const monthsFor = monthsByYear.get(selectedYear) || new Set<number>();
    // Always show all 12 months for the selected year
    return { availableYears: years, monthsForYear: Array.from({ length: 12 }, (_, i) => i + 1) };
  }, [availablePeriods, selectedYear]);

  const toggleMonth = (month: number) => {
    setSelectedMonths(prev => {
      if (prev.includes(month)) {
        if (prev.length === 1) return prev; // keep at least one
        return prev.filter(m => m !== month);
      }
      return [...prev, month].sort((a, b) => a - b);
    });
  };

  const selectAllMonths = () => setSelectedMonths(Array.from({ length: 12 }, (_, i) => i + 1));

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Flatten tree respecting expanded state
  const flatLines = useMemo(() => {
    const result: { line: DRELine; visible: boolean }[] = [];
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
    const header = ["Número", "Conta", ...monthKeys.map(mk => {
      const [, m] = mk.split("-");
      return MONTH_NAMES[parseInt(m) - 1];
    })].join(";");
    const rows = allLines.map(l =>
      [l.number || "", l.label, ...monthKeys.map(mk => (l.amounts[mk] || 0).toFixed(2))].join(";")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Demonstração de Resultado (DRE)</h1>
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
          {/* Filters: Year + Months */}
          <div className="flex flex-wrap items-center gap-3">
            <Select value={String(selectedYear)} onValueChange={(v) => { setSelectedYear(Number(v)); setSelectedMonths([1]); }}>
              <SelectTrigger className="w-[120px] h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {availableYears.map(y => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-1.5 flex-wrap">
              {monthsForYear.map(m => {
                const isSelected = selectedMonths.includes(m);
                return (
                  <button
                    key={m}
                    onClick={() => toggleMonth(m)}
                    className={`px-2.5 py-1 text-xs rounded-md border transition-colors ${
                      isSelected
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/50"
                    }`}
                  >
                    {MONTH_NAMES[m - 1]}
                  </button>
                );
              })}
              <button
                onClick={selectAllMonths}
                className="px-2.5 py-1 text-xs rounded-md border border-border text-muted-foreground hover:border-primary/50 transition-colors"
              >
                Todos
              </button>
            </div>
          </div>

          {/* DRE Table */}
          <div className="w-full overflow-x-auto">
            <Card className="border-border/50">
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm font-medium flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary" />
                  DRE
                  <Badge variant="outline" className="text-[10px] ml-2 font-normal">
                    {selectedYear}
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
                        <TableHead className="text-xs sticky left-0 bg-background z-10 min-w-[250px]">Conta</TableHead>
                        {monthKeys.map(mk => {
                          const [, m] = mk.split("-");
                          return (
                            <TableHead key={mk} className="text-right text-xs min-w-[120px]">
                              {MONTH_NAMES[parseInt(m) - 1]}/{selectedYear}
                            </TableHead>
                          );
                        })}
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

                        return (
                          <TableRow key={line.id} className={`${rowBg} border-border/15 hover:bg-muted/10 transition-colors`}>
                            <TableCell className="py-1.5 pr-0 sticky left-0 bg-background z-10">
                              <div
                                className="flex items-center gap-1.5 cursor-pointer select-none"
                                style={{ paddingLeft: `${line.depth * 20}px` }}
                                onClick={() => { if (hasChildren) toggleGroup(line.id); }}
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
                                <span className={`text-xs ${labelColor} whitespace-nowrap`}>{line.label}</span>
                              </div>
                            </TableCell>
                            {monthKeys.map(mk => {
                              const amt = line.amounts[mk] || 0;
                              const valueColor = isSummary
                                ? amt >= 0 ? "text-emerald-500 font-semibold" : "text-destructive font-semibold"
                                : isRevenue ? "text-emerald-500" : line.depth === 0 ? "text-destructive" : "text-foreground";
                              return (
                                <TableCell key={mk} className={`text-right text-xs py-1.5 ${valueColor}`}>
                                  {isSummary && amt < 0 ? `(${fmt(Math.abs(amt))})` : fmt(Math.abs(amt))}
                                </TableCell>
                              );
                            })}
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

        <TabsContent value="personalizar" className="mt-4">
          <div className="max-w-2xl">
            <PlanoDeContasSection />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
