import { useState } from "react";
import { eventBus } from "@/lib/events";
import { FileSearch, Plus, Check, Info, DollarSign, FileText, Clock, Users, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { FormModal } from "@/components/FormModal";
import { ModuleTabs } from "@/components/ModuleTabs";
import { TextInput } from "@/components/inputs/TextInput";
import { CurrencyInput } from "@/components/inputs/CurrencyInput";
import { DateInput } from "@/components/inputs/DateInput";
import { RelatedFinancial } from "@/components/modules/RelatedFinancial";
import { RelatedDocuments } from "@/components/modules/RelatedDocuments";
import { RelatedHistory } from "@/components/modules/RelatedHistory";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const tabs = [
  { id: "info", label: "Informações", icon: Info },
  { id: "parcelas", label: "Parcelas", icon: DollarSign, count: 0 },
  { id: "documentos", label: "Documentos", icon: FileText, count: 0 },
  { id: "historico", label: "Histórico", icon: Clock, count: 0 },
];

export default function Contratos() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [form, setForm] = useState({
    cliente: "", empresa: "", produto: "", valor: 0,
    dataInicio: undefined as Date | undefined, dataTermino: undefined as Date | undefined,
    status: "ativo", descricao: "",
  });

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Contratos</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Gerencie contratos e vínculos</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-lg gap-2 shadow-sm"><Plus className="w-4 h-4" /> Novo Contrato</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <StatCard icon={FileSearch} title="Total" value="0" />
        <StatCard icon={Check} title="Ativos" value="0" />
        <StatCard icon={Calendar} title="Vencendo" value="0" />
        <StatCard icon={DollarSign} title="Valor Total" value="R$ 0,00" />
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <ModuleTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="p-4">
          {activeTab === "parcelas" ? <RelatedFinancial /> : activeTab === "documentos" ? <RelatedDocuments /> : activeTab === "historico" ? <RelatedHistory /> : (
            <div className="py-12 text-center"><div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3 mx-auto"><FileSearch className="w-5 h-5 text-muted-foreground/30" /></div><p className="text-sm text-muted-foreground font-medium">Selecione um contrato</p></div>
          )}
        </div>
      </Card>

      <FormModal open={showForm} onOpenChange={setShowForm} title="Novo Contrato" description="Vincule cliente, produto e defina as condições do contrato." size="lg">
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Cliente" placeholder="Selecione o cliente" value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })} icon={<Users className="w-4 h-4" />} />
            <TextInput label="Produto / Serviço" placeholder="Selecione" value={form.produto} onChange={(e) => setForm({ ...form, produto: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput label="Valor" value={form.valor} onValueChange={(v) => setForm({ ...form, valor: v })} />
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Status</label>
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="rounded-lg h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="pendente">Pendente</SelectItem>
                  <SelectItem value="encerrado">Encerrado</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <DateInput label="Data de Início" value={form.dataInicio} onValueChange={(d) => setForm({ ...form, dataInicio: d })} />
            <DateInput label="Data de Término" value={form.dataTermino} onValueChange={(d) => setForm({ ...form, dataTermino: d })} />
          </div>
          <TextInput label="Descrição" placeholder="Detalhes do contrato..." value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <div className="h-px bg-border/30" />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-lg">Cancelar</Button>
            <Button onClick={() => { eventBus.emit({ type: "contrato.criado", data: { cliente: form.cliente, valor: form.valor, descricao: `Contrato criado para ${form.cliente}` }, moduloOrigem: "contratos", registroId: crypto.randomUUID() }); toast.success("Contrato criado!"); setShowForm(false); }} className="rounded-lg gap-2 shadow-sm"><Check className="w-4 h-4" /> Salvar Contrato</Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
