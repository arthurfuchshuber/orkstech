import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { useTiposAusencia, useColaboradores } from "@/hooks/useRH";
import { toast } from "sonner";

export default function RHAusencias() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const { data: tipos = [] } = useTiposAusencia();
  const { data: colabs = [] } = useColaboradores();
  const colabMap = new Map(colabs.map((c: any) => [c.id, c.nome]));
  const tipoMap = new Map(tipos.map((t: any) => [t.id, t]));

  const { data: list = [], refetch } = useQuery({
    queryKey: ["rh_ausencias_all", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rh_ausencias").select("*").eq("user_id", targetUserId!).order("data_inicio", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ colaborador_id: "", tipo_ausencia_id: "", data_inicio: "", data_fim: "", observacoes: "" });
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("rh_ausencias").insert({ ...form, user_id: targetUserId, empresa_id: empresa?.id ?? null });
      if (error) throw error;
    },
    onSuccess: () => { setOpen(false); setForm({ colaborador_id: "", tipo_ausencia_id: "", data_inicio: "", data_fim: "", observacoes: "" }); refetch(); toast.success("Ausência registrada"); },
    onError: (e: any) => toast.error(e?.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("rh_ausencias").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => refetch(),
  });

  const today = new Date().toISOString().slice(0, 10);
  const ativas = useMemo(() => list.filter((a: any) => a.data_inicio <= today && a.data_fim >= today).length, [list]);
  const futuras = useMemo(() => list.filter((a: any) => a.data_inicio > today).length, [list]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Férias & Ausências</h1>
          <p className="text-sm text-muted-foreground mt-1">Calendário consolidado de férias, atestados e licenças da empresa.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Registrar ausência</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Em andamento hoje" value={String(ativas)} />
        <StatCard label="Programadas" value={String(futuras)} />
        <StatCard label="Total registrado" value={String(list.length)} />
      </div>

      <Card className="p-4">
        {list.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Nenhuma ausência registrada.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 w-[28%]">Colaborador</th>
                  <th className="py-2 pr-3 w-[18%]">Tipo</th>
                  <th className="py-2 pr-3 w-[18%]">Início</th>
                  <th className="py-2 pr-3 w-[18%]">Fim</th>
                  <th className="py-2 pr-3 w-[8%]">Dias</th>
                  <th className="py-2 w-[10%] text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((a: any) => {
                  const t: any = tipoMap.get(a.tipo_ausencia_id);
                  return (
                    <tr key={a.id} className="border-b border-border/20 hover:bg-muted/20">
                      <td className="py-2.5 pr-3 font-medium">{colabMap.get(a.colaborador_id) ?? "—"}</td>
                      <td className="py-2.5 pr-3">
                        <span className="inline-flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ background: t?.cor ?? "#3b82f6" }} />
                          {t?.nome ?? "—"}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{new Date(a.data_inicio).toLocaleDateString("pt-BR")}</td>
                      <td className="py-2.5 pr-3 text-muted-foreground">{new Date(a.data_fim).toLocaleDateString("pt-BR")}</td>
                      <td className="py-2.5 pr-3">{a.dias}</td>
                      <td className="py-2.5 text-right">
                        <Badge variant="outline">{a.status}</Badge>
                        <Button size="icon" variant="ghost" className="h-7 w-7 ml-2" onClick={() => del.mutate(a.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Registrar ausência</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Colaborador</Label>
              <Select value={form.colaborador_id} onValueChange={(v) => setForm({ ...form, colaborador_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{colabs.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Tipo</Label>
              <Select value={form.tipo_ausencia_id} onValueChange={(v) => setForm({ ...form, tipo_ausencia_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{tipos.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Início</Label><Input type="date" value={form.data_inicio} onChange={(e) => setForm({ ...form, data_inicio: e.target.value })} /></div>
              <div><Label className="text-xs">Fim</Label><Input type="date" value={form.data_fim} onChange={(e) => setForm({ ...form, data_fim: e.target.value })} /></div>
            </div>
            <div><Label className="text-xs">Observações</Label><Textarea rows={2} value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!form.colaborador_id || !form.tipo_ausencia_id || !form.data_inicio || !form.data_fim} onClick={() => add.mutate()}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return <Card className="p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="text-2xl font-bold mt-1">{value}</p></Card>;
}
