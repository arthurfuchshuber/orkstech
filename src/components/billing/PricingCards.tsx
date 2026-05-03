import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Loader2, Sparkles, Zap, Building2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePlans, type BillingInterval } from "@/hooks/usePlans";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface PricingCardsProps {
  /** Quando true, força o modo público: CTAs redirecionam para /register em vez de checkout. */
  publicMode?: boolean;
}

// Visuais base (ícone) — tagline e highlight agora vêm do banco (plan_overrides)
const PLAN_ICONS: Record<string, any> = {
  starter: Zap,
  pro: Sparkles,
  enterprise: Building2,
};

const INTERVAL_LABELS: Record<BillingInterval, string> = {
  monthly: "Mensal",
  semiannual: "Semestral",
  annual: "Anual",
};

const INTERVAL_DIVISOR: Record<BillingInterval, number> = {
  monthly: 1,
  semiannual: 6,
  annual: 12,
};

const INTERVAL_SUFFIX: Record<BillingInterval, string> = {
  monthly: "/mês",
  semiannual: "/mês — cobrado a cada 6 meses",
  annual: "/mês — cobrado anualmente",
};

const fmtBRL = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(cents / 100);

export function PricingCards({ publicMode = false }: PricingCardsProps) {
  const { data: plans, isLoading } = usePlans();
  const { user } = useAuth();
  const { currentPlan } = useSubscription();
  const navigate = useNavigate();
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  // Em modo público (landing) ou sem usuário logado, sempre tratar como "sem plano"
  const effectiveCurrentPlan = publicMode || !user ? null : currentPlan;

  const handleSubscribe = async (priceId: string) => {
    // Sem usuário ou modo público: redireciona para cadastro carregando o priceId
    if (publicMode || !user) {
      navigate(`/register?priceId=${encodeURIComponent(priceId)}`);
      return;
    }
    setLoadingPriceId(priceId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: { priceId },
      });
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast.error("Erro ao iniciar checkout: " + (e.message || "Tente novamente"));
    } finally {
      setLoadingPriceId(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!plans?.length) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Não foi possível carregar os planos no momento.</p>
      </Card>
    );
  }

  // Discount calc vs monthly
  const monthlyRef = (productId: string) =>
    plans.find((p) => p.product_id === productId)?.prices.monthly?.amount ?? 0;

  return (
    <div className="space-y-6">
      {/* Interval toggle */}
      <div className="flex flex-col items-center gap-2">
        <Tabs value={interval} onValueChange={(v) => setInterval(v as BillingInterval)}>
          <TabsList className="bg-muted/50 border border-border/50 p-1 h-auto">
            {(Object.keys(INTERVAL_LABELS) as BillingInterval[]).map((key) => (
              <TabsTrigger
                key={key}
                value={key}
                className="px-4 py-1.5 text-xs data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
              >
                {INTERVAL_LABELS[key]}
                {key === "annual" && (
                  <span className="ml-1.5 text-[10px] font-semibold text-emerald-500 data-[state=active]:text-primary-foreground">
                    -20%
                  </span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <p className="text-[11px] text-muted-foreground">
          {plans[0]?.trial_days ?? 7} dias grátis em qualquer plano. Cancele quando quiser.
        </p>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {plans.map((plan) => {
          const Icon = PLAN_ICONS[plan.key] ?? Sparkles;
          const tagline = plan.tagline ?? "";
          const highlight = plan.highlight;
          const badge = highlight ? "Mais Contratado" : null;
          const isCurrent = effectiveCurrentPlan === plan.key;
          const price = plan.prices[interval];
          const monthlyPrice = monthlyRef(plan.product_id);
          const effectivePerMonth = price ? Math.round(price.amount / INTERVAL_DIVISOR[interval]) : null;
          const totalSavings =
            interval !== "monthly" && price && monthlyPrice
              ? monthlyPrice * INTERVAL_DIVISOR[interval] - price.amount
              : 0;
          const isLoading = loadingPriceId === price?.id;

          // CTA dinâmico para quem já tem assinatura
          const hasAnyPlan = !!effectiveCurrentPlan;
          const currentPlanRank = effectiveCurrentPlan
            ? plans.findIndex((p) => p.key === effectiveCurrentPlan)
            : -1;
          const thisPlanRank = plans.findIndex((p) => p.key === plan.key);
          const isUpgrade = hasAnyPlan && !isCurrent && thisPlanRank > currentPlanRank;
          const isDowngrade = hasAnyPlan && !isCurrent && thisPlanRank < currentPlanRank;

          const ctaLabel = isCurrent
            ? "Plano selecionado"
            : !hasAnyPlan
            ? "Começar teste grátis"
            : isUpgrade
            ? "Fazer upgrade"
            : isDowngrade
            ? "Mudar para este plano"
            : "Migrar para este plano";

          return (
            <Card
              key={plan.key}
              data-plan-key={plan.key}
              className={cn(
                "relative p-6 flex flex-col transition-all duration-200 snap-center shrink-0 w-[85%] min-[380px]:w-[80%] sm:w-[70%] md:w-auto",
                highlight
                  ? "border-primary/60 bg-gradient-to-b from-primary/[0.04] to-transparent shadow-[0_0_0_1px_hsl(var(--primary)/0.2),0_8px_32px_-12px_hsl(var(--primary)/0.3)] md:scale-[1.02]"
                  : "border-border/50 hover:border-border",
                isCurrent && "ring-2 ring-primary/40"
              )}
            >
              {badge && (
                <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground text-[10px] uppercase tracking-wider px-2.5 py-0.5 shadow-sm">
                    {badge}
                  </Badge>
                </div>
              )}

              {isCurrent && (
                <div className="absolute -top-2.5 right-4">
                  <Badge variant="secondary" className="text-[10px] uppercase tracking-wider px-2 py-0.5">
                    Plano atual
                  </Badge>
                </div>
              )}

              {/* Header */}
              <div className="flex items-center gap-2.5 mb-1">
                <div
                  className={cn(
                    "h-9 w-9 rounded-lg flex items-center justify-center",
                    highlight ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  <Icon className="w-4 h-4" />
                </div>
                <h3 className="text-lg font-semibold text-foreground">{plan.name}</h3>
              </div>
              <p className="text-xs text-muted-foreground min-h-[32px]">{tagline}</p>
              {plan.description && (
                <p className="text-[11px] text-muted-foreground/80 mt-1">{plan.description}</p>
              )}
              

              {/* Price */}
              <div className="mt-5 mb-5">
                {effectivePerMonth !== null ? (
                  <>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-bold text-foreground tracking-tight">
                        {fmtBRL(effectivePerMonth)}
                      </span>
                      <span className="text-xs text-muted-foreground">/mês</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {interval === "monthly"
                        ? "Cobrado mensalmente"
                        : interval === "semiannual"
                        ? `Total ${fmtBRL(price!.amount)} a cada 6 meses`
                        : `Total ${fmtBRL(price!.amount)} por ano`}
                    </p>
                    {totalSavings > 0 && (
                      <p className="text-[11px] text-emerald-500 font-medium mt-1">
                        Economize {fmtBRL(totalSavings)} vs mensal
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Indisponível neste ciclo</p>
                )}
              </div>

              {/* Features */}
              <ul className="space-y-2.5 mb-6 flex-1">
                {plan.features?.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-foreground/90">
                    <Check
                      className={cn(
                        "w-3.5 h-3.5 mt-0.5 shrink-0",
                        highlight ? "text-primary" : "text-emerald-500"
                      )}
                    />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <Button
                onClick={() => price && handleSubscribe(price.id)}
                disabled={!price || isLoading || isCurrent}
                variant={highlight ? "default" : "outline"}
                className={cn(
                  "w-full",
                  highlight && "shadow-sm",
                  isCurrent && "opacity-60"
                )}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    Redirecionando...
                  </>
                ) : isCurrent ? (
                  <>
                    <Check className="w-3.5 h-3.5 mr-1.5" />
                    {ctaLabel}
                  </>
                ) : (
                  ctaLabel
                )}
              </Button>
              {!isCurrent && price && !hasAnyPlan && (
                <p className="text-[10px] text-center text-muted-foreground mt-2">
                  {plan.trial_days} dias grátis • Cobrança após o período de teste
                </p>
              )}
            </Card>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="text-center space-y-1 pt-2">
        <p className="text-[11px] text-muted-foreground">
          Pagamentos processados com segurança via Stripe • Aceitamos cartão de crédito e débito
        </p>
      </div>
    </div>
  );
}
