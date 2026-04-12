import { useEffect } from "react";
import { CreditCard, ExternalLink, RefreshCw, Sparkles } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

export default function ConfigPlanos() {
  const { subscribed, currentPlan, subscriptionEnd, isLoading, refetch } = useSubscription();
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

  // Load Stripe Pricing Table script
  useEffect(() => {
    const existingScript = document.querySelector('script[src="https://js.stripe.com/v3/pricing-table.js"]');
    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/pricing-table.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

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

      {/* Stripe Pricing Table */}
      <div
        dangerouslySetInnerHTML={{
          __html: `<stripe-pricing-table pricing-table-id="prctbl_1TLE55J633HWAlBjLIDqdzsi" publishable-key="pk_test_51TFifCJ633HWAlBjiOg67fgb2hPnc0MO5gFCWvNqUE3yXPLQUNPzF9kCwFPt0ZZkNGfez75GX0WAQHVDzwiZ3dy200apPUxMmQ"></stripe-pricing-table>`,
        }}
      />

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
