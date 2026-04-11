import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Power, Target } from "lucide-react";

interface CentroCusto {
  id: string;
  nome: string;
  descricao: string | null;
  ativo: boolean;
}

export default function CentrosDeCusto() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: "", descricao: "" });
  const [search, setSearch] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["centros_custo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("centros_custo")
        .select("*")
        .eq("user_id", user!.id)
        .order("nome");
      if (error) throw error;
      return data as CentroCusto[];
    },
    enabled: !!user,
  });

  const filtered = items.filter((i) => i.nome.toLowerCase().includes(search.toLowerCase()));

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("centros_custo").update({ nome: form.nome, descricao: form.descricao || null }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("centros_custo").insert({ nome: form.nome, descricao: form.descricao || null, user_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success(editingId ? "Centro de custo atualizado" : "Centro de custo criado");
      closeModal();
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("centros_custo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["centros_custo"] });
      toast.success("Centro de custo excluído");
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("centros_custo").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["centros_custo"] }),
  });

  const closeModal = () => { setModalOpen(false); setEditingId(null); setForm({ nome: "", descricao: "" }); };
  const openNew = () => { setEditingId(null); setForm({ nome: "", descricao: "" }); setModalOpen(true); };
  const openEdit = (item: CentroCusto) => { setEditingId(item.id); setForm({ nome: item.nome, descricao: item.descricao || "" }); setModalOpen(true); };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Target className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Centros de Custo</h1>
            <p className="text-sm text-muted-foreground">Gerencie os centros de custo da empresa</p>
          </div>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Novo Centro</Button>
      </div>

      <Input placeholder="Buscar centro de custo..." value={search} onChange={(e) => setSearch(e.target.value)} className="max-w-sm" />

      <Card className="divide-y divide-border/50">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Nenhum centro de custo encontrado.</div>
        ) : filtered.map((item) => (
          <div key={item.id} className={`flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors group ${!item.ativo ? "opacity-50" : ""}`}>
            <Target className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.nome}</p>
              {item.descricao && <p className="text-xs text-muted-foreground truncate">{item.descricao}</p>}
            </div>
            <Badge variant="outline" className={item.ativo ? "text-emerald-400 border-emerald-500/20" : "text-muted-foreground"}>
              {item.ativo ? "Ativo" : "Inativo"}
            </Badge>
            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}><Pencil className="w-3.5 h-3.5" /></Button>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleMutation.mutate({ id: item.id, ativo: !item.ativo })}>
                <Power className={`w-3.5 h-3.5 ${item.ativo ? "text-emerald-400" : ""}`} />
              </Button>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(item.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
            </div>
          </div>
        ))}
      </Card>

      <Dialog open={modalOpen} onOpenChange={(v) => !v && closeModal()}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Centro de Custo" : "Novo Centro de Custo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Marketing" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição</label>
              <Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} placeholder="Descrição do centro de custo..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeModal}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.nome.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
