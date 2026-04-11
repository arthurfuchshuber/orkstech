import { useState } from "react";
import { eventBus } from "@/lib/events";
import { Truck, Plus, Building2, UserRound, Check, Mail, MapPin, Home, Info, DollarSign, FileText, Clock, ShoppingCart, Tag, Loader2 } from "lucide-react";
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
import { SelectInput } from "@/components/inputs/SelectInput";
import { RelatedFinancial } from "@/components/modules/RelatedFinancial";
import { RelatedDocuments } from "@/components/modules/RelatedDocuments";
import { RelatedHistory } from "@/components/modules/RelatedHistory";
import { validateSupplierForm, type SupplierFormData, type FormErrors } from "@/lib/validators";
import { toast } from "sonner";

const tabs = [
  { id: "info", label: "Informações", icon: Info },
  { id: "compras", label: "Compras", icon: ShoppingCart, count: 0 },
  { id: "financeiro", label: "Financeiro", icon: DollarSign, count: 0 },
  { id: "documentos", label: "Documentos", icon: FileText, count: 0 },
  { id: "historico", label: "Histórico", icon: Clock, count: 0 },
];

const categoriaOptions = [
  { value: "tecnologia", label: "Tecnologia" },
  { value: "logistica", label: "Logística" },
  { value: "escritorio", label: "Material de Escritório" },
  { value: "servicos", label: "Serviços" },
  { value: "consultoria", label: "Consultoria" },
  { value: "marketing", label: "Marketing" },
  { value: "outros", label: "Outros" },
];

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

