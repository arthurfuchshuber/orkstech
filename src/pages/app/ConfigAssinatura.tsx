import { useState, useEffect } from "react";
import {
  CreditCard, ExternalLink, RefreshCw, Sparkles, Clock, AlertTriangle,
  CheckCircle2, Calendar, Receipt, ArrowUpRight,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useSubscription, PLANS } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

const STATUS_LABELS: Record<string, { label: string; tone: string; icon: any }> = {
  active: { label: "Ativa", tone: "text-green-600 bg-green-500/10 border-green-500/30", icon: CheckCircle2 },
  trialing: { label: "Em teste", tone: "text-amber-600 bg-amber-500/10 border-amber-500/30", icon: Clock },
  past_due: { label: "Pagamento atrasado", tone: "text-destructive bg-destructive/10 border-destructive/30", icon: AlertTriangle },
  unpaid: { label: "Não pago", tone: "text-destructive bg-destructive/10 border-destructive/30", icon: AlertTriangle },
  canceled: { label: "Cancelada", tone: "text-muted-foreground bg-muted/30 border-border", icon: AlertTriangle },
  incomplete: { label: "Incompleta", tone: "text-amber-600 bg-amber-500/10 border-amber-500/30", icon: AlertTriangle },
  incomplete_expired: { label: "Expirada", tone: "text-destructive bg-destructive/10 border-destructive/30", icon: AlertTriangle },
  paused: { label: "Pausada", tone: "text-muted-foreground bg-muted/30 border-border", icon: Clock },
};

export default function ConfigAssinatura() {
  const navigate = useNavigate();
  const {
    subscribed, currentPlan, status, subscriptionEnd, isLoading, refetch,
    isTrialing, trialEnd, cancelAtPeriodEnd,
  } = useSubscription();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    document.title = "Assinatura | NexusOS";
  }, []);

  const handleManageSubscription = async () => {
    setLoadingPortal(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error("Erro ao abrir portal: " + (e.message || "Tente novamente"));
    } finally {
      setLoadingPortal(false);
    }
  };

  const handleForceRefresh = async () => {
    setRefreshing(true);
    try {
      // Força ressincronização ignorando cache
      await supabase.functions.invoke("check-subscription?force=true");
      await refetch();
      toast.success("Status atualizado");
    } catch (e: any) {
      toast.error("Erro ao atualizar: " + (e.message || ""));
    } finally {
      setRefreshing(false);
    }
  };

  const planLabel = currentPlan ? PLANS[currentPlan].name : null;
  const statusInfo = status ? STATUS_LABELS[status] : null;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Assinatura</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Visão completa do seu plano, faturamento e ciclo de cobrança
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleForceRefresh}
          disabled={refreshing || isLoading}
          className="gap-1.5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing || isLoading ? "animate-spin" : ""}`} />
          Sincronizar
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : !subscribed && !status ? (
        // Sem assinatura
        <Card className="p-8 text-center border-dashed">
          <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground mb-1">Você ainda não tem um plano ativo</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Escolha um plano para acessar todas as funcionalidades do sistema.
          </p>
          <Button onClick={() => navigate("/app/config/planos")} className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            Ver planos disponíveis
          </Button>
        </Card>
      ) : (
        <>
          {/* Card principal: Plano ativo */}
          <Card className="p-5">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Plano atual</p>
                  <p className="text-lg font-bold text-foreground">{planLabel ?? "—"}</p>
                </div>
              </div>
              {statusInfo && (
                <Badge variant="outline" className={`gap-1 ${statusInfo.tone}`}>
                  <statusInfo.icon className="w-3 h-3" />
                  {statusInfo.label}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3 border-t border-border/40">
              {isTrialing && trialEnd && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-amber-500" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">Trial termina</p>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(trialEnd).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              )}
              {subscriptionEnd && (
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-muted-foreground" />
                  <div>
                    <p className="text-[10px] text-muted-foreground uppercase">
                      {cancelAtPeriodEnd ? "Cancela em" : "Próxima cobrança"}
                    </p>
                    <p className="text-sm font-medium text-foreground">
                      {new Date(subscriptionEnd).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Avisos contextuais */}
          {cancelAtPeriodEnd && (
            <Card className="p-4 border-amber-500/30 bg-amber-500/[0.05]">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Cancelamento agendado</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sua assinatura será encerrada em{" "}
                    {subscriptionEnd && new Date(subscriptionEnd).toLocaleDateString("pt-BR")}.
                    Você pode reativar a qualquer momento sem perder seus dados.
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={handleManageSubscription} disabled={loadingPortal}>
                  Reativar
                </Button>
              </div>
            </Card>
          )}

          {(status === "past_due" || status === "unpaid") && (
            <Card className="p-4 border-destructive/30 bg-destructive/[0.05]">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-destructive mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">Pagamento em atraso</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    A última cobrança falhou. Atualize seu método de pagamento para evitar a suspensão do acesso.
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleManageSubscription}
                  disabled={loadingPortal}
                  className="border-destructive/30 text-destructive hover:text-destructive"
                >
                  Atualizar
                </Button>
              </div>
            </Card>
          )}

          {/* Ações */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <Receipt className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Faturas e pagamento</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Acesse o portal Stripe para baixar faturas, atualizar cartão e gerenciar cobranças.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={handleManageSubscription}
                disabled={loadingPortal}
                className="gap-1.5 w-full"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                {loadingPortal ? "Abrindo..." : "Abrir portal de cobrança"}
              </Button>
            </Card>

            <Card className="p-5">
              <div className="flex items-center gap-3 mb-3">
                <ArrowUpRight className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-semibold text-foreground">Trocar de plano</h3>
              </div>
              <p className="text-xs text-muted-foreground mb-3">
                Faça upgrade ou downgrade. O valor é ajustado proporcionalmente (pro-rata) na próxima cobrança.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigate("/app/config/planos")}
                className="gap-1.5 w-full"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Ver planos disponíveis
              </Button>
            </Card>
          </div>

          {/* Cancelar */}
          {subscribed && !cancelAtPeriodEnd && (
            <Card className="p-4 border-border/40">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">Cancelar assinatura</p>
                  <p className="text-[10px] text-muted-foreground">
                    Sua assinatura permanece ativa até o fim do período pago. Sem multa.
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleManageSubscription}
                  disabled={loadingPortal}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  Cancelar plano
                </Button>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
