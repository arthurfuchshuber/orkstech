import { useState, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresa } from "@/hooks/useEmpresa";
import {
  Receipt, Plus, Check, Loader2, AlertTriangle, Clock, Ban,
  FileText, Search, CreditCard,
  Building2, Target, Landmark, FolderTree, Copy, Pencil, Trash2,
  Banknote, ChevronDown, ChevronRight, MoreHorizontal, BarChart3, Layers, Eye,
  Users, UserRound, Zap, Calendar, CalendarDays,
} from "lucide-react";
import { DueStatCard } from "@/components/financas/DueStatCard";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormModal } from "@/components/FormModal";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { CurrencyInput } from "@/components/inputs/CurrencyInput";
import { DateInput } from "@/components/inputs/DateInput";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileAttachment } from "@/components/inputs/FileAttachment";

import { useManagedSelect } from "@/hooks/useManagedSelect";
import { CategoriaFinanceiraModal } from "@/components/modals/CategoriaFinanceiraModal";
import { CentroCustoModal } from "@/components/modals/CentroCustoModal";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";
import { FormaPagamentoModal } from "@/components/modals/FormaPagamentoModal";
import { ClienteModal, type ClientePrefill } from "@/components/modals/ClienteModal";
import { FornecedorModal, type FornecedorPrefill } from "@/components/modals/FornecedorModal";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenericImporter } from "@/components/financas/importacoes/GenericImporter";
import { ImportsHistoryTargeted } from "@/components/financas/importacoes/ImportsHistoryTargeted";
import { useAuth } from "@/hooks/useAuth";
import { refreshQueries } from "@/lib/query-refresh";
import {
  fetchAccountsReceivable, createAccountReceivable, updateAccountReceivable,
  countAccountsReceivable, registerReceipt, deleteAccountReceivable, type AccountReceivableInsert,
} from "@/lib/accounts-receivable-helpers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isPast, addDays, isBefore } from "date-fns";
import { QuickListModal } from "@/components/financas/QuickListModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { AsaasChargeDialog } from "@/components/asaas/AsaasChargeDialog";

type PaymentMode = "avista" | "parcelado" | "recorrente" | "sazonal";
type PayerKind = "cliente" | "fornecedor";

interface ReceivableForm {
  description: string;
  payer_kind: PayerKind;
  cliente_id: string;
  supplier_id: string;
  supplier_name: string;
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
  pessoa_tipo: "pj" | "pf";
  attachment_url: string | null;
}

const initialForm: ReceivableForm = {
  description: "",
  payer_kind: "cliente",
  cliente_id: "",
  supplier_id: "",
  supplier_name: "",
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
  pessoa_tipo: "pj",
  attachment_url: null,
};

const tiposFinanceiros = [
  { value: "receita", label: "💰 Receita", tooltip: "Entradas operacionais do negócio, como vendas de produtos ou prestação de serviços." },
  { value: "deducao", label: "➖ Dedução", tooltip: "Valores descontados da receita bruta, como impostos sobre vendas (ISS, ICMS) e devoluções." },
  { value: "receita_financeira", label: "📈 Rec. Financeira", tooltip: "Ganhos financeiros como rendimentos de aplicações, juros recebidos e descontos obtidos." },
  { value: "ajuste", label: "🔄 Ajuste", tooltip: "Lançamentos de correção ou reclassificação contábil." },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: Clock },
  paid: { label: "Recebido", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: Check },
  overdue: { label: "Vencido", color: "bg-red-500/10 text-red-600 border-red-200", icon: AlertTriangle },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border", icon: Ban },
};

