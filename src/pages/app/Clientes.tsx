import { useState } from "react";
import { Users, Search, Plus, Building2, UserRound, X, Check, Loader2, Mail, MapPin, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DocumentInput, validateCPF, validateCNPJ } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextInput } from "@/components/inputs/TextInput";
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
  // PF
  nomeCompleto: string;
  cpf: string;
  // PJ
  razaoSocial: string;
  nomeFantasia: string;
  cnpj: string;
  // Common
  telefone: string;
  email: string;
  endereco: AddressData;
}

const initialForm: ClientForm = {
  type: "pf",
  nomeCompleto: "",
  cpf: "",
  razaoSocial: "",
  nomeFantasia: "",
  cnpj: "",
  telefone: "",
  email: "",
  endereco: { logradouro: "", bairro: "", cidade: "", estado: "", cep: "" },
};

export default function Clientes() {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<ClientForm>(initialForm);
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState("");

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
    setForm((prev) => ({
      ...prev,
      endereco: { ...prev.endereco, ...address },
    }));
    toast.success("Endereço preenchido automaticamente");
  };

  const handleSubmit = () => {
    toast.success("Cliente cadastrado com sucesso!");
    setForm(initialForm);
    setShowForm(false);
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie sua base de clientes</p>
        </div>
        <Button onClick={() => setShowForm(!showForm)} className="rounded-lg gap-2 shadow-sm">
          {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showForm ? "Cancelar" : "Novo Cliente"}
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} title="Total de Clientes" value="0" />
        <StatCard icon={Building2} title="Pessoa Jurídica" value="0" />
        <StatCard icon={UserRound} title="Pessoa Física" value="0" />
      </div>

      {/* New Client Form */}
      {showForm && (
        <Card className="border-border/50 shadow-lg animate-slide-up overflow-hidden">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg font-semibold">Novo Cliente</CardTitle>
            <CardDescription>Preencha os dados do cliente. Campos com CNPJ e CEP preenchem dados automaticamente.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Type Selector */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Tipo de cliente</label>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => updateField("type", "pf")}
                  className={`flex-1 flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all duration-200 ${
                    form.type === "pf"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/50 hover:border-muted-foreground/30 bg-background"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    form.type === "pf" ? "bg-primary/15" : "bg-muted/50"
                  }`}>
                    <UserRound className={`w-4 h-4 ${form.type === "pf" ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${form.type === "pf" ? "text-foreground" : "text-muted-foreground"}`}>Pessoa Física</p>
                    <p className="text-xs text-muted-foreground">CPF</p>
                  </div>
                  {form.type === "pf" && <Check className="w-4 h-4 text-primary ml-auto" />}
                </button>
                <button
                  type="button"
                  onClick={() => updateField("type", "pj")}
                  className={`flex-1 flex items-center gap-3 p-3.5 rounded-lg border-2 transition-all duration-200 ${
                    form.type === "pj"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/50 hover:border-muted-foreground/30 bg-background"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    form.type === "pj" ? "bg-primary/15" : "bg-muted/50"
                  }`}>
                    <Building2 className={`w-4 h-4 ${form.type === "pj" ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="text-left">
                    <p className={`text-sm font-medium ${form.type === "pj" ? "text-foreground" : "text-muted-foreground"}`}>Pessoa Jurídica</p>
                    <p className="text-xs text-muted-foreground">CNPJ</p>
                  </div>
                  {form.type === "pj" && <Check className="w-4 h-4 text-primary ml-auto" />}
                </button>
              </div>
            </div>

            <div className="h-px bg-border/40" />

            {/* Dynamic Fields */}
            {form.type === "pf" ? (
              <div className="space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados pessoais</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <TextInput
                    label="Nome completo"
                    placeholder="Digite o nome completo"
                    value={form.nomeCompleto}
                    onChange={(e) => updateField("nomeCompleto", e.target.value)}
                    icon={<UserRound className="w-4 h-4" />}
                  />
                  <DocumentInput
                    type="cpf"
                    value={form.cpf}
                    onValueChange={(raw) => updateField("cpf", raw)}
                  />
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
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DocumentInput
                    type="cnpj"
                    value={form.cnpj}
                    onValueChange={(raw) => updateField("cnpj", raw)}
                    onBlur={handleCnpjBlur}
                  />
                  <TextInput
                    label="Razão Social"
                    placeholder="Razão social da empresa"
                    value={form.razaoSocial}
                    onChange={(e) => updateField("razaoSocial", e.target.value)}
                    icon={<Building2 className="w-4 h-4" />}
                  />
                  <TextInput
                    label="Nome Fantasia"
                    placeholder="Nome fantasia"
                    value={form.nomeFantasia}
                    onChange={(e) => updateField("nomeFantasia", e.target.value)}
                  />
                </div>
              </div>
            )}

            <div className="h-px bg-border/40" />

            {/* Contact */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <PhoneInput
                  value={form.telefone}
                  onValueChange={(raw) => updateField("telefone", raw)}
                />
                <TextInput
                  label="Email"
                  type="email"
                  placeholder="email@exemplo.com"
                  value={form.email}
                  onChange={(e) => updateField("email", e.target.value)}
                  icon={<Mail className="w-4 h-4" />}
                />
              </div>
            </div>

            <div className="h-px bg-border/40" />

            {/* Address */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <CepInput
                  value={form.endereco.cep}
                  onValueChange={(raw) => updateAddress("cep", raw)}
                  onAddressFound={handleAddressFound}
                />
                <div className="md:col-span-2">
                  <TextInput
                    label="Logradouro"
                    placeholder="Rua, Avenida..."
                    value={form.endereco.logradouro}
                    onChange={(e) => updateAddress("logradouro", e.target.value)}
                    icon={<Home className="w-4 h-4" />}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <TextInput
                  label="Bairro"
                  placeholder="Bairro"
                  value={form.endereco.bairro}
                  onChange={(e) => updateAddress("bairro", e.target.value)}
                />
                <TextInput
                  label="Cidade"
                  placeholder="Cidade"
                  value={form.endereco.cidade}
                  onChange={(e) => updateAddress("cidade", e.target.value)}
                  icon={<MapPin className="w-4 h-4" />}
                />
                <TextInput
                  label="Estado"
                  placeholder="UF"
                  value={form.endereco.estado}
                  onChange={(e) => updateAddress("estado", e.target.value)}
                />
              </div>
            </div>

            <div className="h-px bg-border/40" />

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-lg">
                Cancelar
              </Button>
              <Button onClick={handleSubmit} className="rounded-lg gap-2 shadow-sm">
                <Check className="w-4 h-4" />
                Salvar Cliente
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client List */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-border/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Lista de Clientes</h3>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 text-sm text-muted-foreground border border-border/30 cursor-pointer hover:bg-muted/50 transition-colors">
            <Search className="w-3.5 h-3.5" />
            <span className="text-xs">Buscar cliente...</span>
          </div>
        </div>
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <div className="w-12 h-12 rounded-xl bg-muted/30 flex items-center justify-center mb-4">
            <Users className="w-6 h-6 text-muted-foreground/30" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Nenhum cliente cadastrado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Clique em "Novo Cliente" para começar</p>
        </div>
      </Card>
    </div>
  );
}
