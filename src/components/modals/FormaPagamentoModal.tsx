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

type TipoForma = "pix" | "boleto" | "cartao" | "transferencia" | "dinheiro";

interface FormaPagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  onSaved?: (id: string) => void;
}

export function FormaPagamentoModal({ open, onOpenChange, editingId, onSaved }: FormaPagamentoModalProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", tipo: "pix" as TipoForma });

  const { data: existing } = useQuery({
    queryKey: ["formas_pagamento_edit", editingId],
    enabled: !!editingId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("formas_pagamento").select("*").eq("id", editingId!).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing && editingId) {
      setForm({ nome: existing.nome, tipo: existing.tipo as TipoForma });
    } else if (!editingId && open) {
      setForm({ nome: "", tipo: "pix" });
    }
  }, [existing, editingId, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("formas_pagamento").update({ nome: form.nome, tipo: form.tipo }).eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        const { data, error } = await supabase.from("formas_pagamento").insert({ nome: form.nome, tipo: form.tipo, user_id: user!.id }).select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["formas_pagamento"] });
      qc.invalidateQueries({ queryKey: ["formas-pagamento"] });
      toast.success(editingId ? "Forma de pagamento atualizada" : "Forma de pagamento criada");
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editingId ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: PIX Banco do Brasil" maxLength={60} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo</label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoForma })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pix">PIX</SelectItem>
                <SelectItem value="boleto">Boleto</SelectItem>
                <SelectItem value="cartao">Cartão</SelectItem>
                <SelectItem value="transferencia">Transferência</SelectItem>
                <SelectItem value="dinheiro">Dinheiro</SelectItem>
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
