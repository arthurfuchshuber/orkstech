import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SelectInput } from "@/components/inputs/SelectInput";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface CategoriaCadastroModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  onSaved?: (id: string) => void;
}

export function CategoriaCadastroModal({ open, onOpenChange, editingId, onSaved }: CategoriaCadastroModalProps) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", categoria_pai_id: "" });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias_cadastro", targetUserId],
    enabled: !!user && open,
    queryFn: async () => {
      let q = supabase
        .from("categorias_cadastro")
        .select("id, nome, categoria_pai_id")
        .eq("ativo", true)
        .eq("user_id", targetUserId!)
        .is("categoria_pai_id", null)
        .order("ordem");
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: existing } = useQuery({
    queryKey: ["categorias_cadastro_edit", editingId],
    enabled: !!editingId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("categorias_cadastro").select("*").eq("id", editingId!).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing && editingId) {
      setForm({ nome: existing.nome, categoria_pai_id: existing.categoria_pai_id || "" });
    } else if (!editingId && open) {
      setForm({ nome: "", categoria_pai_id: "" });
    }
  }, [existing, editingId, open]);

  const parentOptions = categorias
    .filter((c) => c.id !== editingId)
    .map((c) => ({ value: c.id, label: c.nome }));

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome.trim(),
        categoria_pai_id: form.categoria_pai_id || null,
      };
      if (editingId) {
        const { error } = await supabase.from("categorias_cadastro").update(payload).eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        const { data, error } = await supabase
          .from("categorias_cadastro")
          .insert({ ...payload, user_id: user!.id, empresa_id: empresa?.id || null })
          .select("id")
          .single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["categorias_cadastro"] });
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
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Tecnologia"
              maxLength={60}
            />
          </div>
          {parentOptions.length > 0 && (
            <SelectInput
              label="Categoria pai (opcional)"
              placeholder="Nenhuma (categoria raiz)"
              value={form.categoria_pai_id}
              onValueChange={(v) => setForm({ ...form, categoria_pai_id: v })}
              options={parentOptions}
            />
          )}
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