export default function ContasAReceber() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReceivableForm>(initialForm);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [showReceiptDialog, setShowReceiptDialog] = useState(false);
  const [receivingId, setReceivingId] = useState<string | null>(null);
  const [receiptBankAccount, setReceiptBankAccount] = useState("");
  const [receiptDate, setReceiptDate] = useState<Date | undefined>(new Date());
  const [receiptJurosMulta, setReceiptJurosMulta] = useState<number>(0);
  const [receiptIsOverdue, setReceiptIsOverdue] = useState(false);
  const [receiptValueChanged, setReceiptValueChanged] = useState<string>("");
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [dupDetailItem, setDupDetailItem] = useState<any | null>(null);
  const [inlineTipoMap, setInlineTipoMap] = useState<Record<string, string>>({});
  const [quickListMode, setQuickListMode] = useState<"overdue" | "nearDue" | "thisMonth" | "nextMonth" | null>(null);

  const centrosCrud = useManagedSelect("centros_custo");
  const contasCrud = useManagedSelect("contas_bancarias");
  const formasCrud = useManagedSelect("formas_pagamento");
  const catFinCrud = useManagedSelect("categorias_financeiras");

  const [ccModalOpen, setCcModalOpen] = useState(false);
  const [ccEditingId, setCcEditingId] = useState<string | null>(null);
  const [cbModalOpen, setCbModalOpen] = useState(false);
  const [cbEditingId, setCbEditingId] = useState<string | null>(null);
  const [fpModalOpen, setFpModalOpen] = useState(false);
  const [fpEditingId, setFpEditingId] = useState<string | null>(null);
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [cfEditingId, setCfEditingId] = useState<string | null>(null);
  const [cliModalOpen, setCliModalOpen] = useState(false);
  const [cliEditingId, setCliEditingId] = useState<string | null>(null);
  const [cliPrefill, setCliPrefill] = useState<ClientePrefill | null>(null);
  const [fornModalOpen, setFornModalOpen] = useState(false);
  const [fornEditingId, setFornEditingId] = useState<string | null>(null);
  const [fornPrefill, setFornPrefill] = useState<FornecedorPrefill | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [asaasReceivableId, setAsaasReceivableId] = useState<string | null>(null);
  const [generateAsaas, setGenerateAsaas] = useState(false);
  const [asaasBillingType, setAsaasBillingType] = useState<"BOLETO" | "CREDIT_CARD">("BOLETO");
  const [asaasPromptIds, setAsaasPromptIds] = useState<string[] | null>(null);
  const [asaasGenerating, setAsaasGenerating] = useState(false);
  // Scope dialog for installment editing
  const [scopeDialogItem, setScopeDialogItem] = useState<any | null>(null);
  const [editScope, setEditScope] = useState<"single" | "group">("single");

  const { data: receivables = [], isLoading } = useQuery({
    queryKey: ["accounts-receivable", empresaId],
    queryFn: async () => fetchAccountsReceivable(empresaId),
    enabled: !!user,
  });

  const { data: counts = { openTotal: 0, upcoming: 0, overdue: 0, paid: 0 } } = useQuery({
    queryKey: ["accounts-receivable-counts", empresaId],
    queryFn: async () => countAccountsReceivable(empresaId),
    enabled: !!user,
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes", empresaId],
    queryFn: async () => {
      let q = supabase.from("clientes").select("id, tipo, nome_completo, razao_social, nome_fantasia, cnpj, cpf").eq("ativo", true).order("razao_social");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: fornecedores = [] } = useQuery({
    queryKey: ["fornecedores", empresaId],
    queryFn: async () => {
      let q = supabase.from("fornecedores").select("id, tipo, nome_completo, razao_social, nome_fantasia, cnpj, cpf").eq("ativo", true).order("razao_social");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const clienteOptions = clientes.map((c: any) => ({
    value: c.id,
    label: c.tipo === "pj" ? (c.nome_fantasia || c.razao_social || "—") : (c.nome_completo || "—"),
  }));

  const fornecedorOptions = fornecedores.map((f: any) => ({
    value: f.id,
    label: f.tipo === "pj" ? (f.nome_fantasia || f.razao_social || "—") : (f.nome_completo || "—"),
  }));

  const { data: categoriasFinanceiras = [] } = useQuery({
    queryKey: ["categorias-financeiras", empresaId],
    queryFn: async () => {
      let q = supabase.from("categorias_financeiras").select("id, nome, tipo, categoria_pai_id").eq("ativo", true).order("ordem");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: allCategoriasFin = [] } = useQuery({
    queryKey: ["categorias-financeiras-all-hierarchy"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias_financeiras").select("id, categoria_pai_id").eq("ativo", true);
      return data ?? [];
    },
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["centros-custo", empresaId],
    queryFn: async () => {
      let q = supabase.from("centros_custo").select("id, nome").eq("ativo", true).order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["contas-bancarias", empresaId],
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("id, nome, banco").eq("ativo", true).order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data: manual } = await q;

      const { data: pluggy } = await supabase
        .from("pluggy_bank_accounts")
        .select("id, name, pluggy_item_id, type, subtype, bank_data")
        .eq("type", "BANK")
        .eq("subtype", "CHECKING_ACCOUNT")
        .order("name");

      const itemIds = [...new Set((pluggy ?? []).map((p: any) => p.pluggy_item_id))];
      let connectorMap: Record<string, string> = {};
      if (itemIds.length) {
        const { data: conns } = await supabase
          .from("pluggy_connections")
          .select("pluggy_item_id, connector_name")
          .in("pluggy_item_id", itemIds);
        for (const c of conns ?? []) {
          connectorMap[c.pluggy_item_id] = c.connector_name || "";
        }
      }

      const pluggyMapped = (pluggy ?? []).map((p: any) => ({
        id: p.id,
        nome: connectorMap[p.pluggy_item_id] || p.name,
        banco: "Open Finance",
      }));

      return [...(manual ?? []), ...pluggyMapped];
    },
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["formas-pagamento", empresaId],
    queryFn: async () => {
      let q = supabase.from("formas_pagamento").select("id, nome").eq("ativo", true).order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
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
    enabled: !!empresaId,
  });
  const asaasEnabled = !!asaasCred;

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
      // Open dialog for first one to show details
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
      await refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]]);
      toast.success(editingId ? "Conta atualizada!" : "Conta(s) criada(s) com sucesso!");
      const newIds = (created ?? []).map((r: any) => r.id).filter(Boolean);
      const wasGenerating = generateAsaas;
      const billingChosen = asaasBillingType;
      resetForm();
      // Post-save Asaas flow
      if (newIds.length > 0 && asaasEnabled) {
        if (wasGenerating) {
          // toggle was on → generate immediately
          triggerAsaasForRecords(newIds, billingChosen);
        } else {
          // toggle was off → ask user
          setAsaasPromptIds(newIds);
        }
      }
    },
    onError: () => toast.error("Erro ao salvar conta"),
  });

  const pushReceivableToAsaas = async (receivableId: string, scope: "single" | "group" = "single") => {
    if (!asaasEnabled) return;
    try {
      const { data: linked } = await supabase
        .from("asaas_cobrancas")
        .select("id")
        .eq("account_receivable_id", receivableId)
        .limit(1)
        .maybeSingle();
      if (!linked) return;
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "update_payment", receivable_id: receivableId, scope, empresa_id: empresaId },
      });
      if (error || (data as any)?.error) {
        toast.warning(`Conta salva, mas falha ao sincronizar com Asaas: ${(data as any)?.error || error?.message}`);
      } else {
        const ok = (data as any)?.ok ?? 0;
        if (ok > 0) toast.success(`${ok} cobrança(s) sincronizada(s) com Asaas`);
      }
    } catch (e) {
      console.warn("[asaas push receivable]", e);
    }
  };

  const updateMutation = useMutation({
    mutationFn: async ({ id, data, scope }: { id: string; data: any; scope?: "single" | "group" }) => {
      if (scope === "group") {
        // Apply only mass-editable fields to all siblings sharing grupo_id
        const { data: rec } = await supabase.from("accounts_receivable").select("grupo_id").eq("id", id).maybeSingle();
        if (rec?.grupo_id) {
          // Strip per-installment fields from group update
          const { due_date, installment_number, installment_total, ...groupSafe } = data;
          const { data: siblings } = await supabase
            .from("accounts_receivable")
            .select("id")
            .eq("grupo_id", rec.grupo_id);
          const ids = (siblings ?? []).map((s: any) => s.id);
          for (const sid of ids) {
            await updateAccountReceivable(sid, sid === id ? data : groupSafe);
          }
          return { ids };
        }
      }
      await updateAccountReceivable(id, data);
      return { ids: [id] };
    },
    onSuccess: async (res, vars) => {
      await refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]]);
      toast.success("Conta atualizada!");
      resetForm();
      // Push to Asaas in background
      const scope = vars.scope || "single";
      void pushReceivableToAsaas(vars.id, scope);
    },
    onError: () => toast.error("Erro ao atualizar conta"),
  });

  const receiptMutation = useMutation({
    mutationFn: ({ id, bankAccountId, paymentDate, jurosMulta }: { id: string; bankAccountId: string; paymentDate: string; jurosMulta?: number }) =>
      registerReceipt(id, bankAccountId, paymentDate, user!.id, empresaId, jurosMulta),
    onSuccess: async () => {
      await refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]]);
      toast.success("Recebimento registrado!");
      setShowReceiptDialog(false);
      setReceivingId(null);
      setReceiptJurosMulta(0);
      setReceiptIsOverdue(false);
      setReceiptValueChanged("");
    },
    onError: () => toast.error("Erro ao registrar recebimento"),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
    setErrors({});
    setGenerateAsaas(false);
    setAsaasBillingType("BOLETO");
  };

  const updateField = <K extends keyof ReceivableForm>(key: K, value: ReceivableForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key as string]) setErrors((prev) => { const n = { ...prev }; delete n[key as string]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.description.trim()) errs.description = "Descrição obrigatória";
    if (form.amount <= 0) errs.amount = "Valor deve ser maior que zero";
    if (!form.due_date) errs.due_date = "Data de vencimento obrigatória";
    if (form.installments < 1) errs.installments = "Mínimo 1 parcela";
    if (form.payer_kind === "cliente" && !form.cliente_id) errs.cliente_id = "Selecione um cliente";
    if (form.payer_kind === "fornecedor" && !form.supplier_id) errs.supplier_id = "Selecione um fornecedor";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const checkDuplicatesFromForm = (formData: ReceivableForm, excludeId?: string | null): any[] => {
    const matches: any[] = [];
    for (const existing of receivables) {
      if (excludeId && existing.id === excludeId) continue;
      if (existing.status === "cancelled") continue;

      const formDoc = formData.document_number.trim().replace(/\D/g, "");
      const existDoc = (existing.document_number || "").replace(/\D/g, "");
      if (formDoc && existDoc && formDoc === existDoc) {
        matches.push({ ...existing, _dupReasons: ["Nº Documento igual"] });
        continue;
      }

      if (!formDoc) {
        const formAmount = formData.amount / 100;
        const sameAmount = formAmount > 0 && Math.abs(formAmount - existing.amount) < 0.01;

        let samePayer = false;
        if (formData.payer_kind === "cliente" && formData.cliente_id && (existing as any).cliente_id === formData.cliente_id) {
          samePayer = true;
        } else if (formData.payer_kind === "fornecedor" && formData.supplier_id && existing.supplier_id === formData.supplier_id) {
          samePayer = true;
        }
        if (sameAmount && samePayer) {
          matches.push({ ...existing, _dupReasons: ["Mesmo pagador", "Mesmo valor"] });
        }
      }
    }
    return matches;
  };

  const proceedWithSave = () => {
    setShowDuplicateAlert(false);
    setDuplicateMatches([]);
    doSave();
  };

  const handleSubmit = async () => {
    if (!validate()) {
      toast.error("Corrija os campos destacados");
      return;
    }
    const dups = checkDuplicatesFromForm(form, editingId);
    if (dups.length > 0) {
      setDuplicateMatches(dups);
      setShowDuplicateAlert(true);
      return;
    }
    doSave();
  };

  const doSave = () => {
    const isCliente = form.payer_kind === "cliente";
    const payerName = isCliente
      ? (() => {
          const c = clientes.find((x: any) => x.id === form.cliente_id);
          if (!c) return "";
          return c.tipo === "pj" ? (c.nome_fantasia || c.razao_social || "") : (c.nome_completo || "");
        })()
      : form.supplier_name;

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        scope: editScope,
        data: {
          description: form.description,
          cliente_id: isCliente ? form.cliente_id || null : null,
          supplier_name: payerName || null,
          document_number: form.document_number || null,
          amount: form.amount / 100,
          due_date: form.due_date!.toISOString().split("T")[0],
          categoria_financeira_id: form.categoria_financeira_id || null,
          cost_center_id: form.cost_center_id || null,
          bank_account_id: form.bank_account_id || null,
          payment_method_id: form.payment_method_id || null,
          notes: form.notes || null,
          pessoa_tipo: form.pessoa_tipo,
          attachment_url: form.attachment_url,
        },
      });
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
      cliente_id: isCliente ? form.cliente_id || null : null,
      supplier_id: !isCliente ? form.supplier_id || null : null,
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
      pessoa_tipo: form.pessoa_tipo,
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
      const interval = form.recurrence_interval || "monthly";
      records.push(baseRecord({
        is_recurring: true,
        recurrence_interval: interval as any,
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

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    const catFin = categoriasFinanceiras.find((c: any) => c.id === item.categoria_financeira_id);
    setForm({
      description: item.description,
      payer_kind: item.cliente_id ? "cliente" : "fornecedor",
      cliente_id: item.cliente_id || "",
      supplier_id: item.supplier_id || "",
      supplier_name: item.supplier_name || "",
      document_number: item.document_number || "",
      amount: Math.round(item.amount * 100),
      due_date: new Date(item.due_date),
      tipo_financeiro: catFin?.tipo || "",
      categoria_financeira_id: item.categoria_financeira_id || "",
      cost_center_id: item.cost_center_id || "",
      bank_account_id: item.bank_account_id || "",
      payment_method_id: item.payment_method_id || "",
      payment_mode: item.is_recurring
        ? "recorrente"
        : (item.installment_total || 1) > 1
        ? "parcelado"
        : "avista",
      installments: item.installment_total || 1,
      recurrence_interval: item.recurrence_interval || "monthly",
      sazonal_dates: [undefined],
      notes: item.notes || "",
      pessoa_tipo: item.pessoa_tipo || "pj",
      attachment_url: item.attachment_url || null,
    });
    setShowForm(true);
  };

  // Decide whether to ask scope (parcelado) before opening edit
  const requestEditAccount = (item: any) => {
    const isParcelado = (item.installment_total || 1) > 1 && !!item.grupo_id;
    if (isParcelado) {
      setScopeDialogItem(item);
      return;
    }
    setEditScope("single");
    handleEdit(item);
  };

  const handleEditClienteFromRow = (clienteId: string) => {
    if (!clienteId) return;
    setCliEditingId(clienteId);
    setCliPrefill(null);
    setCliModalOpen(true);
  };

  const confirmScopeAndEdit = (scope: "single" | "group") => {
    setEditScope(scope);
    if (scopeDialogItem) {
      const item = scopeDialogItem;
      setScopeDialogItem(null);
      handleEdit(item);
    }
  };

  const handleDuplicate = (item: any) => {
    setEditingId(null);
    const catFin = categoriasFinanceiras.find((c: any) => c.id === item.categoria_financeira_id);
    setForm({
      description: item.description,
      payer_kind: item.cliente_id ? "cliente" : "fornecedor",
      cliente_id: item.cliente_id || "",
      supplier_id: item.supplier_id || "",
      supplier_name: item.supplier_name || "",
      document_number: "",
      amount: Math.round(item.amount * 100),
      due_date: undefined,
      tipo_financeiro: catFin?.tipo || "",
      categoria_financeira_id: item.categoria_financeira_id || "",
      cost_center_id: item.cost_center_id || "",
      bank_account_id: item.bank_account_id || "",
      payment_method_id: item.payment_method_id || "",
      payment_mode: "avista",
      installments: 1,
      recurrence_interval: "monthly",
      sazonal_dates: [undefined],
      notes: item.notes || "",
      pessoa_tipo: item.pessoa_tipo || "pj",
      attachment_url: null,
    });
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteAccountReceivable(id);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao excluir");
      return;
    }
    queryClient.setQueryData<any[]>(["accounts-receivable", empresaId], (current = []) =>
      current.filter((item) => item.id !== id),
    );
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    await refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]]);
    toast.success("Conta excluída");
    setDeleteId(null);
  };

  const handleChangeStatus = async (id: string, newStatus: string) => {
    if (newStatus === "paid") {
      openReceiptDialog(id);
      return;
    }
    await updateAccountReceivable(id, { status: newStatus, ...(newStatus !== "paid" ? { payment_date: null } : {}) });
    await refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]]);
    toast.success(`Status alterado para ${statusConfig[newStatus]?.label || newStatus}`);
  };

  const handleBulkChangeStatus = async (newStatus: string) => {
    if (newStatus === "paid") {
      toast.error("Para registrar recebimento, use a ação individual.");
      return;
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await updateAccountReceivable(id, { status: newStatus, ...(newStatus !== "paid" ? { payment_date: null } : {}) });
    }
    setSelectedIds(new Set());
    await refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]]);
    toast.success(`${ids.length} conta(s) atualizada(s)`);
  };

  const handleBulkUpdate = async (data: Record<string, any>) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await updateAccountReceivable(id, data);
    }
    setSelectedIds(new Set());
    await refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]]);
    toast.success(`${ids.length} conta(s) atualizada(s)!`);
  };

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    let ok = 0, fail = 0;
    for (const id of ids) {
      try { await deleteAccountReceivable(id); ok++; } catch { fail++; }
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    await refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]]);
    if (fail === 0) toast.success(`${ok} conta(s) excluída(s)`);
    else toast.warning(`${ok} excluída(s), ${fail} falharam`);
  };

  const handleBulkCancel = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await updateAccountReceivable(id, { status: "cancelled", payment_date: null });
    }
    setSelectedIds(new Set());
    setBulkCancelOpen(false);
    await refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]]);
    toast.success(`${ids.length} conta(s) cancelada(s)`);
  };


  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((p: any) => p.id)));
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openReceiptDialog = (id: string) => {
    const item = receivables.find((p: any) => p.id === id);
    const isOverdue = item && (item.status === "overdue" || (item.status === "pending" && isPast(new Date(item.due_date))));
    setReceivingId(id);
    setReceiptBankAccount("");
    setReceiptDate(new Date());
    setReceiptJurosMulta(0);
    setReceiptIsOverdue(!!isOverdue);
    setReceiptValueChanged(isOverdue ? "" : "nao");
    setShowReceiptDialog(true);
  };

  const handleReceiptSubmit = () => {
    if (!receivingId || !receiptDate) return;
    if (receiptIsOverdue && !receiptValueChanged) {
      toast.error("Informe se houve alteração de valor por atraso");
      return;
    }
    receiptMutation.mutate({
      id: receivingId,
      bankAccountId: receiptBankAccount || "",
      paymentDate: receiptDate.toISOString().split("T")[0],
      jurosMulta: receiptValueChanged === "sim" ? receiptJurosMulta / 100 : 0,
    });
  };

  const filtered = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    let list = receivables;
    if (filterStatus === "open") {
      list = list.filter((p: any) => p.status === "pending" || p.status === "overdue");
    } else if (filterStatus === "upcoming") {
      list = list.filter((p: any) => p.status === "pending" && p.due_date >= todayStr);
    } else if (filterStatus !== "all") {
      list = list.filter((p: any) => p.status === filterStatus);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase().trim();
      const termDigits = term.replace(/\D/g, "");
      list = list.filter((p: any) => {
        const haystack = [p.description, p.supplier_name, p.document_number, p.notes]
          .filter(Boolean).join(" ").toLowerCase();
        if (haystack.includes(term)) return true;
        if (termDigits.length >= 3) {
          const haystackDigits = haystack.replace(/\D/g, "");
          if (haystackDigits.includes(termDigits)) return true;
        }
        return false;
      });
    }
    return list;
  }, [receivables, filterStatus, searchTerm]);

  type GroupedRow = { type: "single"; item: any } | { type: "group"; groupId: string; parent: any; children: any[] };
  const groupedRows = useMemo<GroupedRow[]>(() => {
    const groupsMap = new Map<string, any[]>();
    const singles: any[] = [];
    for (const p of filtered) {
      if (p.grupo_id) {
        if (!groupsMap.has(p.grupo_id)) groupsMap.set(p.grupo_id, []);
        groupsMap.get(p.grupo_id)!.push(p);
      } else {
        singles.push(p);
      }
    }
    const rows: GroupedRow[] = [];
    for (const [groupId, items] of groupsMap.entries()) {
      const sorted = [...items].sort((a, b) =>
        (a.installment_number || 0) - (b.installment_number || 0) ||
        a.due_date.localeCompare(b.due_date),
      );
      rows.push({ type: "group", groupId, parent: sorted[0], children: sorted });
    }
    for (const item of singles) {
      rows.push({ type: "single", item });
    }
    rows.sort((a, b) => {
      const da = a.type === "single" ? a.item.due_date : a.parent.due_date;
      const db = b.type === "single" ? b.item.due_date : b.parent.due_date;
      return da.localeCompare(db);
    });
    return rows;
  }, [filtered]);

  const today = useMemo(() => new Date(new Date().toDateString()), []);
  const overdueItems = useMemo(() => {
    return receivables.filter((p: any) => {
      if (p.status === "paid" || p.status === "cancelled") return false;
      const due = new Date(p.due_date + "T00:00:00");
      return due < today;
    });
  }, [receivables, today]);
  const nearDueItems = useMemo(() => {
    const limit = addDays(today, 7);
    return receivables.filter((p: any) => {
      if (p.status !== "pending") return false;
      const due = new Date(p.due_date + "T00:00:00");
      return due >= today && due <= limit;
    });
  }, [receivables, today]);
  const thisMonthItems = useMemo(() => {
    const y = today.getFullYear(); const m = today.getMonth();
    return receivables.filter((p: any) => {
      if (p.status !== "pending") return false;
      const due = new Date(p.due_date + "T00:00:00");
      return due >= today && due.getFullYear() === y && due.getMonth() === m;
    });
  }, [receivables, today]);
  const nextMonthItems = useMemo(() => {
    const y = today.getFullYear(); const m = today.getMonth();
    const ny = m === 11 ? y + 1 : y; const nm = (m + 1) % 12;
    return receivables.filter((p: any) => {
      if (p.status !== "pending") return false;
      const due = new Date(p.due_date + "T00:00:00");
      return due.getFullYear() === ny && due.getMonth() === nm;
    });
  }, [receivables, today]);
  const sumAmount = (arr: any[]) => arr.reduce((s, i) => s + Number(i.amount || 0), 0);
  const overdueAmount = sumAmount(overdueItems);
  const nearDueAmount = sumAmount(nearDueItems);
  const thisMonthAmount = sumAmount(thisMonthItems);
  const nextMonthAmount = sumAmount(nextMonthItems);
  const nearDue = nearDueItems.length;
  const overdueCount = overdueItems.length;

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [summaryGroupId, setSummaryGroupId] = useState<string | null>(null);
  const toggleGroup = (id: string) =>
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const summaryGroup = useMemo(() => {
    if (!summaryGroupId) return null;
    return groupedRows.find((r) => r.type === "group" && r.groupId === summaryGroupId) || null;
  }, [summaryGroupId, groupedRows]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  // Helper to get payer doc display
  const getPayerDocLabel = () => {
    const isCliente = form.payer_kind === "cliente";
    const entity = isCliente
      ? clientes.find((c: any) => c.id === form.cliente_id)
      : fornecedores.find((f: any) => f.id === form.supplier_id);
    const isPj = entity ? entity.tipo === "pj" : form.pessoa_tipo === "pj";
    const docLabel = isPj ? "CNPJ" : "CPF";
    const doc = entity ? (isPj ? entity.cnpj : entity.cpf) : null;
    const formatted = doc
      ? isPj
        ? doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
        : doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
      : "";
    return { docLabel, formatted, isCliente };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Contas a Receber</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie suas receitas e recebimentos</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(initialForm); setShowForm(true); }} className="rounded-lg gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Nova Conta
        </Button>
      </div>

      <Tabs defaultValue="lista" className="space-y-6">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="importacoes">Importações</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-6 mt-4">

      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <DueStatCard
          title="Contas Vencidas"
          amount={overdueAmount}
          count={overdueCount}
          icon={AlertTriangle}
          tone="red"
          onClick={overdueCount > 0 ? () => setQuickListMode("overdue") : undefined}
          disabled={overdueCount === 0}
        />
        <DueStatCard
          title="A Vencer ~ 7 dias"
          amount={nearDueAmount}
          count={nearDue}
          icon={Clock}
          tone="amber"
          onClick={nearDue > 0 ? () => setQuickListMode("nearDue") : undefined}
          disabled={nearDue === 0}
        />
        <DueStatCard
          title="A Vencer ~ Este Mês"
          amount={thisMonthAmount}
          count={thisMonthItems.length}
          icon={Calendar}
          tone="neutral"
          onClick={thisMonthItems.length > 0 ? () => setQuickListMode("thisMonth") : undefined}
          disabled={thisMonthItems.length === 0}
        />
        <DueStatCard
          title="A Vencer ~ Mês Seguinte"
          amount={nextMonthAmount}
          count={nextMonthItems.length}
          icon={CalendarDays}
          tone="neutral"
          onClick={nextMonthItems.length > 0 ? () => setQuickListMode("nextMonth") : undefined}
          disabled={nextMonthItems.length === 0}
        />
      </div>

      <Card className="border-border/50 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, pagador ou documento..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-2">
            {["all", "open", "upcoming", "overdue", "paid", "cancelled"].map((s) => {
              const labels: Record<string, string> = {
                all: "Todos",
                open: "Em Aberto",
                upcoming: "A Vencer",
                overdue: "Vencido",
                paid: "Recebido",
                cancelled: "Cancelado",
              };
              return (
                <Button
                  key={s}
                  size="sm"
                  variant={filterStatus === s ? "default" : "outline"}
                  onClick={() => setFilterStatus(s)}
                  className="rounded-lg text-xs"
                >
                  {labels[s]}
                </Button>
              );
            })}
          </div>
        </div>
      </Card>

      {selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5 shadow-sm p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} item(ns) selecionado(s)
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1">
                    <FolderTree className="w-3 h-3" /> Subcategoria <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[260px] overflow-y-auto custom-scrollbar">
                  {categoriasFinanceiras
                    .filter((c: any) => !allCategoriasFin.some((child: any) => child.categoria_pai_id === c.id))
                    .map((c: any) => (
                      <DropdownMenuItem key={c.id} onClick={() => handleBulkUpdate({ categoria_financeira_id: c.id })}>
                        {c.nome}
                      </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1">
                    <CreditCard className="w-3 h-3" /> Forma <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[260px] overflow-y-auto custom-scrollbar">
                  {paymentMethods.map((m: any) => (
                    <DropdownMenuItem key={m.id} onClick={() => handleBulkUpdate({ payment_method_id: m.id })}>
                      {m.nome}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1">
                    <Landmark className="w-3 h-3" /> Conta <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[260px] overflow-y-auto custom-scrollbar">
                  {bankAccounts.map((b: any) => (
                    <DropdownMenuItem key={b.id} onClick={() => handleBulkUpdate({ bank_account_id: b.id })}>
                      {b.nome}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1">
                    <Clock className="w-3 h-3" /> Status <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {Object.entries(statusConfig).filter(([key]) => key !== "cancelled").map(([key, cfg]) => (
                    <DropdownMenuItem key={key} onClick={() => handleBulkChangeStatus(key)}>
                      <cfg.icon className="w-4 h-4 mr-2" />
                      {cfg.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={() => setBulkCancelOpen(true)}>
                <Ban className="w-3 h-3" /> Cancelar
              </Button>

              <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1 text-destructive hover:text-destructive border-destructive/30" onClick={() => setBulkDeleteOpen(true)}>
                <Trash2 className="w-3 h-3" /> Excluir
              </Button>

              <Button size="sm" variant="ghost" className="rounded-lg text-xs" onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card className="border-border/50 shadow-sm overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-center">
            <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
              <Receipt className="w-5 h-5 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Nenhuma conta encontrada</p>
          </div>
        ) : (
          <Table className="w-full">
            <TableHeader>
              <TableRow>
                <TableHead style={{ width: 40, minWidth: 40 }}>
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead style={{ minWidth: 110 }}>Vencimento</TableHead>
                <TableHead style={{ minWidth: 180 }}>Pagador</TableHead>
                <TableHead style={{ minWidth: 220 }}>Descrição</TableHead>
                <TableHead style={{ minWidth: 110 }}>Valor</TableHead>
                <TableHead style={{ minWidth: 120 }}>Status</TableHead>
                <TableHead style={{ minWidth: 200 }}>Subcategoria</TableHead>
                <TableHead style={{ minWidth: 180 }}>Forma</TableHead>
                <TableHead style={{ minWidth: 180 }}>Conta Bancária</TableHead>
                <TableHead style={{ width: 50, minWidth: 50 }} className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(() => {
                const renderItemRow = (item: any, opts: { isChild?: boolean } = {}) => {
                  const dueDate = new Date(item.due_date);
                  const isOverdue = (item.status === "pending" || item.status === "overdue") && isPast(dueDate) && format(dueDate, "yyyy-MM-dd") !== format(new Date(), "yyyy-MM-dd");
                  const isNearDue = item.status === "pending" && !isOverdue && isBefore(dueDate, addDays(new Date(), 7));
                  const isPaid = item.status === "paid";
                  const dueColor = isOverdue
                    ? "text-red-600 font-medium"
                    : isNearDue
                      ? "text-amber-600 font-medium"
                      : isPaid
                        ? "text-emerald-600"
                        : "";
                  const rowBg = isOverdue ? "bg-red-500/5" : isNearDue ? "bg-amber-500/5" : "";
                  const catFin = categoriasFinanceiras.find((c: any) => c.id === item.categoria_financeira_id);
                  const rowTipo = inlineTipoMap[item.id] || catFin?.tipo || "";
                  const formaPgto = paymentMethods.find((m: any) => m.id === item.payment_method_id);
                  const contaBanc = bankAccounts.find((b: any) => b.id === item.bank_account_id);
                  const subcatOptions = rowTipo
                    ? categoriasFinanceiras
                        .filter((c: any) => c.tipo === rowTipo)
                        .filter((c: any) => !allCategoriasFin.some((child: any) => child.categoria_pai_id === c.id))
                    : categoriasFinanceiras
                        .filter((c: any) => !allCategoriasFin.some((child: any) => child.categoria_pai_id === c.id));
                  return (
                    <TableRow key={item.id} className={`${rowBg} ${opts.isChild ? "bg-muted/20" : ""}`}>
                      <TableCell>
                        <Checkbox checked={selectedIds.has(item.id)} onCheckedChange={() => toggleSelectItem(item.id)} />
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm ${dueColor}`}>
                          {format(dueDate, "dd/MM/yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium truncate text-sm">
                        {opts.isChild ? (
                          <span className="text-muted-foreground/60 ml-6">↳</span>
                        ) : item.cliente_id ? (
                          <button
                            type="button"
                            onClick={() => handleEditClienteFromRow(item.cliente_id)}
                            className="text-left hover:text-primary hover:underline transition-colors truncate max-w-full"
                            title="Editar cliente"
                          >
                            {item.supplier_name || "—"}
                          </button>
                        ) : (
                          item.supplier_name || "—"
                        )}
                      </TableCell>
                      <TableCell className="truncate">
                        <button
                          type="button"
                          onClick={() => requestEditAccount(item)}
                          className="text-left w-full hover:text-primary transition-colors group/edit"
                          title="Editar conta"
                        >
                          <div className={opts.isChild ? "pl-4" : ""}>
                            <span className="text-sm group-hover/edit:underline">{item.description}</span>
                            {item.installment_total > 1 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({item.installment_number}/{item.installment_total})
                              </span>
                            )}
                          </div>
                        </button>
                      </TableCell>
                      <TableCell className="font-medium text-sm">{formatCurrency(item.amount)}</TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="cursor-pointer">
                              {(() => {
                                const cfg = statusConfig[item.status] || statusConfig.pending;
                                const Icon = cfg.icon;
                                return (
                                  <Badge variant="outline" className={`${cfg.color} gap-1 font-medium cursor-pointer hover:opacity-80 transition-opacity`}>
                                    <Icon className="w-3 h-3" />
                                    {cfg.label}
                                    <ChevronDown className="w-3 h-3 ml-0.5 opacity-50" />
                                  </Badge>
                                );
                              })()}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start">
                            {Object.entries(statusConfig).filter(([key]) => key !== "cancelled").map(([key, cfg]) => {
                              if (key === item.status) return null;
                              return (
                                <DropdownMenuItem key={key} onClick={() => handleChangeStatus(item.id, key)}>
                                  <cfg.icon className="w-4 h-4 mr-2" />
                                  {cfg.label}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 text-sm cursor-pointer hover:text-foreground transition-colors group w-full">
                              <span className="truncate">{catFin?.nome || <span className="text-muted-foreground/50">Selecionar</span>}</span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="max-h-[260px] overflow-y-auto custom-scrollbar">
                            {subcatOptions.map((c: any) => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={() => {
                                  updateMutation.mutate({ id: item.id, data: { categoria_financeira_id: c.id } });
                                }}
                              >
                                {c.nome}
                              </DropdownMenuItem>
                            ))}
                            {catFin && (
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: item.id, data: { categoria_financeira_id: null } })} className="text-muted-foreground">
                                Limpar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => { setCfEditingId(null); setCfModalOpen(true); }} className="text-primary">
                              <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova subcategoria
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 text-sm cursor-pointer hover:text-foreground transition-colors group w-full">
                              <span className="truncate">{formaPgto?.nome || <span className="text-muted-foreground/50">Selecionar</span>}</span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="max-h-[260px] overflow-y-auto custom-scrollbar">
                            {paymentMethods.map((m: any) => (
                              <DropdownMenuItem key={m.id} onClick={() => updateMutation.mutate({ id: item.id, data: { payment_method_id: m.id } })}>
                                {m.nome}
                              </DropdownMenuItem>
                            ))}
                            {formaPgto && (
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: item.id, data: { payment_method_id: null } })} className="text-muted-foreground">
                                Limpar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="flex items-center gap-1 text-sm cursor-pointer hover:text-foreground transition-colors group w-full">
                              <span className="truncate">{contaBanc?.nome || <span className="text-muted-foreground/50">Selecionar</span>}</span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="max-h-[260px] overflow-y-auto custom-scrollbar">
                            {bankAccounts.map((b: any) => (
                              <DropdownMenuItem key={b.id} onClick={() => updateMutation.mutate({ id: item.id, data: { bank_account_id: b.id } })}>
                                {b.nome}
                              </DropdownMenuItem>
                            ))}
                            {contaBanc && (
                              <DropdownMenuItem onClick={() => updateMutation.mutate({ id: item.id, data: { bank_account_id: null } })} className="text-muted-foreground">
                                Limpar
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="rounded-lg">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {item.status === "pending" && (
                              <DropdownMenuItem onClick={() => openReceiptDialog(item.id)}>
                                <Banknote className="w-4 h-4 mr-2" /> Registrar Recebimento
                              </DropdownMenuItem>
                            )}
                            {(item.status === "pending" || item.status === "overdue") && (
                              <DropdownMenuItem onClick={() => handleEdit(item)}>
                                <Pencil className="w-4 h-4 mr-2" /> Editar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => handleDuplicate(item)}>
                              <Copy className="w-4 h-4 mr-2" /> Duplicar
                            </DropdownMenuItem>
                            {item.cliente_id && (item.status === "pending" || item.status === "overdue") && (
                              <DropdownMenuItem onClick={() => setAsaasReceivableId(item.id)}>
                                <Banknote className="w-4 h-4 mr-2" /> Gerar cobrança Asaas
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => setDeleteId(item.id)} className="text-destructive">
                              <Trash2 className="w-4 h-4 mr-2" /> Excluir
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  );
                };

                const renderGroupParent = (groupId: string, parent: any, children: any[]) => {
                  const totalAmount = children.reduce((s, c) => s + Number(c.amount || 0), 0);
                  const paidCount = children.filter((c) => c.status === "paid").length;
                  const overdueCount = children.filter((c) => c.status === "overdue").length;
                  const pendingCount = children.filter((c) => c.status === "pending").length;
                  const earliest = children.reduce((min, c) => (c.due_date < min ? c.due_date : min), children[0].due_date);
                  const latest = children.reduce((max, c) => (c.due_date > max ? c.due_date : max), children[0].due_date);
                  const groupKind = parent.is_recurring ? "Recorrente" : "Parcelado/Sazonal";
                  const isExpanded = expandedGroups.has(groupId);
                  const aggStatus = overdueCount > 0 ? "overdue" : pendingCount > 0 ? "pending" : "paid";
                  const cfg = statusConfig[aggStatus] || statusConfig.pending;
                  const StatusIcon = cfg.icon;

                  return (
                    <>
                      <TableRow key={`grp-${groupId}`} className="bg-primary/[0.04] hover:bg-primary/[0.08] border-l-2 border-l-primary/40 cursor-pointer" onClick={() => toggleGroup(groupId)}>
                        <TableCell>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); toggleGroup(groupId); }}
                            className="rounded p-0.5 hover:bg-muted/40"
                          >
                            <ChevronRight className={`w-4 h-4 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                          </button>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {format(new Date(earliest), "dd/MM/yy")} → {format(new Date(latest), "dd/MM/yy")}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium truncate text-sm">{parent.supplier_name || "—"}</TableCell>
                        <TableCell className="truncate">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{parent.description.replace(/\s*\(\d+\/\d+\)\s*$/, "")}</span>
                            <Badge variant="outline" className="text-[10px] uppercase font-semibold bg-primary/10 text-primary border-primary/20">
                              <Layers className="w-3 h-3 mr-1" />
                              {children.length}x
                            </Badge>
                            <span className="text-xs text-muted-foreground">{groupKind}</span>
                          </div>
                        </TableCell>
                        <TableCell className="font-semibold text-sm">{formatCurrency(totalAmount)}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`${cfg.color} gap-1 font-medium`}>
                            <StatusIcon className="w-3 h-3" />
                            {cfg.label}
                          </Badge>
                        </TableCell>
                        <TableCell colSpan={3}>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {paidCount > 0 && <span><Check className="w-3 h-3 inline text-success" /> {paidCount} recebidas</span>}
                            {pendingCount > 0 && <span><Clock className="w-3 h-3 inline text-warning" /> {pendingCount} pendentes</span>}
                            {overdueCount > 0 && <span><AlertTriangle className="w-3 h-3 inline text-destructive" /> {overdueCount} vencidas</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="rounded-lg gap-1.5"
                            onClick={(e) => { e.stopPropagation(); setSummaryGroupId(groupId); }}
                          >
                            <Eye className="w-4 h-4" />
                            <span className="text-xs">Resumo</span>
                          </Button>
                        </TableCell>
                      </TableRow>
                      {isExpanded && children.map((c) => renderItemRow(c, { isChild: true }))}
                    </>
                  );
                };

                return groupedRows.map((row) => {
                  if (row.type === "single") return renderItemRow(row.item);
                  return renderGroupParent(row.groupId, row.parent, row.children);
                });
              })()}
            </TableBody>
          </Table>
        )}
      </Card>

        </TabsContent>

        <TabsContent value="importacoes" className="mt-4 space-y-4">
          <GenericImporter target="receivable" onImported={() => refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]])} />
          <ImportsHistoryTargeted target="receivable" onDeleted={() => refreshQueries(queryClient, [["accounts-receivable"], ["accounts-receivable-counts"]])} />
        </TabsContent>
      </Tabs>

      {/* Scope Dialog (parcelamento) */}
      <Dialog open={!!scopeDialogItem} onOpenChange={(open) => !open && setScopeDialogItem(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar parcelamento</DialogTitle>
            <DialogDescription>
              Esta conta faz parte de um parcelamento de {scopeDialogItem?.installment_total || 0} parcelas. O que deseja editar?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 pt-2">
            <button
              type="button"
              onClick={() => confirmScopeAndEdit("single")}
              className="w-full text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
            >
              <div className="font-medium text-sm text-foreground">Apenas esta parcela</div>
              <div className="text-xs text-muted-foreground mt-1">
                Modificar somente a parcela {scopeDialogItem?.installment_number}/{scopeDialogItem?.installment_total}
              </div>
            </button>
            <button
              type="button"
              onClick={() => confirmScopeAndEdit("group")}
              className="w-full text-left p-4 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all"
            >
              <div className="font-medium text-sm text-foreground">Todas as parcelas do grupo</div>
              <div className="text-xs text-muted-foreground mt-1">
                Aplicar mudanças (descrição, valor, categoria, etc.) em todas. Vencimentos individuais permanecem.
              </div>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Receipt Dialog */}
      <Dialog open={showReceiptDialog} onOpenChange={setShowReceiptDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Recebimento</DialogTitle>
            <DialogDescription>Informe os dados do recebimento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {receiptIsOverdue && (() => {
              const item = receivables.find((p: any) => p.id === receivingId);
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-500/10 p-3 space-y-3">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">Conta vencida</span>
                  </div>
                  {item && (
                    <p className="text-xs text-muted-foreground">
                      Valor original: {formatCurrency(item.amount)}
                    </p>
                  )}
                  <div>
                    <label className="text-sm font-medium text-foreground mb-2 block">
                      O valor foi alterado por conta do atraso? <span className="text-destructive">*</span>
                    </label>
                    <RadioGroup
                      value={receiptValueChanged}
                      onValueChange={(v) => {
                        setReceiptValueChanged(v);
                        if (v === "nao") setReceiptJurosMulta(0);
                      }}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="sim" id="rcpt-sim" />
                        <label htmlFor="rcpt-sim" className="text-sm cursor-pointer">Sim</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="nao" id="rcpt-nao" />
                        <label htmlFor="rcpt-nao" className="text-sm cursor-pointer">Não</label>
                      </div>
                    </RadioGroup>
                  </div>
                  {receiptValueChanged === "sim" && (
                    <CurrencyInput
                      label="Juros/Multa recebidos"
                      value={receiptJurosMulta}
                      onValueChange={setReceiptJurosMulta}
                      error={receiptJurosMulta <= 0 ? "Informe o valor de juros/multa" : undefined}
                    />
                  )}
                </div>
              );
            })()}

            <DateInput label="Data do recebimento" value={receiptDate} onValueChange={setReceiptDate} />
            <ManagedSelectInput
              label="Conta bancária"
              value={receiptBankAccount}
              onValueChange={setReceiptBankAccount}
              options={bankAccounts.map((b: any) => ({ value: b.id, label: `${b.nome}${b.banco ? ` - ${b.banco}` : ""}` }))}
              placeholder="Selecione a conta..."
              icon={<Landmark className="w-4 h-4" />}
              onAddModal={() => { setCbEditingId(null); setCbModalOpen(true); }}
              onEditModal={(id) => { setCbEditingId(id); setCbModalOpen(true); }}
              onDelete={contasCrud.onDelete}
              addLabel="Nova conta bancária"
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowReceiptDialog(false)} className="rounded-lg">Cancelar</Button>
              <Button
                onClick={handleReceiptSubmit}
                disabled={receiptMutation.isPending || (receiptIsOverdue && !receiptValueChanged) || (receiptValueChanged === "sim" && receiptJurosMulta <= 0)}
                className="rounded-lg gap-2"
              >
                {receiptMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmar Recebimento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Form */}
      <FormModal
        open={showForm}
        onOpenChange={(open) => { if (!open) resetForm(); else setShowForm(true); }}
        title={editingId ? "Editar Conta" : "Nova Conta a Receber"}
        description="Preencha os dados da receita"
        size="md"
        preventOutsideClose
      >
        <div className="space-y-4">
          {/* Tipo PJ/PF */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Tipo de pessoa</label>
            <RadioGroup value={form.pessoa_tipo} onValueChange={(v) => updateField("pessoa_tipo", v as "pj" | "pf")} className="flex gap-2">
              <label className={`flex items-center gap-2 cursor-pointer text-sm px-4 py-2.5 rounded-lg border transition-all duration-200 ${form.pessoa_tipo === "pj" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-muted-foreground/30"}`}>
                <RadioGroupItem value="pj" className="sr-only" />
                <Building2 className="w-4 h-4" />
                Pessoa Jurídica
              </label>
              <label className={`flex items-center gap-2 cursor-pointer text-sm px-4 py-2.5 rounded-lg border transition-all duration-200 ${form.pessoa_tipo === "pf" ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-muted-foreground/30"}`}>
                <RadioGroupItem value="pf" className="sr-only" />
                <UserRound className="w-4 h-4" />
                Pessoa Física
              </label>
            </RadioGroup>
          </div>

          {/* Título */}
          <TextInput label="Título da receita" placeholder="Ex: Mensalidade contrato 2024" value={form.description} onChange={(e) => updateField("description", e.target.value)} error={errors.description} />

          {/* Tipo de pagador */}
          <div>
            <label className="text-sm font-medium text-foreground mb-2 block">Pagador</label>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {([
                { key: "cliente" as const, label: "Cliente", icon: Users },
                { key: "fornecedor" as const, label: "Fornecedor", icon: Building2 },
              ]).map(({ key, label, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateField("payer_kind", key)}
                  className={`flex items-center justify-center gap-2 p-2.5 rounded-lg border transition-all ${form.payer_kind === key ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:border-muted-foreground/30 text-muted-foreground"}`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm">{label}</span>
                </button>
              ))}
            </div>

            {form.payer_kind === "cliente" ? (
              <ManagedSelectInput
                label=""
                value={form.cliente_id}
                onValueChange={(v) => {
                  updateField("cliente_id", v);
                  const cli = clientes.find((c: any) => c.id === v);
                  if (cli) {
                    const name = cli.tipo === "pj" ? (cli.nome_fantasia || cli.razao_social || "") : (cli.nome_completo || "");
                    updateField("supplier_name", name);
                  }
                }}
                options={clienteOptions}
                placeholder="Selecione o cliente..."
                icon={<Users className="w-4 h-4" />}
                onAddModal={() => { setCliEditingId(null); setCliPrefill(null); setCliModalOpen(true); }}
                onEditModal={(id) => { setCliEditingId(id); setCliPrefill(null); setCliModalOpen(true); }}
                addLabel="Novo cliente"
                error={errors.cliente_id}
              />
            ) : (
              <ManagedSelectInput
                label=""
                value={form.supplier_id}
                onValueChange={(v) => {
                  updateField("supplier_id", v);
                  const forn = fornecedores.find((f: any) => f.id === v);
                  if (forn) {
                    const name = forn.tipo === "pj" ? (forn.nome_fantasia || forn.razao_social || "") : (forn.nome_completo || "");
                    updateField("supplier_name", name);
                  }
                }}
                options={fornecedorOptions}
                placeholder="Selecione o fornecedor..."
                icon={<Building2 className="w-4 h-4" />}
                onAddModal={() => { setFornEditingId(null); setFornPrefill(null); setFornModalOpen(true); }}
                onEditModal={(id) => { setFornEditingId(id); setFornPrefill(null); setFornModalOpen(true); }}
                addLabel="Novo fornecedor"
                error={errors.supplier_id}
              />
            )}
          </div>

          {/* Documento do pagador */}
          {(() => {
            const { docLabel, formatted, isCliente } = getPayerDocLabel();
            const placeholder = isCliente ? "Selecione um cliente" : "Selecione um fornecedor";
            return (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{docLabel} do Pagador</label>
                <div className="flex h-10 w-full items-center rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed">
                  {formatted || <span className="text-muted-foreground/50">{placeholder}</span>}
                </div>
              </div>
            );
          })()}

          <TextInput label="Nº Documento" placeholder="NF, recibo, contrato..." value={form.document_number} onChange={(e) => updateField("document_number", e.target.value)} icon={<FileText className="w-4 h-4" />} />

          <CurrencyInput label="Valor" value={form.amount} onValueChange={(v) => updateField("amount", v)} error={errors.amount} />

          <DateInput label="Vencimento" value={form.due_date} onValueChange={(d) => updateField("due_date", d)} error={errors.due_date} />

          {/* Modo de Pagamento */}
          {!editingId && (
            <>
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
            </>
          )}

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Classificação</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          <ManagedSelectInput
            label="Tipo Financeiro (DRE)"
            value={form.tipo_financeiro}
            onValueChange={(v) => {
              updateField("tipo_financeiro", v);
              updateField("categoria_financeira_id", "");
            }}
            options={tiposFinanceiros}
            placeholder="Selecione o tipo financeiro..."
            icon={<BarChart3 className="w-4 h-4" />}
          />

          <ManagedSelectInput
            label="Subcategoria (Plano de Contas)"
            value={form.categoria_financeira_id}
            onValueChange={(v) => updateField("categoria_financeira_id", v)}
            options={(() => {
              const filteredCats = categoriasFinanceiras.filter((c: any) => !form.tipo_financeiro || c.tipo === form.tipo_financeiro);
              return filteredCats
                .filter((c: any) => !allCategoriasFin.some((child: any) => child.categoria_pai_id === c.id))
                .map((c: any) => ({ value: c.id, label: c.nome }));
            })()}
            placeholder={form.tipo_financeiro ? "Selecione a subcategoria..." : "Selecione o tipo financeiro primeiro..."}
            icon={<FolderTree className="w-4 h-4" />}
            onAddModal={() => { setCfEditingId(null); setCfModalOpen(true); }}
            onEditModal={(id) => { setCfEditingId(id); setCfModalOpen(true); }}
            onDelete={catFinCrud.onDelete}
            addLabel="Nova subcategoria"
            disabled={!form.tipo_financeiro}
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
            options={bankAccounts.map((b: any) => ({ value: b.id, label: `${b.nome}${b.banco ? ` - ${b.banco}` : ""}` }))}
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

          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Extras</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          <TextareaInput label="Observações" placeholder="Informações adicionais..." value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />

          <FileAttachment value={form.attachment_url} onValueChange={(url) => updateField("attachment_url", url)} folder="contas-receber" />

          {/* Asaas Integration Block - only when integration is active */}
          {asaasEnabled && !editingId && form.payer_kind === "cliente" && (
            <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Zap className="w-4.5 h-4.5 text-primary" />
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
            <Button variant="outline" onClick={resetForm} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isPending} className="rounded-lg gap-2 shadow-sm">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingId ? "Salvar Alterações" : "Criar Conta"}
            </Button>
          </div>
        </div>
      </FormModal>

      {/* Entity modals */}
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
      <ClienteModal
        open={cliModalOpen}
        onOpenChange={setCliModalOpen}
        editingId={cliEditingId}
        prefill={cliPrefill}
        onSaved={async (id) => {
          await queryClient.invalidateQueries({ queryKey: ["clientes"] });
          await queryClient.refetchQueries({ queryKey: ["clientes", empresaId] });
          updateField("cliente_id", id);
        }}
      />
      <FornecedorModal
        open={fornModalOpen}
        onOpenChange={setFornModalOpen}
        editingId={fornEditingId}
        prefill={fornPrefill}
        onSaved={async (id) => {
          await queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
          await queryClient.refetchQueries({ queryKey: ["fornecedores", empresaId] });
          updateField("supplier_id", id);
        }}
      />

      {/* Duplicate detection alert */}
      <AlertDialog open={showDuplicateAlert} onOpenChange={setShowDuplicateAlert}>
        <AlertDialogContent className="max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              Possível duplicidade detectada
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>Foram encontrados registros semelhantes ao que você está tentando salvar:</p>
                <div className="max-h-48 overflow-y-auto space-y-2">
                  {duplicateMatches.map((dup: any, idx: number) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => setDupDetailItem(dup)}
                      className="w-full text-left rounded-md border border-border bg-muted/30 p-3 text-sm hover:bg-muted/60 hover:border-primary/40 transition-colors cursor-pointer"
                    >
                      <p className="font-medium text-foreground">{dup.description}</p>
                      <p className="text-muted-foreground">
                        Valor: R$ {Number(dup.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        {dup.document_number && ` • Doc: ${dup.document_number}`}
                        {dup.supplier_name && ` • ${dup.supplier_name}`}
                      </p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {dup._dupReasons?.map((r: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs border-amber-300 text-amber-600">{r}</Badge>
                        ))}
                      </div>
                    </button>
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

      {/* Group Summary Modal */}
      <Dialog open={!!summaryGroupId} onOpenChange={(open) => !open && setSummaryGroupId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Resumo da Conta Agrupada
            </DialogTitle>
            <DialogDescription>
              {summaryGroup && summaryGroup.type === "group"
                ? summaryGroup.parent.description.replace(/\s*\(\d+\/\d+\)\s*$/, "")
                : ""}
            </DialogDescription>
          </DialogHeader>
          {summaryGroup && summaryGroup.type === "group" && (() => {
            const { children, parent } = summaryGroup;
            const totalAmount = children.reduce((s, c) => s + Number(c.amount || 0), 0);
            const paidAmount = children.filter((c) => c.status === "paid").reduce((s, c) => s + Number(c.amount || 0), 0);
            const pendingAmount = children.filter((c) => c.status !== "paid" && c.status !== "cancelled").reduce((s, c) => s + Number(c.amount || 0), 0);
            const paidCount = children.filter((c) => c.status === "paid").length;
            const overdueCount = children.filter((c) => c.status === "overdue").length;
            const pendingCount = children.filter((c) => c.status === "pending").length;
            const earliest = children.reduce((min, c) => (c.due_date < min ? c.due_date : min), children[0].due_date);
            const latest = children.reduce((max, c) => (c.due_date > max ? c.due_date : max), children[0].due_date);
            const groupKind = parent.is_recurring ? "Recorrente" : "Parcelado / Sazonal";
            const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

            return (
              <div className="overflow-y-auto custom-scrollbar space-y-5 pr-1">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border border-border/40 bg-muted/20">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tipo</p>
                    <p className="text-sm font-semibold mt-1">{groupKind}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-border/40 bg-muted/20">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pagador</p>
                    <p className="text-sm font-semibold mt-1 truncate">{parent.supplier_name || "—"}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-border/40 bg-muted/20">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Período</p>
                    <p className="text-sm font-semibold mt-1">
                      {format(new Date(earliest), "dd/MM/yy")} → {format(new Date(latest), "dd/MM/yy")}
                    </p>
                  </div>
                  <div className="p-3 rounded-xl border border-border/40 bg-muted/20">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Parcelas</p>
                    <p className="text-sm font-semibold mt-1">{children.length} ocorrências</p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Valor total</p>
                    <p className="text-lg font-bold mt-1 text-primary">{formatCurrency(totalAmount)}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-success/20 bg-success/5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Recebido</p>
                    <p className="text-lg font-bold mt-1 text-success">{formatCurrency(paidAmount)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{paidCount} de {children.length}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-warning/20 bg-warning/5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Em aberto</p>
                    <p className="text-lg font-bold mt-1 text-warning">{formatCurrency(pendingAmount)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {pendingCount} pendentes{overdueCount > 0 ? ` · ${overdueCount} vencidas` : ""}
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground font-medium">Progresso de recebimento</span>
                    <span className="text-xs font-semibold">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-success transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-2">Parcelas</h4>
                  <div className="rounded-xl border border-border/40 overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">#</TableHead>
                          <TableHead>Descrição</TableHead>
                          <TableHead>Vencimento</TableHead>
                          <TableHead>Valor</TableHead>
                          <TableHead>Recebimento</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {children.map((c) => {
                          const cfg = statusConfig[c.status] || statusConfig.pending;
                          const Icon = cfg.icon;
                          return (
                            <TableRow key={c.id}>
                              <TableCell className="text-xs text-muted-foreground font-mono">
                                {c.installment_number || "—"}/{c.installment_total || children.length}
                              </TableCell>
                              <TableCell className="text-sm truncate max-w-[200px]">{c.description}</TableCell>
                              <TableCell className="text-sm">{format(new Date(c.due_date), "dd/MM/yyyy")}</TableCell>
                              <TableCell className="text-sm font-medium">{formatCurrency(c.amount)}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {c.payment_date ? format(new Date(c.payment_date), "dd/MM/yyyy") : "—"}
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className={`${cfg.color} gap-1 text-[10px]`}>
                                  <Icon className="w-3 h-3" />
                                  {cfg.label}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </div>
            );
          })()}
          <div className="flex justify-end pt-3 border-t border-border/30">
            <Button variant="outline" onClick={() => setSummaryGroupId(null)} className="rounded-lg">Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta a receber?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteId) handleDelete(deleteId); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} conta(s)?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é permanente. Contas com recebimento registrado podem não ser excluídas.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir tudo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkCancelOpen} onOpenChange={setBulkCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar {selectedIds.size} conta(s)?</AlertDialogTitle>
            <AlertDialogDescription>O status será alterado para "Cancelado" e a data de recebimento será removida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkCancel}>
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AsaasChargeDialog
        receivableId={asaasReceivableId}
        empresaId={empresaId || null}
        onOpenChange={(open) => { if (!open) setAsaasReceivableId(null); }}
        onChanged={() => refreshQueries(queryClient, [["accounts-receivable", empresaId]])}
      />

      {/* Prompt: ask user if they want to push the just-created receivables to Asaas */}
      <AlertDialog open={!!asaasPromptIds} onOpenChange={(open) => { if (!open) setAsaasPromptIds(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-primary" />
              Gerar cobrança no Asaas?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Você criou {asaasPromptIds?.length === 1 ? "1 lançamento" : `${asaasPromptIds?.length} lançamentos`}.
              Deseja gerar {asaasPromptIds && asaasPromptIds.length > 1 ? "as cobranças correspondentes" : "a cobrança"} no Asaas agora?
              O cliente será criado/atualizado automaticamente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2 py-2">
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
          <AlertDialogFooter>
            <AlertDialogCancel disabled={asaasGenerating}>Agora não</AlertDialogCancel>
            <AlertDialogAction
              disabled={asaasGenerating}
              onClick={async (e) => {
                e.preventDefault();
                const ids = asaasPromptIds || [];
                setAsaasPromptIds(null);
                await triggerAsaasForRecords(ids, asaasBillingType);
              }}
            >
              {asaasGenerating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Zap className="w-4 h-4 mr-2" />}
              Gerar no Asaas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuickListModal
        open={quickListMode !== null}
        onOpenChange={(o) => { if (!o) setQuickListMode(null); }}
        mode="receivable"
        title={
          quickListMode === "overdue" ? "Contas Vencidas"
          : quickListMode === "nearDue" ? "A Vencer nos próximos 7 dias"
          : quickListMode === "thisMonth" ? "A Vencer neste mês"
          : "A Vencer no mês seguinte"
        }
        description="Edite valor, vencimento ou altere o status diretamente."
        items={
          quickListMode === "overdue" ? overdueItems
          : quickListMode === "nearDue" ? nearDueItems
          : quickListMode === "thisMonth" ? thisMonthItems
          : nextMonthItems
        }
      />
    </div>
  );
}
