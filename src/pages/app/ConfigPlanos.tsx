import { useState, useEffect } from "react";
import { CreditCard, Check, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useSubscription, PLANS, type PlanKey } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

const planCards: {
  key: PlanKey;
  features: string[];
}[] = [
  {
    key: "starter",
    features: [
      "Até 3 usuários",
      "1 empresa",
      "Módulos básicos",
      "Suporte por e-mail",
    ],
  },
  {
    key: "pro",
    features: [
      "Até 10 usuários",
      "1 empresa",
      "Todos os módulos",
      "Integrações bancárias",
      "Suporte prioritário",
    ],
  },
  {
    key: "enterprise",
    features: [
      "Usuários ilimitados",
      "Multi-empresa",
      "Todos os módulos",
      "Integrações bancárias",
      "API & Webhooks",
      "Suporte dedicado",
    ],
  },
];

function formatBRL(cents: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export default function ConfigPlanos() {
  const { subscribed, currentPlan, subscriptionEnd, isLoading, refetch } = useSubscription();
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

  const handleCheckout = async (planKey: PlanKey) => {
    setLoadingPlan(planKey);
    try {
      const priceId = PLANS[planKey].prices.monthly;
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
                  Plano atual: <span className="text-primary">{PLANS[currentPlan].name}</span>
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {planCards.map((plan) => {
          const planData = PLANS[plan.key];
          const isCurrent = currentPlan === plan.key;
          const isUpgrade = !subscribed || (currentPlan && Object.keys(PLANS).indexOf(plan.key) > Object.keys(PLANS).indexOf(currentPlan));

          return (
            <Card
              key={plan.key}
              className={`p-5 flex flex-col justify-between transition-all ${
                isCurrent ? "border-primary/40 ring-1 ring-primary/20" : ""
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground">{planData.name}</h3>
                  {isCurrent && <Badge className="text-[10px]">Atual</Badge>}
                </div>
                <p className="text-2xl font-bold text-foreground mb-1">
                  {formatBRL(planData.monthlyPrice)}
                </p>
                <p className="text-xs text-muted-foreground mb-4">/mês</p>
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
                    onClick={() => handleCheckout(plan.key)}
                    disabled={!!loadingPlan}
                    variant={isUpgrade ? "default" : "outline"}
                  >
                    {loadingPlan === plan.key ? "Redirecionando..." : isUpgrade ? "Fazer upgrade" : "Selecionar"}
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
