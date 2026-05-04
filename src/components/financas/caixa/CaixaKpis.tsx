import { Landmark, CreditCard, PiggyBank, Receipt, TrendingUp, TrendingDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { PluggyLastSyncBadge } from "@/components/PluggyLastSyncBadge";
import { AjusteContaTrigger } from "@/components/financas/AjusteContaTrigger";
import { DivergenciaBadge } from "@/components/financas/DivergenciaBadge";
import { useSaldoDivergencias } from "@/hooks/useSaldoDivergencias";
import type { AjusteCampo } from "@/components/financas/AjusteValorDialog";
import { KpiHoverCard, KpiCardShell } from "@/components/financas/KpiHoverCard";
import { useNavigate } from "react-router-dom";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface KpiProps {
  totalBalance: number;
  totalInvestments: number;
  totalCreditAvailable: number;
  totalCreditBills: number;
  totalCreditLimit: number;
  totalOverdraftAvailable: number;
  totalOverdraftLimit: number;
  totalOverdraftUsed: number;
  balanceDeltaPct?: number | null;
  /** Última sincronização Open Finance (mais recente entre as conexões) */
  lastSyncAt?: string | null;
  /** Status agregado: "connected" se ao menos uma OK; senão o pior status */
  syncStatus?: string | null;
  /** True se existe ao menos uma conexão Pluggy ativa */
  hasPluggy?: boolean;
}

export function CaixaKpis({
  totalBalance,
  totalInvestments,
  totalCreditAvailable,
  totalCreditBills,
  totalCreditLimit,
  totalOverdraftAvailable,
  totalOverdraftLimit,
  totalOverdraftUsed,
  balanceDeltaPct,
  lastSyncAt,
  syncStatus,
  hasPluggy,
}: KpiProps) {
  const utilizacao = totalCreditLimit > 0 ? ((totalCreditLimit - totalCreditAvailable) / totalCreditLimit) * 100 : 0;
  const odUtilizacao = totalOverdraftLimit > 0 ? (totalOverdraftUsed / totalOverdraftLimit) * 100 : 0;
  const { data: divergencias } = useSaldoDivergencias();
  const divergenciaSaldoTotal = divergencias?.total ?? 0;
  const navigate = useNavigate();

  const cards: Array<{
    icon: any; label: string; flag: string; value: string;
    sub?: string; subColor?: string; tone: "primary" | "emerald" | "blue" | "amber" | "violet";
    trend?: "up" | "down" | null; ajusteCampo?: AjusteCampo;
  }> = [
    {
      icon: Landmark,
      label: "Saldo em Contas",
      flag: "Contas Correntes",
      value: fmt(totalBalance),
      tone: "primary",
      trend: null,
      ajusteCampo: "saldo",
    },
    {
      icon: PiggyBank,
      label: "Investimentos",
      flag: "Aplicações",
      value: fmt(totalInvestments),
      tone: "emerald",
      ajusteCampo: "investimento",
    },
    {
      icon: CreditCard,
      label: "Limite Disponível",
      flag: "Cartões de Crédito",
      value: fmt(totalCreditAvailable),
      sub: totalCreditLimit > 0 ? `${utilizacao.toFixed(0)}% utilizado de ${fmt(totalCreditLimit)}` : "Nenhum cartão",
      tone: "blue",
      ajusteCampo: "limite_credito",
    },
    {
      icon: Receipt,
      label: "Faturas em Aberto",
      flag: "Cartões de Crédito",
      value: fmt(totalCreditBills),
      tone: "amber",
      ajusteCampo: "fatura",
    },
    {
      icon: Wallet,
      label: "Cheque Especial",
      flag: "Limite Disponível",
      value: fmt(totalOverdraftAvailable),
      sub: totalOverdraftLimit > 0
        ? `${odUtilizacao.toFixed(0)}% utilizado de ${fmt(totalOverdraftLimit)}`
        : "Nenhum limite contratado",
      tone: "violet",
      ajusteCampo: "limite_cheque_especial",
    },
  ];

  const toneStyles: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-500/10 text-emerald-400",
    blue: "bg-sky-500/10 text-sky-400",
    amber: "bg-amber-500/10 text-amber-400",
    violet: "bg-violet-500/10 text-violet-400",
  };

  const flagStyles: Record<string, string> = {
    primary: "bg-primary/10 text-primary border-primary/20",
    emerald: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    blue: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    violet: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  };

  return (
    <div className="space-y-2">
      {hasPluggy && (
        <div className="flex items-center justify-end px-1 min-h-[16px]">
          <PluggyLastSyncBadge lastSyncAt={lastSyncAt} status={syncStatus} />
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {cards.map((c) => {
          const Icon = c.icon;
          const details = [
            { label: c.label, value: c.value, highlight: true, fromApi: hasPluggy },
            ...(c.sub ? [{ label: "Detalhe", value: c.sub }] : []),
            ...(c.ajusteCampo === "saldo" && divergenciaSaldoTotal !== 0
              ? [{ label: "Divergência vs extrato", value: fmt(divergenciaSaldoTotal) }]
              : []),
          ];
          return (
            <KpiHoverCard
              key={c.label}
              title={c.label}
              subtitle={c.flag}
              details={details}
              onOpen={() => navigate("/app/financas/contas-bancarias")}
              openLabel="Ver contas"
              readOnlyReason={hasPluggy ? "Sincronizado via Open Finance — use 'Ajustar' para correção manual" : undefined}
            >
              <KpiCardShell className="relative overflow-visible">
                {c.flag && (
                  <span className={cn(
                    "absolute -top-2 right-3 text-[9px] uppercase tracking-wider font-medium px-2 py-0.5 rounded border whitespace-nowrap",
                    flagStyles[c.tone]
                  )}>
                    {c.flag}
                  </span>
                )}
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center", toneStyles[c.tone])}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    {c.trend && (
                      c.trend === "up"
                        ? <TrendingUp className="w-3.5 h-3.5 text-success" />
                        : <TrendingDown className="w-3.5 h-3.5 text-destructive" />
                    )}
                    {c.ajusteCampo && <AjusteContaTrigger campo={c.ajusteCampo} />}
                  </div>
                </div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{c.label}</p>
                <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{c.value}</p>
                {c.sub && (
                  <p className={cn("text-[11px] mt-1.5", c.subColor || "text-muted-foreground")}>{c.sub}</p>
                )}
                {c.ajusteCampo === "saldo" && (
                  <div className="mt-2"><DivergenciaBadge delta={divergenciaSaldoTotal} /></div>
                )}
              </KpiCardShell>
            </KpiHoverCard>
          );
        })}
      </div>
    </div>
  );
}
