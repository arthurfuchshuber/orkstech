import { DollarSign, TrendingUp, Users, Activity, Plus, ArrowRight } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Visão geral da sua operação</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Receita Mensal" value="R$ 0,00" />
        <StatCard icon={TrendingUp} title="Lucro Líquido" value="R$ 0,00" />
        <StatCard icon={Users} title="Clientes Ativos" value="0" />
        <StatCard icon={Activity} title="Health Score Médio" value="--" />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[260px]">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">Receita vs Despesas</h3>
            <p className="text-xs text-muted-foreground mb-4">Nenhum dado financeiro registrado ainda</p>
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5">
              <Plus className="w-3 h-3" /> Adicionar transação
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-8 flex flex-col items-center justify-center text-center min-h-[260px]">
            <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Activity className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold text-foreground mb-1">NPS Score</h3>
            <p className="text-xs text-muted-foreground mb-4">Sem pesquisas de NPS registradas</p>
            <Button variant="outline" size="sm" className="rounded-lg gap-1.5">
              <ArrowRight className="w-3 h-3" /> Configurar NPS
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-8 flex flex-col items-center justify-center text-center">
          <h3 className="text-sm font-semibold text-foreground mb-1">Atividade Recente</h3>
          <p className="text-xs text-muted-foreground">Nenhuma atividade registrada</p>
        </CardContent>
      </Card>
    </div>
  );
}
