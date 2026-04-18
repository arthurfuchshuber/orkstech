import { Card, CardContent } from "@/components/ui/card";
import { Landmark, CreditCard, PiggyBank, Receipt, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface KpiProps {
  totalBalance: number;
  totalInvestments: number;
  totalCreditAvailable: number;
  totalCreditBills: number;
  totalCreditLimit: number;
  balanceDeltaPct?: number | null;
}

export function CaixaKpis({
  totalBalance,
  totalInvestments,
  totalCreditAvailable,
  totalCreditBills,
  totalCreditLimit,
  balanceDeltaPct,
}: KpiProps) {
  const liquidez = totalBalance + totalInvestments;
  const utilizacao = totalCreditLimit > 0 ? ((totalCreditLimit - totalCreditAvailable) / totalCreditLimit) * 100 : 0;

  const cards = [
    {
      icon: Landmark,
      label: "Saldo em Contas",
      flag: "Contas Correntes",
      value: fmt(totalBalance),
      sub: balanceDeltaPct != null ? `${balanceDeltaPct >= 0 ? "+" : ""}${balanceDeltaPct.toFixed(1)}% vs mês anterior` : undefined,
      subColor: balanceDeltaPct == null ? undefined : balanceDeltaPct >= 0 ? "text-success" : "text-destructive",
      tone: "primary" as const,
      trend: balanceDeltaPct != null ? (balanceDeltaPct >= 0 ? "up" : "down") : null,
    },
    {
      icon: PiggyBank,
      label: "Investimentos",
      flag: "Aplicações",
      value: fmt(totalInvestments),
      sub: `Liquidez total: ${fmt(liquidez)}`,
      tone: "emerald" as const,
    },
    {
      icon: CreditCard,
      label: "Limite Disponível",
      flag: "Cartões de Crédito",
      value: fmt(totalCreditAvailable),
      sub: totalCreditLimit > 0 ? `${utilizacao.toFixed(0)}% utilizado de ${fmt(totalCreditLimit)}` : "Nenhum cartão",
      tone: "blue" as const,
    },
    {
      icon: Receipt,
      label: "Faturas em Aberto",
      flag: "Cartões de Crédito",
      value: fmt(totalCreditBills),
      sub: totalCreditBills > 0 ? "Próximas faturas a pagar" : "Sem faturas em aberto",
      tone: "amber" as const,
    },
  ];

  const toneStyles: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-400",
    blue: "bg-sky-500/10 text-sky-400",
    amber: "bg-amber-500/10 text-amber-400",
  };

  const flagStyles: Record<string, string> = {
    primary: "bg-primary/10 text-primary border-primary/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blue: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <Card key={c.label} className="border-border/50 hover:border-border transition-colors relative overflow-visible">
            {c.flag && (
              <span className={cn(
                "absolute -top-2 right-3 text-[9px] uppercase tracking-wider font-medium px-2 py-0.5 rounded border whitespace-nowrap",
                flagStyles[c.tone]
              )}>
                {c.flag}
              </span>
            )}
            <CardContent className="p-4">
              <div className="flex items-start justify-between mb-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", toneStyles[c.tone])}>
                  <Icon className="w-4 h-4" />
                </div>
                {c.trend && (
                  c.trend === "up"
                    ? <TrendingUp className="w-3.5 h-3.5 text-success mt-5" />
                    : <TrendingDown className="w-3.5 h-3.5 text-destructive mt-5" />
                )}
              </div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{c.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{c.value}</p>
              {c.sub && (
                <p className={cn("text-[11px] mt-1.5", c.subColor || "text-muted-foreground")}>{c.sub}</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
