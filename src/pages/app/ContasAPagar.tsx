import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Receipt, Plus, Check, Loader2, AlertTriangle, Clock, Ban,
  FileText, Search, CreditCard,
  Building2, Target, Landmark, FolderTree, X, Copy, Pencil,
  Banknote, ChevronDown
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { FormModal } from "@/components/FormModal";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { CurrencyInput } from "@/components/inputs/CurrencyInput";
import { DateInput } from "@/components/inputs/DateInput";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";

import { useManagedSelect } from "@/hooks/useManagedSelect";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  fetchAccountsPayable, createAccountPayable, updateAccountPayable,
  countAccountsPayable, registerPayment, type AccountPayableInsert
} from "@/lib/accounts-payable-helpers";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, isPast, addDays, isBefore } from "date-fns";

interface PayableForm {
  description: string;
  supplier_name: string;
  document_number: string;
  amount: number; // in cents
  due_date?: Date;
  issue_date?: Date;
  category_id: string;
  cost_center_id: string;
  bank_account_id: string;
  payment_method_id: string;
  installments: number;
  is_recurring: boolean;
  recurrence_interval: string;
  notes: string;
}

const initialForm: PayableForm = {
  description: "",
  supplier_name: "",
  document_number: "",
  amount: 0,
  due_date: undefined,
  issue_date: undefined,
  category_id: "",
  cost_center_id: "",
  bank_account_id: "",
  payment_method_id: "",
  installments: 1,
  is_recurring: false,
  recurrence_interval: "",
  notes: "",
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: Clock },
  paid: { label: "Pago", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: Check },
  overdue: { label: "Vencido", color: "bg-red-500/10 text-red-600 border-red-200", icon: AlertTriangle },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border", icon: Ban },
};

