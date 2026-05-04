import { Card, CardContent } from "@/components/ui/card";
import { ArrowDownRight, ArrowUpRight, Wallet, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  inflow: number;
  outflow: number;
  startBalance: number;
  endBalance: number;
}

export function CashflowKpis({ inflow, outflow, startBalance, endBalance }: Props) {
  const net = inflow - outflow;
  const cards = [
    { icon: Wallet, label: "Saldo Atual", value: fmt(startBalance), tone: "primary", sub: "Contas + caixinhas + investimentos" },
    { icon: ArrowUpRight, label: "Entradas Previstas", value: fmt(inflow), tone: "emerald", sub: "Receitas no período" },
    { icon: ArrowDownRight, label: "Saídas Previstas", value: fmt(outflow), tone: "rose", sub: "Despesas no período" },
    { icon: TrendingUp, label: "Saldo Projetado", value: fmt(endBalance), tone: net >= 0 ? "blue" : "amber", sub: `Resultado líquido: ${fmt(net)}` },
  ];
  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-500",
    rose: "bg-rose-500/10 text-rose-500",
    blue: "bg-sky-500/10 text-sky-500",
    amber: "bg-amber-500/10 text-amber-500",
  };
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="border-border/50">
            <CardContent className="p-4">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", tones[c.tone])}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{c.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{c.value}</p>
              <p className="text-[11px] mt-1.5 text-muted-foreground">{c.sub}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
