import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, Laptop } from "lucide-react";
import { useCategoriasEquipamento, useColaboradores } from "@/hooks/useRH";
import { toast } from "sonner";

export default function RHEquipamentos() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const { data: cats = [] } = useCategoriasEquipamento();
  const { data: colabs = [] } = useColaboradores();
  const catMap = new Map(cats.map((c: any) => [c.id, c.nome]));
  const colabMap = new Map(colabs.map((c: any) => [c.id, c.nome]));

  const { data: list = [], refetch } = useQuery({
    queryKey: ["rh_equipamentos", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("rh_equipamentos").select("*").eq("user_id", targetUserId!).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<any>({ nome: "", categoria_id: "", marca: "", modelo: "", numero_serie: "", patrimonio: "", valor_aquisicao: "", colaborador_id: "" });
  const add = useMutation({
    mutationFn: async () => {
      const payload = { ...form, valor_aquisicao: form.valor_aquisicao ? Number(form.valor_aquisicao) : null, status: form.colaborador_id ? "em_uso" : "estoque", user_id: targetUserId, empresa_id: empresa?.id ?? null };
      if (!payload.colaborador_id) payload.colaborador_id = null;
      if (!payload.categoria_id) payload.categoria_id = null;
      const { error } = await (supabase as any).from("rh_equipamentos").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { setOpen(false); setForm({ nome: "", categoria_id: "", marca: "", modelo: "", numero_serie: "", patrimonio: "", valor_aquisicao: "", colaborador_id: "" }); refetch(); toast.success("Equipamento adicionado"); },
    onError: (e: any) => toast.error(e?.message),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await (supabase as any).from("rh_equipamentos").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => refetch(),
  });

  const totalValor = list.reduce((s: number, e: any) => s + Number(e.valor_aquisicao || 0), 0);
  const emUso = list.filter((e: any) => e.status === "em_uso").length;
  const estoque = list.filter((e: any) => e.status === "estoque").length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Equipamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Inventário de hardware atribuído à equipe.</p>
        </div>
        <Button onClick={() => setOpen(true)} className="gap-2"><Plus className="w-4 h-4" /> Novo equipamento</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Total de itens</p><p className="text-2xl font-bold mt-1">{list.length}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Em uso / Estoque</p><p className="text-2xl font-bold mt-1">{emUso} / {estoque}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Valor total</p><p className="text-2xl font-bold mt-1">R$ {totalValor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p></Card>
      </div>

      <Card className="p-4">
        {list.length === 0 ? <p className="py-12 text-center text-sm text-muted-foreground">Nenhum equipamento.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 w-[24%]">Equipamento</th>
                  <th className="py-2 pr-3 w-[16%]">Categoria</th>
                  <th className="py-2 pr-3 w-[18%]">Identificação</th>
                  <th className="py-2 pr-3 w-[18%]">Atribuído a</th>
                  <th className="py-2 pr-3 w-[12%] text-right">Valor</th>
                  <th className="py-2 w-[12%] text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {list.map((e: any) => (
                  <tr key={e.id} className="border-b border-border/20 hover:bg-muted/20">
                    <td className="py-2.5 pr-3 font-medium flex items-center gap-2"><Laptop className="w-4 h-4 text-primary/60" />{e.nome}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground">{catMap.get(e.categoria_id) ?? "—"}</td>
                    <td className="py-2.5 pr-3 text-muted-foreground text-xs">{e.marca} {e.modelo}{e.numero_serie ? ` · SN ${e.numero_serie}` : ""}</td>
                    <td className="py-2.5 pr-3">{colabMap.get(e.colaborador_id) ?? <span className="text-muted-foreground">—</span>}</td>
                    <td className="py-2.5 pr-3 text-right">R$ {Number(e.valor_aquisicao || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                    <td className="py-2.5 text-right">
                      <Badge variant="outline" className={e.status === "em_uso" ? "text-emerald-400 border-emerald-500/20" : ""}>{e.status}</Badge>
                      <Button size="icon" variant="ghost" className="h-7 w-7 ml-2" onClick={() => del.mutate(e.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo equipamento</DialogTitle></DialogHeader>
          <div className="space-y-3 py-2">
            <div><Label className="text-xs">Nome *</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} maxLength={60} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label className="text-xs">Categoria</Label>
                <Select value={form.categoria_id} onValueChange={(v) => setForm({ ...form, categoria_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{cats.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Atribuir a</Label>
                <Select value={form.colaborador_id} onValueChange={(v) => setForm({ ...form, colaborador_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Estoque" /></SelectTrigger>
                  <SelectContent>{colabs.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Marca</Label><Input value={form.marca} onChange={(e) => setForm({ ...form, marca: e.target.value })} maxLength={60} /></div>
              <div><Label className="text-xs">Modelo</Label><Input value={form.modelo} onChange={(e) => setForm({ ...form, modelo: e.target.value })} maxLength={60} /></div>
              <div><Label className="text-xs">Nº de série</Label><Input value={form.numero_serie} onChange={(e) => setForm({ ...form, numero_serie: e.target.value })} maxLength={60} /></div>
              <div><Label className="text-xs">Patrimônio</Label><Input value={form.patrimonio} onChange={(e) => setForm({ ...form, patrimonio: e.target.value })} maxLength={60} /></div>
              <div><Label className="text-xs">Valor de aquisição</Label><Input type="number" step="0.01" value={form.valor_aquisicao} onChange={(e) => setForm({ ...form, valor_aquisicao: e.target.value })} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button disabled={!form.nome.trim()} onClick={() => add.mutate()}>Adicionar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