export default function ContasAPagar() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<PayableForm>(initialForm);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [paymentBankAccount, setPaymentBankAccount] = useState("");
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());

  // Managed select hooks
  const categoriasCrud = useManagedSelect("categorias_financeiras", { insertDefaults: { tipo: "despesa" } });
  const centrosCrud = useManagedSelect("centros_custo");
  const contasCrud = useManagedSelect("contas_bancarias");
  const formasCrud = useManagedSelect("formas_pagamento");

  // Fetch data
  const { data: payables = [], isLoading } = useQuery({
    queryKey: ["accounts-payable"],
    queryFn: fetchAccountsPayable,
  });

  const { data: counts = { total: 0, pending: 0, overdue: 0, paid: 0 } } = useQuery({
    queryKey: ["accounts-payable-counts"],
    queryFn: countAccountsPayable,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categorias-financeiras"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias_financeiras").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: costCenters = [] } = useQuery({
    queryKey: ["centros-custo"],
    queryFn: async () => {
      const { data } = await supabase.from("centros_custo").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["contas-bancarias"],
    queryFn: async () => {
      const { data } = await supabase.from("contas_bancarias").select("id, nome, banco").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  const { data: paymentMethods = [] } = useQuery({
    queryKey: ["formas-pagamento"],
    queryFn: async () => {
      const { data } = await supabase.from("formas_pagamento").select("id, nome").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: createAccountPayable,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-payable-counts"] });
      toast.success(editingId ? "Conta atualizada!" : "Conta(s) criada(s) com sucesso!");
      resetForm();
    },
    onError: () => toast.error("Erro ao salvar conta"),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateAccountPayable(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-payable-counts"] });
      toast.success("Conta atualizada!");
      resetForm();
    },
    onError: () => toast.error("Erro ao atualizar conta"),
  });

  const paymentMutation = useMutation({
    mutationFn: ({ id, bankAccountId, paymentDate }: { id: string; bankAccountId: string; paymentDate: string }) =>
      registerPayment(id, bankAccountId, paymentDate, user!.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
      queryClient.invalidateQueries({ queryKey: ["accounts-payable-counts"] });
      toast.success("Pagamento registrado!");
      setShowPaymentDialog(false);
      setPayingId(null);
    },
    onError: () => toast.error("Erro ao registrar pagamento"),
  });

  const resetForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
    setErrors({});
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

  const handleSubmit = () => {
    if (!validate()) {
      toast.error("Corrija os campos destacados");
      return;
    }

    if (editingId) {
      updateMutation.mutate({
        id: editingId,
        data: {
          description: form.description,
          supplier_name: form.supplier_name || null,
          document_number: form.document_number || null,
          amount: form.amount / 100,
          due_date: form.due_date!.toISOString().split("T")[0],
          issue_date: form.issue_date ? form.issue_date.toISOString().split("T")[0] : null,
          category_id: form.category_id || null,
          cost_center_id: form.cost_center_id || null,
          bank_account_id: form.bank_account_id || null,
          payment_method_id: form.payment_method_id || null,
          is_recurring: form.is_recurring,
          recurrence_interval: form.is_recurring && form.recurrence_interval ? form.recurrence_interval : null,
          notes: form.notes || null,
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
        description: form.installments > 1 ? `${form.description} (${i + 1}/${form.installments})` : form.description,
        supplier_name: form.supplier_name || null,
        document_number: form.document_number || null,
        amount: i === form.installments - 1 ? totalAmount - installmentAmount * (form.installments - 1) : installmentAmount,
        due_date: dueDate.toISOString().split("T")[0],
        issue_date: form.issue_date ? form.issue_date.toISOString().split("T")[0] : null,
        category_id: form.category_id || null,
        cost_center_id: form.cost_center_id || null,
        bank_account_id: form.bank_account_id || null,
        payment_method_id: form.payment_method_id || null,
        installment_number: i + 1,
        installment_total: form.installments,
        is_recurring: form.is_recurring,
        recurrence_interval: form.is_recurring && form.recurrence_interval ? form.recurrence_interval as any : null,
        notes: form.notes || null,
      });
    }

    createMutation.mutate(records);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setForm({
      description: item.description,
      supplier_name: item.supplier_name || "",
      document_number: item.document_number || "",
      amount: Math.round(item.amount * 100),
      due_date: new Date(item.due_date),
      issue_date: item.issue_date ? new Date(item.issue_date) : undefined,
      category_id: item.category_id || "",
      cost_center_id: item.cost_center_id || "",
      bank_account_id: item.bank_account_id || "",
      payment_method_id: item.payment_method_id || "",
      installments: item.installment_total || 1,
      is_recurring: item.is_recurring,
      recurrence_interval: item.recurrence_interval || "",
      notes: item.notes || "",
    });
    setShowForm(true);
  };

  const handleCancel = async (id: string) => {
    await updateAccountPayable(id, { status: "cancelled" as any });
    queryClient.invalidateQueries({ queryKey: ["accounts-payable"] });
    queryClient.invalidateQueries({ queryKey: ["accounts-payable-counts"] });
    toast.success("Conta cancelada");
  };

  const handleDuplicate = (item: any) => {
    setEditingId(null);
    setForm({
      description: item.description,
      supplier_name: item.supplier_name || "",
      document_number: "",
      amount: Math.round(item.amount * 100),
      due_date: undefined,
      issue_date: undefined,
      category_id: item.category_id || "",
      cost_center_id: item.cost_center_id || "",
      bank_account_id: item.bank_account_id || "",
      payment_method_id: item.payment_method_id || "",
      installments: 1,
      is_recurring: item.is_recurring,
      recurrence_interval: item.recurrence_interval || "",
      notes: item.notes || "",
    });
    setShowForm(true);
  };

  const openPaymentDialog = (id: string) => {
    setPayingId(id);
    setPaymentBankAccount("");
    setPaymentDate(new Date());
    setShowPaymentDialog(true);
  };

  const handlePaymentSubmit = () => {
    if (!payingId || !paymentDate) return;
    paymentMutation.mutate({
      id: payingId,
      bankAccountId: paymentBankAccount || "",
      paymentDate: paymentDate.toISOString().split("T")[0],
    });
  };

  // Filter and search
  const filtered = useMemo(() => {
    let list = payables;
    if (filterStatus !== "all") list = list.filter((p: any) => p.status === filterStatus);
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

  const getStatusBadge = (status: string) => {
    const cfg = statusConfig[status] || statusConfig.pending;
    const Icon = cfg.icon;
    return (
      <Badge variant="outline" className={`${cfg.color} gap-1 font-medium`}>
        <Icon className="w-3 h-3" />
        {cfg.label}
      </Badge>
    );
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Contas a Pagar</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie suas despesas e pagamentos</p>
        </div>
        <Button onClick={() => { setEditingId(null); setForm(initialForm); setShowForm(true); }} className="rounded-lg gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Nova Conta
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard icon={Receipt} title="Total" value={String(counts.total)} />
        <StatCard icon={Clock} title="Pendentes" value={String(counts.pending)} />
        <StatCard icon={AlertTriangle} title="Vencidas" value={String(counts.overdue)} />
        <StatCard icon={Check} title="Pagas" value={String(counts.paid)} />
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
            {["all", "pending", "overdue", "paid", "cancelled"].map((s) => (
              <Button
                key={s}
                size="sm"
                variant={filterStatus === s ? "default" : "outline"}
                onClick={() => setFilterStatus(s)}
                className="rounded-lg text-xs"
              >
                {s === "all" ? "Todos" : statusConfig[s]?.label}
              </Button>
            ))}
          </div>
        </div>
      </Card>

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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item: any) => {
                const dueDate = new Date(item.due_date);
                const isNearDue = item.status === "pending" && isBefore(dueDate, addDays(new Date(), 7)) && !isPast(dueDate);
                return (
                  <TableRow key={item.id} className={isNearDue ? "bg-amber-500/5" : ""}>
                    <TableCell className="font-medium">{item.supplier_name || "—"}</TableCell>
                    <TableCell>
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
                    <TableCell>{getStatusBadge(item.status)}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="rounded-lg">
                            <ChevronDown className="w-4 h-4" />
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
                          {item.status !== "cancelled" && item.status !== "paid" && (
                            <DropdownMenuItem onClick={() => handleCancel(item.id)} className="text-destructive">
                              <X className="w-4 h-4 mr-2" /> Cancelar
                            </DropdownMenuItem>
                          )}
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
            <DateInput label="Data do pagamento" value={paymentDate} onValueChange={setPaymentDate} />
            <ManagedSelectInput
              label="Conta bancária"
              value={paymentBankAccount}
              onValueChange={setPaymentBankAccount}
              options={bankAccounts.map((b: any) => ({ value: b.id, label: `${b.nome}${b.banco ? ` - ${b.banco}` : ""}` }))}
              placeholder="Selecione a conta..."
              icon={<Landmark className="w-4 h-4" />}
              onAdd={contasCrud.onAdd}
              onEdit={contasCrud.onEdit}
              onDelete={contasCrud.onDelete}
              addLabel="Nova conta bancária"
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowPaymentDialog(false)} className="rounded-lg">Cancelar</Button>
              <Button onClick={handlePaymentSubmit} disabled={paymentMutation.isPending} className="rounded-lg gap-2">
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
        onOpenChange={(open) => { if (!open) resetForm(); else setShowForm(true); }}
        title={editingId ? "Editar Conta" : "Nova Conta a Pagar"}
        description="Preencha os dados da despesa"
        size="xl"
      >
        <div className="space-y-6">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados da Conta</p>
            <div className="grid grid-cols-2 gap-4">
              <TextInput label="Fornecedor" placeholder="Nome do fornecedor" value={form.supplier_name} onChange={(e) => updateField("supplier_name", e.target.value)} icon={<Building2 className="w-4 h-4" />} />
              <TextInput label="Nº do Documento" placeholder="Nota fiscal, boleto..." value={form.document_number} onChange={(e) => updateField("document_number", e.target.value)} icon={<FileText className="w-4 h-4" />} />
            </div>
            <TextInput label="Descrição" placeholder="Descrição da despesa" value={form.description} onChange={(e) => updateField("description", e.target.value)} error={errors.description} />
            <div className="grid grid-cols-3 gap-4">
              <CurrencyInput label="Valor" value={form.amount} onValueChange={(v) => updateField("amount", v)} error={errors.amount} />
              <DateInput label="Data de emissão" value={form.issue_date} onValueChange={(d) => updateField("issue_date", d)} />
              <DateInput label="Data de vencimento" value={form.due_date} onValueChange={(d) => updateField("due_date", d)} error={errors.due_date} />
            </div>
          </div>

          <div className="h-px bg-border/30" />

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Classificação</p>
            <div className="grid grid-cols-2 gap-4">
              <ManagedSelectInput
                label="Categoria (Plano de Contas)"
                value={form.category_id}
                onValueChange={(v) => updateField("category_id", v)}
                options={categories.map((c: any) => ({ value: c.id, label: c.nome }))}
                placeholder="Selecione..."
                icon={<FolderTree className="w-4 h-4" />}
                onAdd={categoriasCrud.onAdd}
                onEdit={categoriasCrud.onEdit}
                onDelete={categoriasCrud.onDelete}
                onReorder={categoriasCrud.onReorder}
                addLabel="Nova categoria"
              />
              <ManagedSelectInput
                label="Centro de Custo"
                value={form.cost_center_id}
                onValueChange={(v) => updateField("cost_center_id", v)}
                options={costCenters.map((c: any) => ({ value: c.id, label: c.nome }))}
                placeholder="Selecione..."
                icon={<Target className="w-4 h-4" />}
                onAdd={centrosCrud.onAdd}
                onEdit={centrosCrud.onEdit}
                onDelete={centrosCrud.onDelete}
                addLabel="Novo centro de custo"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <ManagedSelectInput
                label="Conta Bancária"
                value={form.bank_account_id}
                onValueChange={(v) => updateField("bank_account_id", v)}
                options={bankAccounts.map((b: any) => ({ value: b.id, label: `${b.nome}${b.banco ? ` - ${b.banco}` : ""}` }))}
                placeholder="Selecione..."
                icon={<Landmark className="w-4 h-4" />}
                onAdd={contasCrud.onAdd}
                onEdit={contasCrud.onEdit}
                onDelete={contasCrud.onDelete}
                addLabel="Nova conta bancária"
              />
              <ManagedSelectInput
                label="Forma de Pagamento"
                value={form.payment_method_id}
                onValueChange={(v) => updateField("payment_method_id", v)}
                options={paymentMethods.map((p: any) => ({ value: p.id, label: p.nome }))}
                placeholder="Selecione..."
                icon={<CreditCard className="w-4 h-4" />}
                onAdd={formasCrud.onAdd}
                onEdit={formasCrud.onEdit}
                onDelete={formasCrud.onDelete}
                addLabel="Nova forma de pagamento"
              />
            </div>
          </div>

          <div className="h-px bg-border/30" />

          {!editingId && (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Parcelamento e Recorrência</p>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">Parcelas</label>
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
                <div className="space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
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
                      value={form.recurrence_interval}
                      onValueChange={(v) => updateField("recurrence_interval", v)}
                      options={[
                        { value: "weekly", label: "Semanal" },
                        { value: "monthly", label: "Mensal" },
                        { value: "yearly", label: "Anual" },
                      ]}
                      placeholder="Intervalo..."
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          <TextareaInput label="Observações" placeholder="Observações..." value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />

          <div className="h-px bg-border/30" />

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={resetForm} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={isPending} className="rounded-lg gap-2 shadow-sm">
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingId ? "Salvar Alterações" : "Criar Conta"}
            </Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
