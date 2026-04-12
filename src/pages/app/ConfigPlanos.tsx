import { useState, useEffect } from "react";
import { CreditCard, Check, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription } from "@/hooks/useSubscription";
import { usePlans, type BillingInterval } from "@/hooks/usePlans";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const intervalLabels: Record<BillingInterval, string> = {
  monthly: "Mensal",
  semiannual: "Semestral",
  annual: "Anual",
};

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

function monthlyEquivalent(cents: number, interval: BillingInterval) {
  if (interval === "semiannual") return cents / 6;
  if (interval === "annual") return cents / 12;
  return cents;
}

export default function ConfigPlanos() {
  const { subscribed, currentPlan, subscriptionEnd, isLoading: subLoading, refetch } = useSubscription();
  const { data: plans, isLoading: plansLoading } = usePlans();
  const [billingInterval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    if (searchParams.get("success") === "true") {
      toast.success("Assinatura realizada com sucesso! Atualizando status...");
      refetch();
    }
    if (searchParams.get("canceled") === "true") {
      toast.info("Checkout cancelado");
    }
  }, [searchParams, refetch]);

  const handleCheckout = async (priceId: string, planKey: string) => {
    setLoadingPlan(planKey);
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
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) {
        window.open(data.url, "_blank");
      }
    } catch (e: any) {
      toast.error("Erro ao abrir portal: " + (e.message || "Tente novamente"));
    } finally {
      setLoadingPortal(false);
    }
  };

  const isLoading = subLoading || plansLoading;

  return (
    <div className="space-y-6 max-w-5xl animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Planos e Assinatura</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie seu plano atual e veja as opções disponíveis
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      </div>

      {subscribed && currentPlan && (
        <Card className="p-4 border-primary/30 bg-primary/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Plano atual: <span className="text-primary">{currentPlan}</span>
                </p>
                {subscriptionEnd && (
                  <p className="text-xs text-muted-foreground">
                    Próxima cobrança: {new Date(subscriptionEnd).toLocaleDateString("pt-BR")}
                  </p>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              disabled={loadingPortal}
              className="gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              {loadingPortal ? "Abrindo..." : "Gerenciar assinatura"}
            </Button>
          </div>
        </Card>
      )}

      {/* Billing interval toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center rounded-lg border bg-muted p-0.5 gap-0.5">
          {(["monthly", "semiannual", "annual"] as BillingInterval[]).map((interval) => (
            <button
              key={interval}
              onClick={() => setBillingInterval(interval)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                billingInterval === interval
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {intervalLabels[interval]}
              {interval === "annual" && (
                <span className="ml-1 text-[10px] text-primary font-semibold">-20%</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {plansLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-5 space-y-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-32" />
                <div className="space-y-2">
                  {Array.from({ length: 4 }).map((_, j) => (
                    <Skeleton key={j} className="h-3 w-full" />
                  ))}
                </div>
                <Skeleton className="h-8 w-full" />
              </Card>
            ))
          : plans?.map((plan) => {
              const price = plan.prices[billingInterval];
              const isCurrent = currentPlan === plan.name;
              const planIndex = plans.indexOf(plan);
              const currentIndex = plans.findIndex((p) => p.name === currentPlan);
              const isUpgrade = !subscribed || planIndex > currentIndex;

              return (
                <Card
                  key={plan.key}
                  className={`p-5 flex flex-col justify-between transition-all ${
                    isCurrent ? "border-primary/40 ring-1 ring-primary/20" : ""
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-foreground">{plan.name}</h3>
                      {isCurrent && <Badge className="text-[10px]">Atual</Badge>}
                    </div>
                    {price ? (
                      <>
                        <p className="text-2xl font-bold text-foreground mb-0.5">
                          {formatBRL(
                            billingInterval === "monthly"
                              ? price.amount
                              : Math.round(monthlyEquivalent(price.amount, billingInterval))
                          )}
                        </p>
                        <p className="text-xs text-muted-foreground mb-1">/mês</p>
                        {billingInterval !== "monthly" && (
                          <p className="text-[10px] text-muted-foreground mb-3">
                            Cobrado {formatBRL(price.amount)}{" "}
                            {billingInterval === "semiannual" ? "a cada 6 meses" : "por ano"}
                          </p>
                        )}
                        {billingInterval === "monthly" && <div className="mb-3" />}
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground mb-4">Preço indisponível</p>
                    )}
                    <ul className="space-y-2">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="mt-5">
                    {isCurrent ? (
                      <Button variant="outline" size="sm" className="w-full" disabled>
                        Plano atual
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        className="w-full"
                        onClick={() => price && handleCheckout(price.id, plan.key)}
                        disabled={!!loadingPlan || !price}
                        variant={isUpgrade ? "default" : "outline"}
                      >
                        {loadingPlan === plan.key
                          ? "Redirecionando..."
                          : isUpgrade
                          ? "Fazer upgrade"
                          : "Selecionar"}
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })}
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Faturamento</h3>
        </div>
        {subscribed ? (
          <p className="text-xs text-muted-foreground">
            Gerencie seus métodos de pagamento, faturas e cancelamento através do{" "}
            <button
              onClick={handleManageSubscription}
              className="text-primary underline hover:no-underline"
              disabled={loadingPortal}
            >
              portal de assinatura
            </button>.
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Selecione um plano acima para começar. Aceitamos cartão de crédito, débito e boleto via Stripe.
          </p>
        )}
      </Card>
    </div>
  );
}
