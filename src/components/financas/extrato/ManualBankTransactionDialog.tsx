import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { CurrencyInput } from "@/components/inputs/CurrencyInput";
import { DateInput } from "@/components/inputs/DateInput";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";
import { useManagedSelect } from "@/hooks/useManagedSelect";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";
import { CategoriaFinanceiraModal } from "@/components/modals/CategoriaFinanceiraModal";
import { Loader2, ArrowDownLeft, ArrowUpRight, Landmark, FolderTree, AlertTriangle, Layers } from "lucide-react";
import { toast } from "sonner";
import { useBankAccountOptions } from "@/hooks/useBankAccountOptions";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";

export interface ManualBankTx {
  id?: string;
  transaction_date: Date | undefined;
  amount: number;
  type: "CREDIT" | "DEBIT";
  description: string;
  document_number: string;
  category: string;
  categoria_financeira_id: string;
  notes: string;
  bank_account_id: string;
  business_unit_id: string;
}

const empty: ManualBankTx = {
  transaction_date: new Date(),
  amount: 0,
  type: "DEBIT",
  description: "",
  document_number: "",
  category: "",
  categoria_financeira_id: "",
  notes: "",
  bank_account_id: "",
  business_unit_id: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editing?: any | null;
}

export function ManualBankTransactionDialog({ open, onOpenChange, editing }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<ManualBankTx>(empty);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);

  // Sub-modals for cadastro at source
  const [cbModalOpen, setCbModalOpen] = useState(false);
  const [cbEditingId, setCbEditingId] = useState<string | null>(null);
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [cfEditingId, setCfEditingId] = useState<string | null>(null);

  const empresaId = empresa?.id ?? null;
  const targetUserId = empresa?.user_id ?? user?.id;

  // Bank accounts: manuais + Pluggy (Open Finance) — mesma lógica de Contas a Pagar/Receber
  // Espelha 100% o cadastro de Contas Bancárias (sem abreviar nomes Pluggy ou bancos)
  const { options: bankAccounts } = useBankAccountOptions();
  const { businessUnits } = useBusinessUnits();

  // Categorias financeiras (Plano de Contas) — full hierarchy used to find leaves
  const { data: categoriasFinanceiras = [] } = useQuery({
    queryKey: ["categorias-financeiras", empresaId],
    queryFn: async () => {
      let q = supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo, categoria_pai_id")
        .eq("ativo", true)
        .order("ordem");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!targetUserId,
  });

  const { data: allCategoriasFin = [] } = useQuery({
    queryKey: ["categorias-financeiras-all-hierarchy", empresaId],
    queryFn: async () => {
      let q = supabase
        .from("categorias_financeiras")
        .select("id, categoria_pai_id")
        .eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: !!targetUserId,
  });

  const contasCrud = useManagedSelect("contas_bancarias");
  const catFinCrud = useManagedSelect("categorias_financeiras");

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
        categoria_financeira_id: editing.categoria_financeira_id ?? "",
        notes: editing.notes ?? "",
        bank_account_id: editing.bank_account_id ?? "",
        business_unit_id: editing.business_unit_id ?? "",
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
      // Resolve category label from selected categoria_financeira_id
      const catRow = categoriasFinanceiras.find((c: any) => c.id === form.categoria_financeira_id);
      const payload = {
        user_id: user.id,
        empresa_id: empresa?.id ?? null,
        bank_account_id: form.bank_account_id || null,
        transaction_date: form.transaction_date!.toISOString().slice(0, 10),
        amount: form.amount,
        type: form.type,
        description: form.description.trim(),
        document_number: form.document_number.trim() || null,
        category: catRow?.nome ?? null,
        categoria_financeira_id: form.categoria_financeira_id || null,
        business_unit_id: form.business_unit_id || null,
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

  const checkDuplicates = async (): Promise<any[]> => {
    if (!targetUserId) return [];
    const dateStr = form.transaction_date!.toISOString().slice(0, 10);
    const docDigits = form.document_number.trim().replace(/\D/g, "");
    const descNorm = form.description.trim().toLowerCase();

    let q = supabase
      .from("manual_bank_transactions" as any)
      .select("id, transaction_date, amount, type, description, document_number, bank_account_id")
      .eq("transaction_date", dateStr)
      .eq("type", form.type);
    if (empresaId) q = q.eq("empresa_id", empresaId);
    if (form.id) q = q.neq("id", form.id);

    const { data } = await q;
    const candidates = (data ?? []) as any[];

    const matches: any[] = [];
    for (const ex of candidates) {
      const exDoc = (ex.document_number || "").replace(/\D/g, "");
      // Prioridade 1: Nº Documento igual
      if (docDigits && exDoc && docDigits === exDoc) {
        matches.push({ ...ex, _dupReasons: ["Nº Documento igual"] });
        continue;
      }
      // Prioridade 2 (sem doc): mesma descrição + mesmo valor + mesma conta
      if (!docDigits) {
        const sameAmount = Math.abs(Number(ex.amount) - form.amount) < 0.01;
        const sameDesc = (ex.description || "").trim().toLowerCase() === descNorm;
        const sameAccount = (ex.bank_account_id || null) === (form.bank_account_id || null);
        if (sameAmount && sameDesc && sameAccount) {
          matches.push({ ...ex, _dupReasons: ["Mesma descrição", "Mesmo valor", "Mesma data"] });
        }
      }
    }
    return matches;
  };

  const submit = async () => {
    if (!validate()) return;
    const dups = await checkDuplicates();
    if (dups.length > 0) {
      setDuplicateMatches(dups);
      setShowDuplicateAlert(true);
      return;
    }
    saveMut.mutate();
  };

  const proceedWithSave = () => {
    setShowDuplicateAlert(false);
    setDuplicateMatches([]);
    saveMut.mutate();
  };

  // Leaf categorias only (filtered by direction: CREDIT → receita, DEBIT → despesa)
  const tipoFilter = form.type === "CREDIT" ? "receita" : "despesa";
  const categoriaOptions = categoriasFinanceiras
    .filter((c: any) => c.tipo === tipoFilter)
    .filter((c: any) => !allCategoriasFin.some((child: any) => child.categoria_pai_id === c.id))
    .map((c: any) => ({ value: c.id, label: c.nome }));

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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
                onValueChange={(v) => {
                  update("type", v as "CREDIT" | "DEBIT");
                  // Reset categoria when direction changes (different leaf set)
                  update("categoria_financeira_id", "");
                }}
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

            {/* Conta bancária — gerenciável (cria/edita/exclui na fonte) */}
            <ManagedSelectInput
              label="Conta bancária"
              value={form.bank_account_id}
              onValueChange={(v) => update("bank_account_id", v)}
              options={bankAccounts.map((b: any) => ({
                value: b.id,
                label: b.secondaryLabel ? `${b.primaryLabel} — ${b.secondaryLabel}` : b.primaryLabel,
              }))}
              placeholder="Selecione a conta..."
              icon={<Landmark className="w-4 h-4" />}
              onAddModal={() => { setCbEditingId(null); setCbModalOpen(true); }}
              onEditModal={(id) => { setCbEditingId(id); setCbModalOpen(true); }}
              onDelete={contasCrud.onDelete}
              addLabel="Nova conta bancária"
            />

            {/* Categoria — Plano de Contas, somente folhas */}
            <ManagedSelectInput
              label="Categoria (Plano de Contas)"
              value={form.categoria_financeira_id}
              onValueChange={(v) => update("categoria_financeira_id", v)}
              options={categoriaOptions}
              placeholder={`Selecione a categoria de ${form.type === "CREDIT" ? "receita" : "despesa"}...`}
              icon={<FolderTree className="w-4 h-4" />}
              onAddModal={() => { setCfEditingId(null); setCfModalOpen(true); }}
              onEditModal={(id) => { setCfEditingId(id); setCfModalOpen(true); }}
              onDelete={catFinCrud.onDelete}
              addLabel="Nova categoria"
            />

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

      <ContaBancariaModal
        open={cbModalOpen}
        onOpenChange={setCbModalOpen}
        editingId={cbEditingId}
        onSaved={(id) => update("bank_account_id", id)}
      />
      <CategoriaFinanceiraModal
        open={cfModalOpen}
        onOpenChange={setCfModalOpen}
        editingId={cfEditingId}
        defaultTipo={form.type === "CREDIT" ? "receita" : "despesa"}
        onSaved={(id) => update("categoria_financeira_id", id)}
      />

      <AlertDialog open={showDuplicateAlert} onOpenChange={setShowDuplicateAlert}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Possível duplicidade detectada
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Foram encontrados lançamentos manuais semelhantes:</p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {duplicateMatches.map((dup: any, idx: number) => (
                    <div key={idx} className="rounded-md border border-border bg-muted/30 p-3 text-sm">
                      <p className="font-medium text-foreground">{dup.description}</p>
                      <p className="text-muted-foreground">
                        Valor: R$ {Number(dup.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        {dup.document_number && ` • Doc: ${dup.document_number}`}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {dup._dupReasons?.map((r: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs border-amber-300 text-amber-600">{r}</Badge>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm">Deseja continuar mesmo assim?</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={proceedWithSave} className="bg-amber-600 hover:bg-amber-700">
              Continuar mesmo assim
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
