import { useState } from "react";
import { Package, Plus, Check, Info, FileSearch, Users, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";
import { Card } from "@/components/ui/card";
import { FormModal } from "@/components/FormModal";
import { ModuleTabs } from "@/components/ModuleTabs";
import { TextInput } from "@/components/inputs/TextInput";
import { CurrencyInput } from "@/components/inputs/CurrencyInput";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

const tabs = [
  { id: "info", label: "Informações", icon: Info },
  { id: "contratos", label: "Contratos", icon: FileSearch, count: 0 },
  { id: "clientes", label: "Clientes", icon: Users, count: 0 },
];

export default function ProdutosServicos() {
  const [showForm, setShowForm] = useState(false);
  const [activeTab, setActiveTab] = useState("info");
  const [form, setForm] = useState({ nome: "", descricao: "", categoria: "", preco: 0, tipo: "servico", ativo: "true" });

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Produtos & Serviços</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Catálogo de produtos e serviços</p>
        </div>
        <Button onClick={() => setShowForm(true)} className="rounded-lg gap-2 shadow-sm"><Plus className="w-4 h-4" /> Novo Item</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Package} title="Total" value="0" />
        <StatCard icon={Tag} title="Categorias" value="0" />
        <StatCard icon={Users} title="Clientes Vinculados" value="0" />
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <ModuleTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        <div className="p-4">
          <div className="py-12 text-center">
            <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3 mx-auto"><Package className="w-5 h-5 text-muted-foreground/30" /></div>
            <p className="text-sm text-muted-foreground font-medium">Selecione um item para ver detalhes</p>
          </div>
        </div>
      </Card>

      <FormModal open={showForm} onOpenChange={setShowForm} title="Novo Produto / Serviço" description="Adicione ao catálogo." size="md">
        <div className="space-y-5">
          <TextInput label="Nome" placeholder="Nome do item" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
          <TextInput label="Descrição" placeholder="Descrição breve" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <TextInput label="Categoria" placeholder="Ex: Software, Consultoria..." value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} icon={<Tag className="w-4 h-4" />} />
            <CurrencyInput label="Preço" value={form.preco} onValueChange={(v) => setForm({ ...form, preco: v })} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Tipo</label>
              <Select value={form.tipo} onValueChange={(v) => setForm({ ...form, tipo: v })}>
                <SelectTrigger className="rounded-lg h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="servico">Serviço</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-foreground">Status</label>
              <Select value={form.ativo} onValueChange={(v) => setForm({ ...form, ativo: v })}>
                <SelectTrigger className="rounded-lg h-10"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="true">Ativo</SelectItem>
                  <SelectItem value="false">Inativo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="h-px bg-border/30" />
          <div className="flex justify-end gap-3 pt-1">
            <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-lg">Cancelar</Button>
            <Button onClick={() => { toast.success("Item cadastrado!"); setShowForm(false); }} className="rounded-lg gap-2 shadow-sm"><Check className="w-4 h-4" /> Salvar</Button>
          </div>
        </div>
      </FormModal>
    </div>
  );
}
