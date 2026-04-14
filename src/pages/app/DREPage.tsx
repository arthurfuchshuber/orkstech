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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileText,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Percent,
  ChevronRight,
  ChevronDown,
  Download,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtPct = (v: number) => `${v.toFixed(1)}%`;

const periodLabels: Record<PeriodPreset, string> = {
  today: "Hoje",
  "7d": "Últimos 7 dias",
  "30d": "Últimos 30 dias",
  this_month: "Este mês",
  last_month: "Mês anterior",
  this_year: "Este ano",
  custom: "Personalizado",
};

export default function DREPage() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const [filters, setFilters] = useState<DREFilters>({
    period: "this_month",
    tipo: "all",
  });
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [drillDownCategory, setDrillDownCategory] = useState<{ id: string; label: string } | null>(null);

  const {
    lines,
    totalRevenue,
    totalExpense,
    operatingResult,
    netIncome,
    profitMargin,
    transactions,
    isLoading,
    dateRange,
  } = useDRE(filters);

  // Bank accounts for filter
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["dre-bank-accounts", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("id, nome").eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Cost centers for filter
  const { data: costCenters = [] } = useQuery({
    queryKey: ["dre-cost-centers", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("centros_custo").select("id, nome").eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Drill down data
  const drillDownData = useMemo(() => {
    if (!drillDownCategory) return [];
    return transactions.filter(
      (t) => (t as any).categoria_financeira_id === drillDownCategory.id
    );
  }, [drillDownCategory, transactions]);

  // Chart data - monthly breakdown
  const chartData = useMemo(() => {
    const months: { label: string; revenue: number; expense: number; profit: number }[] = [];
    const grouped: Record<string, { revenue: number; expense: number }> = {};

    transactions.forEach((t) => {
      const key = format(new Date((t as any).transaction_date + "T12:00:00"), "yyyy-MM");
      if (!grouped[key]) grouped[key] = { revenue: 0, expense: 0 };
      if ((t as any).type === "income") grouped[key].revenue += Math.abs(Number((t as any).amount));
      else grouped[key].expense += Math.abs(Number((t as any).amount));
    });

    Object.keys(grouped)
      .sort()
      .forEach((key) => {
        const d = new Date(key + "-15");
        months.push({
          label: format(d, "MMM", { locale: ptBR }),
          revenue: grouped[key].revenue,
          expense: grouped[key].expense,
          profit: grouped[key].revenue - grouped[key].expense,
        });
      });

    return months;
  }, [transactions]);

  const maxChart = Math.max(...chartData.map((m) => Math.max(m.revenue, m.expense)), 1);

  // Export CSV
  const exportCSV = () => {
    const flatLines = flattenLines(lines);
    const csvRows = [
      ["Categoria", "Valor", "% Receita", "Período Anterior", "Variação %"].join(";"),
      ...flatLines.map((l) =>
        [
          "  ".repeat(l.depth) + l.label,
          l.amount.toFixed(2),
          l.percentage.toFixed(1),
          l.previousAmount.toFixed(2),
          l.variation !== null ? l.variation.toFixed(1) : "-",
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Demonstração de Resultado (DRE)
          </h1>
          <p className="text-sm text-muted-foreground">
            Relatório financeiro estratégico baseado no plano de contas
          </p>
        </div>
        <Button variant="outline" className="gap-2" onClick={exportCSV}>
          <Download className="w-4 h-4" /> Exportar CSV
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <Select
              value={filters.period}
              onValueChange={(v) => setFilters((f) => ({ ...f, period: v as PeriodPreset }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Período" />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.bankAccountId || "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, bankAccountId: v === "all" ? undefined : v }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Conta bancária" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {bankAccounts.map((b) => (
                  <SelectItem key={b.id} value={b.id}>{b.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.costCenterId || "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, costCenterId: v === "all" ? undefined : v }))}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Centro de custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os centros</SelectItem>
                {costCenters.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.tipo || "all"}
              onValueChange={(v) => setFilters((f) => ({ ...f, tipo: v as any }))}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="income">Receitas</SelectItem>
                <SelectItem value="expense">Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KPICard icon={TrendingUp} label="Receita Bruta" value={fmt(totalRevenue)} color="text-emerald-500" bgColor="bg-emerald-500/10" />
        <KPICard icon={TrendingDown} label="Despesas Operacionais" value={fmt(totalExpense)} color="text-destructive" bgColor="bg-destructive/10" />
        <KPICard icon={DollarSign} label="Resultado Operacional" value={fmt(operatingResult)} color={operatingResult >= 0 ? "text-emerald-500" : "text-destructive"} bgColor="bg-primary/10" />
        <KPICard icon={DollarSign} label="Lucro Líquido" value={fmt(netIncome)} color={netIncome >= 0 ? "text-emerald-500" : "text-destructive"} bgColor="bg-primary/10" />
        <KPICard icon={Percent} label="Margem de Lucro" value={fmtPct(profitMargin)} color={profitMargin >= 0 ? "text-emerald-500" : "text-destructive"} bgColor="bg-primary/10" />
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Receita vs Despesa vs Lucro
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 h-48">
              {chartData.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="flex gap-0.5 items-end w-full justify-center" style={{ height: 160 }}>
                    <div
                      className="w-1/3 rounded-t-sm bg-emerald-500/80"
                      style={{ height: `${Math.max((m.revenue / maxChart) * 140, 2)}px` }}
                      title={`Receita: ${fmt(m.revenue)}`}
                    />
                    <div
                      className="w-1/3 rounded-t-sm bg-destructive/80"
                      style={{ height: `${Math.max((m.expense / maxChart) * 140, 2)}px` }}
                      title={`Despesa: ${fmt(m.expense)}`}
                    />
                    <div
                      className={`w-1/3 rounded-t-sm ${m.profit >= 0 ? "bg-primary/80" : "bg-warning/80"}`}
                      style={{ height: `${Math.max((Math.abs(m.profit) / maxChart) * 140, 2)}px` }}
                      title={`Lucro: ${fmt(m.profit)}`}
                    />
                  </div>
                  <span className="text-[11px] text-muted-foreground capitalize">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-4 justify-center mt-3">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-emerald-500/80" /> Receita
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-destructive/80" /> Despesa
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <div className="w-3 h-3 rounded-sm bg-primary/80" /> Lucro
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* DRE Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            Demonstração de Resultado do Exercício
            <Badge variant="outline" className="text-[10px] ml-2">
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
                  <TableHead className="w-[40%]">Categoria</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-right">% Receita</TableHead>
                  <TableHead className="text-right">Período Anterior</TableHead>
                  <TableHead className="text-right">Variação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.map((line) => (
                  <DRELineRow
                    key={line.id}
                    line={line}
                    expandedGroups={expandedGroups}
                    onToggle={toggleGroup}
                    onDrillDown={(id, label) => setDrillDownCategory({ id, label })}
                    totalRevenue={totalRevenue}
                  />
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Drill Down Dialog */}
      <Dialog open={!!drillDownCategory} onOpenChange={() => setDrillDownCategory(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Detalhamento: {drillDownCategory?.label}</DialogTitle>
          </DialogHeader>
          {drillDownData.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum lançamento encontrado para esta categoria no período.
            </p>
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
                    <TableCell className="text-xs">
                      {format(new Date(t.transaction_date + "T12:00:00"), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell className="text-xs">{t.description || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${t.type === "income" ? "text-emerald-500 border-emerald-500/30" : "text-destructive border-destructive/30"}`}>
                        {t.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {fmt(Math.abs(Number(t.amount)))}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  color,
  bgColor,
}: {
  icon: any;
  label: string;
  value: string;
  color: string;
  bgColor: string;
}) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className={`text-lg font-bold ${color}`}>{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function DRELineRow({
  line,
  expandedGroups,
  onToggle,
  onDrillDown,
  totalRevenue,
  depth = 0,
}: {
  line: DRELine;
  expandedGroups: Set<string>;
  onToggle: (id: string) => void;
  onDrillDown: (id: string, label: string) => void;
  totalRevenue: number;
  depth?: number;
}) {
  const isExpanded = expandedGroups.has(line.id);
  const hasChildren = line.children && line.children.length > 0;
  const isPositive = line.dreGroup === "revenue" || line.dreGroup === "financial_revenue";
  const isSummary = line.isSummary;

  const rowClass = isSummary
    ? "bg-muted/20 font-semibold border-t border-border/50"
    : line.depth === 0
      ? "font-medium"
      : "";

  const valueColor = isSummary
    ? line.amount >= 0
      ? "text-emerald-500"
      : "text-destructive"
    : isPositive
      ? "text-emerald-500"
      : line.depth === 0
        ? "text-destructive"
        : "text-foreground";

  return (
    <>
      <TableRow className={`${rowClass} border-border/20 hover:bg-muted/10 transition-colors`}>
        <TableCell className="py-2.5">
          <div
            className="flex items-center gap-1 cursor-pointer"
            style={{ paddingLeft: `${(line.depth + depth) * 20}px` }}
            onClick={() => {
              if (hasChildren) onToggle(line.id);
              else if (line.categoryId) onDrillDown(line.categoryId, line.label);
            }}
          >
            {hasChildren ? (
              isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
              )
            ) : (
              <span className="w-3.5" />
            )}
            <span className={`text-sm ${isSummary ? "text-foreground" : ""}`}>{line.label}</span>
          </div>
        </TableCell>
        <TableCell className={`text-right text-sm ${valueColor}`}>
          {isSummary && line.amount < 0 ? `(${fmt(Math.abs(line.amount))})` : fmt(Math.abs(line.amount))}
        </TableCell>
        <TableCell className="text-right text-sm text-muted-foreground">
          {fmtPct(line.percentage)}
        </TableCell>
        <TableCell className="text-right text-sm text-muted-foreground">
          {line.previousAmount > 0 ? fmt(line.previousAmount) : "—"}
        </TableCell>
        <TableCell className="text-right">
          {line.variation !== null ? (
            <div className="flex items-center justify-end gap-1">
              {line.variation > 0 ? (
                <ArrowUpRight className="w-3 h-3 text-emerald-500" />
              ) : line.variation < 0 ? (
                <ArrowDownRight className="w-3 h-3 text-destructive" />
              ) : (
                <Minus className="w-3 h-3 text-muted-foreground" />
              )}
              <span
                className={`text-xs ${line.variation > 0 ? "text-emerald-500" : line.variation < 0 ? "text-destructive" : "text-muted-foreground"}`}
              >
                {fmtPct(Math.abs(line.variation))}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {hasChildren && isExpanded &&
        line.children!.map((child) => (
          <DRELineRow
            key={child.id}
            line={child}
            expandedGroups={expandedGroups}
            onToggle={onToggle}
            onDrillDown={onDrillDown}
            totalRevenue={totalRevenue}
            depth={depth}
          />
        ))}
    </>
  );
}

function flattenLines(lines: DRELine[]): DRELine[] {
  const result: DRELine[] = [];
  for (const line of lines) {
    result.push(line);
    if (line.children) {
      result.push(...flattenLines(line.children));
    }
  }
  return result;
}
