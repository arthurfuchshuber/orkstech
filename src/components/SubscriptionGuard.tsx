import { useState, type ReactNode } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, AlertTriangle, Loader2, ExternalLink, LogOut } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/hooks/useAuth";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";

const REASONS = {
  no_subscription: {
    title: "Assinatura necessária",
    description: "Você ainda não possui um plano ativo. Escolha um plano para acessar o sistema.",
    cta: "Ver planos disponíveis",
  },
  past_due: {
    title: "Pagamento pendente",
    description: "Identificamos uma falha na cobrança da sua assinatura. Atualize seu método de pagamento para restabelecer o acesso.",
    cta: "Atualizar pagamento",
  },
  canceled: {
    title: "Assinatura cancelada",
    description: "Sua assinatura foi cancelada. Reative seu plano para continuar usando o sistema.",
    cta: "Reativar assinatura",
  },
  trial_expired: {
    title: "Período de teste encerrado",
    description: "Seu período de teste terminou. Escolha um plano para continuar.",
    cta: "Escolher plano",
  },
  incomplete: {
    title: "Assinatura incompleta",
    description: "Sua assinatura não foi finalizada. Conclua o processo de pagamento para liberar o acesso.",
    cta: "Concluir pagamento",
  },
};

export function SubscriptionGuard({ children }: { children: ReactNode }) {
  const { hasAccess, blockReason, isLoading } = useSubscription();
  const { isSuperAdmin } = useSuperAdmin();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [portalLoading, setPortalLoading] = useState(false);

  // Não bloqueia: super admin, carregando, na própria página de planos/assinatura, ou no onboarding
  const isOnPlansPage =
    location.pathname === "/app/config/planos" ||
    location.pathname === "/app/config/assinatura";
  const isOnOnboarding = location.pathname === "/app/onboarding";
  const shouldBlock =
    !isSuperAdmin &&
    !isLoading &&
    !hasAccess &&
    !isOnPlansPage &&
    !isOnOnboarding;

  const reason = blockReason ? REASONS[blockReason] : null;

  const handleAction = async () => {
    if (blockReason === "past_due" || blockReason === "canceled") {
      // Abre portal Stripe para corrigir pagamento ou reativar
      setPortalLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("customer-portal");
        if (error) throw error;
        if (data?.url) window.open(data.url, "_blank");
      } catch (e: any) {
        toast.error("Erro ao abrir portal: " + (e.message || "Tente novamente"));
      } finally {
        setPortalLoading(false);
      }
    } else {
      navigate("/app/config/assinatura");
    }
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/login");
  };

  return (
    <>
      {children}
      <Dialog open={shouldBlock} onOpenChange={() => { /* non-dismissible */ }}>
        <DialogContent
          className="max-w-md border-destructive/40 [&>button.absolute]:hidden"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/30">
              <AlertTriangle className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center text-lg">
              {reason?.title}
            </DialogTitle>
            <DialogDescription className="text-center text-sm">
              {reason?.description}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <Button
              onClick={handleAction}
              disabled={portalLoading}
              className="w-full"
            >
              {portalLoading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Abrindo...</>
              ) : (
                <>
                  {blockReason === "past_due" || blockReason === "canceled" ? (
                    <ExternalLink className="mr-2 h-4 w-4" />
                  ) : (
                    <CreditCard className="mr-2 h-4 w-4" />
                  )}
                  {reason?.cta}
                </>
              )}
            </Button>

            <Button
              variant="ghost"
              onClick={handleSignOut}
              className="w-full text-muted-foreground"
              size="sm"
            >
              <LogOut className="mr-2 h-3.5 w-3.5" />
              Sair da conta
            </Button>
          </div>

          <p className="text-center text-[10px] text-muted-foreground">
            O acesso é restabelecido automaticamente após a confirmação do pagamento.
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
