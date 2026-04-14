import React, { useState, useMemo } from "react";
import { useMultiMonthDRE, type DRELine } from "@/hooks/useMultiMonthDRE";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, ChevronRight, ChevronDown, Download, Settings2 } from "lucide-react";
import { PlanoDeContasSection } from "@/components/financas/PlanoDeContasSection";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(v));
const fmtPct = (v: number) => `${Math.abs(v).toFixed(1)}%`;

const MONTH_NAMES_SHORT = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MONTH_NAMES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function DREPage() {
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedMonths, setSelectedMonths] = useState<number[]>([now.getMonth() + 1]);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { lines, monthKeys, isLoading, availablePeriods } = useMultiMonthDRE(selectedYear, selectedMonths);

  const availableYears = useMemo(() => {
    const yearsSet = new Set<number>();
    for (const p of availablePeriods) yearsSet.add(Number(p.split("-")[0]));
    yearsSet.add(now.getFullYear());
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [availablePeriods]);

  const toggleMonth = (month: number) => {
    setSelectedMonths(prev => {
      if (prev.includes(month)) {
        if (prev.length === 1) return prev;
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
    const header = ["Estrutura", ...monthKeys.flatMap(mk => {
      const [y, m] = mk.split("-");
      const label = `${MONTH_NAMES_SHORT[parseInt(m) - 1]}/${y}`;
      return [label, `A.V. ${label}`];
    })].join(";");
    const rows = allLines.map(l =>
      [`${l.sign ? l.sign + " " : ""}${l.label}`, ...monthKeys.flatMap(mk =>
        [(l.amounts[mk] || 0).toFixed(2), (l.percentages[mk] || 0).toFixed(1) + "%"]
      )].join(";")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE_${selectedYear}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const monthColLabel = (mk: string) => {
    const [y, m] = mk.split("-");
    return `${MONTH_NAMES_SHORT[parseInt(m) - 1]}/${y}`;
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
              {Array.from({ length: 12 }, (_, i) => i + 1).map(m => {
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
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-left py-2 px-3 font-medium text-muted-foreground sticky left-0 bg-background z-10 min-w-[280px]">
                            Estrutura
                          </th>
                          {monthKeys.map(mk => (
                            <th key={mk} colSpan={2} className="text-center py-2 px-1 font-medium text-muted-foreground border-l border-border/20 min-w-[160px]">
                              {monthColLabel(mk)}
                            </th>
                          ))}
                        </tr>
                        <tr className="border-b border-border/20">
                          <th className="sticky left-0 bg-background z-10" />
                          {monthKeys.map(mk => (
                            <React.Fragment key={mk}>
                              <th className="text-right py-1 px-2 font-normal text-muted-foreground/70 text-[10px] border-l border-border/20">
                                Valor
                              </th>
                              <th className="text-right py-1 px-2 font-normal text-muted-foreground/70 text-[10px]">
                                A.V.
                              </th>
                            </React.Fragment>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {flatLines.filter(f => f.visible).map((f) => {
                          const { line } = f;
                          const hasChildren = line.children && line.children.length > 0;
                          const isExpanded = expandedGroups.has(line.id);
                          const isSummary = line.isSummary;
                          const isComputed = line.lineType === "computed";
                          const isResult = line.sign === "(=)";

                          const rowClass = isResult
                            ? "bg-muted/40 border-t border-border/40 font-semibold"
                            : isSummary || (isComputed && !isResult)
                              ? "bg-muted/15"
                              : "";

                          const labelWeight = isResult || (isComputed && line.depth === 0)
                            ? "font-semibold text-foreground"
                            : line.depth === 0
                              ? "font-medium text-foreground"
                              : "text-muted-foreground";

                          return (
                            <tr
                              key={line.id}
                              className={`${rowClass} border-b border-border/10 hover:bg-muted/10 transition-colors`}
                            >
                              <td className="py-1.5 px-3 sticky left-0 bg-background z-10">
                                <div
                                  className="flex items-center gap-1.5 cursor-pointer select-none"
                                  style={{ paddingLeft: `${line.depth * 16}px` }}
                                  onClick={() => { if (hasChildren) toggleGroup(line.id); }}
                                >
                                  {hasChildren ? (
                                    isExpanded
                                      ? <ChevronDown className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                      : <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                  ) : (
                                    <span className="w-3 flex-shrink-0" />
                                  )}
                                  {line.sign && (
                                    <span className="text-[10px] text-muted-foreground/60 font-mono flex-shrink-0 min-w-[1.5rem]">
                                      {line.sign}
                                    </span>
                                  )}
                                  {line.number && (
                                    <span className="text-[10px] text-muted-foreground/60 font-mono flex-shrink-0 min-w-[2rem]">
                                      {line.number}
                                    </span>
                                  )}
                                  <span className={`text-xs ${labelWeight} whitespace-nowrap`}>
                                    {line.label}
                                  </span>
                                </div>
                              </td>
                              {monthKeys.map(mk => {
                                const amt = line.amounts[mk] || 0;
                                const pct = line.percentages[mk] || 0;
                                return (
                                  <React.Fragment key={mk}>
                                    <td className={`text-right py-1.5 px-2 tabular-nums border-l border-border/10 ${labelWeight}`}>
                                      {fmt(amt)}
                                    </td>
                                    <td className="text-right py-1.5 px-2 tabular-nums text-muted-foreground">
                                      {fmtPct(pct)}
                                    </td>
                                  </React.Fragment>
                                );
                              })}
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

import React from "react";
