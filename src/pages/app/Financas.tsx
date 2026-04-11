import { DollarSign, TrendingUp, TrendingDown, CreditCard, Plus } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";

export default function Financas() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Finanças</h1>
          <p className="text-muted-foreground text-sm">Gestão financeira completa</p>
        </div>
        <Button className="glow">
          <Plus className="w-4 h-4 mr-2" /> Nova Transação
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Saldo Atual" value="R$ 0,00" />
        <StatCard icon={TrendingUp} title="Receitas (mês)" value="R$ 0,00" />
        <StatCard icon={TrendingDown} title="Despesas (mês)" value="R$ 0,00" />
        <StatCard icon={CreditCard} title="A Receber" value="R$ 0,00" />
      </div>

      <div className="rounded-xl glass overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground">Transações Recentes</h3>
        </div>
        <div className="p-12 flex flex-col items-center justify-center text-center">
          <DollarSign className="w-10 h-10 text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma transação registrada</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Adicione sua primeira transação para começar</p>
        </div>
      </div>
    </div>
  );
}