export default function Fornecedores() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [form, setForm] = useState<SupplierFormData>(initialForm);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loadingCnpj, setLoadingCnpj] = useState(false);
  const [cnpjMessage, setCnpjMessage] = useState("");

  const update = (key: string, value: string) => {
    setForm((p) => ({ ...p, [key]: value }));
    if (errors[key]) setErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
  };
  const updateAddr = (key: string, value: string) => setForm((p) => ({ ...p, endereco: { ...p.endereco, [key]: value } }));

  const handleCnpjBlur = async () => {
    if (form.type !== "empresa") return;
    const raw = form.cpfCnpj.replace(/\D/g, "");
    if (raw.length !== 14) return;

    const { validateCNPJ } = await import("@/components/inputs/DocumentInput");
    if (!validateCNPJ(raw)) {
      setErrors((prev) => ({ ...prev, cpfCnpj: "CNPJ inválido" }));
      return;
    }

    setLoadingCnpj(true);
    setCnpjMessage("");
    try {
      const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${raw}`);
      if (res.ok) {
        const data = await res.json();
        if (data.descricao_situacao_cadastral && data.descricao_situacao_cadastral !== "ATIVA") {
          setErrors((prev) => ({ ...prev, cpfCnpj: "CNPJ inválido ou empresa não ativa na Receita Federal." }));
          setLoadingCnpj(false);
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
        toast.success("Dados do fornecedor preenchidos automaticamente");
      }
    } catch { /* silent */ } finally {
      setLoadingCnpj(false);
    }
  };

  const handleAddressFound = (addr: { logradouro: string; bairro: string; cidade: string; estado: string }) => {
    setForm((p) => ({ ...p, endereco: { ...p.endereco, ...addr } }));
    toast.success("Endereço preenchido automaticamente");
  };

  const handleSubmit = () => {
    const validationErrors = validateSupplierForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Corrija os campos destacados antes de salvar");
      return;
    }

    eventBus.emit({ type: "fornecedor.criado", data: { nome: form.nome, descricao: `Fornecedor ${form.nome} cadastrado` }, moduloOrigem: "fornecedores", registroId: crypto.randomUUID() });
    toast.success("Fornecedor cadastrado com sucesso!");
    setForm(initialForm);
    setErrors({});
    setShowForm(false);
    setCnpjMessage("");
  };

  const handleOpenChange = (open: boolean) => {
    setShowForm(open);
    if (!open) { setForm(initialForm); setErrors({}); setCnpjMessage(""); }
  };

  const renderTab = () => {
    switch (activeTab) {
      case "compras": return <div className="py-12 text-center"><p className="text-sm text-muted-foreground">Nenhuma compra registrada</p></div>;
      case "financeiro": return <RelatedFinancial />;
      case "documentos": return <RelatedDocuments />;
      case "historico": return <RelatedHistory />;
      default: return <div className="py-12 text-center"><div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3 mx-auto"><Truck className="w-5 h-5 text-muted-foreground/30" /></div><p className="text-sm text-muted-foreground font-medium">Selecione um fornecedor para ver detalhes</p></div>;
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Fornecedores</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie sua base de fornecedores</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-lg gap-2 shadow-sm">
          <Plus className="w-4 h-4" /> Novo Fornecedor
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Truck} title="Total de Fornecedores" value="0" />
        <StatCard icon={Building2} title="Empresas" value="0" />
        <StatCard icon={Tag} title="Categorias" value="0" />
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <ModuleTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="p-4">{renderTab()}</div>
      </Card>

      <FormModal open={showForm} onOpenChange={handleOpenChange} title="Novo Fornecedor" description="Cadastre um novo fornecedor. CNPJ e CEP preenchem dados automaticamente." size="xl">
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
            <div className="grid grid-cols-2 gap-4">
              <DocumentInput
                type={form.type === "empresa" ? "cnpj" : "cpf"}
                value={form.cpfCnpj}
                onValueChange={(raw) => update("cpfCnpj", raw)}
                onBlur={form.type === "empresa" ? handleCnpjBlur : undefined}
                error={errors.cpfCnpj}
              />
              <TextInput label="Nome" placeholder={form.type === "empresa" ? "Razão social do fornecedor" : "Nome do fornecedor"} value={form.nome} onChange={(e) => update("nome", e.target.value)} error={errors.nome} />
              <SelectInput label="Categoria" placeholder="Selecione a categoria" value={form.categoria} onValueChange={(v) => update("categoria", v)} options={categoriaOptions} icon={<Tag className="w-4 h-4" />} />
              <TextInput label="Contato Responsável" placeholder="Nome do contato principal" value={form.contatoResponsavel} onChange={(e) => update("contatoResponsavel", e.target.value)} />
            </div>
          </div>

          <div className="h-px bg-border/30" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
          <div className="grid grid-cols-2 gap-4">
            <PhoneInput value={form.telefone} onValueChange={(raw) => update("telefone", raw)} error={errors.telefone} />
            <TextInput label="Email" type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => update("email", e.target.value)} icon={<Mail className="w-4 h-4" />} error={errors.email} />
          </div>

          <div className="h-px bg-border/30" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
          <div className="grid grid-cols-3 gap-4">
            <CepInput value={form.endereco.cep} onValueChange={(raw) => updateAddr("cep", raw)} onAddressFound={handleAddressFound} />
            <div className="col-span-2"><TextInput label="Logradouro" placeholder="Rua, Avenida..." value={form.endereco.logradouro} onChange={(e) => updateAddr("logradouro", e.target.value)} icon={<Home className="w-4 h-4" />} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <TextInput label="Bairro" placeholder="Bairro" value={form.endereco.bairro} onChange={(e) => updateAddr("bairro", e.target.value)} />
            <TextInput label="Cidade" placeholder="Cidade" value={form.endereco.cidade} onChange={(e) => updateAddr("cidade", e.target.value)} icon={<MapPin className="w-4 h-4" />} />
            <TextInput label="Estado" placeholder="UF" value={form.endereco.estado} onChange={(e) => updateAddr("estado", e.target.value)} />
          </div>

          <TextareaInput label="Observações" placeholder="Observações sobre o fornecedor..." value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} />

          <div className="h-px bg-border/30" />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => handleOpenChange(false)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSubmit} className="rounded-lg gap-2 shadow-sm"><Check className="w-4 h-4" /> Salvar Fornecedor</Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
