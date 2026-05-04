import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, FileSpreadsheet, Lock, Trash2, ExternalLink } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Link } from "react-router-dom";

export default function RHFolha() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const qc = useQueryClient();

  const { data: periodos = [], refetch: refetchPeriodos } = useQuery({
    queryKey: ["rh_folha_periodos", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rh_folha_periodos").select("*").eq("user_id", targetUserId!).order("competencia", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: any = periodos.find((p: any) => p.id === selectedId) ?? periodos[0];
  const folhaId = selected?.id;

  const { data: itens = [], refetch: refetchItens } = useQuery({
    queryKey: ["rh_folha_itens", folhaId],
    enabled: !!folhaId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rh_folha_itens").select("*, colaboradores(nome)").eq("folha_id", folhaId);
      if (error) throw error;
      return data ?? [];
    },
  });

  const [novoOpen, setNovoOpen] = useState(false);
  const [competencia, setCompetencia] = useState(() => new Date().toISOString().slice(0, 7));

  const criarFolha = useMutation({
    mutationFn: async () => {
      // Cria período
      const compDate = `${competencia}-01`;
      const { data: novo, error } = await (supabase as any).from("rh_folha_periodos").insert({
        user_id: targetUserId, empresa_id: empresa?.id ?? null, competencia: compDate, status: "rascunho",
      }).select("*").single();
      if (error) throw error;

      // Pré-popula com colaboradores ativos
      const { data: colabs } = await supabase.from("colaboradores").select("id, salario").eq("user_id", targetUserId!).eq("ativo", true);
      const items = (colabs ?? []).map((c: any) => ({
        user_id: targetUserId, empresa_id: empresa?.id ?? null, folha_id: novo.id, colaborador_id: c.id,
        salario_base: Number(c.salario || 0), beneficios: 0, descontos: 0, encargos: 0, liquido: Number(c.salario || 0),
      }));
      if (items.length) {
        const { error: itErr } = await (supabase as any).from("rh_folha_itens").insert(items);
        if (itErr) throw itErr;
      }
      return novo.id;
    },
    onSuccess: (id) => { toast.success("Folha criada"); setNovoOpen(false); setSelectedId(id); refetchPeriodos(); },
    onError: (e: any) => toast.error(e?.message),
  });

  const fecharFolha = useMutation({
    mutationFn: async () => {
      if (!folhaId) return;
      const due = `${competencia || selected.competencia.slice(0, 7)}-05`;
      const { error } = await (supabase as any).rpc("rh_fechar_folha", { p_folha_id: folhaId, p_due_date: due });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Folha lançada em Contas a Pagar");
      qc.invalidateQueries({ queryKey: ["accounts_payable"] });
      refetchPeriodos();
    },
    onError: (e: any) => toast.error(e?.message),
  });

  const excluir = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("rh_folha_periodos").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { setSelectedId(null); refetchPeriodos(); toast.success("Folha excluída"); },
    onError: (e: any) => toast.error(e?.message),
  });

  const updateItem = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: any }) => {
      const liquido = Number(patch.salario_base ?? 0) + Number(patch.beneficios ?? 0) - Number(patch.descontos ?? 0);
      const { error } = await (supabase as any).from("rh_folha_itens").update({ ...patch, liquido }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => refetchItens(),
  });

  const totais = useMemo(() => {
    const t = { proventos: 0, descontos: 0, liquido: 0 };
    itens.forEach((i: any) => {
      t.proventos += Number(i.salario_base || 0) + Number(i.beneficios || 0);
      t.descontos += Number(i.descontos || 0);
      t.liquido += Number(i.liquido || 0);
    });
    return t;
  }, [itens]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">Folha de Pagamento</h1>
          <p className="text-sm text-muted-foreground mt-1">Feche a folha mensal e gere automaticamente um título consolidado em Contas a Pagar.</p>
        </div>
        <Button onClick={() => setNovoOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Nova folha</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-5">
        <Card className="p-2">
          <p className="text-[11px] uppercase font-semibold text-muted-foreground px-2 py-2">Períodos</p>
          {periodos.length === 0 ? <p className="p-4 text-xs text-muted-foreground">Nenhuma folha ainda.</p> : (
            <div className="space-y-1">
              {periodos.map((p: any) => (
                <button key={p.id} onClick={() => setSelectedId(p.id)} className={`w-full text-left px-3 py-2 rounded-md text-sm hover:bg-muted/40 transition ${selected?.id === p.id ? "bg-muted/60" : ""}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{new Date(p.competencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span>
                    <Badge variant="outline" className={p.status === "lancada" ? "text-emerald-400 border-emerald-500/20" : "text-muted-foreground"}>{p.status}</Badge>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">R$ {Number(p.total_liquido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-4">
          {!selected ? (
            <Card className="p-12 text-center text-sm text-muted-foreground">Selecione ou crie uma folha.</Card>
          ) : (
            <>
              <Card className="p-4">
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div>
                    <h2 className="text-base font-semibold">Folha — {new Date(selected.competencia).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">Status: {selected.status}{selected.conta_pagar_id && " · vinculada a Contas a Pagar"}</p>
                  </div>
                  <div className="flex gap-2">
                    {selected.conta_pagar_id && (
                      <Link to="/app/financas/pagar"><Button variant="outline" size="sm" className="gap-2"><ExternalLink className="w-3.5 h-3.5" /> Ver no financeiro</Button></Link>
                    )}
                    {selected.status !== "lancada" && (
                      <>
                        <Button onClick={() => fecharFolha.mutate()} disabled={fecharFolha.isPending} className="gap-2"><Lock className="w-3.5 h-3.5" /> Fechar e lançar</Button>
                        <Button variant="outline" size="sm" onClick={() => excluir.mutate(selected.id)} className="gap-2 text-destructive"><Trash2 className="w-3.5 h-3.5" /></Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 mt-5">
                  <Stat label="Proventos" value={`R$ ${totais.proventos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  <Stat label="Descontos" value={`R$ ${totais.descontos.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} />
                  <Stat label="Líquido a pagar" value={`R$ ${totais.liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} highlight />
                </div>
              </Card>

              <Card className="p-4">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
                        <th className="py-2 pr-3 w-[28%]">Colaborador</th>
                        <th className="py-2 pr-3 w-[18%] text-right">Salário base</th>
                        <th className="py-2 pr-3 w-[18%] text-right">Benefícios</th>
                        <th className="py-2 pr-3 w-[18%] text-right">Descontos</th>
                        <th className="py-2 w-[18%] text-right">Líquido</th>
                      </tr>
                    </thead>
                    <tbody>
                      {itens.map((it: any) => {
                        const editable = selected.status !== "lancada";
                        return (
                          <tr key={it.id} className="border-b border-border/20">
                            <td className="py-2 pr-3 font-medium">{it.colaboradores?.nome ?? "—"}</td>
                            <td className="py-2 pr-3 text-right">
                              <NumberCell disabled={!editable} value={it.salario_base} onSave={(v) => updateItem.mutate({ id: it.id, patch: { salario_base: v, beneficios: it.beneficios, descontos: it.descontos } })} />
                            </td>
                            <td className="py-2 pr-3 text-right">
                              <NumberCell disabled={!editable} value={it.beneficios} onSave={(v) => updateItem.mutate({ id: it.id, patch: { salario_base: it.salario_base, beneficios: v, descontos: it.descontos } })} />
                            </td>
                            <td className="py-2 pr-3 text-right">
                              <NumberCell disabled={!editable} value={it.descontos} onSave={(v) => updateItem.mutate({ id: it.id, patch: { salario_base: it.salario_base, beneficios: it.beneficios, descontos: v } })} />
                            </td>
                            <td className="py-2 text-right font-semibold">R$ {Number(it.liquido || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                {itens.length === 0 && <p className="py-8 text-center text-xs text-muted-foreground">Nenhum colaborador na folha.</p>}
              </Card>
            </>
          )}
        </div>
      </div>

      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova folha</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label className="text-xs">Competência</Label>
              <Input type="month" value={competencia} onChange={(e) => setCompetencia(e.target.value)} />
            </div>
            <p className="text-xs text-muted-foreground flex gap-2"><FileSpreadsheet className="w-3.5 h-3.5" /> A folha será criada em rascunho com todos os colaboradores ativos pré-populados pelo salário base.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={() => criarFolha.mutate()} disabled={!competencia || criarFolha.isPending}>Criar folha</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg border border-border/40 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold mt-1 ${highlight ? "text-primary" : ""}`}>{value}</p>
    </div>
  );
}

function NumberCell({ value, onSave, disabled }: { value: number; onSave: (v: number) => void; disabled?: boolean }) {
  const [v, setV] = useState(String(value ?? 0));
  if (disabled) return <span>R$ {Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>;
  return (
    <Input
      type="number" step="0.01" value={v} onChange={(e) => setV(e.target.value)}
      onBlur={() => { const n = Number(v); if (n !== Number(value)) onSave(n); }}
      className="h-8 text-right"
    />
  );
}
