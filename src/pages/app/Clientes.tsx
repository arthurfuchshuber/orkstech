import { Users, Search, Plus, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/StatCard";

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
        <StatCard icon={Users} title="Total de Clientes" value="0" />
        <StatCard icon={Building2} title="Enterprise" value="0" />
        <StatCard icon={Users} title="Ativos" value="0" />
      </div>

      <div className="rounded-xl glass overflow-hidden">
        <div className="p-5 border-b border-border/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Lista de Clientes</h3>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-sm text-muted-foreground">
            <Search className="w-4 h-4" />
            <span>Buscar cliente...</span>
          </div>
        </div>
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <Users className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Adicione seu primeiro cliente para começar</p>
        </div>
      </div>
    </div>
  );
}
