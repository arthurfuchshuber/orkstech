import { useEffect, useMemo, useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw, BarChart3, FileText, Upload as UploadIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import {
  buildDailySeries,
  fetchBankBalance,
  fetchConsolidated,
  summarize,
  type ConsolidatedRow,
} from "@/lib/cashflow-helpers";
import { CashflowKpis } from "@/components/financas/fluxo/CashflowKpis";
import { CashflowChart } from "@/components/financas/fluxo/CashflowChart";
import { CashflowExtrato } from "@/components/financas/fluxo/CashflowExtrato";
import { CashflowImporter } from "@/components/financas/fluxo/CashflowImporter";
import { ImportsHistory } from "@/components/financas/fluxo/ImportsHistory";

function todayISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function plusDays(iso: string, days: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Fluxo() {
  const { user } = useAuth();
  const { empresaAtiva } = useEmpresa();
  const [start, setStart] = useState(todayISO());
  const [end, setEnd] = useState(plusDays(todayISO(), 90));
  const [rows, setRows] = useState<ConsolidatedRow[]>([]);
  const [bankBalance, setBankBalance] = useState(0);
  const [loading, setLoading] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [data, bal] = await Promise.all([
        fetchConsolidated(user.id, empresaAtiva?.id, start, end),
        fetchBankBalance(empresaAtiva?.id),
      ]);
      setRows(data);
      setBankBalance(bal);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, empresaAtiva?.id, start, end, reloadKey]);

  const summary = useMemo(() => summarize(rows), [rows]);
  const series = useMemo(() => buildDailySeries(rows, bankBalance), [rows, bankBalance]);
  const endBalance = series.length > 0 ? series[series.length - 1].balance : bankBalance;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Fluxo de Caixa</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Projeção consolidada: contas a receber, contas a pagar, saldos bancários e previsões importadas.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <div>
            <Label htmlFor="start" className="text-xs text-muted-foreground">De</Label>
            <Input id="start" type="date" value={start} onChange={(e) => setStart(e.target.value)} className="w-40" />
          </div>
          <div>
            <Label htmlFor="end" className="text-xs text-muted-foreground">Até</Label>
            <Input id="end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="w-40" />
          </div>
          <Button variant="outline" size="icon" onClick={() => setReloadKey((k) => k + 1)} disabled={loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="resumo">
        <TabsList>
          <TabsTrigger value="resumo"><BarChart3 className="w-4 h-4 mr-2" />Resumo</TabsTrigger>
          <TabsTrigger value="extrato"><FileText className="w-4 h-4 mr-2" />Extrato Detalhado</TabsTrigger>
          <TabsTrigger value="importacoes"><UploadIcon className="w-4 h-4 mr-2" />Importações</TabsTrigger>
        </TabsList>

        <TabsContent value="resumo" className="space-y-4 mt-4">
          <CashflowKpis
            inflow={summary.inflow}
            outflow={summary.outflow}
            startBalance={bankBalance}
            endBalance={endBalance}
          />
          <CashflowChart data={series} />
        </TabsContent>

        <TabsContent value="extrato" className="mt-4">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Movimentações Previstas</CardTitle>
              <p className="text-xs text-muted-foreground">
                Todas as entradas e saídas projetadas no período selecionado, com saldo acumulado.
              </p>
            </CardHeader>
            <CardContent>
              <CashflowExtrato rows={rows} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="importacoes" className="mt-4 space-y-4">
          <CashflowImporter onImported={() => setReloadKey((k) => k + 1)} />
          <ImportsHistory refreshKey={reloadKey} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
