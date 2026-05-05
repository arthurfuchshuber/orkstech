import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { RefreshCw, AlertTriangle, CheckCircle2, FileSearch, Activity } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

const fmtDate = (s?: string | null) =>
  s ? new Date(s).toLocaleString("pt-BR") : "—";

export default function Sincronizacao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reportOpen, setReportOpen] = useState<{ id: string; nome: string } | null>(null);

  // ============= LOGS =============
  const { data: logs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["pluggy_sync_logs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_sync_logs" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // ============= CONTAS + ÚLTIMA RECONCILIAÇÃO =============
  const { data: contas = [] } = useQuery({
    queryKey: ["sincronizacao_contas", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("id, nome, banco, pluggy_account_id, investimento_sincronizado, divergencia_alerta_limite, ultima_sync_at, ativo")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: reconciliations = [] } = useQuery({
    queryKey: ["recon_latest", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reconciliacoes_investimento" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // último snapshot por conta
  const latestByConta = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of reconciliations) {
      if (!map[r.conta_id]) map[r.conta_id] = r;
    }
    return map;
  }, [reconciliations]);

  const reconcileMutation = useMutation({
    mutationFn: async (contaId: string) => {
      const { data, error } = await (supabase as any).rpc("reconciliar_investimentos_conta", {
        p_conta_id: contaId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data: any) => {
      toast.success(
        `Reconciliação concluída — ${data?.status === "ok" ? "sem divergências" :
          data?.status === "divergente" ? `divergência de ${fmtBRL(data.divergencia)}` :
          "sem dados de investimento"}`
      );
      qc.invalidateQueries({ queryKey: ["recon_latest"] });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao reconciliar"),
  });

  const reconcileAll = useMutation({
    mutationFn: async () => {
      let ok = 0, div = 0;
      for (const c of contas) {
        if (!c.pluggy_account_id) continue;
        try {
          const { data } = await (supabase as any).rpc("reconciliar_investimentos_conta", { p_conta_id: c.id });
          if (data?.status === "divergente") div++; else if (data?.status === "ok") ok++;
        } catch {}
      }
      return { ok, div };
    },
    onSuccess: ({ ok, div }) => {
      toast.success(`${ok} conta(s) OK · ${div} divergente(s)`);
      qc.invalidateQueries({ queryKey: ["recon_latest"] });
    },
  });

  const statusBadge = (s: string) => {
    if (s === "divergente") return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Divergente</Badge>;
    if (s === "ok") return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600"><CheckCircle2 className="h-3 w-3" />OK</Badge>;
    return <Badge variant="secondary">Sem dados</Badge>;
  };

  return (
    <div className="w-full space-y-4 p-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Sincronização & Reconciliação</h1>
          <p className="text-sm text-muted-foreground">Logs de cada sync e reconciliação automática de investimentos por conta.</p>
        </div>
      </div>

      <Tabs defaultValue="reconciliacao" className="w-full">
        <TabsList>
          <TabsTrigger value="reconciliacao" className="gap-2"><FileSearch className="h-4 w-4" />Reconciliação</TabsTrigger>
          <TabsTrigger value="logs" className="gap-2"><Activity className="h-4 w-4" />Logs de Sincronização</TabsTrigger>
        </TabsList>

        {/* =================== ABA RECONCILIAÇÃO =================== */}
        <TabsContent value="reconciliacao" className="space-y-4">
          <Card>
            <CardHeader className="flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">Reconciliação por Conta</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Compara o <strong>saldo agregado</strong> de investimentos vs <strong>soma dos investimentos detalhados ATIVOS</strong> (valor líquido / resgatável).
                </p>
              </div>
              <Button size="sm" onClick={() => reconcileAll.mutate()} disabled={reconcileAll.isPending}>
                <RefreshCw className={`h-4 w-4 mr-2 ${reconcileAll.isPending ? "animate-spin" : ""}`} />
                Reconciliar todas
              </Button>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[24%]">Conta</TableHead>
                    <TableHead className="w-[14%] text-right">Saldo agregado</TableHead>
                    <TableHead className="w-[14%] text-right">Soma detalhada</TableHead>
                    <TableHead className="w-[12%] text-right">Divergência</TableHead>
                    <TableHead className="w-[10%] text-right">Limite</TableHead>
                    <TableHead className="w-[10%]">Status</TableHead>
                    <TableHead className="w-[16%]">Última checagem</TableHead>
                    <TableHead className="w-auto text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contas.length === 0 && (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Nenhuma conta cadastrada.</TableCell></TableRow>
                  )}
                  {contas.map((c: any) => {
                    const r = latestByConta[c.id];
                    const status = r?.status || (c.pluggy_account_id ? "pendente" : "sem_dados");
                    const div = r ? Number(r.divergencia) : 0;
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.nome}</div>
                          <div className="text-xs text-muted-foreground">{c.banco || "—"}</div>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">{fmtBRL(r?.saldo_agregado ?? c.investimento_sincronizado ?? 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">{r ? fmtBRL(r.soma_detalhada) : "—"}</TableCell>
                        <TableCell className={`text-right tabular-nums ${status === "divergente" ? "text-destructive font-medium" : ""}`}>
                          {r ? fmtBRL(div) : "—"}
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-xs text-muted-foreground">
                          {fmtBRL(c.divergencia_alerta_limite ?? 1)}
                        </TableCell>
                        <TableCell>
                          {status === "pendente"
                            ? <Badge variant="outline">Não checado</Badge>
                            : statusBadge(status)}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{fmtDate(r?.created_at)}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button size="sm" variant="ghost"
                            onClick={() => reconcileMutation.mutate(c.id)}
                            disabled={reconcileMutation.isPending || !c.pluggy_account_id}>
                            <RefreshCw className={`h-3.5 w-3.5 ${reconcileMutation.isPending ? "animate-spin" : ""}`} />
                          </Button>
                          {r && (
                            <Button size="sm" variant="outline" onClick={() => setReportOpen({ id: c.id, nome: c.nome })}>
                              Relatório
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* =================== ABA LOGS =================== */}
        <TabsContent value="logs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Logs de Sincronização Pluggy</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Histórico de cada sync: timestamp, conector, fonte, tipo de valor (líquido/bruto), totais e duração.
              </p>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[16%]">Quando</TableHead>
                    <TableHead className="w-[16%]">Conector</TableHead>
                    <TableHead className="w-[8%]">Fonte</TableHead>
                    <TableHead className="w-[10%]">Tipo de valor</TableHead>
                    <TableHead className="w-[8%] text-right">Contas</TableHead>
                    <TableHead className="w-[10%] text-right">Transações</TableHead>
                    <TableHead className="w-[10%] text-right">Investim.</TableHead>
                    <TableHead className="w-[12%] text-right">Total invest.</TableHead>
                    <TableHead className="w-[8%]">Status</TableHead>
                    <TableHead className="w-auto text-right">Duração</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loadingLogs && (
                    <TableRow><TableCell colSpan={10} className="text-center py-6 text-muted-foreground">Carregando…</TableCell></TableRow>
                  )}
                  {!loadingLogs && logs.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Sem registros — execute uma sincronização.</TableCell></TableRow>
                  )}
                  {logs.map((l: any) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-xs">{fmtDate(l.created_at)}</TableCell>
                      <TableCell className="text-sm">{l.connector_name || "—"}</TableCell>
                      <TableCell><Badge variant="outline" className="text-[10px]">{l.source}</Badge></TableCell>
                      <TableCell>
                        <Badge variant={l.value_type === "liquido" ? "default" : "secondary"} className="text-[10px]">
                          {l.value_type === "liquido" ? "Líquido (resgatável)" : "Bruto"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{l.accounts_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.transactions_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{l.investments_count}</TableCell>
                      <TableCell className="text-right tabular-nums">{fmtBRL(l.total_investments)}</TableCell>
                      <TableCell>
                        {l.status === "success"
                          ? <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[10px]">OK</Badge>
                          : <Badge variant="destructive" className="text-[10px]">{l.status}</Badge>}
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums">{l.duration_ms ? `${(l.duration_ms / 1000).toFixed(1)}s` : "—"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <ReportDialog
        open={!!reportOpen}
        onOpenChange={(v) => !v && setReportOpen(null)}
        contaId={reportOpen?.id}
        contaNome={reportOpen?.nome}
        snapshot={reportOpen ? latestByConta[reportOpen.id] : null}
      />
    </div>
  );
}

function ReportDialog({
  open, onOpenChange, contaId, contaNome, snapshot,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contaId?: string;
  contaNome?: string;
  snapshot: any;
}) {
  const investimentos: any[] = snapshot?.detalhes?.investimentos || [];
  const soma = Number(snapshot?.soma_detalhada || 0);
  const agregado = Number(snapshot?.saldo_agregado || 0);
  const divergencia = Number(snapshot?.divergencia || 0);
  const limite = Number(snapshot?.limite_configurado || 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Relatório de Divergência — {contaNome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-4 gap-3">
            <Stat label="Saldo agregado" value={fmtBRL(agregado)} hint="contas_bancarias.investimento_sincronizado" />
            <Stat label="Soma detalhada" value={fmtBRL(soma)} hint="Σ pluggy_investments.balance (ACTIVE)" />
            <Stat label="Divergência" value={fmtBRL(divergencia)} hint={`limite ${fmtBRL(limite)}`}
              tone={divergencia > limite ? "danger" : "ok"} />
            <Stat label="Status" value={snapshot?.status || "—"} hint={fmtDate(snapshot?.created_at)} />
          </div>

          <div className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1">
            <div><strong>Fórmula:</strong> divergência = | saldo_agregado − Σ balance(ACTIVE) |</div>
            <div><strong>Origem do saldo agregado:</strong> recalculado pela edge function <code>pluggy-sync</code> a partir de Σ balance dos investimentos ATIVOS.</div>
            <div><strong>Tipo de valor utilizado:</strong> líquido (<code>balance</code> = valor resgatável). O valor bruto (<code>amount</code>) foi descontinuado.</div>
          </div>

          <div className="rounded-lg border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Investimento</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead className="text-right">Aportado</TableHead>
                  <TableHead className="text-right">Lucro</TableHead>
                  <TableHead className="text-right">Resgatável (balance)</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Atualizado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investimentos.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum investimento detalhado.</TableCell></TableRow>
                )}
                {investimentos.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="text-sm">{inv.name}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{inv.subtype || inv.type || "—"}</TableCell>
                    <TableCell className="text-right tabular-nums">{inv.amount_original != null ? fmtBRL(inv.amount_original) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums text-emerald-500">{inv.amount_profit != null ? fmtBRL(inv.amount_profit) : "—"}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{fmtBRL(inv.balance)}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{inv.status || "ACTIVE"}</Badge></TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(inv.updated_at)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "danger" }) {
  return (
    <div className={`rounded-lg border p-3 ${tone === "danger" ? "border-destructive/40 bg-destructive/5" : ""}`}>
      <div className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg font-semibold tabular-nums ${tone === "danger" ? "text-destructive" : ""}`}>{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}
