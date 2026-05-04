import { ArrowDownRight, ArrowUpRight, Wallet, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";
import { KpiHoverCard, KpiCardShell } from "@/components/financas/KpiHoverCard";

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
  const navigate = useNavigate();

  const tones: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-500",
    rose: "bg-rose-500/10 text-rose-500",
    blue: "bg-sky-500/10 text-sky-500",
    amber: "bg-amber-500/10 text-amber-500",
  };

  const cards = [
    {
      icon: Wallet,
      label: "Saldo Atual",
      value: fmt(startBalance),
      tone: "primary",
      sub: "Contas bancárias ativas",
      title: "Saldo Atual em Contas",
      subtitle: "Soma dos saldos das contas bancárias ativas (Open Finance + manuais).",
      details: [
        { label: "Saldo bancário consolidado", value: fmt(startBalance), highlight: true, fromApi: true },
      ],
      onOpen: () => navigate("/app/financas/contas-bancarias"),
      openLabel: "Ver contas",
      readOnlyReason: "Origem: Open Finance / Cadastro de contas",
    },
    {
      icon: ArrowUpRight,
      label: "Entradas Previstas",
      value: fmt(inflow),
      tone: "emerald",
      sub: "Receitas no período",
      title: "Entradas Previstas no Período",
      subtitle: "Soma das contas a receber + previsões de entrada no intervalo selecionado.",
      details: [
        { label: "Total de entradas", value: fmt(inflow), highlight: true },
      ],
      onOpen: () => navigate("/app/financas/contas-receber"),
      openLabel: "Contas a Receber",
    },
    {
      icon: ArrowDownRight,
      label: "Saídas Previstas",
      value: fmt(outflow),
      tone: "rose",
      sub: "Despesas no período",
      title: "Saídas Previstas no Período",
      subtitle: "Soma das contas a pagar + previsões de saída no intervalo selecionado.",
      details: [
        { label: "Total de saídas", value: fmt(outflow), highlight: true },
      ],
      onOpen: () => navigate("/app/financas/contas-pagar"),
      openLabel: "Contas a Pagar",
    },
    {
      icon: TrendingUp,
      label: "Saldo Projetado",
      value: fmt(endBalance),
      tone: net >= 0 ? "blue" : "amber",
      sub: `Resultado líquido: ${fmt(net)}`,
      title: "Saldo Projetado no Final do Período",
      subtitle: "Saldo atual + entradas previstas − saídas previstas.",
      details: [
        { label: "Saldo inicial", value: fmt(startBalance) },
        { label: "Entradas", value: `+ ${fmt(inflow)}` },
        { label: "Saídas", value: `− ${fmt(outflow)}` },
        { label: "Resultado líquido", value: fmt(net), highlight: true },
        { label: "Saldo final", value: fmt(endBalance), highlight: true },
      ],
      readOnlyReason: "Calculado automaticamente",
    },
  ] as const;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((c: any) => {
        const Icon = c.icon;
        return (
          <KpiHoverCard
            key={c.label}
            title={c.title}
            subtitle={c.subtitle}
            details={c.details}
            onOpen={c.onOpen}
            openLabel={c.openLabel}
            readOnlyReason={c.readOnlyReason}
          >
            <KpiCardShell>
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", tones[c.tone])}>
                <Icon className="w-4 h-4" />
              </div>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{c.label}</p>
              <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{c.value}</p>
              <p className="text-[11px] mt-1.5 text-muted-foreground">{c.sub}</p>
            </KpiCardShell>
          </KpiHoverCard>
        );
      })}
    </div>
  );
}
