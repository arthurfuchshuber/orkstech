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
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";
import { TipoFormaPagamentoModal } from "./TipoFormaPagamentoModal";
import { useManagedSelect } from "@/hooks/useManagedSelect";
import { FileAttachment } from "@/components/inputs/FileAttachment";
import { CreditCard } from "lucide-react";

interface FormaPagamentoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId?: string | null;
  onSaved?: (id: string) => void;
}

export function FormaPagamentoModal({ open, onOpenChange, editingId, onSaved }: FormaPagamentoModalProps) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [form, setForm] = useState({ nome: "", tipo_id: "", numero_cartao: "", attachment_url: null as string | null });
  const [tipoModalOpen, setTipoModalOpen] = useState(false);
  const [tipoEditingId, setTipoEditingId] = useState<string | null>(null);

  const tiposCrud = useManagedSelect("tipos_forma_pagamento");

  useEffect(() => {
    if (user && open) {
      supabase.rpc("seed_default_tipos_pagamento", { p_user_id: user.id }).then(() => {
        qc.invalidateQueries({ queryKey: ["tipos-forma-pagamento"] });
      });
    }
  }, [user, open]);

  const { data: tipos = [] } = useQuery({
    queryKey: ["tipos-forma-pagamento"],
    queryFn: async () => {
      const { data } = await supabase.from("tipos_forma_pagamento").select("id, nome").eq("ativo", true).order("ordem");
      return data ?? [];
    },
    enabled: !!user,
  });

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
      setForm({
        nome: existing.nome,
        tipo_id: existing.tipo_id || "",
        numero_cartao: existing.numero_cartao || "",
        attachment_url: null,
      });
    } else if (!editingId && open) {
      setForm({ nome: "", tipo_id: "", numero_cartao: "", attachment_url: null });
    }
  }, [existing, editingId, open]);

  const selectedTipo = tipos.find((t: any) => t.id === form.tipo_id);
  const isCartao = selectedTipo?.nome?.toLowerCase().includes("cartão") || selectedTipo?.nome?.toLowerCase().includes("cartao");

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nome: form.nome,
        tipo_id: form.tipo_id || null,
        numero_cartao: isCartao ? (form.numero_cartao || null) : null,
        tipo: mapTipoToEnum(selectedTipo?.nome),
      };
      if (editingId) {
        const { error } = await supabase.from("formas_pagamento").update(payload).eq("id", editingId);
        if (error) throw error;
        return editingId;
      } else {
        const { data, error } = await supabase.from("formas_pagamento").insert({ ...payload, user_id: user!.id }).select("id").single();
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
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingId ? "Editar Forma de Pagamento" : "Nova Forma de Pagamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground mb-1.5 block">Nome</label>
              <Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} placeholder="Ex: PIX Banco do Brasil" maxLength={60} />
            </div>
            <ManagedSelectInput
              label="Tipo"
              value={form.tipo_id}
              onValueChange={(v) => setForm({ ...form, tipo_id: v })}
              options={tipos.map((t: any) => ({ value: t.id, label: t.nome }))}
              placeholder="Selecione o tipo..."
              icon={<CreditCard className="w-4 h-4" />}
              onAddModal={() => { setTipoEditingId(null); setTipoModalOpen(true); }}
              onEditModal={(id) => { setTipoEditingId(id); setTipoModalOpen(true); }}
              onDelete={tiposCrud.onDelete}
              onReorder={tiposCrud.onReorder}
              addLabel="Novo tipo"
            />
            {isCartao && (
              <div>
                <label className="text-sm font-medium text-foreground mb-1.5 block">Número do Cartão (últimos dígitos)</label>
                <Input
                  value={form.numero_cartao}
                  onChange={(e) => setForm({ ...form, numero_cartao: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                  placeholder="Ex: 1234"
                  maxLength={4}
                />
                <p className="text-xs text-muted-foreground mt-1">Últimos 4 dígitos para identificação</p>
              </div>
            )}
            <FileAttachment value={form.attachment_url} onValueChange={(url) => setForm({ ...form, attachment_url: url })} folder="formas-pagamento" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.nome.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TipoFormaPagamentoModal
        open={tipoModalOpen}
        onOpenChange={setTipoModalOpen}
        editingId={tipoEditingId}
        onSaved={(id) => setForm((prev) => ({ ...prev, tipo_id: id }))}
      />
    </>
  );
}

function mapTipoToEnum(tipoNome?: string): "pix" | "boleto" | "cartao" | "transferencia" | "dinheiro" {
  if (!tipoNome) return "pix";
  const lower = tipoNome.toLowerCase();
  if (lower.includes("pix")) return "pix";
  if (lower.includes("boleto")) return "boleto";
  if (lower.includes("cartão") || lower.includes("cartao")) return "cartao";
  if (lower.includes("transferência") || lower.includes("transferencia")) return "transferencia";
  if (lower.includes("dinheiro")) return "dinheiro";
  return "pix";
}
