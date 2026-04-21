import { useState, useEffect } from "react";
import { CreditCard, ExternalLink, RefreshCw, Sparkles, Clock, AlertTriangle, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useSubscription, PLANS } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

export default function ConfigPlanos() {
  const {
    subscribed, currentPlan, subscriptionEnd, isLoading, refetch,
    isTrialing, trialEnd, cancelAtPeriodEnd,
  } = useSubscription();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [deletionLoading, setDeletionLoading] = useState(false);
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

  const handleRequestDeletion = async () => {
    setDeletionLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "request_account_deletion" },
      });
      if (error) throw error;
      toast.success("Solicitação enviada com sucesso. Nossa equipe entrará em contato.");
    } catch (e: any) {
      toast.error("Erro ao enviar solicitação: " + (e.message || "Tente novamente"));
    } finally {
      setDeletionLoading(false);
    }
  };

  const planLabel = currentPlan ? PLANS[currentPlan].name : null;

  return (
    <div className="space-y-6 animate-fade-in">
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

      {/* Trial Banner */}
      {isTrialing && (
        <Card className="p-4 border-amber-500/30 bg-amber-500/[0.05]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-500" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Período de teste — <span className="text-amber-600">{planLabel}</span>
                </p>
                {trialEnd && (
                  <p className="text-xs text-muted-foreground">
                    Seu trial termina em {new Date(trialEnd).toLocaleDateString("pt-BR")}. Após essa data, a cobrança será iniciada automaticamente.
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
              Gerenciar
            </Button>
          </div>
        </Card>
      )}

      {/* Cancel at period end warning */}
      {cancelAtPeriodEnd && subscribed && (
        <Card className="p-4 border-destructive/30 bg-destructive/[0.05]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Cancelamento agendado
                </p>
                <p className="text-xs text-muted-foreground">
                  Sua assinatura será cancelada em {subscriptionEnd ? new Date(subscriptionEnd).toLocaleDateString("pt-BR") : "—"}. 
                  Você pode reativar a qualquer momento pelo portal.
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageSubscription}
              disabled={loadingPortal}
              className="gap-1.5 border-destructive/30 text-destructive hover:text-destructive"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Reativar
            </Button>
          </div>
        </Card>
      )}

      {/* Active subscription card */}
      {subscribed && !isTrialing && !cancelAtPeriodEnd && currentPlan && (
        <Card className="p-4 border-primary/30 bg-primary/[0.03]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Sparkles className="w-5 h-5 text-primary" />
              <div>
                <p className="text-sm font-medium text-foreground flex items-center gap-2">
                  Plano atual: <Badge variant="secondary" className="text-xs">{planLabel}</Badge>
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
      <Card className="p-5">
        <div
          dangerouslySetInnerHTML={{
            __html: `<stripe-pricing-table pricing-table-id="prctbl_1TOiRGJ633HWAlBjrvIAqj6L" publishable-key="pk_live_51TFifCJ633HWAlBjxKEAWCnxkRHoumxoRORhtAFO0MdR46Pg4OXsSqlcI1aavgo9seGo3Cpu1D1NNp9CQtq7HvM400z5wX4IVO"></stripe-pricing-table>`,
          }}
        />
      </Card>

      <Card className="p-5">
        <div className="flex items-center gap-3 mb-3">
          <CreditCard className="w-5 h-5 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Faturamento</h3>
        </div>
        {subscribed ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Gerencie seus métodos de pagamento, faturas, upgrade, downgrade e cancelamento através do{" "}
              <button
                onClick={handleManageSubscription}
                className="text-primary underline hover:no-underline"
                disabled={loadingPortal}
              >
                portal de assinatura
              </button>.
            </p>
            <p className="text-[10px] text-muted-foreground/60">
              Ao fazer upgrade ou downgrade, o valor será ajustado proporcionalmente (pro-rata) no próximo ciclo de cobrança.
            </p>
            <div className="pt-2 border-t border-border/40 flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-foreground">Cancelar assinatura</p>
                <p className="text-[10px] text-muted-foreground">Sua assinatura ficará ativa até o fim do período pago.</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={loadingPortal}
                className="gap-1.5 border-destructive/30 text-destructive hover:text-destructive"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Cancelar plano
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Selecione um plano acima para começar. Aceitamos cartão de crédito, débito e boleto via Stripe.
          </p>
        )}
      </Card>

      {/* Account Deletion Request */}
      <Card className="p-5 border-destructive/20">
        <div className="flex items-center gap-3 mb-3">
          <Trash2 className="w-5 h-5 text-destructive" />
          <h3 className="text-sm font-semibold text-foreground">Exclusão de conta</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">
          Ao solicitar a exclusão, nossa equipe irá apagar todos os dados da sua empresa e conta. 
          Esta ação é <strong>irreversível</strong>.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5 border-destructive/30 text-destructive hover:text-destructive">
              <Trash2 className="w-3.5 h-3.5" />
              Solicitar exclusão total
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Solicitar exclusão de conta</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza? Esta solicitação será enviada à nossa equipe e resultará na exclusão permanente de:
                <ul className="list-disc list-inside mt-2 space-y-1 text-xs">
                  <li>Sua empresa e todos os dados vinculados</li>
                  <li>Clientes, fornecedores e financeiro</li>
                  <li>Documentos e arquivos armazenados</li>
                  <li>Sua conta de acesso ao sistema</li>
                </ul>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRequestDeletion}
                disabled={deletionLoading}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletionLoading ? "Enviando..." : "Confirmar solicitação"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </Card>
    </div>
  );
}
