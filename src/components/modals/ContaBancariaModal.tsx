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

type TipoConta = "corrente" | "poupanca" | "caixa" | "carteira_digital";

interface ContaBancariaModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  onSaved?: (id: string) => void;
}

export function ContaBancariaModal({ open, onOpenChange, editingId, onSaved }: ContaBancariaModalProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", banco: "", tipo: "corrente" as TipoConta, saldo_inicial: "0" });

  const { data: existing } = useQuery({
    queryKey: ["contas_bancarias_edit", editingId],
    enabled: !!editingId && open,
    queryFn: async () => {
      const { data, error } = await supabase.from("contas_bancarias").select("*").eq("id", editingId!).single();
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (existing && editingId) {
      setForm({ nome: existing.nome, banco: existing.banco || "", tipo: existing.tipo as TipoConta, saldo_inicial: String(existing.saldo_inicial) });
    } else if (!editingId && open) {
      setForm({ nome: "", banco: "", tipo: "corrente", saldo_inicial: "0" });
    }
  }, [existing, editingId, open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome: form.nome,
        banco: form.banco || null,
        tipo: form.tipo,
        saldo_inicial: parseFloat(form.saldo_inicial) || 0,
      };
      if (editingId) {
        const { error } = await supabase.from("contas_bancarias").update(payload).eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        const { data, error } = await supabase.from("contas_bancarias").insert({ ...payload, user_id: user!.id }).select("id").single();
        if (error) throw error;
        return data.id;
      }
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["contas_bancarias"] });
      qc.invalidateQueries({ queryKey: ["contas-bancarias"] });
      toast.success(editingId ? "Conta atualizada" : "Conta criada");
      onSaved?.(id);
      onOpenChange(false);
    },
    onError: () => toast.error("Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>{editingId ? "Editar Conta Bancária" : "Nova Conta Bancária"}</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Nome da Conta</label>
            <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: Conta Principal" maxLength={60} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Banco</label>
            <Input value={form.banco} onChange={(e) => setForm({ ...form, banco: e.target.value })} placeholder="Ex: Banco do Brasil" maxLength={60} />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Tipo</label>
            <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v as TipoConta })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="corrente">Corrente</SelectItem>
                <SelectItem value="poupanca">Poupança</SelectItem>
                <SelectItem value="caixa">Caixa</SelectItem>
                <SelectItem value="carteira_digital">Carteira Digital</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-sm font-medium text-foreground mb-1.5 block">Saldo Inicial (R$)</label>
            <Input type="number" step="0.01" value={form.saldo_inicial} onChange={(e) => setForm({ ...form, saldo_inicial: e.target.value })} />
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
