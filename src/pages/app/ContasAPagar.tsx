import { useState, useMemo, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmpresa } from "@/hooks/useEmpresa";
import {
  Receipt, Plus, Check, Loader2, AlertTriangle, Clock, Ban,
  FileText, Search, CreditCard,
  Building2, Target, Landmark, FolderTree, Copy, Pencil, Trash2,
  Banknote, ChevronDown, ChevronRight, ScanLine, MoreHorizontal, BarChart3, Layers, Eye,
  Calendar, CalendarDays, Users,
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
import { InlineManagedCell } from "@/components/inputs/InlineManagedCell";
import { CategoriaTreeSelect } from "@/components/inputs/CategoriaTreeSelect";
import { CategoriaTreeField } from "@/components/inputs/CategoriaTreeField";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { FileAttachment } from "@/components/inputs/FileAttachment";

import { useManagedSelect } from "@/hooks/useManagedSelect";
import { CategoriaCadastroModal } from "@/components/modals/CategoriaCadastroModal";
import { CategoriaFinanceiraModal } from "@/components/modals/CategoriaFinanceiraModal";
import { CentroCustoModal } from "@/components/modals/CentroCustoModal";
import { BusinessUnitModal } from "@/components/modals/BusinessUnitModal";
import { useBusinessUnits } from "@/hooks/useBusinessUnits";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";
import { useBankAccountOptions } from "@/hooks/useBankAccountOptions";
import { FormaPagamentoModal } from "@/components/modals/FormaPagamentoModal";
import { FornecedorModal, type FornecedorPrefill } from "@/components/modals/FornecedorModal";
import { ClienteModal } from "@/components/modals/ClienteModal";
import { BulkBoletoScanner } from "@/components/BulkBoletoScanner";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenericImporter } from "@/components/financas/importacoes/GenericImporter";
import { ImportsHistoryTargeted } from "@/components/financas/importacoes/ImportsHistoryTargeted";
import { useAuth } from "@/hooks/useAuth";
import { refreshQueries } from "@/lib/query-refresh";
import {
  fetchAccountsPayable, createAccountPayable, updateAccountPayable,
  countAccountsPayable, registerPayment, deleteAccountPayable, type AccountPayableInsert
} from "@/lib/accounts-payable-helpers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isPast, addDays, isBefore } from "date-fns";
import { QuickListModal } from "@/components/financas/QuickListModal";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { OfertaCriarRegraModal } from "@/components/financas/extrato/OfertaCriarRegraModal";
import { DescricaoComRegra } from "@/components/financas/extrato/DescricaoComRegra";

type PaymentMode = "avista" | "parcelado" | "recorrente" | "sazonal";

