import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Users, Plus, Search, Building2, UserRound, Check, Loader2,
  Mail, MapPin, Home, Filter, X, Pencil, Power, Trash2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FormModal } from "@/components/FormModal";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { DateInput } from "@/components/inputs/DateInput";
import { validateClientForm, type ClientFormData, type FormErrors } from "@/lib/validators";
import { refreshQueries } from "@/lib/query-refresh";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const initialForm: ClientFormData = {
  type: "pf",
  nomeCompleto: "",
  cpf: "",
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  inscricaoEstadual: "",
  inscricaoMunicipal: "",
  telefone: "",
  email: "",
  observacoes: "",
  dataNascimento: undefined,
  endereco: { logradouro: "", bairro: "", cidade: "", estado: "", cep: "" },
};

function formatDoc(tipo: string, cpf?: string | null, cnpj?: string | null) {
  if (tipo === "pf" && cpf) {
    return cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }
  if (tipo === "pj" && cnpj) {
    return cnpj.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }
  return "—";
}

function formatPhone(phone?: string | null) {
  if (!phone) return "—";
  const raw = phone.replace(/\D/g, "");
  if (raw.length === 11) return raw.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  if (raw.length === 10) return raw.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  return phone;
}

export default function Clientes() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ClientFormData>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState("");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes", empresaId],
    queryFn: async () => {
      let q = supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const filtered = useMemo(() => {
    let list = clientes;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((c) =>
        (c.nome_completo?.toLowerCase().includes(q)) ||
        (c.razao_social?.toLowerCase().includes(q)) ||
        (c.nome_fantasia?.toLowerCase().includes(q)) ||
        (c.cpf?.includes(q)) ||
        (c.cnpj?.includes(q)) ||
        (c.email?.toLowerCase().includes(q)) ||
        (c.telefone?.includes(q))
      );
    }
    if (filterStatus.length > 0) {
      list = list.filter((c) => {
        if (filterStatus.includes("ativo") && c.ativo) return true;
        if (filterStatus.includes("inativo") && !c.ativo) return true;
        return false;
      });
    }
    if (filterTipo.length > 0) {
      list = list.filter((c) => filterTipo.includes(c.tipo));
    }
    return list;
  }, [clientes, search, filterStatus, filterTipo]);

  const hasFilters = filterStatus.length > 0 || filterTipo.length > 0;

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const { data: result, error } = await supabase.from("clientes").insert(data).select().single();
      if (error) throw error;
      return result;
    },
    onSuccess: async () => {
      await refreshQueries(queryClient, [["clientes"]]);
      toast.success("Cliente cadastrado com sucesso!");
      setForm(initialForm);
      setErrors({});
      setShowForm(false);
      setCnpjMessage("");
    },
    onError: (err: any) => {
      if (err?.message?.includes("clientes_cpf_unique")) toast.error("CPF já cadastrado");
      else if (err?.message?.includes("clientes_cnpj_unique")) toast.error("CNPJ já cadastrado");
      else toast.error("Erro ao cadastrar cliente");
    },
  });

  const updateField = <K extends keyof ClientFormData>(key: K, value: ClientFormData[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };

  const updateAddress = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, endereco: { ...prev.endereco, [field]: value } }));
  };

  const handleCnpjBlur = async () => {
    const raw = form.cnpj.replace(/\D/g, "");
    if (raw.length !== 14) return;
    const { validateCNPJ } = await import("@/lib/validators");
    if (!validateCNPJ(raw)) { setErrors((prev) => ({ ...prev, cnpj: "CNPJ inválido" })); return; }

    setLoadingCnpj(true);
    setCnpjMessage("");
    try {
      const exists = clientes.some((c) => c.cnpj === raw);
      if (exists) { setErrors((prev) => ({ ...prev, cnpj: "CNPJ já cadastrado" })); setLoadingCnpj(false); return; }
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (res.ok) {
        const data = await res.json();
        if (data.descricao_situacao_cadastral && data.descricao_situacao_cadastral !== "ATIVA") {
          setErrors((prev) => ({ ...prev, cnpj: "Empresa não ativa na Receita Federal" })); setLoadingCnpj(false); return;
        }
        setForm((prev) => ({
          ...prev,
          razaoSocial: data.razao_social || prev.razaoSocial,
          nomeFantasia: data.nome_fantasia || prev.nomeFantasia,
          endereco: {
            logradouro: data.logradouro || prev.endereco.logradouro,
            bairro: data.bairro || prev.endereco.bairro,
            cidade: data.municipio || prev.endereco.cidade,
            estado: data.uf || prev.endereco.estado,
            cep: data.cep ? data.cep.replace(/\D/g, "") : prev.endereco.cep,
          },
        }));
        setCnpjMessage("Dados da empresa encontrados automaticamente");
        setErrors((prev) => { const n = { ...prev }; delete n.cnpj; return n; });
        toast.success("Dados preenchidos automaticamente");
      } else {
        setErrors((prev) => ({ ...prev, cnpj: "CNPJ não encontrado na Receita Federal" }));
      }
    } catch { /* silent */ } finally { setLoadingCnpj(false); }
  };

  const handleAddressFound = (address: { logradouro: string; bairro: string; cidade: string; estado: string }) => {
    setForm((prev) => ({ ...prev, endereco: { ...prev.endereco, ...address } }));
    toast.success("Endereço preenchido automaticamente");
  };

  const handleSubmit = async () => {
    const validationErrors = validateClientForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Corrija os campos destacados");
      return;
    }

    mutation.mutate({
      user_id: user!.id,
      empresa_id: empresaId,
      tipo: form.type,
      nome_completo: form.type === "pf" ? form.nomeCompleto : undefined,
      cpf: form.type === "pf" ? form.cpf.replace(/\D/g, "") : undefined,
      razao_social: form.type === "pj" ? form.razaoSocial : undefined,
      nome_fantasia: form.type === "pj" ? form.nomeFantasia || undefined : undefined,
      cnpj: form.type === "pj" ? form.cnpj.replace(/\D/g, "") : undefined,
      inscricao_estadual: form.inscricaoEstadual || undefined,
      inscricao_municipal: form.inscricaoMunicipal || undefined,
      telefone: form.telefone.replace(/\D/g, "") || undefined,
      email: form.email || undefined,
      data_nascimento: form.dataNascimento ? form.dataNascimento.toISOString().split("T")[0] : undefined,
      logradouro: form.endereco.logradouro || undefined,
      bairro: form.endereco.bairro || undefined,
      cidade: form.endereco.cidade || undefined,
      estado: form.endereco.estado || undefined,
      cep: form.endereco.cep || undefined,
      observacoes: form.observacoes || undefined,
    });
  };

  const handleOpenChange = (open: boolean) => {
    setShowForm(open);
    if (!open) { setForm(initialForm); setErrors({}); setCnpjMessage(""); }
  };

  const totalAtivos = clientes.filter((c) => c.ativo).length;
  const totalPJ = clientes.filter((c) => c.tipo === "pj").length;
  const totalPF = clientes.filter((c) => c.tipo === "pf").length;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Cadastro mestre de clientes da empresa</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-lg gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4 border-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Ativos</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="w-3.5 h-3.5 text-primary" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{totalAtivos}</div>
        </Card>
        <Card className="p-4 border-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pessoa Jurídica</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-3.5 h-3.5 text-primary" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{totalPJ}</div>
        </Card>
        <Card className="p-4 border-border/50 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pessoa Física</span>
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <UserRound className="w-3.5 h-3.5 text-primary" />
            </div>
          </div>
          <div className="text-2xl font-bold text-foreground">{totalPF}</div>
        </Card>
      </div>

      {/* Search + Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, documento, email ou telefone..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 bg-card border-border/50"
          />
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className={`gap-2 rounded-lg ${hasFilters ? "border-primary text-primary" : ""}`}>
              <Filter className="w-4 h-4" />
              Filtros
              {hasFilters && (
                <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">{filterStatus.length + filterTipo.length}</Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-4" align="end">
            <div className="space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Status</p>
                <div className="space-y-2">
                  {[{ value: "ativo", label: "Ativo" }, { value: "inativo", label: "Inativo" }].map((item) => (
                    <label key={item.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filterStatus.includes(item.value)}
                        onCheckedChange={(checked) => {
                          setFilterStatus((prev) =>
                            checked ? [...prev, item.value] : prev.filter((v) => v !== item.value)
                          );
                        }}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Tipo</p>
                <div className="space-y-2">
                  {[{ value: "pf", label: "Pessoa Física" }, { value: "pj", label: "Pessoa Jurídica" }].map((item) => (
                    <label key={item.value} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={filterTipo.includes(item.value)}
                        onCheckedChange={(checked) => {
                          setFilterTipo((prev) =>
                            checked ? [...prev, item.value] : prev.filter((v) => v !== item.value)
                          );
                        }}
                      />
                      {item.label}
                    </label>
                  ))}
                </div>
              </div>
              {hasFilters && (
                <Button variant="ghost" size="sm" className="w-full text-xs" onClick={() => { setFilterStatus([]); setFilterTipo([]); }}>
                  <X className="w-3 h-3 mr-1" /> Limpar filtros
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Nome / Razão Social</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Tipo</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Documento</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Telefone</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Email</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Cidade</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Criado em</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">
                      {search || hasFilters ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow
                  key={c.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors border-border/20"
                  onClick={() => navigate(`/app/clientes/${c.id}`)}
                >
                  <TableCell className="font-medium text-foreground">
                    {c.tipo === "pf" ? c.nome_completo : (c.nome_fantasia || c.razao_social) || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs font-medium">
                      {c.tipo === "pf" ? "PF" : "PJ"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm font-mono">
                    {formatDoc(c.tipo, c.cpf, c.cnpj)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatPhone(c.telefone)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{c.email || "—"}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {c.cidade ? `${c.cidade}${c.estado ? `/${c.estado}` : ""}` : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={c.ativo ? "default" : "secondary"} className="text-xs">
                      {c.ativo ? "Ativo" : "Inativo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(c.created_at), "dd/MM/yyyy", { locale: ptBR })}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {/* Modal Novo Cliente */}
      <FormModal open={showForm} onOpenChange={handleOpenChange} title="Novo Cliente" description="Preencha os dados do cliente. CNPJ e CEP preenchem dados automaticamente." size="xl">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tipo de cliente</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "pf" as const, label: "Pessoa Física", sub: "CPF", icon: UserRound },
                { key: "pj" as const, label: "Pessoa Jurídica", sub: "CNPJ", icon: Building2 },
              ]).map(({ key, label, sub, icon: Icon }) => (
                <button key={key} type="button" onClick={() => { updateField("type", key); setErrors({}); }}
                  className={`flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all duration-200 ${form.type === key ? "border-primary bg-primary/5" : "border-border/50 hover:border-muted-foreground/30"}`}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${form.type === key ? "bg-primary/15" : "bg-muted/50"}`}>
                    <Icon className={`w-4 h-4 ${form.type === key ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${form.type === key ? "text-foreground" : "text-muted-foreground"}`}>{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  {form.type === key && <Check className="w-4 h-4 text-primary ml-auto" />}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px bg-border/30" />

          {form.type === "pf" ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados pessoais</p>
              <div className="grid grid-cols-2 gap-4">
                <TextInput label="Nome completo" placeholder="Nome completo" value={form.nomeCompleto} onChange={(e) => updateField("nomeCompleto", e.target.value)} icon={<UserRound className="w-4 h-4" />} error={errors.nomeCompleto} />
                <DocumentInput type="cpf" value={form.cpf} onValueChange={(raw) => updateField("cpf", raw)} error={errors.cpf} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <DateInput label="Data de nascimento" value={form.dataNascimento} onValueChange={(d) => updateField("dataNascimento", d)} />
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados da empresa</p>
                {loadingCnpj && <Loader2 className="w-3 h-3 animate-spin text-primary" />}
              </div>
              {cnpjMessage && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20">
                  <Check className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs text-primary">{cnpjMessage}</span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <DocumentInput type="cnpj" value={form.cnpj} onValueChange={(raw) => updateField("cnpj", raw)} onBlur={handleCnpjBlur} error={errors.cnpj} />
                <TextInput label="Razão Social" placeholder="Razão social" value={form.razaoSocial} onChange={(e) => updateField("razaoSocial", e.target.value)} icon={<Building2 className="w-4 h-4" />} error={errors.razaoSocial} className="uppercase" />
                <TextInput label="Nome Fantasia" placeholder="Nome fantasia" value={form.nomeFantasia} onChange={(e) => updateField("nomeFantasia", e.target.value)} className="uppercase" />
                <TextInput label="Inscrição Estadual" placeholder="Inscrição estadual" value={form.inscricaoEstadual} onChange={(e) => updateField("inscricaoEstadual", e.target.value)} />
                <TextInput label="Inscrição Municipal" placeholder="Inscrição municipal" value={form.inscricaoMunicipal} onChange={(e) => updateField("inscricaoMunicipal", e.target.value)} />
              </div>
            </div>
          )}

          <div className="h-px bg-border/30" />

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
            <div className="grid grid-cols-2 gap-4">
              <PhoneInput value={form.telefone} onValueChange={(raw) => updateField("telefone", raw)} error={errors.telefone} />
              <TextInput label="Email" type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => updateField("email", e.target.value)} icon={<Mail className="w-4 h-4" />} error={errors.email} />
            </div>
          </div>

          <div className="h-px bg-border/30" />

          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
            <div className="grid grid-cols-3 gap-4">
              <CepInput value={form.endereco.cep} onValueChange={(raw) => updateAddress("cep", raw)} onAddressFound={handleAddressFound} />
              <div className="col-span-2">
                <TextInput label="Logradouro" placeholder="Rua, Avenida..." value={form.endereco.logradouro} onChange={(e) => updateAddress("logradouro", e.target.value)} icon={<Home className="w-4 h-4" />} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <TextInput label="Bairro" placeholder="Bairro" value={form.endereco.bairro} onChange={(e) => updateAddress("bairro", e.target.value)} />
              <TextInput label="Cidade" placeholder="Cidade" value={form.endereco.cidade} onChange={(e) => updateAddress("cidade", e.target.value)} icon={<MapPin className="w-4 h-4" />} />
              <TextInput label="Estado" placeholder="UF" value={form.endereco.estado} onChange={(e) => updateAddress("estado", e.target.value)} />
            </div>
          </div>

          <TextareaInput label="Observações" placeholder="Observações sobre o cliente..." value={form.observacoes} onChange={(e) => updateField("observacoes", e.target.value)} />

          <div className="h-px bg-border/30" />

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSubmit} disabled={mutation.isPending} className="rounded-lg gap-2 shadow-sm">
              {mutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Salvar Cliente
            </Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
