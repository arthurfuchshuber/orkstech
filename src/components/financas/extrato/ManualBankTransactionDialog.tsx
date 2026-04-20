import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CurrencyInput } from "@/components/inputs/CurrencyInput";
import { DateInput } from "@/components/inputs/DateInput";
import { Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";

export interface ManualBankTx {
  id?: string;
  transaction_date: Date | undefined;
  amount: number;
  type: "CREDIT" | "DEBIT";
  description: string;
  document_number: string;
  category: string;
  notes: string;
  bank_account_id: string;
}

const empty: ManualBankTx = {
  transaction_date: new Date(),
  amount: 0,
  type: "DEBIT",
  description: "",
  document_number: "",
  category: "",
  notes: "",
  bank_account_id: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: any | null;
  bankAccounts: { id: string; nome: string; banco?: string | null }[];
}

export function ManualBankTransactionDialog({ open, onOpenChange, editing, bankAccounts }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ManualBankTx>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setForm({
        id: editing.id,
        transaction_date: editing.transaction_date ? new Date(editing.transaction_date + "T12:00:00") : new Date(),
        amount: Math.abs(Number(editing.amount ?? 0)),
        type: editing.type === "CREDIT" ? "CREDIT" : "DEBIT",
        description: editing.description ?? "",
        document_number: editing.document_number ?? "",
        category: editing.category ?? "",
        notes: editing.notes ?? "",
        bank_account_id: editing.bank_account_id ?? "",
      });
    } else {
      setForm(empty);
    }
    setErrors({});
  }, [open, editing]);

  const update = <K extends keyof ManualBankTx>(k: K, v: ManualBankTx[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
    if (errors[k as string]) setErrors((p) => { const n = { ...p }; delete n[k as string]; return n; });
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.description.trim()) e.description = "Descrição obrigatória";
    if (!form.transaction_date) e.transaction_date = "Data obrigatória";
    if (!form.amount || form.amount <= 0) e.amount = "Valor deve ser maior que zero";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Não autenticado");
      const payload = {
        user_id: user.id,
        empresa_id: empresa?.id ?? null,
        bank_account_id: form.bank_account_id || null,
        transaction_date: form.transaction_date!.toISOString().slice(0, 10),
        amount: form.amount,
        type: form.type,
        description: form.description.trim(),
        document_number: form.document_number.trim() || null,
        category: form.category.trim() || null,
        notes: form.notes.trim() || null,
        source: "manual" as const,
      };
      if (form.id) {
        const { error } = await supabase
          .from("manual_bank_transactions" as any)
          .update(payload as any)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("manual_bank_transactions" as any)
          .insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(form.id ? "Lançamento atualizado" : "Lançamento criado");
      queryClient.invalidateQueries({ queryKey: ["manual_bank_transactions"] });
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const submit = () => {
    if (!validate()) return;
    saveMut.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{form.id ? "Editar lançamento manual" : "Novo lançamento manual"}</DialogTitle>
          <DialogDescription>
            Lançamentos manuais são separados das transações sincronizadas e podem ser editados ou
            excluídos a qualquer momento.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div>
            <Label className="text-sm font-medium mb-2 block">Tipo de movimentação</Label>
            <RadioGroup
              value={form.type}
              onValueChange={(v) => update("type", v as "CREDIT" | "DEBIT")}
              className="grid grid-cols-2 gap-2"
            >
              <label
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form.type === "CREDIT" ? "border-primary bg-primary/5" : "border-border"
                }`}
              >
                <RadioGroupItem value="CREDIT" />
                <ArrowDownLeft className="h-4 w-4 text-primary" />
                <span className="text-sm font-medium">Entrada</span>
              </label>
              <label
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form.type === "DEBIT" ? "border-destructive bg-destructive/5" : "border-border"
                }`}
              >
                <RadioGroupItem value="DEBIT" />
                <ArrowUpRight className="h-4 w-4 text-destructive" />
                <span className="text-sm font-medium">Saída</span>
              </label>
            </RadioGroup>
          </div>

          <div>
            <Label htmlFor="desc" className="text-sm font-medium">
              Descrição <span className="text-destructive">*</span>
            </Label>
            <Input
              id="desc"
              value={form.description}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Ex: Pagamento de serviço prestado"
              maxLength={60}
              className="mt-1"
            />
            {errors.description && <p className="text-xs text-destructive mt-1">{errors.description}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <DateInput
              value={form.transaction_date}
              onValueChange={(d) => update("transaction_date", d)}
              label="Data *"
              error={errors.transaction_date}
            />
            <CurrencyInput
              value={Math.round(form.amount * 100)}
              onValueChange={(cents) => update("amount", cents / 100)}
              label="Valor *"
              error={errors.amount}
            />
          </div>

          <div>
            <Label className="text-sm font-medium">Conta bancária</Label>
            <Select
              value={form.bank_account_id || "__none__"}
              onValueChange={(v) => update("bank_account_id", v === "__none__" ? "" : v)}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Selecione (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">— Nenhuma —</SelectItem>
                {bankAccounts.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nome}
                    {b.banco ? ` · ${b.banco}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="doc" className="text-sm font-medium">
                Documento
              </Label>
              <Input
                id="doc"
                value={form.document_number}
                onChange={(e) => update("document_number", e.target.value)}
                maxLength={60}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="cat" className="text-sm font-medium">
                Categoria livre
              </Label>
              <Input
                id="cat"
                value={form.category}
                onChange={(e) => update("category", e.target.value)}
                maxLength={60}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="notes" className="text-sm font-medium">
              Observações
            </Label>
            <Textarea
              id="notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              maxLength={500}
              rows={3}
              className="mt-1"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saveMut.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saveMut.isPending}>
            {saveMut.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
            {form.id ? "Salvar alterações" : "Criar lançamento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
