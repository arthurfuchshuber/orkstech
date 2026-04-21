import { useState, useEffect } from "react";
import {
  CreditCard, ExternalLink, RefreshCw, Sparkles, Clock, AlertTriangle,
  CheckCircle2, Calendar, Receipt, ArrowUpRight, Download, FileText, LayoutGrid,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ModuleTabs } from "@/components/ModuleTabs";
import { useSubscription, PLANS } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
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

const INVOICE_STATUS: Record<string, { label: string; tone: string }> = {
  paid: { label: "Paga", tone: "text-green-600 bg-green-500/10 border-green-500/30" },
  open: { label: "Em aberto", tone: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  void: { label: "Cancelada", tone: "text-muted-foreground bg-muted/30 border-border" },
  uncollectible: { label: "Não cobrável", tone: "text-destructive bg-destructive/10 border-destructive/30" },
  draft: { label: "Rascunho", tone: "text-muted-foreground bg-muted/30 border-border" },
};

interface InvoiceItem {
  id: string;
  number: string | null;
  status: string;
  amount_paid: number;
  amount_due: number;
  currency: string;
  created: number;
  hosted_invoice_url: string | null;
  invoice_pdf: string | null;
  description: string | null;
}

interface PaymentMethodCard {
  brand: string;
  last4: string;
  exp_month: number;
  exp_year: number;
}

const formatCurrency = (cents: number, currency = "brl") =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);

