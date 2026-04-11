import { useState } from "react";
import { Truck, Plus, Building2, UserRound, Check, Mail, MapPin, Home, Info, DollarSign, FileText, Clock, ShoppingCart, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { FormModal } from "@/components/FormModal";
import { ModuleTabs } from "@/components/ModuleTabs";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextInput } from "@/components/inputs/TextInput";
import { RelatedFinancial } from "@/components/modules/RelatedFinancial";
import { RelatedDocuments } from "@/components/modules/RelatedDocuments";
import { RelatedHistory } from "@/components/modules/RelatedHistory";
import { toast } from "sonner";

const tabs = [
  { id: "info", label: "Informações", icon: Info },
  { id: "compras", label: "Compras", icon: ShoppingCart, count: 0 },
  { id: "financeiro", label: "Financeiro", icon: DollarSign, count: 0 },
  { id: "documentos", label: "Documentos", icon: FileText, count: 0 },
  { id: "historico", label: "Histórico", icon: Clock, count: 0 },
];

export default function Fornecedores() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [form, setForm] = useState({
    type: "empresa" as "empresa" | "pessoa",
    nome: "", cpfCnpj: "", telefone: "", email: "",
    contatoResponsavel: "", categoria: "", observacoes: "",
    endereco: { cep: "", logradouro: "", bairro: "", cidade: "", estado: "" },
  });

  const update = (key: string, value: string) => setForm((p) => ({ ...p, [key]: value }));
  const updateAddr = (key: string, value: string) => setForm((p) => ({ ...p, endereco: { ...p.endereco, [key]: value } }));

  const handleAddressFound = (addr: { logradouro: string; bairro: string; cidade: string; estado: string }) => {
    setForm((p) => ({ ...p, endereco: { ...p.endereco, ...addr } }));
    toast.success("Endereço preenchido automaticamente");
  };

  const handleSubmit = () => {
    toast.success("Fornecedor cadastrado com sucesso!");
    setShowForm(false);
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

      <FormModal open={showForm} onOpenChange={setShowForm} title="Novo Fornecedor" description="Cadastre um novo fornecedor com dados de contato e categoria." size="xl">
        <div className="space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Tipo</label>
            <div className="grid grid-cols-2 gap-3">
              {([
                { key: "empresa" as const, label: "Empresa", icon: Building2 },
                { key: "pessoa" as const, label: "Pessoa Física", icon: UserRound },
              ]).map(({ key, label, icon: Icon }) => (
                <button key={key} type="button" onClick={() => update("type", key)}
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
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Nome" placeholder="Nome do fornecedor" value={form.nome} onChange={(e) => update("nome", e.target.value)} />
            <DocumentInput type={form.type === "empresa" ? "cnpj" : "cpf"} value={form.cpfCnpj} onValueChange={(raw) => update("cpfCnpj", raw)} />
            <TextInput label="Categoria" placeholder="Ex: Tecnologia, Logística..." value={form.categoria} onChange={(e) => update("categoria", e.target.value)} icon={<Tag className="w-4 h-4" />} />
            <TextInput label="Contato Responsável" placeholder="Nome do contato" value={form.contatoResponsavel} onChange={(e) => update("contatoResponsavel", e.target.value)} />
          </div>
          <div className="h-px bg-border/30" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
          <div className="grid grid-cols-2 gap-4">
            <PhoneInput value={form.telefone} onValueChange={(raw) => update("telefone", raw)} />
            <TextInput label="Email" type="email" placeholder="email@exemplo.com" value={form.email} onChange={(e) => update("email", e.target.value)} icon={<Mail className="w-4 h-4" />} />
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
          <TextInput label="Observações" placeholder="Observações..." value={form.observacoes} onChange={(e) => update("observacoes", e.target.value)} />
          <div className="h-px bg-border/30" />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-lg">Cancelar</Button>
            <Button onClick={handleSubmit} className="rounded-lg gap-2 shadow-sm"><Check className="w-4 h-4" /> Salvar Fornecedor</Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
