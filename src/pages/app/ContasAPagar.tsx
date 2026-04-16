import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresa } from "@/hooks/useEmpresa";
import {
  Receipt, Plus, Check, Loader2, AlertTriangle, Clock, Ban,
  FileText, Search, CreditCard,
  Building2, Target, Landmark, FolderTree, Copy, Pencil, Trash2,
  Banknote, ChevronDown, ScanLine, MoreHorizontal, BarChart3
} from "lucide-react";
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
import { CategoriaCadastroModal } from "@/components/modals/CategoriaCadastroModal";
import { CategoriaFinanceiraModal } from "@/components/modals/CategoriaFinanceiraModal";
import { CentroCustoModal } from "@/components/modals/CentroCustoModal";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";
import { FormaPagamentoModal } from "@/components/modals/FormaPagamentoModal";
import { FornecedorModal, type FornecedorPrefill } from "@/components/modals/FornecedorModal";
import { BulkBoletoScanner } from "@/components/BulkBoletoScanner";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { refreshQueries } from "@/lib/query-refresh";
import {
  fetchAccountsPayable, createAccountPayable, updateAccountPayable,
  countAccountsPayable, registerPayment, type AccountPayableInsert
} from "@/lib/accounts-payable-helpers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isPast, addDays, isBefore } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type PaymentMode = "avista" | "parcelado" | "recorrente" | "sazonal";

interface PayableForm {
  description: string;
  supplier_id: string;
  supplier_name: string;
  document_number: string;
  amount: number;
  due_date?: Date;
  category_id: string;
  tipo_financeiro: string;
  categoria_financeira_id: string;
  cost_center_id: string;
  bank_account_id: string;
  payment_method_id: string;
  payment_mode: PaymentMode;
  installments: number;
  is_recurring: boolean;
  recurrence_interval: string;
  recurrence_count: number;
  sazonal_dates: (Date | undefined)[];
  notes: string;
  pessoa_tipo: "pj" | "pf";
  attachment_url: string | null;
}

const initialForm: PayableForm = {
  description: "",
  supplier_id: "",
  supplier_name: "",
  document_number: "",
  amount: 0,
  due_date: undefined,
  category_id: "",
  tipo_financeiro: "",
  categoria_financeira_id: "",
  cost_center_id: "",
  bank_account_id: "",
  payment_method_id: "",
  payment_mode: "avista",
  installments: 1,
  is_recurring: false,
  recurrence_interval: "monthly",
  recurrence_count: 12,
  sazonal_dates: [undefined],
  notes: "",
  pessoa_tipo: "pj",
  attachment_url: null,
};

const tiposFinanceiros = [
  { value: "receita", label: "💰 Receita", tooltip: "Entradas operacionais do negócio, como vendas de produtos ou prestação de serviços." },
  { value: "deducao", label: "➖ Dedução", tooltip: "Valores descontados da receita bruta, como impostos sobre vendas (ISS, ICMS) e devoluções." },
  { value: "custo", label: "🏭 Custo", tooltip: "Gastos diretamente ligados à produção ou entrega do serviço/produto (ex: matéria-prima, mão de obra direta)." },
  { value: "despesa", label: "💸 Despesa", tooltip: "Gastos operacionais para manter a empresa funcionando (ex: aluguel, salários administrativos, marketing)." },
  { value: "receita_financeira", label: "📈 Rec. Financeira", tooltip: "Ganhos financeiros como rendimentos de aplicações, juros recebidos e descontos obtidos." },
  { value: "despesa_financeira", label: "📉 Desp. Financeira", tooltip: "Gastos financeiros como juros de empréstimos, tarifas bancárias e multas." },
  { value: "imposto", label: "🏛️ Imposto", tooltip: "Tributos sobre o lucro da empresa, como Imposto de Renda (IRPJ) e Contribuição Social (CSLL)." },
  { value: "ajuste", label: "🔄 Ajuste", tooltip: "Lançamentos de correção ou reclassificação contábil que não se encaixam nas categorias acima." },
];

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: Clock },
  paid: { label: "Pago", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: Check },
  overdue: { label: "Vencido", color: "bg-red-500/10 text-red-600 border-red-200", icon: AlertTriangle },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border", icon: Ban },
};

