import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type TipoFinanceiro = "receita" | "despesa" | "custo" | "ajuste";

interface CategoriaFinanceiraModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  defaultTipo?: TipoFinanceiro;
  onSaved?: (id: string) => void;
}

export function CategoriaFinanceiraModal({ open, onOpenChange, editingId, defaultTipo = "despesa", onSaved }: CategoriaFinanceiraModalProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", tipo: defaultTipo as TipoFinanceiro, categoria_pai_id: null as string | null });

  const { data: existing } = useQuery({
    queryKey: ["categorias_financeiras_edit", editingId],
    enabled: !!editingId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias_financeiras").select("*").eq("id", editingId!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: allCategories = [] } = useQuery({
    queryKey: ["categorias_financeiras"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias_financeiras").select("*").eq("user_id", user!.id).order("ordem");
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing && editingId) {
      setForm({ nome: existing.nome, tipo: existing.tipo as TipoFinanceiro, categoria_pai_id: existing.categoria_pai_id });
    } else if (!editingId && open) {
      setForm({ nome: "", tipo: defaultTipo, categoria_pai_id: null });
    }
  }, [existing, editingId, open, defaultTipo]);

  const parentOptions = allCategories.filter((c) => c.id !== editingId);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("categorias_financeiras")
          .update({ nome: form.nome, tipo: form.tipo, categoria_pai_id: form.categoria_pai_id })
          .eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        const siblings = allCategories.filter((c) => c.categoria_pai_id === form.categoria_pai_id);
        const ordem = siblings.length;
        const { data, error } = await supabase.from("categorias_financeiras")
          .insert({ nome: form.nome, tipo: form.tipo, categoria_pai_id: form.categoria_pai_id, ordem, user_id: user!.id })
          .select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["categorias_financeiras"] });
      qc.invalidateQueries({ queryKey: ["categorias-financeiras"] });
      toast.success(editingId ? "Categoria atualizada" : "Categoria criada");
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar categoria"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Receita de Serviços" maxLength={60} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo Financeiro</label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoFinanceiro })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="receita">Receita</SelectItem>
                <SelectItem value="despesa">Despesa</SelectItem>
                <SelectItem value="custo">Custo</SelectItem>
                <SelectItem value="ajuste">Ajuste</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Categoria Pai (opcional)</label>
            <Select value={form.categoria_pai_id || "__none__"} onValueChange={(v) => setForm({ ...form, categoria_pai_id: v === "__none__" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Nenhuma (raiz)" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhuma (raiz)</SelectItem>
                {parentOptions.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={!form.nome.trim() || saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
