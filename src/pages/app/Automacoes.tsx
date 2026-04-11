import { Workflow, Zap, Clock, CheckCircle, Plus } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";

export default function Automacoes() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground text-sm">Workflows e integrações automatizadas</p>
        </div>
        <Button className="glow">
          <Zap className="w-4 h-4 mr-2" /> Novo Workflow
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Workflow} title="Workflows Ativos" value="0" />
        <StatCard icon={CheckCircle} title="Execuções (mês)" value="0" />
        <StatCard icon={Clock} title="Tempo Médio" value="--" />
      </div>

      <div className="rounded-xl glass overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground">Workflows</h3>
        </div>
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <Workflow className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum workflow criado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Crie automações para otimizar seus processos</p>
        </div>
      </div>
    </div>
  );
}
