import { useState, useEffect } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";

interface TipoGastoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  onSaved?: (id: string) => void;
}

// Conjunto curado de emojis para escolha rápida
const EMOJI_PRESETS = [
  "🛒","🍽️","🚗","⛽","🏠","💡","🏥","💊","📚","🎓","🎬","✈️",
  "👕","💄","💪","🐾","🎁","📱","💼","🪙","💳","🔧","🎉","❓",
  "💰","💸","📈","📉","🏢","🏭","🛠️","🚌","🏨","🍕","🍺","☕",
];

export function TipoGastoModal({ open, onOpenChange, editingId, onSaved }: TipoGastoModalProps) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", emoji: "💰" });

  const { data: existing } = useQuery({
    queryKey: ["tipos_gasto_edit", editingId],
    enabled: !!editingId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("tipos_gasto" as any).select("*").eq("id", editingId!).single();
      if (error) throw error;
      return data as any;
    },
  });

  useEffect(() => {
    if (existing && editingId) {
      setForm({ nome: existing.nome ?? "", emoji: existing.emoji ?? "💰" });
    } else if (!editingId && open) {
      setForm({ nome: "", emoji: "💰" });
    }
  }, [existing, editingId, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!empresa?.id) throw new Error("Selecione uma empresa");
      if (editingId) {
        const { error } = await supabase
          .from("tipos_gasto" as any)
          .update({ nome: form.nome, emoji: form.emoji } as any)
          .eq("id", editingId);
        if (error) throw error;
        return editingId;
      }
      const { data, error } = await supabase
        .from("tipos_gasto" as any)
        .insert({
          nome: form.nome,
          emoji: form.emoji,
          user_id: targetUserId!,
          empresa_id: empresa.id,
        } as any)
        .select("id")
        .single();
      if (error) throw error;
      return (data as any).id as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["tipos_gasto"] });
      toast.success(editingId ? "Tipo de gasto atualizado" : "Tipo de gasto criado");
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editingId ? "Editar Tipo de Gasto" : "Novo Tipo de Gasto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Emoji</label>
            <div className="flex items-center gap-2">
              <Input
                value={form.emoji}
                onChange={(e) => setForm({ ...form, emoji: e.target.value })}
                className="w-16 h-10 text-center text-xl"
                maxLength={4}
              />
              <p className="text-xs text-muted-foreground">Cole qualquer emoji ou escolha abaixo</p>
            </div>
            <div className="mt-2 flex flex-wrap gap-1 max-h-32 overflow-y-auto custom-scrollbar p-1 rounded-lg border border-border/40">
              {EMOJI_PRESETS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, emoji: e }))}
                  className={`h-8 w-8 rounded-md text-lg hover:bg-accent transition-colors ${form.emoji === e ? "bg-primary/15 ring-1 ring-primary" : ""}`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
            <Input
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
              placeholder="Ex: Alimentação"
              maxLength={60}
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
