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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

interface PayableForm {
  description: string;
  supplier_id: string;
  supplier_name: string;
  document_number: string;
  amount: number;
  due_date?: Date;
  category_id: string;
  categoria_financeira_id: string;
  cost_center_id: string;
  bank_account_id: string;
  payment_method_id: string;
  installments: number;
  is_recurring: boolean;
  recurrence_interval: string;
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
  categoria_financeira_id: "",
  cost_center_id: "",
  bank_account_id: "",
  payment_method_id: "",
  installments: 1,
  is_recurring: false,
  recurrence_interval: "",
  notes: "",
  pessoa_tipo: "pj",
  attachment_url: null,
};

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
      let q = supabase.from("categorias_financeiras").select("id, nome, tipo").eq("ativo", true).order("ordem");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
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
      const { data } = await q;
      return data ?? [];
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

    // Create with installments
    const totalAmount = form.amount / 100;
    const installmentAmount = Math.round((totalAmount / form.installments) * 100) / 100;
    const records: AccountPayableInsert[] = [];

    for (let i = 0; i < form.installments; i++) {
      const dueDate = new Date(form.due_date!);
      dueDate.setMonth(dueDate.getMonth() + i);

      records.push({
        user_id: user!.id,
        empresa_id: empresaId || undefined,
        description: form.installments > 1 ? `${form.description} (${i + 1}/${form.installments})` : form.description,
        supplier_id: form.supplier_id || null,
        supplier_name: form.supplier_name || null,
        document_number: form.document_number || null,
        amount: i === form.installments - 1 ? totalAmount - installmentAmount * (form.installments - 1) : installmentAmount,
        due_date: dueDate.toISOString().split("T")[0],
        category_id: form.category_id || null,
        categoria_financeira_id: form.categoria_financeira_id || null,
        cost_center_id: form.cost_center_id || null,
        bank_account_id: form.bank_account_id || null,
        payment_method_id: form.payment_method_id || null,
        installment_number: i + 1,
        installment_total: form.installments,
        is_recurring: form.is_recurring,
        recurrence_interval: form.is_recurring && form.recurrence_interval ? form.recurrence_interval as any : null,
        notes: form.notes || null,
        pessoa_tipo: form.pessoa_tipo,
        attachment_url: form.attachment_url,
      });
    }

    createMutation.mutate(records);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      description: item.description,
      supplier_id: item.supplier_id || "",
      supplier_name: item.supplier_name || "",
      document_number: item.document_number || "",
      amount: Math.round(item.amount * 100),
      due_date: new Date(item.due_date),
      category_id: item.category_id || "",
      categoria_financeira_id: item.categoria_financeira_id || "",
      cost_center_id: item.cost_center_id || "",
      bank_account_id: item.bank_account_id || "",
      payment_method_id: item.payment_method_id || "",
      installments: item.installment_total || 1,
      is_recurring: item.is_recurring,
      recurrence_interval: item.recurrence_interval || "",
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
    const { error } = await supabase.from("accounts_payable").delete().eq("id", id);
    if (error) { toast.error("Erro ao excluir"); return; }
    queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
    queryClient.invalidateQueries({ queryKey: ["accounts-payable-counts"] });
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
    queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
    queryClient.invalidateQueries({ queryKey: ["accounts-payable-counts"] });
    toast.success(`${ids.length} conta(s) atualizada(s) para ${statusConfig[newStatus]?.label || newStatus}`);
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
    setForm({
      description: item.description,
      supplier_id: item.supplier_id || "",
      supplier_name: item.supplier_name || "",
      document_number: "",
      amount: Math.round(item.amount * 100),
      due_date: undefined,
      category_id: item.category_id || "",
      categoria_financeira_id: item.categoria_financeira_id || "",
      cost_center_id: item.cost_center_id || "",
      bank_account_id: item.bank_account_id || "",
      payment_method_id: item.payment_method_id || "",
      installments: 1,
      is_recurring: item.is_recurring,
      recurrence_interval: item.recurrence_interval || "",
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
          body: { file_base64: base64, file_type: file.type },
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
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">
              {selectedIds.size} item(ns) selecionado(s)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground mr-1">Alterar status para:</span>
              {Object.entries(statusConfig).filter(([key]) => key !== "cancelled").map(([key, cfg]) => (
                <Button
                  key={key}
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-xs gap-1"
                  onClick={() => handleBulkChangeStatus(key)}
                >
                  <cfg.icon className="w-3 h-3" />
                  {cfg.label}
                </Button>
              ))}
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
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[4%]">
                  <Checkbox
                    checked={filtered.length > 0 && selectedIds.size === filtered.length}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                <TableHead className="w-[18%]">Fornecedor</TableHead>
                <TableHead className="w-[23%]">Descrição</TableHead>
                <TableHead className="w-[11%]">Valor</TableHead>
                <TableHead className="w-[12%]">Vencimento</TableHead>
                <TableHead className="w-[14%]">Status</TableHead>
                <TableHead className="w-[8%] text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item: any) => {
                const dueDate = new Date(item.due_date);
                const isNearDue = item.status === "pending" && isBefore(dueDate, addDays(new Date(), 7)) && !isPast(dueDate);
                return (
                  <TableRow key={item.id} className={isNearDue ? "bg-amber-500/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={selectedIds.has(item.id)}
                        onCheckedChange={() => toggleSelectItem(item.id)}
                      />
                    </TableCell>
                    <TableCell className="font-medium truncate">{item.supplier_name || "—"}</TableCell>
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
                    <TableCell className="font-medium">{formatCurrency(item.amount)}</TableCell>
                    <TableCell>
                      <span className={isNearDue ? "text-amber-600 font-medium" : ""}>
                        {format(dueDate, "dd/MM/yyyy")}
                      </span>
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

          {/* Categoria */}
          <ManagedSelectInput
            label="Categoria"
            value={form.category_id}
            onValueChange={(v) => updateField("category_id", v)}
            options={categories.map((c: any) => ({ value: c.id, label: c.nome }))}
            placeholder="Selecione a categoria..."
            icon={<FolderTree className="w-4 h-4" />}
            onAddModal={() => { setCatEditingId(null); setCatModalOpen(true); }}
            onEditModal={(id) => { setCatEditingId(id); setCatModalOpen(true); }}
            onDelete={categoriasCrud.onDelete}
            onReorder={categoriasCrud.onReorder}
            addLabel="Nova categoria"
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

          {/* Parcelamento */}
          {!editingId && (
            <>
              <div className="flex items-center gap-3 pt-1">
                <div className="h-px flex-1 bg-border/30" />
                <span className="text-[11px] uppercase tracking-widest text-muted-foreground/60 font-medium">Parcelamento</span>
                <div className="h-px flex-1 bg-border/30" />
              </div>

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
                    {form.installments}x de {formatCurrency((form.amount / 100) / form.installments)}
                  </p>
                )}
                {errors.installments && <p className="text-xs text-destructive">{errors.installments}</p>}
              </div>

              <label className="flex items-center gap-2.5 cursor-pointer py-1">
                <input
                  type="checkbox"
                  checked={form.is_recurring}
                  onChange={(e) => updateField("is_recurring", e.target.checked)}
                  className="rounded border-input"
                />
                <span className="text-sm font-medium text-foreground">Conta recorrente</span>
              </label>
              {form.is_recurring && (
                <ManagedSelectInput
                  label="Intervalo de recorrência"
                  value={form.recurrence_interval}
                  onValueChange={(v) => updateField("recurrence_interval", v)}
                  options={[
                    { value: "weekly", label: "Semanal" },
                    { value: "monthly", label: "Mensal" },
                    { value: "yearly", label: "Anual" },
                  ]}
                  placeholder="Selecione..."
                />
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
