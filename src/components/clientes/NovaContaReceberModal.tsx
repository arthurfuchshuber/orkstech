import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Loader2, Check, FileText, CreditCard, Building2, Target, Landmark,
  FolderTree, BarChart3, Trash2, Plus, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FormModal } from "@/components/FormModal";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { CurrencyInput } from "@/components/inputs/CurrencyInput";
import { DateInput } from "@/components/inputs/DateInput";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";
import { CategoriaTreeField } from "@/components/inputs/CategoriaTreeField";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { FileAttachment } from "@/components/inputs/FileAttachment";
import { useManagedSelect } from "@/hooks/useManagedSelect";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { CategoriaFinanceiraModal } from "@/components/modals/CategoriaFinanceiraModal";
import { CentroCustoModal } from "@/components/modals/CentroCustoModal";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";
import { FormaPagamentoModal } from "@/components/modals/FormaPagamentoModal";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { refreshQueries } from "@/lib/query-refresh";
import { useBankAccountOptions } from "@/hooks/useBankAccountOptions";
import {
  createAccountReceivable, type AccountReceivableInsert,
} from "@/lib/accounts-receivable-helpers";
import { AsaasChargeDialog } from "@/components/asaas/AsaasChargeDialog";

type PaymentMode = "avista" | "parcelado" | "recorrente" | "sazonal";

interface ClienteSummary {
  id: string;
  tipo: "pj" | "pf";
  nome_completo?: string | null;
  razao_social?: string | null;
  nome_fantasia?: string | null;
  cnpj?: string | null;
  cpf?: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cliente: ClienteSummary;
  /** When true, opens with the Asaas toggle already enabled */
  preferAsaas?: boolean;
  onSaved?: () => void;
}

interface ReceivableForm {
  description: string;
  document_number: string;
  amount: number;
  due_date?: Date;
  tipo_financeiro: string;
  categoria_financeira_id: string;
  cost_center_id: string;
  bank_account_id: string;
  payment_method_id: string;
  payment_mode: PaymentMode;
  installments: number;
  recurrence_interval: string;
  sazonal_dates: (Date | undefined)[];
  notes: string;
  attachment_url: string | null;
}

const initialForm: ReceivableForm = {
  description: "",
  document_number: "",
  amount: 0,
  due_date: undefined,
  tipo_financeiro: "",
  categoria_financeira_id: "",
  cost_center_id: "",
  bank_account_id: "",
  payment_method_id: "",
  payment_mode: "avista",
  installments: 1,
  recurrence_interval: "monthly",
  sazonal_dates: [undefined],
  notes: "",
  attachment_url: null,
};

