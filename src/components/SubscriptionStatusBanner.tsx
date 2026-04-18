import { useState } from "react";
import { Clock, AlertTriangle, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSubscription } from "@/hooks/useSubscription";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

/**
 * Banner global, não bloqueante, exibido no topo do app.
 * Mostra: trial terminando em <=7 dias, cancelamento agendado, pagamento atrasado.
 * É dispensável (X) durante a sessão.
 */
export function SubscriptionStatusBanner() {
  const { isTrialing, trialEnd, cancelAtPeriodEnd, subscriptionEnd, status, hasAccess } =
    useSubscription();
  const { isSuperAdmin } = useSuperAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(false);
  const [loading, setLoading] = useState(false);

  if (isSuperAdmin || dismissed) return null;
  if (location.pathname.startsWith("/app/config/assinatura")) return null;
  if (location.pathname === "/app/config/planos") return null;

  // Past due (ainda pode estar com hasAccess=false → modal cuida; aqui mostramos contexto)
  const isPastDue = status === "past_due" || status === "unpaid";

  // Trial terminando em <= 7 dias
  let trialDaysLeft: number | null = null;
  if (isTrialing && trialEnd) {
    const diff = new Date(trialEnd).getTime() - Date.now();
    trialDaysLeft = Math.ceil(diff / (1000 * 60 * 60 * 24));
  }

  // Determina qual banner mostrar (prioridade)
  let banner: { tone: "warn" | "danger"; icon: any; title: string; cta: string } | null = null;

  if (isPastDue && hasAccess) {
    banner = {
      tone: "danger",
      icon: AlertTriangle,
      title: "Pagamento pendente — atualize seu método de cobrança para evitar suspensão.",
      cta: "Atualizar pagamento",
    };
  } else if (cancelAtPeriodEnd && subscriptionEnd) {
    const date = new Date(subscriptionEnd).toLocaleDateString("pt-BR");
    banner = {
      tone: "warn",
      icon: AlertTriangle,
      title: `Cancelamento agendado para ${date}. Reative para manter o acesso.`,
      cta: "Reativar",
    };
  } else if (trialDaysLeft !== null && trialDaysLeft <= 7 && trialDaysLeft > 0) {
    banner = {
      tone: "warn",
      icon: Clock,
      title: `Seu período de teste termina em ${trialDaysLeft} ${trialDaysLeft === 1 ? "dia" : "dias"}.`,
      cta: "Gerenciar plano",
    };
  }

  if (!banner) return null;

  const handleAction = async () => {
    if (banner!.cta === "Gerenciar plano") {
      navigate("/app/config/assinatura");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("customer-portal");
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast.error("Erro ao abrir portal: " + (e.message || "Tente novamente"));
    } finally {
      setLoading(false);
    }
  };

  const Icon = banner.icon;
  const toneClasses =
    banner.tone === "danger"
      ? "bg-destructive/10 border-destructive/30 text-destructive"
      : "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400";

  return (
    <div className={`border-b ${toneClasses}`}>
      <div className="flex items-center justify-between gap-3 px-5 py-2 text-xs">
        <div className="flex items-center gap-2 min-w-0">
          <Icon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate font-medium">{banner.title}</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            size="sm"
            variant="ghost"
            onClick={handleAction}
            disabled={loading}
            className="h-7 text-xs gap-1 hover:bg-background/40"
          >
            <ExternalLink className="w-3 h-3" />
            {loading ? "Abrindo..." : banner.cta}
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="p-1 rounded hover:bg-background/40 transition-colors"
            title="Dispensar"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
}
