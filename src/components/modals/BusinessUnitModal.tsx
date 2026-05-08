import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface BusinessUnitModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  onSaved?: (id: string) => void;
}

export function BusinessUnitModal({ open, onOpenChange, editingId, onSaved }: BusinessUnitModalProps) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", descricao: "" });

  const { data: existing } = useQuery({
    queryKey: ["business_units_edit", editingId],
    enabled: !!editingId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("business_units" as any).select("*").eq("id", editingId!).single();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (existing && editingId) {
      setForm({ nome: existing.nome ?? "", descricao: existing.descricao ?? "" });
    } else if (!editingId && open) {
      setForm({ nome: "", descricao: "" });
    }
  }, [existing, editingId, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!empresa?.id) throw new Error("Selecione uma empresa");
      if (editingId) {
        const { error } = await supabase
          .from("business_units" as any)
          .update({ nome: form.nome, descricao: form.descricao || null })
          .eq("id", editingId);
        if (error) throw error;
        return editingId;
      }
      const { data, error } = await supabase
        .from("business_units" as any)
        .insert({
          nome: form.nome,
          descricao: form.descricao || null,
          user_id: targetUserId!,
          empresa_id: empresa.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["business_units"] });
      qc.invalidateQueries({ queryKey: ["business-units"] });
      toast.success(editingId ? "Unidade atualizada" : "Unidade criada");
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar Unidade de Negócio" : "Nova Unidade de Negócio"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: SaaS Gestão de Imóveis"
              maxLength={60}
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Descrição</label>
            <Textarea
              value={form.descricao}
              onChange={(e) => setForm({ ...form, descricao: e.target.value })}
              placeholder="O que esta unidade representa..."
              rows={3}
            />
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