const tiposFinanceiros = [
  { value: "receita", label: "💰 Receita" },
  { value: "deducao", label: "➖ Dedução" },
  { value: "receita_financeira", label: "📈 Rec. Financeira" },
  { value: "ajuste", label: "🔄 Ajuste" },
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

function formatDocument(doc: string | null | undefined): string {
  if (!doc) return "";
  const digits = doc.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return doc;
}

export function NovaContaReceberModal({
  open, onOpenChange, cliente, preferAsaas = false, onSaved,
}: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();

  const [form, setForm] = useState<ReceivableForm>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [generateAsaas, setGenerateAsaas] = useState(false);
  const [asaasBillingType, setAsaasBillingType] = useState<"BOLETO" | "CREDIT_CARD">("BOLETO");
  const [asaasReceivableId, setAsaasReceivableId] = useState<string | null>(null);
  const [asaasGenerating, setAsaasGenerating] = useState(false);

  // Sub-entity modals
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [cfEditingId, setCfEditingId] = useState<string | null>(null);
  const [ccModalOpen, setCcModalOpen] = useState(false);
  const [ccEditingId, setCcEditingId] = useState<string | null>(null);
  const [cbModalOpen, setCbModalOpen] = useState(false);
  const [cbEditingId, setCbEditingId] = useState<string | null>(null);
  const [fpModalOpen, setFpModalOpen] = useState(false);
  const [fpEditingId, setFpEditingId] = useState<string | null>(null);

  const centrosCrud = useManagedSelect("centros_custo");
  const contasCrud = useManagedSelect("contas_bancarias");
  const formasCrud = useManagedSelect("formas_pagamento");
  const catFinCrud = useManagedSelect("categorias_financeiras");

  // Reset whenever modal re-opens
  useEffect(() => {
    if (open) {
      setForm(initialForm);
      setErrors({});
      setGenerateAsaas(preferAsaas);
      setAsaasBillingType("BOLETO");
    }
  }, [open, preferAsaas]);

  const { data: categoriasFinanceiras = [] } = useQuery({
    queryKey: ["categorias-financeiras", empresaId],
    queryFn: async () => {
      let q = supabase.from("categorias_financeiras").select("id, nome, tipo, categoria_pai_id").eq("ativo", true).order("ordem");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: allCategoriasFin = [] } = useQuery({
    queryKey: ["categorias-financeiras-all-hierarchy"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias_financeiras").select("id, categoria_pai_id").eq("ativo", true);
      return data ?? [];
    },
    enabled: open,
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["centros-custo", empresaId],
    queryFn: async () => {
      let q = supabase.from("centros_custo").select("id, nome").eq("ativo", true).order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: open,
  });

  // Espelha 100% o cadastro de Contas Bancárias (sem abreviar nomes Pluggy ou bancos)
  const { options: bankAccounts } = useBankAccountOptions();

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["formas-pagamento", empresaId],
    queryFn: async () => {
      let q = supabase.from("formas_pagamento").select("id, nome").eq("ativo", true).order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
    enabled: open,
  });

  const { data: asaasCred } = useQuery({
    queryKey: ["asaas-cred-receber", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data } = await supabase
        .from("integracoes_credenciais")
        .select("id, ativo")
        .eq("empresa_id", empresaId)
        .eq("provider", "asaas")
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: open && !!empresaId,
  });
  const asaasEnabled = !!asaasCred;

  const updateField = <K extends keyof ReceivableForm>(key: K, value: ReceivableForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) setErrors((prev) => { const n = { ...prev }; delete n[key as string]; return n; });
  };

  const payerName = useMemo(() => {
    return cliente.tipo === "pj"
      ? (cliente.nome_fantasia || cliente.razao_social || "")
      : (cliente.nome_completo || "");
  }, [cliente]);

  const payerDoc = useMemo(() => {
    return cliente.tipo === "pj" ? (cliente.cnpj || "") : (cliente.cpf || "");
  }, [cliente]);
  const payerDocLabel = cliente.tipo === "pj" ? "CNPJ" : "CPF";

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.description.trim()) errs.description = "Descrição obrigatória";
    if (form.amount <= 0) errs.amount = "Valor deve ser maior que zero";
    if (!form.due_date) errs.due_date = "Data de vencimento obrigatória";
    if (form.installments < 1) errs.installments = "Mínimo 1 parcela";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const triggerAsaasForRecords = async (recordIds: string[], billingType: "BOLETO" | "CREDIT_CARD") => {
    if (recordIds.length === 0) return;
    setAsaasGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "create_payments_bulk", receivable_ids: recordIds, billing_type: billingType, empresa_id: empresaId },
      });
      if (error || (data as any)?.error) throw new Error((data as any)?.error || error?.message);
      const ok = (data as any)?.ok ?? 0;
      const total = (data as any)?.total ?? recordIds.length;
      const failed = (data as any)?.results?.filter((r: any) => !r.success) ?? [];
      if (failed.length > 0) {
        toast.warning(`${ok}/${total} cobranças geradas no Asaas. Erros: ${failed.map((f: any) => f.error).join("; ").slice(0, 200)}`);
      } else {
        toast.success(`${ok} cobrança(s) gerada(s) no Asaas`);
      }
      await refreshQueries(queryClient, [["accounts-receivable", empresaId]]);
      if (recordIds[0]) setAsaasReceivableId(recordIds[0]);
    } catch (e) {
      toast.error(`Falha ao gerar no Asaas: ${(e as Error).message}`);
    } finally {
      setAsaasGenerating(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: createAccountReceivable,
    onSuccess: async (created) => {
      await refreshQueries(queryClient, [
        ["accounts-receivable"],
        ["accounts-receivable-counts"],
        ["cliente-fin-snapshot", cliente.id],
        ["cliente-financeiro", cliente.id],
      ]);
      toast.success("Conta(s) criada(s) com sucesso!");
      const newIds = (created ?? []).map((r: any) => r.id).filter(Boolean);
      const wasGenerating = generateAsaas;
      const billingChosen = asaasBillingType;

      // Reset & close
      setForm(initialForm);
      setErrors({});
      setGenerateAsaas(false);
      setAsaasBillingType("BOLETO");
      onOpenChange(false);
      onSaved?.();

      if (newIds.length > 0 && asaasEnabled && wasGenerating) {
        triggerAsaasForRecords(newIds, billingChosen);
      }
    },
    onError: (e: any) => toast.error(`Erro ao salvar conta: ${e?.message || "desconhecido"}`),
  });

  const handleSubmit = () => {
    if (!validate()) {
      toast.error("Corrija os campos destacados");
      return;
    }

    const totalAmount = form.amount / 100;
    const records: AccountReceivableInsert[] = [];
    const willGroup =
      form.payment_mode === "parcelado" ||
      form.payment_mode === "recorrente" ||
      (form.payment_mode === "sazonal" && form.sazonal_dates.filter(Boolean).length > 1);
    const grupoId = willGroup
      ? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `grp-${Date.now()}-${Math.random()}`)
      : null;

    const baseRecord = (overrides: Partial<AccountReceivableInsert>): AccountReceivableInsert => ({
      user_id: user!.id,
      empresa_id: empresaId || undefined,
      description: form.description,
      cliente_id: cliente.id,
      supplier_name: payerName || null,
      document_number: form.document_number || null,
      amount: totalAmount,
      due_date: form.due_date!.toISOString().split("T")[0],
      categoria_financeira_id: form.categoria_financeira_id || null,
      cost_center_id: form.cost_center_id || null,
      bank_account_id: form.bank_account_id || null,
      payment_method_id: form.payment_method_id || null,
      installment_number: 1,
      installment_total: 1,
      is_recurring: false,
      recurrence_interval: null,
      notes: form.notes || null,
      pessoa_tipo: cliente.tipo,
      attachment_url: form.attachment_url,
      grupo_id: grupoId,
      ...overrides,
    });

    if (form.payment_mode === "avista") {
      records.push(baseRecord({}));
    } else if (form.payment_mode === "parcelado") {
      const n = Math.max(1, form.installments);
      const installmentAmount = Math.round((totalAmount / n) * 100) / 100;
      for (let i = 0; i < n; i++) {
        const dueDate = new Date(form.due_date!);
        dueDate.setMonth(dueDate.getMonth() + i);
        records.push(baseRecord({
          description: `${form.description} (${i + 1}/${n})`,
          amount: i === n - 1 ? totalAmount - installmentAmount * (n - 1) : installmentAmount,
          due_date: dueDate.toISOString().split("T")[0],
          installment_number: i + 1,
          installment_total: n,
        }));
      }
    } else if (form.payment_mode === "recorrente") {
      records.push(baseRecord({
        is_recurring: true,
        recurrence_interval: (form.recurrence_interval || "monthly") as any,
      }));
    } else if (form.payment_mode === "sazonal") {
      const validDates = form.sazonal_dates.filter((d): d is Date => !!d);
      if (validDates.length === 0) {
        toast.error("Adicione ao menos uma data sazonal");
        return;
      }
      const n = validDates.length;
      validDates.forEach((d, i) => {
        records.push(baseRecord({
          description: n > 1 ? `${form.description} (${i + 1}/${n})` : form.description,
          due_date: d.toISOString().split("T")[0],
          installment_number: i + 1,
          installment_total: n,
        }));
      });
    }

    createMutation.mutate(records);
  };

  return (
    <>
      <FormModal
        open={open}
        onOpenChange={(o) => { if (!o) { onOpenChange(false); } }}
        title="Nova Conta a Receber"
        description={`Lançamento vinculado a ${payerName || "cliente"}`}
        size="md"
        preventOutsideClose
      >
        <div className="space-y-4">
          {/* Pagador (locked) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">Pagador</label>
            <div className="flex h-10 w-full items-center gap-2 rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm text-foreground cursor-not-allowed">
              <Building2 className="w-4 h-4 text-muted-foreground" />
              <span className="truncate">{payerName || "—"}</span>
            </div>
          </div>

          {/* Documento (locked) */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-foreground">{payerDocLabel} do Pagador</label>
            <div className="flex h-10 w-full items-center rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed">
              {formatDocument(payerDoc) || <span className="text-muted-foreground/50">—</span>}
            </div>
          </div>

          <TextInput
            label="Título da receita"
            placeholder="Ex: Mensalidade contrato 2024"
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            error={errors.description}
          />

          <TextInput
            label="Nº Documento"
            placeholder="NF, recibo, contrato..."
            value={form.document_number}
            onChange={(e) => updateField("document_number", e.target.value)}
            icon={<FileText className="w-4 h-4" />}
          />

          <CurrencyInput label="Valor" value={form.amount} onValueChange={(v) => updateField("amount", v)} error={errors.amount} />

          <DateInput label="Vencimento" value={form.due_date} onValueChange={(d) => updateField("due_date", d)} error={errors.due_date} />

          {/* Modo de Recebimento */}
          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Modo de Recebimento</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {([
              { value: "avista", label: "À Vista" },
              { value: "parcelado", label: "Parcelamento" },
              { value: "recorrente", label: "Recorrente" },
              { value: "sazonal", label: "Sazonal" },
            ] as { value: PaymentMode; label: string }[]).map((opt) => {
              const active = form.payment_mode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => updateField("payment_mode", opt.value)}
                  className={`h-10 rounded-lg border text-sm font-medium transition-all ${
                    active
                      ? "border-primary bg-primary/10 text-primary shadow-sm"
                      : "border-input bg-background text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>

          {form.payment_mode === "parcelado" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Número de parcelas</label>
              <Input
                type="number"
                min={1}
                max={120}
                value={form.installments}
                onChange={(e) => updateField("installments", parseInt(e.target.value) || 1)}
              />
              {form.installments > 1 && form.amount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {form.installments}x de {formatCurrency((form.amount / 100) / form.installments)} (mensal, a partir do vencimento)
                </p>
              )}
              {errors.installments && <p className="text-xs text-destructive">{errors.installments}</p>}
            </div>
          )}

          {form.payment_mode === "recorrente" && (
            <div className="space-y-2">
              <ManagedSelectInput
                label="Intervalo"
                value={form.recurrence_interval}
                onValueChange={(v) => updateField("recurrence_interval", v)}
                options={[
                  { value: "weekly", label: "Semanal" },
                  { value: "monthly", label: "Mensal" },
                  { value: "yearly", label: "Anual" },
                ]}
                placeholder="Selecione..."
              />
              <p className="text-xs text-muted-foreground">
                Será criado um lançamento recorrente no valor de {formatCurrency(form.amount / 100)} a cada {form.recurrence_interval === "weekly" ? "semana" : form.recurrence_interval === "yearly" ? "ano" : "mês"}.
              </p>
            </div>
          )}

          {form.payment_mode === "sazonal" && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Datas dos lançamentos</label>
              <p className="text-xs text-muted-foreground">
                Cada data gera um lançamento de {form.amount > 0 ? formatCurrency(form.amount / 100) : "R$ 0,00"}.
              </p>
              <div className="space-y-2">
                {form.sazonal_dates.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <div className="flex-1">
                      <DateInput
                        label=""
                        value={d}
                        onValueChange={(date) => {
                          const next = [...form.sazonal_dates];
                          next[idx] = date;
                          updateField("sazonal_dates", next);
                        }}
                        placeholder={`Data ${idx + 1}`}
                      />
                    </div>
                    {form.sazonal_dates.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          const next = form.sazonal_dates.filter((_, i) => i !== idx);
                          updateField("sazonal_dates", next);
                        }}
                        className="h-9 w-9 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateField("sazonal_dates", [...form.sazonal_dates, undefined])}
                className="rounded-lg gap-2"
              >
                <Plus className="h-4 w-4" /> Adicionar data
              </Button>
            </div>
          )}

          {/* Classificação */}
          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Classificação</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          <CategoriaTreeField
            label="Subcategoria (Plano de Contas)"
            value={form.categoria_financeira_id || null}
            onChange={(v) => updateField("categoria_financeira_id", v || "")}
            categorias={categoriasFinanceiras as any}
            direction="in"
            placeholder="Selecione a subcategoria..."
          />

          <ManagedSelectInput
            label="Centro de Custo"
            value={form.cost_center_id}
            onValueChange={(v) => updateField("cost_center_id", v)}
            options={costCenters.map((c: any) => ({ value: c.id, label: c.nome }))}
            placeholder="Selecione o centro de custo..."
            icon={<Target className="w-4 h-4" />}
            onAddModal={() => { setCcEditingId(null); setCcModalOpen(true); }}
            onEditModal={(id) => { setCcEditingId(id); setCcModalOpen(true); }}
            onDelete={centrosCrud.onDelete}
            addLabel="Novo centro de custo"
          />

          <ManagedSelectInput
            label="Conta Bancária"
            value={form.bank_account_id}
            onValueChange={(v) => updateField("bank_account_id", v)}
            options={bankAccounts.map((b: any) => ({ value: b.id, label: b.secondaryLabel ? `${b.primaryLabel} — ${b.secondaryLabel}` : b.primaryLabel }))}
            placeholder="Selecione a conta..."
            icon={<Landmark className="w-4 h-4" />}
            onAddModal={() => { setCbEditingId(null); setCbModalOpen(true); }}
            onEditModal={(id) => { setCbEditingId(id); setCbModalOpen(true); }}
            onDelete={contasCrud.onDelete}
            addLabel="Nova conta bancária"
          />

          <ManagedSelectInput
            label="Forma de Recebimento"
            value={form.payment_method_id}
            onValueChange={(v) => updateField("payment_method_id", v)}
            options={paymentMethods.map((p: any) => ({ value: p.id, label: p.nome }))}
            placeholder="Selecione a forma..."
            icon={<CreditCard className="w-4 h-4" />}
            onAddModal={() => { setFpEditingId(null); setFpModalOpen(true); }}
            onEditModal={(id) => { setFpEditingId(id); setFpModalOpen(true); }}
            onDelete={formasCrud.onDelete}
            addLabel="Nova forma de recebimento"
          />

          {/* Extras */}
          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Extras</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          <TextareaInput
            label="Observações"
            placeholder="Informações adicionais..."
            value={form.notes}
            onChange={(e) => updateField("notes", e.target.value)}
          />

          <FileAttachment
            value={form.attachment_url}
            onValueChange={(url) => updateField("attachment_url", url)}
            folder="contas-receber"
          />

          {/* Asaas */}
          {asaasEnabled && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Gerar cobrança no Asaas</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      O cliente será criado/atualizado automaticamente e a cobrança enviada.
                    </p>
                  </div>
                </div>
                <Switch checked={generateAsaas} onCheckedChange={setGenerateAsaas} />
              </div>
              {generateAsaas && (
                <div className="pt-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground/70 font-medium mb-2">Forma de cobrança</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { v: "BOLETO" as const, l: "Boleto + PIX" },
                      { v: "CREDIT_CARD" as const, l: "Cartão de Crédito" },
                    ].map((opt) => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setAsaasBillingType(opt.v)}
                        className={`px-3 py-2 rounded-md text-sm font-medium border transition-colors ${
                          asaasBillingType === opt.v
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-input hover:bg-accent text-foreground"
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-border/20">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-lg">Cancelar</Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || asaasGenerating}
              className="rounded-lg gap-2 shadow-sm"
            >
              {(createMutation.isPending || asaasGenerating) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Criar Conta
            </Button>
          </div>
        </div>
      </FormModal>

      {/* Sub-entity modals */}
      <CategoriaFinanceiraModal
        open={cfModalOpen}
        onOpenChange={setCfModalOpen}
        editingId={cfEditingId}
        defaultTipo="receita"
        onSaved={(id) => updateField("categoria_financeira_id", id)}
      />
      <CentroCustoModal
        open={ccModalOpen}
        onOpenChange={setCcModalOpen}
        editingId={ccEditingId}
        onSaved={(id) => updateField("cost_center_id", id)}
      />
      <ContaBancariaModal
        open={cbModalOpen}
        onOpenChange={setCbModalOpen}
        editingId={cbEditingId}
        onSaved={(id) => updateField("bank_account_id", id)}
      />
      <FormaPagamentoModal
        open={fpModalOpen}
        onOpenChange={setFpModalOpen}
        editingId={fpEditingId}
        onSaved={(id) => updateField("payment_method_id", id)}
      />

      {/* Asaas charge details after generation */}
      <AsaasChargeDialog
        receivableId={asaasReceivableId}
        empresaId={empresaId || null}
        onOpenChange={(o) => { if (!o) setAsaasReceivableId(null); }}
      />
    </>
  );
}
