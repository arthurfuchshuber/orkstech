import { DollarSign, TrendingUp, Users, Activity, Plus, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral da sua operação</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Receita Mensal" value="R$ 0,00" />
        <StatCard icon={TrendingUp} title="Lucro Líquido" value="R$ 0,00" />
        <StatCard icon={Users} title="Clientes Ativos" value="0" />
        <StatCard icon={Activity} title="Health Score Médio" value="--" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="p-8 rounded-xl glass flex flex-col items-center justify-center text-center min-h-[280px]">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Receita vs Despesas</h3>
          <p className="text-xs text-muted-foreground mb-4">Nenhum dado financeiro registrado ainda</p>
          <Button variant="outline" size="sm">
            <Plus className="w-3 h-3 mr-1" /> Adicionar transação
          </Button>
        </div>

        <div className="p-8 rounded-xl glass flex flex-col items-center justify-center text-center min-h-[280px]">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
            <Activity className="w-6 h-6 text-primary" />
          </div>
          <h3 className="text-sm font-semibold text-foreground mb-1">NPS Score</h3>
          <p className="text-xs text-muted-foreground mb-4">Sem pesquisas de NPS registradas</p>
          <Button variant="outline" size="sm">
            <ArrowRight className="w-3 h-3 mr-1" /> Configurar NPS
          </Button>
        </div>
      </div>

      <div className="p-8 rounded-xl glass flex flex-col items-center justify-center text-center">
        <h3 className="text-sm font-semibold text-foreground mb-1">Atividade Recente</h3>
        <p className="text-xs text-muted-foreground">Nenhuma atividade registrada</p>
      </div>
    </div>
  );
}
