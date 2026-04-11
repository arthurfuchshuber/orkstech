import { HeartHandshake, Target, UserCheck, TrendingDown } from "lucide-react";
import { StatCard } from "@/components/StatCard";

export default function CustomerSuccess() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Success</h1>
        <p className="text-muted-foreground text-sm">Monitore a saúde e satisfação dos seus clientes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={HeartHandshake} title="Health Score Médio" value="--" />
        <StatCard icon={Target} title="NPS Score" value="--" />
        <StatCard icon={TrendingDown} title="Churn Rate" value="--" />
        <StatCard icon={UserCheck} title="Onboarding Ativo" value="0" />
      </div>

      <div className="rounded-xl glass overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground">Clientes - Health Score</h3>
        </div>
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <HeartHandshake className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhum cliente cadastrado</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Cadastre clientes para acompanhar a saúde da sua base</p>
        </div>
      </div>
    </div>
  );
}
