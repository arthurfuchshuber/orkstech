import { useState } from "react";
import { eventBus } from "@/lib/events";
import { Users, Plus, Building2, UserRound, Check, Loader2, Mail, MapPin, Home, Info, FileSearch, DollarSign, FileText, Phone, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { FormModal } from "@/components/FormModal";
import { ModuleTabs } from "@/components/ModuleTabs";
import { DocumentInput, validateCNPJ } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextInput } from "@/components/inputs/TextInput";
import { RelatedContracts } from "@/components/modules/RelatedContracts";
import { RelatedFinancial } from "@/components/modules/RelatedFinancial";
import { RelatedDocuments } from "@/components/modules/RelatedDocuments";
import { RelatedActivities } from "@/components/modules/RelatedActivities";
import { RelatedHistory } from "@/components/modules/RelatedHistory";
import { toast } from "sonner";

type ClientType = "pf" | "pj";

interface AddressData {
  logradouro: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
}

interface ClientForm {
  type: ClientType;
  nomeCompleto: string;
  cpf: string;
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  inscricaoEstadual: string;
  inscricaoMunicipal: string;
  telefone: string;
  email: string;
  observacoes: string;
  endereco: AddressData;
}

const initialForm: ClientForm = {
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
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ClientForm>(initialForm);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState("");
  const [activeTab, setActiveTab] = useState("info");

  const updateField = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateAddress = (field: keyof AddressData, value: string) => {
    setForm((prev) => ({ ...prev, endereco: { ...prev.endereco, [field]: value } }));
  };

  const handleCnpjBlur = async () => {
    const raw = form.cnpj.replace(/\D/g, "");
    if (raw.length === 14 && validateCNPJ(raw)) {
      setLoadingCnpj(true);
      setCnpjMessage("");
      try {
        const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
        if (res.ok) {
          const data = await res.json();
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
          toast.success("Dados da empresa preenchidos automaticamente");
        }
      } catch {
        // silently fail
      } finally {
        setLoadingCnpj(false);
      }
    }
  };

  const handleAddressFound = (address: { logradouro: string; bairro: string; cidade: string; estado: string }) => {
    setForm((prev) => ({ ...prev, endereco: { ...prev.endereco, ...address } }));
    toast.success("Endereço preenchido automaticamente");
  };

  const handleSubmit = () => {
    eventBus.emit({ type: "cliente.criado", data: { nome: form.nome || form.razaoSocial, tipo: form.type, descricao: `Cliente ${form.nome || form.razaoSocial} cadastrado` }, moduloOrigem: "clientes", registroId: crypto.randomUUID() });
    toast.success("Cliente cadastrado com sucesso!");
    setForm(initialForm);
    setShowForm(false);
    setCnpjMessage("");
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "info":
        return (
          <div className="py-12 flex flex-col items-center justify-center text-center">
            <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
              <Users className="w-5 h-5 text-muted-foreground/30" />
            </div>
            <p className="text-sm text-muted-foreground font-medium">Selecione um cliente para ver detalhes</p>
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
        <StatCard icon={Users} title="Total de Clientes" value="0" />
        <StatCard icon={Building2} title="Pessoa Jurídica" value="0" />
        <StatCard icon={UserRound} title="Pessoa Física" value="0" />
      </div>

      {/* Client Detail Tabs */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <ModuleTabs tabs={clientTabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="p-4">
          {renderTabContent()}
        </div>
      </Card>

      {/* Modal */}
      <FormModal
        open={showForm}
        onOpenChange={setShowForm}
        title="Novo Cliente"
        description="Preencha os dados do cliente. CNPJ e CEP preenchem dados automaticamente."
        size="xl"
      >
        <div className="space-y-6">
          {/* Type Selector */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tipo de cliente</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "pf" as const, label: "Pessoa Física", sub: "CPF", icon: UserRound },
                { key: "pj" as const, label: "Pessoa Jurídica", sub: "CNPJ", icon: Building2 },
              ]).map(({ key, label, sub, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => updateField("type", key)}
                  className={`flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all duration-200 ${
                    form.type === key
                      ? "border-primary bg-primary/5"
                      : "border-border/50 hover:border-muted-foreground/30"
                  }`}
                >
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

          {/* Dynamic Fields */}
          {form.type === "pf" ? (
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados pessoais</p>
              <div className="grid grid-cols-2 gap-4">
                <TextInput label="Nome completo" placeholder="Nome completo" value={form.nomeCompleto} onChange={(e) => updateField("nomeCompleto", e.target.value)} icon={<UserRound className="w-4 h-4" />} />
                <DocumentInput type="cpf" value={form.cpf} onValueChange={(raw) => updateField("cpf", raw)} />
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
                <DocumentInput type="cnpj" value={form.cnpj} onValueChange={(raw) => updateField("cnpj", raw)} onBlur={handleCnpjBlur} />
                <TextInput label="Razão Social" placeholder="Razão social" value={form.razaoSocial} onChange={(e) => updateField("razaoSocial", e.target.value)} icon={<Building2 className="w-4 h-4" />} />
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
              <PhoneInput value={form.telefone} onValueChange={(raw) => updateField("telefone", raw)} />
              <TextInput label="Email" type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => updateField("email", e.target.value)} icon={<Mail className="w-4 h-4" />} />
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

          <div className="space-y-4">
            <TextInput label="Observações" placeholder="Observações sobre o cliente..." value={form.observacoes} onChange={(e) => updateField("observacoes", e.target.value)} />
          </div>

          <div className="h-px bg-border/30" />

          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSubmit} className="rounded-lg gap-2 shadow-sm">
              <Check className="w-4 h-4" /> Salvar Cliente
            </Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