export default function ContasAPagar() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PayableForm>(initialForm);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentBankAccount, setPaymentBankAccount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [paymentJurosMulta, setPaymentJurosMulta] = useState<number>(0);
  const [paymentIsOverdue, setPaymentIsOverdue] = useState(false);
  const [paymentValueChanged, setPaymentValueChanged] = useState<string>("");
  const [showDuplicateAlert, setShowDuplicateAlert] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);
  const [dupDetailItem, setDupDetailItem] = useState<any | null>(null);
  // Track inline tipo_financeiro selection per row (when user picks tipo but hasn't picked subcategoria yet)
  const [inlineTipoMap, setInlineTipoMap] = useState<Record<string, string>>({});

  // Managed select hooks
  const categoriasCrud = useManagedSelect("categorias_cadastro");
  const centrosCrud = useManagedSelect("centros_custo");
  const contasCrud = useManagedSelect("contas_bancarias");
  const formasCrud = useManagedSelect("formas_pagamento");
  const catFinCrud = useManagedSelect("categorias_financeiras");

  // Entity modal states
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditingId, setCatEditingId] = useState<string | null>(null);
  const [ccModalOpen, setCcModalOpen] = useState(false);
  const [ccEditingId, setCcEditingId] = useState<string | null>(null);
  const [cbModalOpen, setCbModalOpen] = useState(false);
  const [cbEditingId, setCbEditingId] = useState<string | null>(null);
  const [fpModalOpen, setFpModalOpen] = useState(false);
  const [fpEditingId, setFpEditingId] = useState<string | null>(null);
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [cfEditingId, setCfEditingId] = useState<string | null>(null);
  const [fornModalOpen, setFornModalOpen] = useState(false);
  const [fornEditingId, setFornEditingId] = useState<string | null>(null);
  const [fornPrefill, setFornPrefill] = useState<FornecedorPrefill | null>(null);
  const [scanning, setScanning] = useState(false);
  const [isPickingScanFile, setIsPickingScanFile] = useState(false);
  const [bulkScanOpen, setBulkScanOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);

  // Fetch data
  const { data: payables = [], isLoading } = useQuery({
    queryKey: ["accounts-payable", empresaId],
    queryFn: async () => fetchAccountsPayable(empresaId),
    enabled: !!user,
  });

  const { data: counts = { openTotal: 0, upcoming: 0, overdue: 0, paid: 0 } } = useQuery({
    queryKey: ["accounts-payable-counts", empresaId],
    queryFn: async () => countAccountsPayable(empresaId),
    enabled: !!user,
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

  const fornecedorOptions = fornecedores.map((f: any) => ({
    value: f.id,
    label: f.tipo === "pj" ? (f.nome_fantasia || f.razao_social || "—") : (f.nome_completo || "—"),
  }));

  const { data: categories = [] } = useQuery({
    queryKey: ["categorias_cadastro", empresaId],
    queryFn: async () => {
      let q = supabase.from("categorias_cadastro").select("id, nome").eq("ativo", true).order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: categoriasFinanceiras = [] } = useQuery({
    queryKey: ["categorias-financeiras", empresaId],
    queryFn: async () => {
      let q = supabase.from("categorias_financeiras").select("id, nome, tipo, categoria_pai_id").eq("ativo", true).order("ordem");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Fetch ALL categories (cross-empresa) to correctly determine parent-child hierarchy
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
      // Manual accounts
      let q = supabase.from("contas_bancarias").select("id, nome, banco").eq("ativo", true).order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data: manual } = await q;

      // Pluggy (Open Finance) — only checking accounts
      const { data: pluggy } = await supabase
        .from("pluggy_bank_accounts")
        .select("id, name, pluggy_item_id, type, subtype, bank_data")
        .eq("type", "BANK")
        .eq("subtype", "CHECKING_ACCOUNT")
        .order("name");

      // Get connector names for friendly labels
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

      // Get empresa names for PJ accounts without owner
      const { data: empresasList } = await supabase
        .from("empresas")
        .select("cnpj, nome_fantasia, razao_social");
      const empresaByDoc: Record<string, string> = {};
      for (const e of empresasList ?? []) {
        const cleanCnpj = (e.cnpj || "").replace(/\D/g, "");
        if (cleanCnpj) empresaByDoc[cleanCnpj] = e.nome_fantasia || e.razao_social || "";
      }

      const pluggyMapped = (pluggy ?? []).map((p: any) => {
        const connName = connectorMap[p.pluggy_item_id] || p.name;
        let ownerName = (p.bank_data as any)?.owner || "";
        if (!ownerName) {
          const taxNum = ((p.bank_data as any)?.taxNumber || "").replace(/\D/g, "");
          ownerName = empresaByDoc[taxNum] || "";
        }
        const label = ownerName ? `${connName} - ${ownerName}` : connName;
        return { id: p.id, nome: label, banco: "Open Finance" };
      });

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

  // Mutations
  const createMutation = useMutation({
    mutationFn: createAccountPayable,
    onSuccess: async () => {
      await refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]]);
      toast.success(editingId ? "Conta atualizada!" : "Conta(s) criada(s) com sucesso!");
      resetForm();
    },
    onError: () => toast.error("Erro ao salvar conta"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateAccountPayable(id, data),
    onSuccess: async () => {
      await refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]]);
      toast.success("Conta atualizada!");
      resetForm();
    },
    onError: () => toast.error("Erro ao atualizar conta"),
  });

   const paymentMutation = useMutation({
    mutationFn: ({ id, bankAccountId, paymentDate, jurosMulta }: { id: string; bankAccountId: string; paymentDate: string; jurosMulta?: number }) =>
      registerPayment(id, bankAccountId, paymentDate, user!.id, empresaId, jurosMulta),
    onSuccess: async () => {
      await refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]]);
      toast.success("Pagamento registrado!");
      setShowPaymentDialog(false);
      setPayingId(null);
      setPaymentJurosMulta(0);
      setPaymentIsOverdue(false);
      setPaymentValueChanged("");
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
    setErrors({});
    setIsPickingScanFile(false);
  };

  const updateField = <K extends keyof PayableForm>(key: K, value: PayableForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const validate = (): boolean => {
    const errs: Record<string, string> = {};
    if (!form.description.trim()) errs.description = "Descrição obrigatória";
    if (form.amount <= 0) errs.amount = "Valor deve ser maior que zero";
    if (!form.due_date) errs.due_date = "Data de vencimento obrigatória";
    if (form.installments < 1) errs.installments = "Mínimo 1 parcela";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // Upload the scanned file to storage and return the public URL
  const uploadScanFile = async (file: File): Promise<string | null> => {
    if (!user) return null;
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/contas-pagar/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("attachments").getPublicUrl(path);
      return urlData.publicUrl;
    } catch {
      return null;
    }
  };

  const checkDuplicatesFromForm = (formData: PayableForm, excludeId?: string | null): any[] => {
    const matches: any[] = [];

    for (const existing of payables) {
      if (excludeId && existing.id === excludeId) continue;
      if (existing.status === "cancelled") continue;

      // Prioridade 1: Nº Documento igual → duplicata imediata
      const formDoc = formData.document_number.trim().replace(/\D/g, "");
      const existDoc = (existing.document_number || "").replace(/\D/g, "");
      if (formDoc && existDoc && formDoc === existDoc) {
        matches.push({ ...existing, _dupReasons: ["Nº Documento igual"] });
        continue;
      }

      // Prioridade 2 (só se Nº Documento vazio): Nome do beneficiário + Valor iguais
      if (!formDoc) {
        const formAmount = formData.amount / 100;
        const sameAmount = formAmount > 0 && Math.abs(formAmount - existing.amount) < 0.01;

        let sameBeneficiary = false;
        if (formData.supplier_id && existing.supplier_id && formData.supplier_id === existing.supplier_id) {
          sameBeneficiary = true;
        } else if (formData.supplier_name.trim() && existing.supplier_name &&
            formData.supplier_name.trim().toLowerCase() === existing.supplier_name.trim().toLowerCase()) {
          sameBeneficiary = true;
        }

        if (sameAmount && sameBeneficiary) {
          matches.push({ ...existing, _dupReasons: ["Mesmo beneficiário", "Mesmo valor"] });
        }
      }
    }

    return matches;
  };

  const proceedWithSave = () => {
    setShowDuplicateAlert(false);
    setDuplicateMatches([]);
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
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          description: form.description,
          supplier_id: form.supplier_id || null,
          supplier_name: form.supplier_name || null,
          document_number: form.document_number || null,
          amount: form.amount / 100,
          due_date: form.due_date!.toISOString().split("T")[0],
          category_id: form.category_id || null,
          categoria_financeira_id: form.categoria_financeira_id || null,
          cost_center_id: form.cost_center_id || null,
          bank_account_id: form.bank_account_id || null,
          payment_method_id: form.payment_method_id || null,
          is_recurring: form.is_recurring,
          recurrence_interval: form.is_recurring && form.recurrence_interval ? form.recurrence_interval : null,
          notes: form.notes || null,
          pessoa_tipo: form.pessoa_tipo,
          attachment_url: form.attachment_url,
        },
      });
      return;
    }

    // Create records based on payment_mode
    const totalAmount = form.amount / 100;
    const records: AccountPayableInsert[] = [];
    // Group ID for multi-record creations (parcelado, recorrente, sazonal)
    const willGroup =
      form.payment_mode === "parcelado" ||
      form.payment_mode === "recorrente" ||
      (form.payment_mode === "sazonal" && form.sazonal_dates.filter(Boolean).length > 1);
    const grupoId = willGroup
      ? (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `grp-${Date.now()}-${Math.random()}`)
      : null;

    const baseRecord = (overrides: Partial<AccountPayableInsert>): AccountPayableInsert => ({
      user_id: user!.id,
      empresa_id: empresaId || undefined,
      description: form.description,
      supplier_id: form.supplier_id || null,
      supplier_name: form.supplier_name || null,
      document_number: form.document_number || null,
      amount: totalAmount,
      due_date: form.due_date!.toISOString().split("T")[0],
      category_id: form.category_id || null,
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
      const n = Math.max(1, form.recurrence_count);
      const interval = form.recurrence_interval || "monthly";
      for (let i = 0; i < n; i++) {
        const dueDate = new Date(form.due_date!);
        if (interval === "weekly") dueDate.setDate(dueDate.getDate() + 7 * i);
        else if (interval === "yearly") dueDate.setFullYear(dueDate.getFullYear() + i);
        else dueDate.setMonth(dueDate.getMonth() + i);
        records.push(baseRecord({
          description: `${form.description} (${i + 1}/${n})`,
          due_date: dueDate.toISOString().split("T")[0],
          installment_number: i + 1,
          installment_total: n,
          is_recurring: true,
          recurrence_interval: interval as any,
        }));
      }
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
      supplier_id: item.supplier_id || "",
      supplier_name: item.supplier_name || "",
      document_number: item.document_number || "",
      amount: Math.round(item.amount * 100),
      due_date: new Date(item.due_date),
      category_id: item.category_id || "",
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
      is_recurring: item.is_recurring,
      recurrence_interval: item.recurrence_interval || "monthly",
      recurrence_count: 12,
      sazonal_dates: [undefined],
      notes: item.notes || "",
      pessoa_tipo: item.pessoa_tipo || "pj",
      attachment_url: item.attachment_url || null,
    });
    setShowForm(true);
  };

  const handleCancel = async (id: string) => {
    await updateAccountPayable(id, { status: "cancelled" as any });
    queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
    queryClient.invalidateQueries({ queryKey: ["accounts-payable-counts"] });
    toast.success("Conta cancelada");
  };

  const handleDelete = async (id: string) => {
    const { data, error } = await supabase
      .from("accounts_payable")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();

    if (error) {
      toast.error(error.message || "Erro ao excluir");
      return;
    }

    if (!data) {
      toast.error("A conta não pôde ser excluída.");
      return;
    }

    queryClient.setQueryData<any[]>(["accounts-payable", empresaId], (current = []) =>
      current.filter((item) => item.id !== id)
    );
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
    await refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]]);
    toast.success("Conta excluída");
    setDeleteId(null);
  };

  const handleChangeStatus = async (id: string, newStatus: string) => {
    if (newStatus === "paid") {
      openPaymentDialog(id);
      return;
    }
    await updateAccountPayable(id, { status: newStatus as any, ...(newStatus !== "paid" ? { payment_date: null } : {}) });
    queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
    queryClient.invalidateQueries({ queryKey: ["accounts-payable-counts"] });
    toast.success(`Status alterado para ${statusConfig[newStatus]?.label || newStatus}`);
  };

  const handleBulkChangeStatus = async (newStatus: string) => {
    if (newStatus === "paid") {
      toast.error("Para registrar pagamento, use a ação individual.");
      return;
    }
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await updateAccountPayable(id, { status: newStatus as any, ...(newStatus !== "paid" ? { payment_date: null } : {}) });
    }
    setSelectedIds(new Set());
    await refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]]);
    toast.success(`${ids.length} conta(s) atualizada(s) para ${statusConfig[newStatus]?.label || newStatus}`);
  };

  const handleBulkUpdate = async (data: Record<string, any>) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await updateAccountPayable(id, data);
    }
    setSelectedIds(new Set());
    await refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]]);
    toast.success(`${ids.length} conta(s) atualizada(s)!`);
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p: any) => p.id)));
    }
  };

  const toggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDuplicate = (item: any) => {
    setEditingId(null);
    const catFin2 = categoriasFinanceiras.find((c: any) => c.id === item.categoria_financeira_id);
    setForm({
      description: item.description,
      supplier_id: item.supplier_id || "",
      supplier_name: item.supplier_name || "",
      document_number: "",
      amount: Math.round(item.amount * 100),
      due_date: undefined,
      category_id: item.category_id || "",
      tipo_financeiro: catFin2?.tipo || "",
      categoria_financeira_id: item.categoria_financeira_id || "",
      cost_center_id: item.cost_center_id || "",
      bank_account_id: item.bank_account_id || "",
      payment_method_id: item.payment_method_id || "",
      payment_mode: "avista",
      installments: 1,
      is_recurring: false,
      recurrence_interval: "monthly",
      recurrence_count: 12,
      sazonal_dates: [undefined],
      notes: item.notes || "",
      pessoa_tipo: item.pessoa_tipo || "pj",
      attachment_url: null,
    });
    setShowForm(true);
  };

  const handleScanBoleto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setIsPickingScanFile(false);

    if (!file) {
      if (scanInputRef.current) scanInputRef.current.value = "";
      return;
    }

    const MAX = 10 * 1024 * 1024;
    if (file.size > MAX) {
      toast.error("Arquivo muito grande (máx. 10MB)");
      if (scanInputRef.current) scanInputRef.current.value = "";
      return;
    }

    setScanning(true);
    try {
      // Upload file to storage for attachment (in parallel with AI scan)
      const uploadPromise = uploadScanFile(file);

      const reader = new FileReader();
      const base64 = await new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const [{ data, error }, attachmentUrl] = await Promise.all([
        supabase.functions.invoke("scan-boleto", {
          body: {
            file_base64: base64,
            file_type: file.type,
            categorias_financeiras: categoriasFinanceiras.map((c: any) => ({ id: c.id, nome: c.nome, tipo: c.tipo })),
            centros_custo: costCenters.map((c: any) => ({ id: c.id, nome: c.nome })),
          },
        }),
        uploadPromise,
      ]);

      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        return;
      }

      const extracted = data?.data;
      if (!extracted) {
        toast.error("Não foi possível extrair dados do boleto");
        return;
      }

      // 1. Clear previous form data before applying new scan
      const newForm: PayableForm = {
        ...initialForm,
        description: extracted.description || "",
        supplier_name: extracted.supplier_name || "",
        document_number: extracted.document_number || "",
        amount: extracted.amount || 0,
        due_date: extracted.due_date ? new Date(extracted.due_date + "T12:00:00") : undefined,
        notes: extracted.barcode ? `Linha digitável: ${extracted.barcode}` : "",
        attachment_url: attachmentUrl || null,
        tipo_financeiro: extracted.suggested_tipo_financeiro || "",
        categoria_financeira_id: extracted.suggested_categoria_financeira_id || "",
        cost_center_id: extracted.suggested_centro_custo_id || "",
      };

      // Try to match supplier by name or CNPJ
      let matchedSupplierId = "";
      const supplierCnpj = extracted.supplier_cnpj?.replace(/\D/g, "") || "";
      
      if (supplierCnpj) {
        const match = fornecedores.find((f: any) => f.cnpj?.replace(/\D/g, "") === supplierCnpj);
        if (match) {
          matchedSupplierId = match.id;
          newForm.supplier_id = match.id;
          newForm.supplier_name = match.tipo === "pj" ? (match.nome_fantasia || match.razao_social || "") : (match.nome_completo || "");
        }
      }
      
      if (!matchedSupplierId && extracted.supplier_name) {
        const nameLower = extracted.supplier_name.toLowerCase();
        const match = fornecedores.find((f: any) => {
          const rz = (f.razao_social || "").toLowerCase();
          const nf = (f.nome_fantasia || "").toLowerCase();
          const nc = (f.nome_completo || "").toLowerCase();
          return rz === nameLower || nf === nameLower || nc === nameLower;
        });
        if (match) {
          matchedSupplierId = match.id;
          newForm.supplier_id = match.id;
          newForm.supplier_name = match.tipo === "pj" ? (match.nome_fantasia || match.razao_social || "") : (match.nome_completo || "");
        }
      }

      setForm(newForm);
      setShowForm(true);

      // Check for duplicates right after scan
      const scanDups = checkDuplicatesFromForm(newForm);
      if (scanDups.length > 0) {
        setDuplicateMatches(scanDups);
        setShowDuplicateAlert(true);
      }

      // 2. If supplier not found, open FornecedorModal with prefill data
      if (!matchedSupplierId && extracted.supplier_name) {
        setFornEditingId(null);
        setFornPrefill({
          type: "empresa",
          nome: extracted.supplier_name || "",
          cpfCnpj: supplierCnpj || "",
          telefone: extracted.supplier_phone || "",
          email: extracted.supplier_email || "",
          endereco: extracted.supplier_address ? { logradouro: extracted.supplier_address } : undefined,
        });
        // Small delay to ensure the form modal renders first
        setTimeout(() => setFornModalOpen(true), 300);
        toast.success("Dados extraídos! Fornecedor não encontrado — cadastre-o agora.");
      } else {
        toast.success("Dados do boleto extraídos! Confira e ajuste os campos antes de salvar.");
      }
    } catch (err) {
      console.error("Scan error:", err);
      toast.error("Erro ao escanear boleto");
    } finally {
      setScanning(false);
      if (scanInputRef.current) scanInputRef.current.value = "";
    }
  };

  const openPaymentDialog = (id: string) => {
    const item = payables.find((p: any) => p.id === id);
    const isOverdue = item && (item.status === "overdue" || (item.status === "pending" && isPast(new Date(item.due_date))));
    setPayingId(id);
    setPaymentBankAccount("");
    setPaymentDate(new Date());
    setPaymentJurosMulta(0);
    setPaymentIsOverdue(!!isOverdue);
    setPaymentValueChanged(isOverdue ? "" : "nao");
    setShowPaymentDialog(true);
  };

  const handlePaymentSubmit = () => {
    if (!payingId || !paymentDate) return;
    if (paymentIsOverdue && !paymentValueChanged) {
      toast.error("Informe se houve alteração de valor por atraso");
      return;
    }
    paymentMutation.mutate({
      id: payingId,
      bankAccountId: paymentBankAccount || "",
      paymentDate: paymentDate.toISOString().split("T")[0],
      jurosMulta: paymentValueChanged === "sim" ? paymentJurosMulta / 100 : 0,
    });
  };

  // Filter and search
  const filtered = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    let list = payables;
    if (filterStatus === "open") {
      list = list.filter((p: any) => p.status === "pending" || p.status === "overdue");
    } else if (filterStatus === "upcoming") {
      list = list.filter((p: any) => p.status === "pending" && p.due_date >= todayStr);
    } else if (filterStatus !== "all") {
      list = list.filter((p: any) => p.status === filterStatus);
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter((p: any) =>
        p.description?.toLowerCase().includes(term) ||
        p.supplier_name?.toLowerCase().includes(term) ||
        p.document_number?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [payables, filterStatus, searchTerm]);

  // Group rows by grupo_id; ungrouped rows stay solo
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
    // Group rows
    for (const [groupId, items] of groupsMap.entries()) {
      const sorted = [...items].sort((a, b) =>
        (a.installment_number || 0) - (b.installment_number || 0) ||
        a.due_date.localeCompare(b.due_date)
      );
      rows.push({ type: "group", groupId, parent: sorted[0], children: sorted });
    }
    // Singles
    for (const item of singles) {
      rows.push({ type: "single", item });
    }
    // Sort all rows by earliest due_date
    rows.sort((a, b) => {
      const da = a.type === "single" ? a.item.due_date : a.parent.due_date;
      const db = b.type === "single" ? b.item.due_date : b.parent.due_date;
      return da.localeCompare(db);
    });
    return rows;
  }, [filtered]);

  // Near due warning (7 days)
  const nearDue = useMemo(() => {
    return payables.filter((p: any) => {
      if (p.status !== "pending") return false;
      const due = new Date(p.due_date);
      return isBefore(due, addDays(new Date(), 7)) && !isPast(due);
    }).length;
  }, [payables]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  // Group expand/collapse + summary modal state
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [summaryGroupId, setSummaryGroupId] = useState<string | null>(null);
  const toggleGroup = (id: string) =>
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const summaryGroup = useMemo(() => {
    if (!summaryGroupId) return null;
    return groupedRows.find(r => r.type === "group" && r.groupId === summaryGroupId) || null;
  }, [summaryGroupId, groupedRows]);





  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Contas a Pagar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie suas despesas e pagamentos</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkScanOpen(true)} className="rounded-lg gap-2 shadow-sm">
            <ScanLine className="w-4 h-4" /> Escanear em Massa
          </Button>
          <Button onClick={() => { setEditingId(null); setForm(initialForm); setShowForm(true); }} className="rounded-lg gap-2 shadow-sm">
            <Plus className="w-4 h-4" /> Nova Conta
          </Button>
        </div>
      </div>


      {nearDue > 0 && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-lg bg-amber-500/10 border border-amber-200">
          <AlertTriangle className="w-4 h-4 text-amber-600" />
          <span className="text-sm text-amber-700 font-medium">
            {nearDue} conta(s) com vencimento nos próximos 7 dias
          </span>
        </div>
      )}

      {/* Filters */}
      <Card className="border-border/50 shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, fornecedor ou documento..."
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
                paid: "Pago",
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

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <Card className="border-primary/30 bg-primary/5 shadow-sm p-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} item(ns) selecionado(s)
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {/* Bulk: Tipo Financeiro */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1">
                    <BarChart3 className="w-3 h-3" /> Tipo Financeiro <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="max-h-[260px] overflow-y-auto custom-scrollbar">
                  {tiposFinanceiros.map((t) => (
                    <DropdownMenuItem key={t.value} title={t.tooltip} onClick={() => {
                      // For bulk, set inline tipo for all selected and clear subcategoria
                      const ids = Array.from(selectedIds);
                      setInlineTipoMap(prev => {
                        const n = { ...prev };
                        ids.forEach(id => { n[id] = t.value; });
                        return n;
                      });
                      handleBulkUpdate({ categoria_financeira_id: null });
                    }}>
                      {t.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Bulk: Subcategoria */}
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

              {/* Bulk: Forma Pagamento */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1">
                    <CreditCard className="w-3 h-3" /> Forma Pgto. <ChevronDown className="w-3 h-3" />
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

              {/* Bulk: Conta Bancária */}
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

              {/* Bulk: Status */}
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

              <Button size="sm" variant="ghost" className="rounded-lg text-xs" onClick={() => setSelectedIds(new Set())}>
                Limpar seleção
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Table */}
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
                <TableHead style={{ minWidth: 180 }}>Fornecedor</TableHead>
                <TableHead style={{ minWidth: 220 }}>Descrição</TableHead>
                <TableHead style={{ minWidth: 110 }}>Valor</TableHead>
                <TableHead style={{ minWidth: 110 }}>Vencimento</TableHead>
                <TableHead style={{ minWidth: 180 }}>Tipo Financeiro</TableHead>
                <TableHead style={{ minWidth: 200 }}>Subcategoria</TableHead>
                <TableHead style={{ minWidth: 180 }}>Forma Pagamento</TableHead>
                <TableHead style={{ minWidth: 180 }}>Conta Bancária</TableHead>
                <TableHead style={{ minWidth: 120 }}>Status</TableHead>
                <TableHead style={{ width: 50, minWidth: 50 }} className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item: any) => {
                const dueDate = new Date(item.due_date);
                const isNearDue = item.status === "pending" && isBefore(dueDate, addDays(new Date(), 7)) && !isPast(dueDate);
                const catFin = categoriasFinanceiras.find((c: any) => c.id === item.categoria_financeira_id);
                // Derive tipo: from inline override, or from existing catFin, or empty
                const rowTipo = inlineTipoMap[item.id] || catFin?.tipo || "";
                const tipoFinLabel = rowTipo ? tiposFinanceiros.find(t => t.value === rowTipo)?.label : null;
                const formaPgto = paymentMethods.find((m: any) => m.id === item.payment_method_id);
                const contaBanc = bankAccounts.find((b: any) => b.id === item.bank_account_id);
                // Subcategoria options: only leaf nodes of the selected tipo
                const subcatOptions = rowTipo
                  ? categoriasFinanceiras
                      .filter((c: any) => c.tipo === rowTipo)
                      .filter((c: any) => !allCategoriasFin.some((child: any) => child.categoria_pai_id === c.id))
                  : [];
                return (
                  <TableRow key={item.id} className={isNearDue ? "bg-amber-500/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelectItem(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium truncate text-sm">{item.supplier_name || "—"}</TableCell>
                    <TableCell className="truncate">
                      <div>
                        <span className="text-sm">{item.description}</span>
                        {item.installment_total > 1 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({item.installment_number}/{item.installment_total})
                          </span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="font-medium text-sm">{formatCurrency(item.amount)}</TableCell>
                    <TableCell>
                      <span className={`text-sm ${isNearDue ? "text-amber-600 font-medium" : ""}`}>
                        {format(dueDate, "dd/MM/yyyy")}
                      </span>
                    </TableCell>
                    {/* Tipo Financeiro dropdown */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="flex items-center gap-1 text-sm cursor-pointer hover:text-foreground transition-colors group w-full">
                            <span className="truncate">{tipoFinLabel || <span className="text-muted-foreground/50">Selecionar</span>}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="max-h-[260px] overflow-y-auto custom-scrollbar">
                          {tiposFinanceiros.map((t) => (
                            <DropdownMenuItem
                              key={t.value}
                              title={t.tooltip}
                              onClick={() => {
                                // Set inline tipo and clear subcategoria if tipo changed
                                setInlineTipoMap(prev => ({ ...prev, [item.id]: t.value }));
                                if (catFin?.tipo !== t.value) {
                                  updateMutation.mutate({ id: item.id, data: { categoria_financeira_id: null } });
                                }
                              }}
                            >
                              {t.label}
                            </DropdownMenuItem>
                          ))}
                          {rowTipo && (
                            <DropdownMenuItem onClick={() => {
                              setInlineTipoMap(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                              updateMutation.mutate({ id: item.id, data: { categoria_financeira_id: null } });
                            }} className="text-muted-foreground">
                              Limpar
                            </DropdownMenuItem>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    {/* Subcategoria dropdown - locked until tipo selected, shows only leaf nodes */}
                    <TableCell>
                      {!rowTipo ? (
                        <span className="text-sm text-muted-foreground/30">Selecione o tipo...</span>
                      ) : (
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
                                  setInlineTipoMap(prev => { const n = { ...prev }; delete n[item.id]; return n; });
                                }}
                              >
                                {c.nome}
                              </DropdownMenuItem>
                            ))}
                            {subcatOptions.length === 0 && (
                              <DropdownMenuItem disabled className="text-muted-foreground text-xs">
                                Nenhuma subcategoria cadastrada
                              </DropdownMenuItem>
                            )}
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
                      )}
                    </TableCell>
                    {/* Forma Pagamento dropdown */}
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
                            <DropdownMenuItem
                              key={m.id}
                              onClick={() => updateMutation.mutate({ id: item.id, data: { payment_method_id: m.id } })}
                            >
                              {m.nome}
                            </DropdownMenuItem>
                          ))}
                          {formaPgto && (
                            <DropdownMenuItem onClick={() => updateMutation.mutate({ id: item.id, data: { payment_method_id: null } })} className="text-muted-foreground">
                              Limpar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setFpEditingId(null); setFpModalOpen(true); }} className="text-primary">
                            <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova forma de pagamento
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                    {/* Conta Bancária dropdown */}
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
                            <DropdownMenuItem
                              key={b.id}
                              onClick={() => updateMutation.mutate({ id: item.id, data: { bank_account_id: b.id } })}
                            >
                              {b.nome}
                            </DropdownMenuItem>
                          ))}
                          {contaBanc && (
                            <DropdownMenuItem onClick={() => updateMutation.mutate({ id: item.id, data: { bank_account_id: null } })} className="text-muted-foreground">
                              Limpar
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => { setCbEditingId(null); setCbModalOpen(true); }} className="text-primary">
                            <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova conta bancária
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
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
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="rounded-lg">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {item.status === "pending" && (
                            <DropdownMenuItem onClick={() => openPaymentDialog(item.id)}>
                              <Banknote className="w-4 h-4 mr-2" /> Registrar Pagamento
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
                          <DropdownMenuItem onClick={() => setDeleteId(item.id)} className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>Informe os dados do pagamento</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {paymentIsOverdue && (() => {
              const item = payables.find((p: any) => p.id === payingId);
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
                      value={paymentValueChanged}
                      onValueChange={(v) => {
                        setPaymentValueChanged(v);
                        if (v === "nao") setPaymentJurosMulta(0);
                      }}
                      className="flex gap-4"
                    >
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="sim" id="val-sim" />
                        <label htmlFor="val-sim" className="text-sm cursor-pointer">Sim</label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="nao" id="val-nao" />
                        <label htmlFor="val-nao" className="text-sm cursor-pointer">Não</label>
                      </div>
                    </RadioGroup>
                  </div>
                  {paymentValueChanged === "sim" && (
                    <CurrencyInput
                      label="Juros/Multa"
                      value={paymentJurosMulta}
                      onValueChange={setPaymentJurosMulta}
                      error={paymentJurosMulta <= 0 ? "Informe o valor de juros/multa" : undefined}
                    />
                  )}
                </div>
              );
            })()}

            <DateInput label="Data do pagamento" value={paymentDate} onValueChange={setPaymentDate} />
            <ManagedSelectInput
              label="Conta bancária"
              value={paymentBankAccount}
              onValueChange={setPaymentBankAccount}
              options={bankAccounts.map((b: any) => ({ value: b.id, label: `${b.nome}${b.banco ? ` - ${b.banco}` : ""}` }))}
              placeholder="Selecione a conta..."
              icon={<Landmark className="w-4 h-4" />}
              onAddModal={() => { setCbEditingId(null); setCbModalOpen(true); }}
              onEditModal={(id) => { setCbEditingId(id); setCbModalOpen(true); }}
              onDelete={contasCrud.onDelete}
              addLabel="Nova conta bancária"
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)} className="rounded-lg">Cancelar</Button>
              <Button
                onClick={handlePaymentSubmit}
                disabled={paymentMutation.isPending || (paymentIsOverdue && !paymentValueChanged) || (paymentValueChanged === "sim" && paymentJurosMulta <= 0)}
                className="rounded-lg gap-2"
              >
                {paymentMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Confirmar Pagamento
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Form */}
      <FormModal
        open={showForm}
        onOpenChange={(open) => {
          if (!open && !scanning) resetForm();
          else setShowForm(true);
        }}
        title={editingId ? "Editar Conta" : "Nova Conta a Pagar"}
        description="Preencha os dados da despesa"
        size="md"
        preventOutsideClose
      >
        <div className="space-y-4">
          {/* Scanner de Boleto */}
          {!editingId && (
            <div>
              <button
                type="button"
                onClick={() => {
                  setIsPickingScanFile(true);
                  window.setTimeout(() => scanInputRef.current?.click(), 0);
                }}
                disabled={scanning}
                className="flex items-center gap-3 w-full p-4 rounded-xl border-2 border-dashed border-primary/30 bg-primary/[0.03] hover:bg-primary/[0.06] hover:border-primary/50 transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-wait"
              >
                {scanning ? (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Loader2 className="w-5 h-5 text-primary animate-spin" />
                  </div>
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <ScanLine className="w-5 h-5 text-primary" />
                  </div>
                )}
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground">
                    {scanning ? "Analisando boleto com IA..." : "Escanear Boleto (PDF/Imagem)"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {scanning ? "Extraindo valor, vencimento, fornecedor..." : "Preenche os dados automaticamente a partir do boleto"}
                  </p>
                </div>
              </button>
            </div>
          )}

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
                <Receipt className="w-4 h-4" />
                Pessoa Física
              </label>
            </RadioGroup>
          </div>

          {/* Título */}
          <TextInput label="Título da despesa" placeholder="Ex: Aluguel do escritório" value={form.description} onChange={(e) => updateField("description", e.target.value)} error={errors.description} />

          {/* Fornecedor */}
          <ManagedSelectInput
            label="Fornecedor"
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
          />

          {/* CNPJ/CPF do fornecedor selecionado */}
          {(() => {
            const forn = form.supplier_id ? fornecedores.find((f: any) => f.id === form.supplier_id) : null;
            const isPj = forn ? forn.tipo === "pj" : form.pessoa_tipo === "pj";
            const docLabel = isPj ? "CNPJ" : "CPF";
            const doc = forn ? (isPj ? forn.cnpj : forn.cpf) : null;
            const formatted = doc
              ? isPj
                ? doc.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5")
                : doc.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4")
              : "";
            return (
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-foreground">{docLabel} do Fornecedor</label>
                <div className="flex h-10 w-full items-center rounded-lg border border-input bg-muted/30 px-3 py-2 text-sm text-muted-foreground cursor-not-allowed">
                  {formatted || <span className="text-muted-foreground/50">Selecione um fornecedor</span>}
                </div>
              </div>
            );
          })()}


          <TextInput label="Nº Documento" placeholder="NF, boleto, recibo..." value={form.document_number} onChange={(e) => updateField("document_number", e.target.value)} icon={<FileText className="w-4 h-4" />} />

          {/* Valor */}
          <CurrencyInput label="Valor" value={form.amount} onValueChange={(v) => updateField("amount", v)} error={errors.amount} />

          {/* Vencimento */}
          <DateInput label="Vencimento" value={form.due_date} onValueChange={(d) => updateField("due_date", d)} error={errors.due_date} />

          {/* Separador com label */}
          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Classificação</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          {/* Tipo Financeiro */}
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

          {/* Subcategoria Financeira (Plano de Contas / DRE) */}
          <ManagedSelectInput
            label="Subcategoria (Plano de Contas)"
            value={form.categoria_financeira_id}
            onValueChange={(v) => updateField("categoria_financeira_id", v)}
            options={(() => {
              const filtered = categoriasFinanceiras.filter((c: any) => !form.tipo_financeiro || c.tipo === form.tipo_financeiro);
              // Leaf = not a parent of any other category (using full hierarchy across all empresas)
              return filtered
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

          {/* Centro de Custo */}
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

          {/* Conta Bancária */}
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

          {/* Forma de Pagamento */}
          <ManagedSelectInput
            label="Forma de Pagamento"
            value={form.payment_method_id}
            onValueChange={(v) => updateField("payment_method_id", v)}
            options={paymentMethods.map((p: any) => ({ value: p.id, label: p.nome }))}
            placeholder="Selecione a forma..."
            icon={<CreditCard className="w-4 h-4" />}
            onAddModal={() => { setFpEditingId(null); setFpModalOpen(true); }}
            onEditModal={(id) => { setFpEditingId(id); setFpModalOpen(true); }}
            onDelete={formasCrud.onDelete}
            addLabel="Nova forma de pagamento"
          />

          {/* Modo de Pagamento */}
          {!editingId && (
            <>
              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-border/30" />
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Modo de Pagamento</span>
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
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground">Quantidade de ocorrências</label>
                    <Input
                      type="number"
                      min={1}
                      max={120}
                      value={form.recurrence_count}
                      onChange={(e) => updateField("recurrence_count", parseInt(e.target.value) || 1)}
                    />
                    {form.amount > 0 && form.recurrence_count > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {form.recurrence_count}x de {formatCurrency(form.amount / 100)}
                      </p>
                    )}
                  </div>
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

          {/* Extras */}
          <div className="flex items-center gap-3 pt-1">
            <div className="h-px flex-1 bg-border/30" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Extras</span>
            <div className="h-px flex-1 bg-border/30" />
          </div>

          <TextareaInput label="Observações" placeholder="Informações adicionais sobre esta despesa..." value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />

          <FileAttachment value={form.attachment_url} onValueChange={(url) => updateField("attachment_url", url)} folder="contas-pagar" />

          {/* Ações */}
          <div className="flex justify-end gap-3 pt-3 border-t border-border/20">
            <Button variant="outline" onClick={resetForm} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isPending} className="rounded-lg gap-2 shadow-sm">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingId ? "Salvar Alterações" : "Criar Conta"}
            </Button>
          </div>
        </div>
      </FormModal>

      <input
        ref={scanInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp"
        onChange={handleScanBoleto}
        className="hidden"
      />

      {/* Entity modals */}
      <CategoriaCadastroModal
        open={catModalOpen}
        onOpenChange={setCatModalOpen}
        editingId={catEditingId}
        onSaved={(id) => updateField("category_id", id)}
      />
      <CategoriaFinanceiraModal
        open={cfModalOpen}
        onOpenChange={setCfModalOpen}
        editingId={cfEditingId}
        defaultTipo="despesa"
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
      <FornecedorModal
        open={fornModalOpen}
        onOpenChange={setFornModalOpen}
        editingId={fornEditingId}
        prefill={fornPrefill}
        onSaved={async (id) => {
          await queryClient.invalidateQueries({ queryKey: ["fornecedores"] });
          // Wait for refetch to complete so the select options include the new supplier
          await queryClient.refetchQueries({ queryKey: ["fornecedores", empresaId] });
          updateField("supplier_id", id);
          // Also set supplier_name from prefill if available
          if (fornPrefill?.nome) {
            updateField("supplier_name", fornPrefill.nome);
          }
        }}
      />

      <BulkBoletoScanner
        open={bulkScanOpen}
        onOpenChange={setBulkScanOpen}
        fornecedores={fornecedores}
        categoriasFinanceiras={categoriasFinanceiras}
        centrosCusto={costCenters}
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
                      <p className="text-xs text-primary mt-1.5">Clique para ver detalhes →</p>
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

      {/* Duplicate detail modal */}
      <Dialog open={!!dupDetailItem} onOpenChange={(open) => { if (!open) setDupDetailItem(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-lg">Detalhes da Conta Existente</DialogTitle>
            <DialogDescription>Informações completas do registro encontrado.</DialogDescription>
          </DialogHeader>
          {dupDetailItem && (() => {
            const d = dupDetailItem;
            const cfg = statusConfig[d.status] || statusConfig.pending;
            const forn = d.supplier_id ? fornecedores.find((f: any) => f.id === d.supplier_id) : null;
            const cat = d.category_id ? categories.find((c: any) => c.id === d.category_id) : null;
            const cc = d.cost_center_id ? costCenters.find((c: any) => c.id === d.cost_center_id) : null;
            const ba = d.bank_account_id ? bankAccounts.find((b: any) => b.id === d.bank_account_id) : null;
            const pm = d.payment_method_id ? paymentMethods.find((p: any) => p.id === d.payment_method_id) : null;
            const fornName = forn ? (forn.tipo === "pj" ? (forn.nome_fantasia || forn.razao_social) : forn.nome_completo) : d.supplier_name;
            const fornDoc = forn ? (forn.tipo === "pj" ? forn.cnpj : forn.cpf) : null;

            const rows: [string, string | null | undefined][] = [
              ["Descrição", d.description],
              ["Status", cfg.label],
              ["Valor", `R$ ${Number(d.amount).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`],
              ["Vencimento", d.due_date ? format(new Date(d.due_date), "dd/MM/yyyy") : null],
              ["Fornecedor", fornName],
              ["Documento (Fornecedor)", fornDoc],
              ["Nº Documento", d.document_number],
              ["Categoria", cat?.nome],
              ["Centro de Custo", cc?.nome],
              ["Conta Bancária", ba?.nome],
              ["Forma de Pagamento", pm?.nome],
              ["Parcela", d.installment_total > 1 ? `${d.installment_number}/${d.installment_total}` : null],
              ["Observações", d.notes],
              ["Criado em", d.created_at ? format(new Date(d.created_at), "dd/MM/yyyy HH:mm") : null],
            ];

            return (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {rows.map(([label, value]) => value ? (
                  <div key={label} className="flex justify-between gap-4 py-1.5 border-b border-border/20 last:border-0">
                    <span className="text-sm text-muted-foreground shrink-0">{label}</span>
                    <span className="text-sm font-medium text-foreground text-right">{value}</span>
                  </div>
                ) : null)}
              </div>
            );
          })()}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => setDupDetailItem(null)} className="rounded-lg">Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta a pagar?</AlertDialogTitle>
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
    </div>
  );
}
