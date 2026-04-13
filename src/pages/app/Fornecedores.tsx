import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { refreshQueries } from "@/lib/query-refresh";
import { toast } from "sonner";
import {
  Truck, Plus, Building2, UserRound, Check, Mail, MapPin, Home,
  Tag, Loader2, Pencil, Trash2, Power, Search, Phone, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/FormModal";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { SelectInput } from "@/components/inputs/SelectInput";
import { validateSupplierForm, type SupplierFormData, type FormErrors } from "@/lib/validators";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface Fornecedor {
  id: string;
  tipo: "pf" | "pj";
  nome_completo: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  cpf: string | null;
  cnpj: string | null;
  telefone: string | null;
  email: string | null;
  logradouro: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  observacoes: string | null;
  ativo: boolean;
  created_at: string;
  categoria_id: string | null;
}

const initialForm: SupplierFormData = {
  type: "empresa",
  nome: "",
  cpfCnpj: "",
  telefone: "",
  email: "",
  contatoResponsavel: "",
  categoria: "",
  observacoes: "",
  endereco: { cep: "", logradouro: "", bairro: "", cidade: "", estado: "" },
};

function getName(f: Fornecedor) {
  return f.nome_completo || f.nome_fantasia || f.razao_social || "Sem nome";
}

function getDoc(f: Fornecedor) {
  if (f.tipo === "pj" && f.cnpj) {
    return f.cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  if (f.tipo === "pf" && f.cpf) {
    return f.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  return "";
}

function getLocation(f: Fornecedor) {
  return [f.cidade, f.estado].filter(Boolean).join(" - ");
}

export default function Fornecedores() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const qc = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState<SupplierFormData>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState("");

  // ---- Queries ----
  const { data: fornecedores = [], isLoading } = useQuery({
    queryKey: ["fornecedores", empresaId],
    queryFn: async () => {
      let q = supabase
        .from("fornecedores")
        .select("*")
        .order("created_at", { ascending: false });
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data as Fornecedor[];
    },
    enabled: !!user,
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias_cadastro", empresaId],
    queryFn: async () => {
      let q = supabase
        .from("categorias_cadastro")
        .select("id, nome, categoria_pai_id")
        .eq("ativo", true)
        .order("ordem");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  const categoriaOptions = categorias.map((c) => ({
    value: c.id,
    label: c.categoria_pai_id
      ? `  └ ${c.nome}`
      : c.nome,
  }));

  const totalAtivos = fornecedores.filter((f) => f.ativo).length;
  const totalEmpresas = fornecedores.filter((f) => f.tipo === "pj" && f.ativo).length;
  const totalPf = fornecedores.filter((f) => f.tipo === "pf" && f.ativo).length;

  const filtered = fornecedores.filter((f) => {
    const name = getName(f).toLowerCase();
    const doc = (f.cnpj || f.cpf || "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || doc.includes(q);
  });

  // ---- Mutations ----
  const saveMutation = useMutation({
    mutationFn: async () => {
      const tipoDb = form.type === "empresa" ? "pj" as const : "pf" as const;
      const docRaw = form.cpfCnpj.replace(/\D/g, "");

      const payload = {
        tipo: tipoDb,
        nome_completo: form.type === "pessoa" ? form.nome : null,
        cpf: form.type === "pessoa" ? docRaw || null : null,
        razao_social: form.type === "empresa" ? form.nome : null,
        cnpj: form.type === "empresa" ? docRaw || null : null,
        telefone: form.telefone.replace(/\D/g, "") || null,
        email: form.email || null,
        logradouro: form.endereco.logradouro || null,
        bairro: form.endereco.bairro || null,
        cidade: form.endereco.cidade || null,
        estado: form.endereco.estado || null,
        cep: form.endereco.cep || null,
        observacoes: form.observacoes || null,
        categoria_id: form.categoria || null,
      };

      if (editingId) {
        const { error } = await supabase.from("fornecedores").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fornecedores").insert({ ...payload, user_id: user!.id, empresa_id: empresaId || null });
        if (error) throw error;
      }
    },
    onSuccess: async () => {
      await refreshQueries(qc, [["fornecedores"]]);
      toast.success(editingId ? "Fornecedor atualizado!" : "Fornecedor cadastrado!");
      closeForm();
    },
    onError: (err: any) => {
      if (err?.message?.includes("fornecedores_cpf_unique")) toast.error("CPF já cadastrado");
      else if (err?.message?.includes("fornecedores_cnpj_unique")) toast.error("CNPJ já cadastrado");
      else toast.error("Erro ao salvar fornecedor");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase
        .from("accounts_payable")
        .select("id", { count: "exact", head: true })
        .eq("supplier_id", id);
      if (count && count > 0) {
        throw new Error("LINKED");
      }
      const { error } = await supabase.from("fornecedores").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshQueries(qc, [["fornecedores"]]);
      toast.success("Fornecedor excluído");
    },
    onError: (err: any) => {
      if (err?.message === "LINKED") {
        toast.error("Este fornecedor possui registros financeiros vinculados e não pode ser excluído.");
      } else {
        toast.error("Erro ao excluir fornecedor");
      }
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("fornecedores").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshQueries(qc, [["fornecedores"]]);
    },
  });

  // ---- Handlers ----
  const closeForm = () => {
    setShowForm(false);
    setEditingId(null);
    setForm(initialForm);
    setErrors({});
    setCnpjMessage("");
  };

  const openNew = () => {
    setEditingId(null);
    setForm(initialForm);
    setShowForm(true);
  };

  const openEdit = (f: Fornecedor) => {
    setEditingId(f.id);
    setForm({
      type: f.tipo === "pj" ? "empresa" : "pessoa",
      nome: f.nome_completo || f.razao_social || f.nome_fantasia || "",
      cpfCnpj: f.cnpj || f.cpf || "",
      telefone: f.telefone || "",
      email: f.email || "",
      contatoResponsavel: "",
      categoria: "",
      observacoes: f.observacoes || "",
      endereco: {
        cep: f.cep || "",
        logradouro: f.logradouro || "",
        bairro: f.bairro || "",
        cidade: f.cidade || "",
        estado: f.estado || "",
      },
    });
    setShowForm(true);
  };

  const update = (key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };
  const updateAddr = (key: string, value: string) => setForm((p) => ({ ...p, endereco: { ...p.endereco, [key]: value } }));

  const handleCnpjBlur = async () => {
    if (form.type !== "empresa") return;
    const raw = form.cpfCnpj.replace(/\D/g, "");
    if (raw.length !== 14) return;
    const { validateCNPJ } = await import("@/lib/validators");
    if (!validateCNPJ(raw)) { setErrors((prev) => ({ ...prev, cpfCnpj: "CNPJ inválido" })); return; }

    setLoadingCnpj(true);
    setCnpjMessage("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (res.ok) {
        const data = await res.json();
        if (data.descricao_situacao_cadastral && data.descricao_situacao_cadastral !== "ATIVA") {
          setErrors((prev) => ({ ...prev, cpfCnpj: "CNPJ inválido ou empresa não ativa" }));
          return;
        }
        setForm((p) => ({
          ...p,
          nome: data.razao_social || p.nome,
          endereco: {
            logradouro: data.logradouro || p.endereco.logradouro,
            bairro: data.bairro || p.endereco.bairro,
            cidade: data.municipio || p.endereco.cidade,
            estado: data.uf || p.endereco.estado,
            cep: data.cep ? data.cep.replace(/\D/g, "") : p.endereco.cep,
          },
        }));
        setCnpjMessage("Dados preenchidos automaticamente");
        setErrors((prev) => { const n = { ...prev }; delete n.cpfCnpj; delete n.nome; return n; });
        toast.success("Dados preenchidos automaticamente");
      }
    } catch { /* silent */ } finally {
      setLoadingCnpj(false);
    }
  };

  const handleAddressFound = (addr: { logradouro: string; bairro: string; cidade: string; estado: string }) => {
    setForm((p) => ({ ...p, endereco: { ...p.endereco, ...addr } }));
    toast.success("Endereço preenchido automaticamente");
  };

  const handleSubmit = async () => {
    const validationErrors = validateSupplierForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Corrija os campos destacados");
      return;
    }
    saveMutation.mutate();
  };

  const handleConfirmDelete = async () => {
    if (!deleteId) return;
    try { await deleteMutation.mutateAsync(deleteId); } finally { setDeleteId(null); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie sua base de fornecedores</p>
        </div>
        <Button onClick={openNew} className="rounded-lg gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Truck} title="Fornecedores Ativos" value={String(totalAtivos)} />
        <StatCard icon={Building2} title="Empresas (PJ)" value={String(totalEmpresas)} />
        <StatCard icon={UserRound} title="Pessoa Física (PF)" value={String(totalPf)} />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome ou documento..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <Card className="divide-y divide-border/50">
        {isLoading ? (
          <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3 mx-auto">
              <Truck className="w-5 h-5 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {search ? "Nenhum fornecedor encontrado" : "Nenhum fornecedor cadastrado ainda"}
            </p>
            {!search && (
              <Button variant="outline" size="sm" onClick={openNew} className="mt-3 gap-2">
                <Plus className="w-3.5 h-3.5" /> Cadastrar primeiro fornecedor
              </Button>
            )}
          </div>
        ) : filtered.map((f) => (
          <div
            key={f.id}
            className={`flex items-center gap-4 px-4 py-3.5 hover:bg-muted/30 transition-colors group ${!f.ativo ? "opacity-50" : ""}`}
          >
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${f.tipo === "pj" ? "bg-primary/10" : "bg-muted/40"}`}>
              {f.tipo === "pj" ? <Building2 className="w-4 h-4 text-primary" /> : <UserRound className="w-4 h-4 text-muted-foreground" />}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="text-sm font-medium text-foreground truncate">{getName(f)}</p>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 flex-shrink-0">
                  {f.tipo === "pj" ? "PJ" : "PF"}
                </Badge>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                {getDoc(f) && <span className="text-xs text-muted-foreground">{getDoc(f)}</span>}
                {f.email && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Mail className="w-3 h-3" /> {f.email}
                  </span>
                )}
                {f.telefone && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" /> {f.telefone}
                  </span>
                )}
                {getLocation(f) && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3 h-3" /> {getLocation(f)}
                  </span>
                )}
              </div>
            </div>

            <Badge variant="outline" className={f.ativo ? "text-emerald-400 border-emerald-500/20" : "text-muted-foreground"}>
              {f.ativo ? "Ativo" : "Inativo"}
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="rounded-lg">
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => openEdit(f)}>
                  <Pencil className="w-4 h-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => toggleMutation.mutate({ id: f.id, ativo: !f.ativo })}>
                  <Power className={`w-4 h-4 mr-2 ${f.ativo ? "text-emerald-400" : ""}`} /> {f.ativo ? "Desativar" : "Ativar"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setDeleteId(f.id)} className="text-destructive">
                  <Trash2 className="w-4 h-4 mr-2" /> Excluir
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
      </Card>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação é permanente e não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Form modal */}
      <FormModal
        open={showForm}
        onOpenChange={(open) => !open ? closeForm() : setShowForm(true)}
        title={editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
        description="CNPJ e CEP preenchem dados automaticamente."
        size="xl"
      >
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tipo</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "empresa" as const, label: "Empresa", icon: Building2 },
                { key: "pessoa" as const, label: "Pessoa Física", icon: UserRound },
              ]).map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => { update("type", key); setErrors({}); }}
                  className={`flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all ${form.type === key ? "border-primary bg-primary/5" : "border-border/50 hover:border-muted-foreground/30"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.type === key ? "bg-primary/15" : "bg-muted/50"}`}>
                    <Icon className={`w-4 h-4 ${form.type === key ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <span className={`text-sm font-medium ${form.type === key ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
                  {form.type === key && <Check className="w-4 h-4 text-primary ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-border/30" />

          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados cadastrais</p>
              {loadingCnpj && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
            </div>
            {cnpjMessage && (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                <Check className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs text-primary">{cnpjMessage}</span>
              </div>
            )}
            <DocumentInput type={form.type === "empresa" ? "cnpj" : "cpf"} value={form.cpfCnpj} onValueChange={(raw) => update("cpfCnpj", raw)} onBlur={form.type === "empresa" ? handleCnpjBlur : undefined} error={errors.cpfCnpj} />
            <TextInput label="Nome" placeholder={form.type === "empresa" ? "Razão social do fornecedor" : "Nome do fornecedor"} value={form.nome} onChange={(e) => update("nome", e.target.value)} error={errors.nome} className={form.type === "empresa" ? "uppercase" : ""} />
            <SelectInput label="Categoria" placeholder="Selecione a categoria" value={form.categoria} onValueChange={(v) => update("categoria", v)} options={categoriaOptions} icon={<Tag className="w-4 h-4" />} />
            <TextInput label="Contato Responsável" placeholder="Nome do contato principal" value={form.contatoResponsavel} onChange={(e) => update("contatoResponsavel", e.target.value)} />
          </div>

          <div className="h-px bg-border/30" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
          <PhoneInput value={form.telefone} onValueChange={(raw) => update("telefone", raw)} error={errors.telefone} />
          <TextInput label="Email" type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => update("email", e.target.value)} icon={<Mail className="w-4 h-4" />} error={errors.email} />

          <div className="h-px bg-border/30" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
          <CepInput value={form.endereco.cep} onValueChange={(raw) => updateAddr("cep", raw)} onAddressFound={handleAddressFound} />
          <TextInput label="Logradouro" placeholder="Rua, Avenida..." value={form.endereco.logradouro} onChange={(e) => updateAddr("logradouro", e.target.value)} icon={<Home className="w-4 h-4" />} />
          <TextInput label="Bairro" placeholder="Bairro" value={form.endereco.bairro} onChange={(e) => updateAddr("bairro", e.target.value)} />
          <TextInput label="Cidade" placeholder="Cidade" value={form.endereco.cidade} onChange={(e) => updateAddr("cidade", e.target.value)} icon={<MapPin className="w-4 h-4" />} />
          <TextInput label="Estado" placeholder="UF" value={form.endereco.estado} onChange={(e) => updateAddr("estado", e.target.value)} />

          <TextareaInput label="Observações" placeholder="Observações sobre o fornecedor..." value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} />

          <div className="h-px bg-border/30" />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={closeForm} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={saveMutation.isPending} className="rounded-lg gap-2 shadow-sm">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {editingId ? "Salvar" : "Cadastrar"}
            </Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
