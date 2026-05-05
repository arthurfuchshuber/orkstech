import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  RefreshCw, AlertTriangle, CheckCircle2, FileSearch, Activity, Scale, FileText,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(v || 0));

const fmtDate = (s?: string | null) => {
  if (!s) return "—";
  const d = new Date(s);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
};

export default function Sincronizacao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [reportOpen, setReportOpen] = useState<{ id: string; nome: string } | null>(null);

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

  const latestByConta = useMemo(() => {
    const map: Record<string, any> = {};
    for (const r of reconciliations) if (!map[r.conta_id]) map[r.conta_id] = r;
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
        data?.status === "ok" ? "Sem divergências" :
        data?.status === "divergente" ? `Divergência de ${fmtBRL(data.divergencia)}` :
        "Sem dados de investimento"
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
      toast.success(`${ok} OK · ${div} divergente${div !== 1 ? "s" : ""}`);
      qc.invalidateQueries({ queryKey: ["recon_latest"] });
    },
  });

  // Resumo (stats)
  const stats = useMemo(() => {
    const total = contas.length;
    let ok = 0, div = 0, pend = 0;
    let totalDiv = 0;
    for (const c of contas) {
      const r = latestByConta[c.id];
      if (!r) { pend++; continue; }
      if (r.status === "divergente") { div++; totalDiv += Number(r.divergencia || 0); }
      else if (r.status === "ok") ok++;
      else pend++;
    }
    return { total, ok, div, pend, totalDiv };
  }, [contas, latestByConta]);

  return (
    <div className="w-full p-4 space-y-4">
      {/* Header compacto */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Scale className="h-5 w-5 text-primary" />
            Reconciliação
          </h1>
          <p className="text-xs text-muted-foreground">
            Cruzamento entre saldo agregado e investimentos detalhados, com histórico de cada sincronização.
          </p>
        </div>
        <Button size="sm" onClick={() => reconcileAll.mutate()} disabled={reconcileAll.isPending}>
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${reconcileAll.isPending ? "animate-spin" : ""}`} />
          Reconciliar todas
        </Button>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <MiniStat icon={FileSearch} label="Contas monitoradas" value={String(stats.total)} />
        <MiniStat icon={CheckCircle2} label="OK" value={String(stats.ok)} tone="ok" />
        <MiniStat icon={AlertTriangle} label="Divergentes" value={String(stats.div)} tone={stats.div > 0 ? "danger" : undefined} />
        <MiniStat icon={Scale} label="Soma das divergências" value={fmtBRL(stats.totalDiv)} tone={stats.totalDiv > 0 ? "danger" : undefined} />
      </div>

      <Tabs defaultValue="reconciliacao" className="w-full">
        <TabsList className="h-9">
          <TabsTrigger value="reconciliacao" className="gap-1.5 text-xs"><FileSearch className="h-3.5 w-3.5" />Reconciliação</TabsTrigger>
          <TabsTrigger value="logs" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" />Logs de Sincronização</TabsTrigger>
        </TabsList>

        {/* RECONCILIAÇÃO */}
        <TabsContent value="reconciliacao" className="mt-3">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-9 text-xs w-[24%]">Conta</TableHead>
                  <TableHead className="h-9 text-xs text-right w-[14%]">Saldo agregado</TableHead>
                  <TableHead className="h-9 text-xs text-right w-[14%]">Soma detalhada</TableHead>
                  <TableHead className="h-9 text-xs text-right w-[12%]">Divergência</TableHead>
                  <TableHead className="h-9 text-xs text-right w-[8%]">Limite</TableHead>
                  <TableHead className="h-9 text-xs w-[10%]">Status</TableHead>
                  <TableHead className="h-9 text-xs w-[12%]">Última checagem</TableHead>
                  <TableHead className="h-9 text-xs text-right w-[6%]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contas.length === 0 && (
                  <TableRow><TableCell colSpan={8} className="text-center text-sm text-muted-foreground py-10">Nenhuma conta cadastrada.</TableCell></TableRow>
                )}
                {contas.map((c: any) => {
                  const r = latestByConta[c.id];
                  const status = r?.status || (c.pluggy_account_id ? "pendente" : "sem_dados");
                  const div = r ? Number(r.divergencia) : 0;
                  return (
                    <TableRow key={c.id} className="text-xs">
                      <TableCell className="py-2">
                        <div className="font-medium text-foreground">{c.nome}</div>
                        <div className="text-[10px] text-muted-foreground">{c.banco || "—"}</div>
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{fmtBRL(r?.saldo_agregado ?? c.investimento_sincronizado ?? 0)}</TableCell>
                      <TableCell className="py-2 text-right tabular-nums">{r ? fmtBRL(r.soma_detalhada) : "—"}</TableCell>
                      <TableCell className={`py-2 text-right tabular-nums ${status === "divergente" ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                        {r ? fmtBRL(div) : "—"}
                      </TableCell>
                      <TableCell className="py-2 text-right tabular-nums text-[10px] text-muted-foreground">
                        {fmtBRL(c.divergencia_alerta_limite ?? 1)}
                      </TableCell>
                      <TableCell className="py-2">
                        <StatusPill status={status} />
                      </TableCell>
                      <TableCell className="py-2 text-[10px] text-muted-foreground">{fmtDate(r?.created_at)}</TableCell>
                      <TableCell className="py-2 text-right">
                        <div className="inline-flex items-center gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0"
                            title="Reconciliar"
                            onClick={() => reconcileMutation.mutate(c.id)}
                            disabled={reconcileMutation.isPending || !c.pluggy_account_id}>
                            <RefreshCw className={`h-3.5 w-3.5 ${reconcileMutation.isPending ? "animate-spin" : ""}`} />
                          </Button>
                          {r && (
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" title="Ver relatório"
                              onClick={() => setReportOpen({ id: c.id, nome: c.nome })}>
                              <FileText className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>
          <p className="mt-2 text-[10px] text-muted-foreground">
            Compara o <strong>saldo agregado</strong> de investimentos vs <strong>soma dos investimentos detalhados ATIVOS</strong> (valor líquido / resgatável).
          </p>
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs" className="mt-3">
          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-9 text-xs w-[14%]">Quando</TableHead>
                  <TableHead className="h-9 text-xs w-[16%]">Conector</TableHead>
                  <TableHead className="h-9 text-xs w-[8%]">Fonte</TableHead>
                  <TableHead className="h-9 text-xs w-[12%]">Tipo de valor</TableHead>
                  <TableHead className="h-9 text-xs text-right w-[6%]">Contas</TableHead>
                  <TableHead className="h-9 text-xs text-right w-[8%]">Transações</TableHead>
                  <TableHead className="h-9 text-xs text-right w-[8%]">Investim.</TableHead>
                  <TableHead className="h-9 text-xs text-right w-[12%]">Total invest.</TableHead>
                  <TableHead className="h-9 text-xs w-[8%]">Status</TableHead>
                  <TableHead className="h-9 text-xs text-right w-[8%]">Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loadingLogs && (
                  <TableRow><TableCell colSpan={10} className="text-center py-10 text-sm text-muted-foreground">Carregando…</TableCell></TableRow>
                )}
                {!loadingLogs && logs.length === 0 && (
                  <TableRow><TableCell colSpan={10} className="text-center py-10 text-sm text-muted-foreground">Sem registros — execute uma sincronização.</TableCell></TableRow>
                )}
                {logs.map((l: any) => (
                  <TableRow key={l.id} className="text-xs">
                    <TableCell className="py-2 text-[11px] text-muted-foreground">{fmtDate(l.created_at)}</TableCell>
                    <TableCell className="py-2">{l.connector_name || "—"}</TableCell>
                    <TableCell className="py-2"><Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4 font-normal">{l.source}</Badge></TableCell>
                    <TableCell className="py-2">
                      <Badge variant={l.value_type === "liquido" ? "default" : "secondary"} className="text-[9px] px-1.5 py-0 h-4 font-normal">
                        {l.value_type === "liquido" ? "Líquido" : "Bruto"}
                      </Badge>
                    </TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{l.accounts_count}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{l.transactions_count}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{l.investments_count}</TableCell>
                    <TableCell className="py-2 text-right tabular-nums">{fmtBRL(l.total_investments)}</TableCell>
                    <TableCell className="py-2">
                      {l.status === "success"
                        ? <Badge className="bg-emerald-600 hover:bg-emerald-600 text-[9px] px-1.5 py-0 h-4 font-normal">OK</Badge>
                        : <Badge variant="destructive" className="text-[9px] px-1.5 py-0 h-4 font-normal">{l.status}</Badge>}
                    </TableCell>
                    <TableCell className="py-2 text-right text-[11px] tabular-nums text-muted-foreground">
                      {l.duration_ms ? `${(l.duration_ms / 1000).toFixed(1)}s` : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </TabsContent>
      </Tabs>

      <ReportDialog
        open={!!reportOpen}
        onOpenChange={(v) => !v && setReportOpen(null)}
        contaNome={reportOpen?.nome}
        snapshot={reportOpen ? latestByConta[reportOpen.id] : null}
      />
    </div>
  );
}

function MiniStat({
  icon: Icon, label, value, tone,
}: { icon: any; label: string; value: string; tone?: "ok" | "danger" }) {
  const ring = tone === "danger" ? "border-destructive/40 bg-destructive/5"
    : tone === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50";
  const text = tone === "danger" ? "text-destructive" : tone === "ok" ? "text-emerald-500" : "text-foreground";
  return (
    <Card className={`${ring} p-3 flex items-center gap-3`}>
      <div className={`shrink-0 rounded-md bg-muted/40 p-1.5 ${text}`}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground truncate">{label}</div>
        <div className={`text-sm font-semibold tabular-nums ${text}`}>{value}</div>
      </div>
    </Card>
  );
}

function StatusPill({ status }: { status: string }) {
  if (status === "divergente")
    return <Badge variant="destructive" className="gap-1 text-[10px] px-1.5 py-0 h-5"><AlertTriangle className="h-3 w-3" />Divergente</Badge>;
  if (status === "ok")
    return <Badge className="gap-1 bg-emerald-600 hover:bg-emerald-600 text-[10px] px-1.5 py-0 h-5"><CheckCircle2 className="h-3 w-3" />OK</Badge>;
  if (status === "pendente")
    return <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">Não checado</Badge>;
  return <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">Sem dados</Badge>;
}

function ReportDialog({
  open, onOpenChange, contaNome, snapshot,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
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
          <DialogTitle className="text-base">Relatório de Divergência — {contaNome}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="grid grid-cols-4 gap-2">
            <Stat label="Saldo agregado" value={fmtBRL(agregado)} hint="contas_bancarias.investimento_sincronizado" />
            <Stat label="Soma detalhada" value={fmtBRL(soma)} hint="Σ pluggy_investments.balance (ACTIVE)" />
            <Stat label="Divergência" value={fmtBRL(divergencia)} hint={`limite ${fmtBRL(limite)}`}
              tone={divergencia > limite ? "danger" : "ok"} />
            <Stat label="Status" value={snapshot?.status || "—"} hint={fmtDate(snapshot?.created_at)} />
          </div>

          <div className="rounded-md border bg-muted/20 p-2.5 text-[11px] leading-relaxed space-y-0.5">
            <div><strong>Fórmula:</strong> divergência = | saldo_agregado − Σ balance(ACTIVE) |</div>
            <div><strong>Tipo de valor:</strong> líquido (<code>balance</code> = resgatável). O bruto (<code>amount</code>) foi descontinuado.</div>
          </div>

          <Card className="overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30 hover:bg-muted/30">
                  <TableHead className="h-8 text-xs">Investimento</TableHead>
                  <TableHead className="h-8 text-xs">Tipo</TableHead>
                  <TableHead className="h-8 text-xs text-right">Aportado</TableHead>
                  <TableHead className="h-8 text-xs text-right">Lucro</TableHead>
                  <TableHead className="h-8 text-xs text-right">Resgatável</TableHead>
                  <TableHead className="h-8 text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {investimentos.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-6">Nenhum investimento detalhado.</TableCell></TableRow>
                )}
                {investimentos.map((inv) => (
                  <TableRow key={inv.id} className="text-xs">
                    <TableCell className="py-1.5">{inv.name}</TableCell>
                    <TableCell className="py-1.5 text-[10px] text-muted-foreground">{inv.subtype || inv.type || "—"}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums">{inv.amount_original != null ? fmtBRL(inv.amount_original) : "—"}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums text-emerald-500">{inv.amount_profit != null ? fmtBRL(inv.amount_profit) : "—"}</TableCell>
                    <TableCell className="py-1.5 text-right tabular-nums font-medium">{fmtBRL(inv.balance)}</TableCell>
                    <TableCell className="py-1.5"><Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">{inv.status || "ACTIVE"}</Badge></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "ok" | "danger" }) {
  const ring = tone === "danger" ? "border-destructive/40 bg-destructive/5"
    : tone === "ok" ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50";
  return (
    <div className={`rounded-md border p-2.5 ${ring}`}>
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{hint}</div>}
    </div>
  );
}