export default function ConfigAssinatura() {
  const navigate = useNavigate();
  const {
    subscribed, currentPlan, status, subscriptionEnd, isLoading, refetch,
    isTrialing, trialEnd, cancelAtPeriodEnd,
  } = useSubscription();
  const [loadingPortal, setLoadingPortal] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<"plano" | "faturas" | "planos">("plano");

  useEffect(() => { document.title = "Assinatura | NexusOS"; }, []);

  // Carrega script da Stripe Pricing Table
  useEffect(() => {
    const existing = document.querySelector('script[src="https://js.stripe.com/v3/pricing-table.js"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://js.stripe.com/v3/pricing-table.js";
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  // Sem assinatura → abre direto na aba "Planos"
  useEffect(() => {
    if (!isLoading && !subscribed && !status) {
      setActiveTab("planos");
    }
  }, [isLoading, subscribed, status]);

  const { data: billing, isLoading: billingLoading, refetch: refetchBilling } = useQuery({
    queryKey: ["stripe-invoices"],
    enabled: !!subscribed || !!status,
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("list-invoices");
      if (error) throw error;
      return data as { invoices: InvoiceItem[]; payment_method: PaymentMethodCard | null };
    },
  });

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
      await supabase.functions.invoke("check-subscription?force=true");
      await Promise.all([refetch(), refetchBilling()]);
      toast.success("Status atualizado");
    } catch (e: any) {
      toast.error("Erro ao atualizar: " + (e.message || ""));
    } finally {
      setRefreshing(false);
    }
  };

  const planLabel = currentPlan ? PLANS[currentPlan].name : null;
  const statusInfo = status ? STATUS_LABELS[status] : null;

  const hasSubscription = subscribed || !!status;
  const tabs = hasSubscription
    ? [
        { id: "plano", label: "Plano", icon: LayoutGrid },
        { id: "faturas", label: "Extrato de pagamentos", icon: Receipt, count: billing?.invoices?.length },
        { id: "planos", label: "Planos disponíveis", icon: Sparkles },
      ]
    : [
        { id: "planos", label: "Planos disponíveis", icon: Sparkles },
      ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground tracking-tight">Assinatura</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Gerencie seu plano, método de pagamento e histórico de faturas
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
      ) : (
        <>
          <ModuleTabs tabs={tabs} activeTab={activeTab} onTabChange={(id) => setActiveTab(id as any)} />

          {activeTab === "plano" && hasSubscription && (
            <div className="space-y-4">
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

              {/* Ação principal: Trocar de plano */}
              <Card className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <ArrowUpRight className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">Trocar de plano</p>
                      <p className="text-xs text-muted-foreground">
                        Faça upgrade ou downgrade. O valor é ajustado proporcionalmente (pro-rata).
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => navigate("/app/config/planos")} className="gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" />
                    Ver planos
                  </Button>
                </div>
              </Card>

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
            </div>
          )}

          {activeTab === "faturas" && hasSubscription && (
            <div className="space-y-4">
              {/* Método de pagamento */}
              <Card className="p-5">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Método de pagamento</p>
                      {billingLoading ? (
                        <Skeleton className="h-5 w-40 mt-1" />
                      ) : billing?.payment_method ? (
                        <p className="text-sm font-semibold text-foreground capitalize">
                          {billing.payment_method.brand} •••• {billing.payment_method.last4}
                          <span className="ml-2 text-xs text-muted-foreground font-normal">
                            Expira {String(billing.payment_method.exp_month).padStart(2, "0")}/
                            {String(billing.payment_method.exp_year).slice(-2)}
                          </span>
                        </p>
                      ) : (
                        <p className="text-sm text-muted-foreground">Nenhum cartão cadastrado</p>
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
                    {billing?.payment_method ? "Atualizar cartão" : "Adicionar cartão"}
                  </Button>
                </div>
              </Card>

              {/* Lista de faturas */}
              <Card className="overflow-hidden">
                <div className="p-4 border-b border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-primary" />
                    <h3 className="text-sm font-semibold text-foreground">Histórico de faturas</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => refetchBilling()} className="gap-1.5 h-7">
                    <RefreshCw className={`w-3 h-3 ${billingLoading ? "animate-spin" : ""}`} />
                    Atualizar
                  </Button>
                </div>

                {billingLoading ? (
                  <div className="p-4 space-y-2">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </div>
                ) : !billing?.invoices?.length ? (
                  <div className="p-8 text-center">
                    <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">Nenhuma fatura emitida ainda</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {billing.invoices.map((inv) => {
                      const statusBadge = INVOICE_STATUS[inv.status] ?? { label: inv.status, tone: "text-muted-foreground bg-muted/30 border-border" };
                      const amount = inv.status === "paid" ? inv.amount_paid : inv.amount_due;
                      return (
                        <div key={inv.id} className="px-4 py-3 flex items-center gap-4 hover:bg-muted/30 transition-colors">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium text-foreground truncate">
                                {inv.number ?? inv.id.slice(-8).toUpperCase()}
                              </p>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-4 ${statusBadge.tone}`}>
                                {statusBadge.label}
                              </Badge>
                            </div>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {inv.description ?? "Assinatura"} • {new Date(inv.created * 1000).toLocaleDateString("pt-BR")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-foreground tabular-nums">
                              {formatCurrency(amount, inv.currency)}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {inv.invoice_pdf && (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="h-8 w-8 p-0"
                                title="Baixar PDF"
                              >
                                <a href={inv.invoice_pdf} target="_blank" rel="noopener noreferrer">
                                  <Download className="w-3.5 h-3.5" />
                                </a>
                              </Button>
                            )}
                            {inv.hosted_invoice_url && (
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                className="h-8 w-8 p-0"
                                title="Ver fatura"
                              >
                                <a href={inv.hosted_invoice_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </div>
          )}

          {activeTab === "planos" && (
            <div className="space-y-4">
              {!hasSubscription && (
                <Card className="p-4 border-primary/30 bg-primary/[0.05]">
                  <div className="flex items-start gap-3">
                    <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-foreground">Escolha seu plano para começar</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Selecione abaixo o plano e o ciclo de cobrança. O acesso é liberado automaticamente após o pagamento.
                      </p>
                    </div>
                  </div>
                </Card>
              )}
              <Card className="p-5">
                <div
                  dangerouslySetInnerHTML={{
                    __html: `<stripe-pricing-table pricing-table-id="prctbl_1TOiRGJ633HWAlBjrvIAqj6L" publishable-key="pk_live_51TFifCJ633HWAlBjxKEAWCnxkRHoumxoRORhtAFO0MdR46Pg4OXsSqlcI1aavgo9seGo3Cpu1D1NNp9CQtq7HvM400z5wX4IVO"></stripe-pricing-table>`,
                  }}
                />
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
