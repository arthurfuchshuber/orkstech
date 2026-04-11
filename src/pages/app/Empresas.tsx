import { useState } from "react";
import { Building2, Plus, Check, Mail, MapPin, Home, Info, Users, FileSearch, DollarSign, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { FormModal } from "@/components/FormModal";
import { ModuleTabs } from "@/components/ModuleTabs";
import { DocumentInput } from "@/components/inputs/DocumentInput";
import { PhoneInput } from "@/components/inputs/PhoneInput";
import { CepInput } from "@/components/inputs/CepInput";
import { TextInput } from "@/components/inputs/TextInput";
import { toast } from "sonner";

const tabs = [
  { id: "info", label: "Informações", icon: Info },
  { id: "clientes", label: "Clientes", icon: Users, count: 0 },
  { id: "contratos", label: "Contratos", icon: FileSearch, count: 0 },
  { id: "financeiro", label: "Financeiro", icon: DollarSign, count: 0 },
  { id: "usuarios", label: "Usuários", icon: UserRound, count: 0 },
];

export default function Empresas() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [form, setForm] = useState({
    razaoSocial: "", nomeFantasia: "", cnpj: "", telefone: "", email: "", plano: "",
    endereco: { cep: "", logradouro: "", bairro: "", cidade: "", estado: "" },
  });

  const update = (k: string, v: string) => setForm((p) => ({ ...p, [k]: v }));
  const updateAddr = (k: string, v: string) => setForm((p) => ({ ...p, endereco: { ...p.endereco, [k]: v } }));

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Empresas</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gestão multiempresa</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-lg gap-2 shadow-sm"><Plus className="w-4 h-4" /> Nova Empresa</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Building2} title="Empresas" value="0" />
        <StatCard icon={Users} title="Usuários" value="0" />
        <StatCard icon={FileSearch} title="Contratos" value="0" />
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <ModuleTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="p-4">
          <div className="py-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3 mx-auto"><Building2 className="w-5 h-5 text-muted-foreground/30" /></div>
            <p className="text-sm text-muted-foreground font-medium">Selecione uma empresa para ver detalhes</p>
          </div>
        </div>
      </Card>

      <FormModal open={showForm} onOpenChange={setShowForm} title="Nova Empresa" description="Cadastre uma nova empresa do sistema." size="xl">
        <div className="space-y-6">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Dados da empresa</p>
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Razão Social" placeholder="Razão social" value={form.razaoSocial} onChange={(e) => update("razaoSocial", e.target.value)} icon={<Building2 className="w-4 h-4" />} />
            <TextInput label="Nome Fantasia" placeholder="Nome fantasia" value={form.nomeFantasia} onChange={(e) => update("nomeFantasia", e.target.value)} />
            <DocumentInput type="cnpj" value={form.cnpj} onValueChange={(raw) => update("cnpj", raw)} />
            <TextInput label="Plano" placeholder="Ex: Pro, Enterprise..." value={form.plano} onChange={(e) => update("plano", e.target.value)} />
          </div>
          <div className="h-px bg-border/30" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contato</p>
          <div className="grid grid-cols-2 gap-4">
            <PhoneInput value={form.telefone} onValueChange={(raw) => update("telefone", raw)} />
            <TextInput label="Email" type="email" placeholder="email@empresa.com" value={form.email} onChange={(e) => update("email", e.target.value)} icon={<Mail className="w-4 h-4" />} />
          </div>
          <div className="h-px bg-border/30" />
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Endereço</p>
          <div className="grid grid-cols-3 gap-4">
            <CepInput value={form.endereco.cep} onValueChange={(raw) => updateAddr("cep", raw)} onAddressFound={(a) => { setForm((p) => ({ ...p, endereco: { ...p.endereco, ...a } })); toast.success("Endereço preenchido"); }} />
            <div className="col-span-2"><TextInput label="Logradouro" placeholder="Rua, Avenida..." value={form.endereco.logradouro} onChange={(e) => updateAddr("logradouro", e.target.value)} icon={<Home className="w-4 h-4" />} /></div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <TextInput label="Bairro" placeholder="Bairro" value={form.endereco.bairro} onChange={(e) => updateAddr("bairro", e.target.value)} />
            <TextInput label="Cidade" placeholder="Cidade" value={form.endereco.cidade} onChange={(e) => updateAddr("cidade", e.target.value)} icon={<MapPin className="w-4 h-4" />} />
            <TextInput label="Estado" placeholder="UF" value={form.endereco.estado} onChange={(e) => updateAddr("estado", e.target.value)} />
          </div>
          <div className="h-px bg-border/30" />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-lg">Cancelar</Button>
            <Button onClick={() => { toast.success("Empresa cadastrada!"); setShowForm(false); }} className="rounded-lg gap-2 shadow-sm"><Check className="w-4 h-4" /> Salvar Empresa</Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
