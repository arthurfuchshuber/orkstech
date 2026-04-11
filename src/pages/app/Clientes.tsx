import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Users, Plus, Building2, UserRound, Check, Loader2, Mail, MapPin, Home, Info, FileSearch, DollarSign, FileText, Phone, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { FormModal } from "@/components/FormModal";
import { ModuleTabs } from "@/components/ModuleTabs";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextInput } from "@/components/inputs/TextInput";
import { TextareaInput } from "@/components/inputs/TextareaInput";
import { DateInput } from "@/components/inputs/DateInput";
import { RelatedContracts } from "@/components/modules/RelatedContracts";
import { RelatedFinancial } from "@/components/modules/RelatedFinancial";
import { RelatedDocuments } from "@/components/modules/RelatedDocuments";
import { RelatedActivities } from "@/components/modules/RelatedActivities";
import { RelatedHistory } from "@/components/modules/RelatedHistory";
import { validateClientForm, type ClientFormData, type FormErrors } from "@/lib/validators";
import { useAuth } from "@/hooks/useAuth";
import { fetchClientes, createCliente, countClientes, checkClienteDuplicidade } from "@/lib/supabase-helpers";
import { toast } from "sonner";

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

const clientTabs = [
  { id: "info", label: "Informações", icon: Info },
  { id: "contratos", label: "Contratos", icon: FileSearch, count: 0 },
  { id: "financeiro", label: "Financeiro", icon: DollarSign, count: 0 },
  { id: "documentos", label: "Documentos", icon: FileText, count: 0 },
  { id: "atividades", label: "Atividades", icon: Phone, count: 0 },
  { id: "historico", label: "Histórico", icon: Clock, count: 0 },
];

export default function Clientes() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ClientFormData>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState("");
  const [activeTab, setActiveTab] = useState("info");

  const { data: clientes = [] } = useQuery({ queryKey: ["clientes"], queryFn: fetchClientes });
  const { data: counts = { total: 0, pj: 0, pf: 0 } } = useQuery({ queryKey: ["clientes-counts"], queryFn: countClientes });

  const mutation = useMutation({
    mutationFn: createCliente,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clientes"] });
      queryClient.invalidateQueries({ queryKey: ["clientes-counts"] });
      toast.success("Cliente cadastrado com sucesso!");
      setForm(initialForm);
      setErrors({});
      setShowForm(false);
      setCnpjMessage("");
    },
    onError: (err: any) => {
      if (err?.message?.includes("clientes_cpf_unique")) toast.error("CPF já cadastrado no sistema");
      else if (err?.message?.includes("clientes_cnpj_unique")) toast.error("CNPJ já cadastrado no sistema");
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
      // Check duplicidade no banco
      const exists = await checkClienteDuplicidade("pj", raw);
      if (exists) {
        setErrors((prev) => ({ ...prev, cnpj: "CNPJ já cadastrado no sistema" }));
        setLoadingCnpj(false);
        return;
      }

      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (res.ok) {
        const data = await res.json();
        if (data.descricao_situacao_cadastral && data.descricao_situacao_cadastral !== "ATIVA") {
          setErrors((prev) => ({ ...prev, cnpj: "CNPJ inválido ou empresa não ativa na Receita Federal." }));
          setLoadingCnpj(false);
          return;
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
        toast.success("Dados da empresa preenchidos automaticamente");
      } else {
        setErrors((prev) => ({ ...prev, cnpj: "CNPJ não encontrado na Receita Federal." }));
      }
    } catch { /* silent */ } finally {
      setLoadingCnpj(false);
    }
  };

  const handleAddressFound = (address: { logradouro: string; bairro: string; cidade: string; estado: string }) => {
    setForm((prev) => ({ ...prev, endereco: { ...prev.endereco, ...address } }));
    toast.success("Endereço preenchido automaticamente");
  };

  const handleSubmit = async () => {
    const validationErrors = validateClientForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Corrija os campos destacados antes de salvar");
      return;
    }

    // Verificar duplicidade antes de salvar
    const doc = form.type === "pf" ? form.cpf.replace(/\D/g, "") : form.cnpj.replace(/\D/g, "");
    const exists = await checkClienteDuplicidade(form.type, doc);
    if (exists) {
      setErrors((prev) => ({ ...prev, [form.type === "pf" ? "cpf" : "cnpj"]: `${form.type === "pf" ? "CPF" : "CNPJ"} já cadastrado` }));
      toast.error(`${form.type === "pf" ? "CPF" : "CNPJ"} já cadastrado no sistema`);
      return;
    }

    mutation.mutate({
      user_id: user!.id,
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

  const renderTabContent = () => {
    switch (activeTab) {
      case "info":
        return (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">
              {clientes.length === 0 ? "Nenhum cliente cadastrado ainda" : "Selecione um cliente para ver detalhes"}
            </p>
          </div>
        );
      case "contratos": return <RelatedContracts />;
      case "financeiro": return <RelatedFinancial />;
      case "documentos": return <RelatedDocuments />;
      case "atividades": return <RelatedActivities />;
      case "historico": return <RelatedHistory />;
      default: return null;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie sua base de clientes</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-lg gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Novo Cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} title="Total de Clientes" value={String(counts.total)} />
        <StatCard icon={Building2} title="Pessoa Jurídica" value={String(counts.pj)} />
        <StatCard icon={UserRound} title="Pessoa Física" value={String(counts.pf)} />
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <ModuleTabs tabs={clientTabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="p-4">{renderTabContent()}</div>
      </Card>

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
                <TextInput label="Nome completo" placeholder="Nome completo do cliente" value={form.nomeCompleto} onChange={(e) => updateField("nomeCompleto", e.target.value)} icon={<UserRound className="w-4 h-4" />} error={errors.nomeCompleto} />
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
                <TextInput label="Razão Social" placeholder="Razão social da empresa" value={form.razaoSocial} onChange={(e) => updateField("razaoSocial", e.target.value)} icon={<Building2 className="w-4 h-4" />} error={errors.razaoSocial} />
                <TextInput label="Nome Fantasia" placeholder="Nome fantasia" value={form.nomeFantasia} onChange={(e) => updateField("nomeFantasia", e.target.value)} />
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