interface PayableForm {
  description: string;
  supplier_id: string;
  supplier_name: string;
  socio_id: string;
  document_number: string;
  amount: number;
  due_date?: Date;
  category_id: string;
  tipo_financeiro: string;
  categoria_financeira_id: string;
  cost_center_id: string;
  business_unit_id?: string;
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
  socio_id: "",
  document_number: "",
  amount: 0,
  due_date: undefined,
  category_id: "",
  tipo_financeiro: "",
  categoria_financeira_id: "",
  cost_center_id: "",
  business_unit_id: "",
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
  { value: "distribuicao_lucros", label: "👥 Distribuição de Lucros", tooltip: "Distribuição de lucros/dividendos aos sócios. Aparece após o Lucro Líquido (não impacta EBITDA nem Lucro Líquido)." },
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
  const [ofertaRegra, setOfertaRegra] = useState<{
    open: boolean;
    descricoes: string[];
    categoriaId: string;
    categoriaNome?: string;
  }>({ open: false, descricoes: [], categoriaId: "" });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("open");
  const [searchParams, setSearchParams] = useSearchParams();
  // Filtro vindo do banner do Dashboard (?filtro=sem-conta) — pagamentos sem conta vinculada
  useEffect(() => {
    if (searchParams.get("filtro") === "sem-conta") {
      setFilterStatus("sem-conta");
      const next = new URLSearchParams(searchParams);
      next.delete("filtro");
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  const businessUnitsCrud = useManagedSelect("business_units");
  const contasCrud = useManagedSelect("contas_bancarias");
  const formasCrud = useManagedSelect("formas_pagamento");
  const catFinCrud = useManagedSelect("categorias_financeiras");

  // Entity modal states
  const [catModalOpen, setCatModalOpen] = useState(false);
  const [catEditingId, setCatEditingId] = useState<string | null>(null);
  const [ccModalOpen, setCcModalOpen] = useState(false);
  const [ccEditingId, setCcEditingId] = useState<string | null>(null);
  const [buModalOpen, setBuModalOpen] = useState(false);
  const [buEditingId, setBuEditingId] = useState<string | null>(null);
  const { businessUnits } = useBusinessUnits();
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
  const [cliEditingId, setCliEditingId] = useState<string | null>(null);
  const [cliModalOpen, setCliModalOpen] = useState(false);
  const [scopeDialogItem, setScopeDialogItem] = useState<any | null>(null);
  const [editScope, setEditScope] = useState<"single" | "group">("single");
  const [quickListMode, setQuickListMode] = useState<"overdue" | "nearDue" | "thisMonth" | "nextMonth" | null>(null);
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

  const { data: socios = [] } = useQuery({
    queryKey: ["empresa_socios", empresaId],
    queryFn: async () => {
      if (!empresaId) return [];
      const { data } = await supabase
        .from("empresa_socios")
        .select("id, nome_completo, cargo, ativo")
        .eq("empresa_id", empresaId)
        .eq("ativo", true)
        .order("nome_completo");
      return data ?? [];
    },
    enabled: !!empresaId,
  });

  const socioOptions = socios.map((s: any) => ({
    value: s.id,
    label: s.cargo ? `${s.nome_completo} — ${s.cargo}` : s.nome_completo,
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

  // Espelha 100% o cadastro (Configurações > Financeiro > Contas Bancárias/Cartões)
  const { options: bankAccountOptions } = useBankAccountOptions();
  const bankAccounts = useMemo(
    () => bankAccountOptions.map((b) => ({
      id: b.id,
      nome: b.primaryLabel,
      banco: b.secondaryLabel,
    })),
    [bankAccountOptions]
  );

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
    mutationFn: async ({ id, data, scope }: { id: string; data: any; scope?: "single" | "group" }) => {
      if (scope === "group") {
        const { data: rec } = await supabase.from("accounts_payable").select("grupo_id").eq("id", id).maybeSingle();
        if (rec?.grupo_id) {
          const { due_date, installment_number, installment_total, ...groupSafe } = data;
          const { data: siblings } = await supabase.from("accounts_payable").select("id").eq("grupo_id", rec.grupo_id);
          for (const s of (siblings ?? [])) {
            await updateAccountPayable(s.id, s.id === id ? data : groupSafe);
          }
          return;
        }
      }
      await updateAccountPayable(id, data);
    },
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
    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        scope: editScope,
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
          business_unit_id: form.business_unit_id || null,
          bank_account_id: form.bank_account_id || null,
          payment_method_id: form.payment_method_id || null,
          is_recurring: form.is_recurring,
          recurrence_interval: form.is_recurring && form.recurrence_interval ? form.recurrence_interval : null,
          notes: form.notes || null,
          pessoa_tipo: form.pessoa_tipo,
          attachment_url: form.attachment_url,
          ...(({ socio_id: form.socio_id || null }) as any),
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
      ...(form.socio_id ? { socio_id: form.socio_id } : {}),
      document_number: form.document_number || null,
      amount: totalAmount,
      due_date: form.due_date!.toISOString().split("T")[0],
      category_id: form.category_id || null,
      categoria_financeira_id: form.categoria_financeira_id || null,
      cost_center_id: form.cost_center_id || null,
      business_unit_id: form.business_unit_id || null,
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
      supplier_id: item.supplier_id || "",
      supplier_name: item.supplier_name || "",
      socio_id: item.socio_id || "",
      document_number: item.document_number || "",
      amount: Math.round(item.amount * 100),
      due_date: new Date(item.due_date),
      category_id: item.category_id || "",
      tipo_financeiro: catFin?.tipo || "",
      categoria_financeira_id: item.categoria_financeira_id || "",
      cost_center_id: item.cost_center_id || "",
      business_unit_id: item.business_unit_id || "",
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
    try {
      await deleteAccountPayable(id);
    } catch (error: any) {
      toast.error(error?.message || "Erro ao excluir");
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
    // Captura descrições antes de limpar a seleção (para oferta de regra)
    const selecionadas = filtered.filter((p: any) => ids.includes(p.id));
    for (const id of ids) {
      await updateAccountPayable(id, data);
    }
    setSelectedIds(new Set());
    await refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]]);
    toast.success(`${ids.length} conta(s) atualizada(s)!`);

    // Se foi categorização em massa de 2+ itens, oferece criar regra
    if (
      Object.prototype.hasOwnProperty.call(data, "categoria_financeira_id") &&
      data.categoria_financeira_id &&
      selecionadas.length >= 2
    ) {
      const cat = categoriasFinanceiras.find((c: any) => c.id === data.categoria_financeira_id);
      setOfertaRegra({
        open: true,
        descricoes: selecionadas.map((p: any) => p.description || "").filter(Boolean),
        categoriaId: data.categoria_financeira_id,
        categoriaNome: cat?.nome,
      });
    }
  };

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [bulkCancelOpen, setBulkCancelOpen] = useState(false);

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    let ok = 0, fail = 0;
    for (const id of ids) {
      try { await deleteAccountPayable(id); ok++; } catch { fail++; }
    }
    setSelectedIds(new Set());
    setBulkDeleteOpen(false);
    await refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]]);
    if (fail === 0) toast.success(`${ok} conta(s) excluída(s)`);
    else toast.warning(`${ok} excluída(s), ${fail} falharam`);
  };

  const handleBulkCancel = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    for (const id of ids) {
      await updateAccountPayable(id, { status: "cancelled" as any, payment_date: null });
    }
    setSelectedIds(new Set());
    setBulkCancelOpen(false);
    await refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]]);
    toast.success(`${ids.length} conta(s) cancelada(s)`);
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

  const requestEditAccount = (item: any) => {
    const isParcelado = (item.installment_total || 1) > 1 && !!item.grupo_id;
    if (isParcelado) { setScopeDialogItem(item); return; }
    setEditScope("single");
    handleEdit(item);
  };
  const confirmScopeAndEdit = (scope: "single" | "group") => {
    setEditScope(scope);
    if (scopeDialogItem) {
      const item = scopeDialogItem;
      setScopeDialogItem(null);
      handleEdit(item);
    }
  };
  const handleEditEntityFromRow = (item: any) => {
    if (item.cliente_id) { setCliEditingId(item.cliente_id); setCliModalOpen(true); }
    else if (item.supplier_id) { setFornEditingId(item.supplier_id); setFornPrefill(null); setFornModalOpen(true); }
  };

  const handleDuplicate = (item: any) => {
    setEditingId(null);
    const catFin2 = categoriasFinanceiras.find((c: any) => c.id === item.categoria_financeira_id);
    setForm({
      description: item.description,
      supplier_id: item.supplier_id || "",
      supplier_name: item.supplier_name || "",
      socio_id: item.socio_id || "",
      document_number: "",
      amount: Math.round(item.amount * 100),
      due_date: undefined,
      category_id: item.category_id || "",
      tipo_financeiro: catFin2?.tipo || "",
      categoria_financeira_id: item.categoria_financeira_id || "",
      cost_center_id: item.cost_center_id || "",
      business_unit_id: item.business_unit_id || "",
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
    // Considera vencida só a partir do 1º dia útil após o vencimento (pula sáb/dom)
    const nextBusinessDay = (d: Date) => {
      const x = new Date(d); x.setDate(x.getDate() + 1);
      while (x.getDay() === 0 || x.getDay() === 6) x.setDate(x.getDate() + 1);
      return x;
    };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const dueDate = item ? new Date(item.due_date) : null;
    const overdueSince = dueDate ? nextBusinessDay(dueDate) : null;
    const isOverdue = item && (item.status === "overdue" || (item.status === "pending" && overdueSince && today >= overdueSince));
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
    } else if (filterStatus === "sem-conta") {
      list = list.filter((p: any) => p.status === "paid" && !p.bank_account_id);
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
  const today = useMemo(() => new Date(new Date().toDateString()), []);
  const overdueItems = useMemo(() => {
    return payables.filter((p: any) => {
      if (p.status === "paid" || p.status === "cancelled") return false;
      const due = new Date(p.due_date + "T00:00:00");
      return due < today;
    });
  }, [payables, today]);
  const nearDueItems = useMemo(() => {
    const limit = addDays(today, 7);
    return payables.filter((p: any) => {
      if (p.status !== "pending") return false;
      const due = new Date(p.due_date + "T00:00:00");
      return due >= today && due <= limit;
    });
  }, [payables, today]);
  const thisMonthItems = useMemo(() => {
    const y = today.getFullYear(); const m = today.getMonth();
    return payables.filter((p: any) => {
      if (p.status !== "pending") return false;
      const due = new Date(p.due_date + "T00:00:00");
      return due >= today && due.getFullYear() === y && due.getMonth() === m;
    });
  }, [payables, today]);
  const nextMonthItems = useMemo(() => {
    const y = today.getFullYear(); const m = today.getMonth();
    const ny = m === 11 ? y + 1 : y; const nm = (m + 1) % 12;
    return payables.filter((p: any) => {
      if (p.status !== "pending") return false;
      const due = new Date(p.due_date + "T00:00:00");
      return due.getFullYear() === ny && due.getMonth() === nm;
    });
  }, [payables, today]);
  const sumAmount = (arr: any[]) => arr.reduce((s, i) => s + Number(i.amount || 0), 0);
  const overdueAmount = sumAmount(overdueItems);
  const nearDueAmount = sumAmount(nearDueItems);
  const thisMonthAmount = sumAmount(thisMonthItems);
  const nextMonthAmount = sumAmount(nextMonthItems);
  const nearDue = nearDueItems.length;
  const overdueCount = overdueItems.length;

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


      <Tabs defaultValue="lista" className="space-y-6">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="importacoes">Importações</TabsTrigger>
        </TabsList>

        <TabsContent value="lista" className="space-y-6 mt-4">

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
              {/* Bulk: Tipo Financeiro — removido (a árvore já filtra por direção) */}
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

              {/* Bulk: Cancelar */}
              <Button size="sm" variant="outline" className="rounded-lg text-xs gap-1" onClick={() => setBulkCancelOpen(true)}>
                <Ban className="w-3 h-3" /> Cancelar
              </Button>

              {/* Bulk: Excluir */}
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
                <TableHead style={{ minWidth: 110 }}>Vencimento</TableHead>
                <TableHead style={{ minWidth: 180 }}>Fornecedor</TableHead>
                <TableHead style={{ minWidth: 220 }}>Descrição</TableHead>
                <TableHead style={{ minWidth: 110 }}>Valor</TableHead>
                <TableHead style={{ minWidth: 120 }}>Status</TableHead>
                <TableHead style={{ minWidth: 220 }}>Subcategoria</TableHead>
                <TableHead style={{ minWidth: 160 }}>Centro de Custo</TableHead>
                <TableHead style={{ minWidth: 160 }}>Unidade de Negócio</TableHead>
                <TableHead style={{ minWidth: 180 }}>Forma Pagamento</TableHead>
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
                  const tipoFinLabel = rowTipo ? tiposFinanceiros.find(t => t.value === rowTipo)?.label : null;
                  const formaPgto = paymentMethods.find((m: any) => m.id === item.payment_method_id);
                  const contaBanc = bankAccounts.find((b: any) => b.id === item.bank_account_id);
                  const subcatOptions = rowTipo
                    ? categoriasFinanceiras
                        .filter((c: any) => c.tipo === rowTipo)
                        .filter((c: any) => !allCategoriasFin.some((child: any) => child.categoria_pai_id === c.id))
                    : [];
                  return (
                    <TableRow key={item.id} className={`${rowBg} ${opts.isChild ? "bg-muted/20" : ""}`}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(item.id)}
                          onCheckedChange={() => toggleSelectItem(item.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <span className={`text-sm ${dueColor}`}>
                          {format(dueDate, "dd/MM/yyyy")}
                        </span>
                      </TableCell>
                      <TableCell className="font-medium truncate text-sm">
                        {opts.isChild ? (
                          <span className="text-muted-foreground/60 ml-6">↳</span>
                        ) : (item.cliente_id || item.supplier_id) ? (
                          <button type="button" onClick={() => handleEditEntityFromRow(item)} className="text-left hover:text-primary hover:underline transition-colors truncate max-w-full" title="Editar cadastro">
                            {item.supplier_name || "—"}
                          </button>
                        ) : (item.supplier_name || "—")}
                      </TableCell>
                      <TableCell className="truncate">
                        <button type="button" onClick={() => requestEditAccount(item)} className="text-left w-full hover:text-primary transition-colors group/edit" title="Editar conta">
                          <div className={opts.isChild ? "pl-4" : ""}>
                            <DescricaoComRegra
                              description={item.description}
                              categoriaId={item.categoria_financeira_id}
                              tipoSugerido="pagar"
                            >
                              <span className="text-sm group-hover/edit:underline">{item.description}</span>
                            </DescricaoComRegra>
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
                        <CategoriaTreeSelect
                          categorias={categoriasFinanceiras as any}
                          value={item.categoria_financeira_id}
                          onChange={(v) => updateMutation.mutate({ id: item.id, data: { categoria_financeira_id: v } })}
                          direction="out"
                          placeholder="Selecionar"
                          footerActions={
                            <button
                              type="button"
                              onClick={() => { setCfEditingId(null); setCfModalOpen(true); }}
                              className="text-xs text-primary hover:bg-primary/10 px-2 py-1.5 rounded-sm transition-colors flex items-center gap-1"
                            >
                              <Plus className="w-3 h-3" /> Nova
                            </button>
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <InlineManagedCell
                          value={item.cost_center_id}
                          options={costCenters.map((c: any) => ({ value: c.id, label: c.nome }))}
                          onChange={(v) => updateMutation.mutate({ id: item.id, data: { cost_center_id: v } })}
                          onAddModal={() => { setCcEditingId(null); setCcModalOpen(true); }}
                          onEditModal={(id) => { setCcEditingId(id); setCcModalOpen(true); }}
                          onDelete={centrosCrud.onDelete}
                          placeholder="Selecionar"
                          addLabel="Novo centro de custo"
                        />
                      </TableCell>
                      <TableCell>
                        <InlineManagedCell
                          value={item.business_unit_id}
                          options={businessUnits.map((u: any) => ({ value: u.id, label: u.nome }))}
                          onChange={(v) => updateMutation.mutate({ id: item.id, data: { business_unit_id: v } })}
                          onAddModal={() => { setBuEditingId(null); setBuModalOpen(true); }}
                          onEditModal={(id) => { setBuEditingId(id); setBuModalOpen(true); }}
                          onDelete={businessUnitsCrud.onDelete}
                          placeholder="Selecionar"
                          addLabel="Nova unidade de negócio"
                        />
                      </TableCell>
                      <TableCell>
                        <InlineManagedCell
                          value={item.payment_method_id}
                          options={paymentMethods.map((m: any) => ({ value: m.id, label: m.nome }))}
                          onChange={(v) => updateMutation.mutate({ id: item.id, data: { payment_method_id: v } })}
                          onAddModal={() => { setFpEditingId(null); setFpModalOpen(true); }}
                          onEditModal={(id) => { setFpEditingId(id); setFpModalOpen(true); }}
                          onDelete={formasCrud.onDelete}
                          placeholder="Selecionar"
                          addLabel="Nova forma de pagamento"
                        />
                      </TableCell>
                      <TableCell>
                        <InlineManagedCell
                          value={item.bank_account_id}
                          options={bankAccounts.map((b: any) => ({ value: b.id, label: b.nome }))}
                          onChange={(v) => updateMutation.mutate({ id: item.id, data: { bank_account_id: v } })}
                          onAddModal={() => { setCbEditingId(null); setCbModalOpen(true); }}
                          onEditModal={(id) => { setCbEditingId(id); setCbModalOpen(true); }}
                          onDelete={contasCrud.onDelete}
                          placeholder="Selecionar"
                          addLabel="Nova conta bancária"
                        />
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
                };

                const renderGroupParent = (groupId: string, parent: any, children: any[]) => {
                  const totalAmount = children.reduce((s, c) => s + Number(c.amount || 0), 0);
                  const paidCount = children.filter(c => c.status === "paid").length;
                  const overdueCount = children.filter(c => c.status === "overdue").length;
                  const pendingCount = children.filter(c => c.status === "pending").length;
                  const earliest = children.reduce((min, c) => c.due_date < min ? c.due_date : min, children[0].due_date);
                  const latest = children.reduce((max, c) => c.due_date > max ? c.due_date : max, children[0].due_date);
                  const groupKind = parent.is_recurring ? "Recorrente" : "Parcelado/Sazonal";
                  const isExpanded = expandedGroups.has(groupId);

                  // Aggregated status badge: prioridade overdue > pending > paid
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
                            aria-label={isExpanded ? "Recolher" : "Expandir"}
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
                        <TableCell colSpan={6}>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            {paidCount > 0 && <span><Check className="w-3 h-3 inline text-success" /> {paidCount} pagas</span>}
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
          <GenericImporter target="payable" onImported={() => refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]])} />
          <ImportsHistoryTargeted target="payable" onDeleted={() => refreshQueries(queryClient, [["accounts-payable"], ["accounts-payable-counts"]])} />
        </TabsContent>
      </Tabs>

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

          {/* Sócio beneficiário (opcional) — vem do Quadro Societário em Configurações > Empresa */}
          <ManagedSelectInput
            label="Sócio beneficiário (opcional)"
            value={form.socio_id}
            onValueChange={(v) => updateField("socio_id", v)}
            options={socioOptions}
            placeholder={socioOptions.length ? "Selecione um sócio..." : "Cadastre sócios em Configurações > Empresa"}
            icon={<Users className="w-4 h-4" />}
            
          />

          {/* Valor */}
          <CurrencyInput label="Valor" value={form.amount} onValueChange={(v) => updateField("amount", v)} error={errors.amount} />

          {/* Vencimento */}
          <DateInput label="Vencimento" value={form.due_date} onValueChange={(d) => updateField("due_date", d)} error={errors.due_date} />

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

          {/* Unidade de Negócio (DRE multioperação) */}
          <ManagedSelectInput
            label="Unidade de Negócio"
            value={form.business_unit_id || ""}
            onValueChange={(v) => updateField("business_unit_id" as any, v)}
            options={businessUnits.map((u) => ({ value: u.id, label: u.nome }))}
            placeholder="Selecione a unidade (opcional)..."
            icon={<Target className="w-4 h-4" />}
            onAddModal={() => { setBuEditingId(null); setBuModalOpen(true); }}
            onEditModal={(id) => { setBuEditingId(id); setBuModalOpen(true); }}
            onDelete={businessUnitsCrud.onDelete}
            addLabel="Nova unidade de negócio"
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
      <BusinessUnitModal
        open={buModalOpen}
        onOpenChange={setBuModalOpen}
        editingId={buEditingId}
        onSaved={(id) => updateField("business_unit_id" as any, id)}
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
          await queryClient.refetchQueries({ queryKey: ["fornecedores", empresaId] });
          updateField("supplier_id", id);
          if (fornPrefill?.nome) {
            updateField("supplier_name", fornPrefill.nome);
          }
        }}
      />

      <ClienteModal
        open={cliModalOpen}
        onOpenChange={(o) => { setCliModalOpen(o); if (!o) setCliEditingId(null); }}
        editingId={cliEditingId}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["clientes"] });
          await queryClient.invalidateQueries({ queryKey: ["accounts-payable", empresaId] });
        }}
      />

      {/* Scope dialog: edit single installment or full group */}
      <AlertDialog open={!!scopeDialogItem} onOpenChange={(o) => { if (!o) setScopeDialogItem(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-primary" />
              Editar parcelamento
            </AlertDialogTitle>
            <AlertDialogDescription>
              Esta conta faz parte de um parcelamento ({scopeDialogItem?.installment_total} parcelas).
              Deseja editar apenas esta parcela ou todas as parcelas do grupo?
              <br />
              <span className="text-xs text-muted-foreground mt-2 block">
                Ao editar todas, datas de vencimento e número da parcela permanecem individuais.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button variant="outline" onClick={() => confirmScopeAndEdit("single")}>
              Apenas esta parcela
            </Button>
            <AlertDialogAction onClick={() => confirmScopeAndEdit("group")}>
              Todas as parcelas
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            const paidAmount = children.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.amount || 0), 0);
            const pendingAmount = children.filter(c => c.status !== "paid" && c.status !== "cancelled").reduce((s, c) => s + Number(c.amount || 0), 0);
            const paidCount = children.filter(c => c.status === "paid").length;
            const overdueCount = children.filter(c => c.status === "overdue").length;
            const pendingCount = children.filter(c => c.status === "pending").length;
            const earliest = children.reduce((min, c) => c.due_date < min ? c.due_date : min, children[0].due_date);
            const latest = children.reduce((max, c) => c.due_date > max ? c.due_date : max, children[0].due_date);
            const groupKind = parent.is_recurring ? "Recorrente" : "Parcelado / Sazonal";
            const forn = parent.supplier_name || "—";
            const progress = totalAmount > 0 ? (paidAmount / totalAmount) * 100 : 0;

            return (
              <div className="overflow-y-auto custom-scrollbar space-y-5 pr-1">
                {/* Aggregated metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border border-border/40 bg-muted/20">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Tipo</p>
                    <p className="text-sm font-semibold mt-1">{groupKind}</p>
                  </div>
                  <div className="p-3 rounded-xl border border-border/40 bg-muted/20">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Fornecedor</p>
                    <p className="text-sm font-semibold mt-1 truncate">{forn}</p>
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

                {/* Totals */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-4 rounded-xl border border-primary/20 bg-primary/5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Valor total</p>
                    <p className="text-lg font-bold mt-1 text-primary">{formatCurrency(totalAmount)}</p>
                  </div>
                  <div className="p-4 rounded-xl border border-success/20 bg-success/5">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pago</p>
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

                {/* Progress bar */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-muted-foreground font-medium">Progresso de pagamento</span>
                    <span className="text-xs font-semibold">{progress.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-success transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>

                {/* Installments table */}
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
                          <TableHead>Pagamento</TableHead>
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

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {selectedIds.size} conta(s)?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é permanente. Contas com pagamento registrado podem não ser excluídas.</AlertDialogDescription>
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
            <AlertDialogDescription>O status será alterado para "Cancelado" e a data de pagamento será removida.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleBulkCancel}>
              Confirmar cancelamento
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <QuickListModal
        open={quickListMode !== null}
        onOpenChange={(o) => { if (!o) setQuickListMode(null); }}
        mode="payable"
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

      <OfertaCriarRegraModal
        open={ofertaRegra.open}
        onOpenChange={(v) => setOfertaRegra((p) => ({ ...p, open: v }))}
        descricoes={ofertaRegra.descricoes}
        categoriaId={ofertaRegra.categoriaId}
        categoriaNome={ofertaRegra.categoriaNome}
        tipoSugerido="pagar"
      />
    </div>
  );
}
