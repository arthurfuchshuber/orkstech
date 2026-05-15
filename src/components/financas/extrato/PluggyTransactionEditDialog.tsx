import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Lock, Sparkles, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { toast } from "sonner";
import { SugestaoCategoriaModal } from "./SugestaoCategoriaModal";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  transactionId: string | null;
  /** Read-only fields shown for context */
  readOnly: {
    description: string | null;
    amount: number;
    date: string;
  } | null;
}

/**
 * Editor de transação Pluggy: somente campos que NÃO são fonte de verdade do banco.
 * Valor, data e descrição original são bloqueados (vêm do Open Finance).
 */
export function PluggyTransactionEditDialog({ open, onOpenChange, transactionId, readOnly }: Props) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();

  const [categoriaId, setCategoriaId] = useState<string | null>(null);
  const [costCenterId, setCostCenterId] = useState<string | null>(null);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [businessUnitId, setBusinessUnitId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [sugestaoOpen, setSugestaoOpen] = useState(false);
  const [autoOfferedFor, setAutoOfferedFor] = useState<string | null>(null);
  const { businessUnits } = useBusinessUnits();

  // Load current values
  const { data: tx } = useQuery({
    queryKey: ["pluggy_tx_edit", transactionId],
    queryFn: async () => {
      if (!transactionId) return null;
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .select("id, categoria_financeira_id, cost_center_id, payment_method_id, notes")
        .eq("id", transactionId)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    enabled: !!transactionId && open,
  });

  useEffect(() => {
    if (tx) {
      setCategoriaId(tx.categoria_financeira_id ?? null);
      setCostCenterId(tx.cost_center_id ?? null);
      setPaymentMethodId(tx.payment_method_id ?? null);
      setNotes(tx.notes ?? "");
    }
  }, [tx]);

  // Sugestão de categoria agora é manual: usuário clica no botão "Sugerir categoria".
  useEffect(() => {
    if (!open) setAutoOfferedFor(null);
  }, [open]);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias_financeiras_select", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, categoria_pai_id")
        .eq("ativo", true)
        .order("ordem");
      return (data ?? []).filter((c: any) => c.categoria_pai_id != null);
    },
    enabled: open,
  });

  const { data: centros = [] } = useQuery({
    queryKey: ["centros_custo_select", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("centros_custo")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data ?? [];
    },
    enabled: open,
  });

  const { data: formasPagamento = [] } = useQuery({
    queryKey: ["formas_pagamento_select", empresaId],
    queryFn: async () => {
      const { data } = await supabase
        .from("formas_pagamento" as any)
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return (data as any[]) ?? [];
    },
    enabled: open,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!transactionId) throw new Error("Sem transação");
      const { error } = await supabase
        .from("pluggy_transactions" as any)
        .update({
          categoria_financeira_id: categoriaId,
          cost_center_id: costCenterId,
          payment_method_id: paymentMethodId,
          notes: notes.trim() || null,
        })
        .eq("id", transactionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      toast.success("Classificação atualizada");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar classificação</DialogTitle>
          <DialogDescription>
            Transação importada via Open Finance. Valor, data e descrição original são fontes de verdade do banco e não podem ser editadas.
          </DialogDescription>
        </DialogHeader>

        {readOnly && (
          <Alert>
            <Lock className="h-4 w-4" />
            <AlertDescription className="text-xs space-y-1">
              <div><strong>Descrição:</strong> {readOnly.description || "—"}</div>
              <div><strong>Valor:</strong> {readOnly.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</div>
              <div><strong>Data:</strong> {new Date(readOnly.date).toLocaleDateString("pt-BR")}</div>
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <Label>Subcategoria (DRE)</Label>
              {readOnly?.description && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs gap-1.5 text-primary hover:text-primary"
                  onClick={() => setSugestaoOpen(true)}
                >
                  <Sparkles className="w-3 h-3" />
                  Sugestão inteligente
                </Button>
              )}
            </div>
            <Select value={categoriaId ?? "_none"} onValueChange={(v) => setCategoriaId(v === "_none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Nenhuma —</SelectItem>
                {categorias.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Centro de custo</Label>
            <Select value={costCenterId ?? "_none"} onValueChange={(v) => setCostCenterId(v === "_none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Nenhum —</SelectItem>
                {centros.map((c: any) => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Forma de pagamento</Label>
            <Select value={paymentMethodId ?? "_none"} onValueChange={(v) => setPaymentMethodId(v === "_none" ? null : v)}>
              <SelectTrigger><SelectValue placeholder="Nenhuma" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">— Nenhuma —</SelectItem>
                {formasPagamento.map((f: any) => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Notas internas</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              placeholder="Observações internas sobre esta transação"
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>

      {readOnly && (
        <SugestaoCategoriaModal
          open={sugestaoOpen}
          onOpenChange={setSugestaoOpen}
          description={readOnly.description ?? ""}
          amount={readOnly.amount}
          currentCategoriaId={categoriaId}
          onApply={(catId) => {
            setCategoriaId(catId);
            setSugestaoOpen(false);
          }}
        />
      )}
    </Dialog>
  );
}
