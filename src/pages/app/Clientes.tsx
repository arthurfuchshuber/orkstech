import { Users, Search, Plus, Building2, Mail, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";

const clientes = [
  { nome: "Alpha Technologies", contato: "João Silva", email: "joao@alpha.com", telefone: "(11) 9999-1234", tipo: "Enterprise", status: "Ativo" },
  { nome: "Beta Solutions", contato: "Maria Santos", email: "maria@beta.com", telefone: "(21) 8888-5678", tipo: "PME", status: "Ativo" },
  { nome: "Gamma Services", contato: "Pedro Oliveira", email: "pedro@gamma.com", telefone: "(31) 7777-9012", tipo: "Enterprise", status: "Inativo" },
  { nome: "Delta Corp", contato: "Ana Costa", email: "ana@delta.com", telefone: "(41) 6666-3456", tipo: "Startup", status: "Ativo" },
  { nome: "Epsilon Digital", contato: "Carlos Lima", email: "carlos@epsilon.com", telefone: "(51) 5555-7890", tipo: "PME", status: "Ativo" },
];

export default function Clientes() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clientes</h1>
          <p className="text-muted-foreground text-sm">Gerencie sua base de clientes</p>
        </div>
        <Button className="glow">
          <Plus className="w-4 h-4 mr-2" /> Novo Cliente
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} title="Total de Clientes" value="284" change="+12 este mês" changeType="positive" />
        <StatCard icon={Building2} title="Enterprise" value="45" change="16% da base" changeType="neutral" />
        <StatCard icon={Users} title="Ativos" value="261" change="92% da base" changeType="positive" />
      </div>

      <div className="rounded-xl glass overflow-hidden">
        <div className="p-5 border-b border-border/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Lista de Clientes</h3>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <Search className="w-4 h-4" />
            <span>Buscar cliente...</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Empresa</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Contato</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Email</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Tipo</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {clientes.map((c) => (
                <tr key={c.nome} className="border-b border-border/20 hover:bg-muted/30 transition-colors cursor-pointer">
                  <td className="p-4 text-sm font-medium text-foreground">{c.nome}</td>
                  <td className="p-4 text-sm text-muted-foreground">{c.contato}</td>
                  <td className="p-4 text-sm text-primary">{c.email}</td>
                  <td className="p-4"><span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-secondary text-secondary-foreground">{c.tipo}</span></td>
                  <td className="p-4">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${c.status === "Ativo" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
