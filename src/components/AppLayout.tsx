import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Outlet, useNavigate } from "react-router-dom";
import { Search, User, LogOut } from "lucide-react";
import { NotificationDropdown } from "@/components/NotificationDropdown";
import { EmpresaCnpjGuard } from "@/components/EmpresaCnpjGuard";
import { SubscriptionGuard } from "@/components/SubscriptionGuard";
import { SubscriptionStatusBanner } from "@/components/SubscriptionStatusBanner";
import { IntegrationFailureBanner } from "@/components/integrations/IntegrationFailureBanner";
import { OnboardingChecklist } from "@/components/onboarding/OnboardingChecklist";
import { OnboardingWelcomeWizard } from "@/components/onboarding/OnboardingWelcomeWizard";
import { MobileBottomTabBar } from "@/components/mobile/MobileBottomTabBar";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useBankNotifications } from "@/hooks/useBankNotifications";
import { toast } from "sonner";

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  useBankNotifications();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sessão encerrada");
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-dvh flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <SubscriptionStatusBanner />
          <header
            className="
              flex items-center justify-between border-b border-border/30
              px-3 md:px-5 bg-background/85 backdrop-blur-lg sticky top-0 z-40
              h-[var(--header-h-mobile)] md:h-14
            "
          >
            <div className="flex items-center gap-2 md:gap-3 min-w-0">
              <SidebarTrigger
                className="text-muted-foreground hover:text-foreground transition-colors tap-target md:tap-target-auto"
                aria-label="Abrir menu lateral"
              />
              {/* Desktop search pill */}
              <button
                type="button"
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/30 text-sm text-muted-foreground w-60 cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Search className="w-3.5 h-3.5" />
                <span className="text-xs">Buscar...</span>
              </button>
              {/* Mobile: app/empresa label */}
              <span className="md:hidden text-sm font-semibold text-foreground truncate max-w-[160px]">
                {empresa?.nome_fantasia || empresa?.razao_social || "Orks"}
              </span>
            </div>
            <div className="flex items-center gap-1 md:gap-1.5">
              {/* Mobile search icon-only */}
              <button
                type="button"
                className="md:hidden tap-target flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                aria-label="Buscar"
              >
                <Search className="w-[18px] h-[18px]" />
              </button>
              <NotificationDropdown />
              <span className="text-xs text-muted-foreground hidden md:block mr-1 max-w-[120px] truncate">
                {user?.email}
              </span>
              <div className="hidden md:flex w-8 h-8 rounded-full bg-primary/15 items-center justify-center ring-1 ring-border/50">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <button
                onClick={handleSignOut}
                className="hidden md:flex w-8 h-8 rounded-full items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Sair"
                aria-label="Sair"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>
          <IntegrationFailureBanner />
          <main
            key={empresa?.id ?? "no-empresa"}
            className="flex-1 p-3 sm:p-4 md:p-6 overflow-auto pb-tab md:pb-6"
          >
            <Outlet />
          </main>
          <footer className="hidden md:block py-2 px-4 border-t border-border/20 bg-background/60 backdrop-blur-sm">
            <p
              className="text-center text-[10px] tracking-[0.2em] uppercase font-medium"
              style={{ color: "hsl(280 70% 75%)" }}
            >
              by Anfitrião Sigma
            </p>
          </footer>
        </div>
        <MobileBottomTabBar />
        <EmpresaCnpjGuard>{null}</EmpresaCnpjGuard>
        <SubscriptionGuard>{null}</SubscriptionGuard>
        <OnboardingWelcomeWizard />
        <OnboardingChecklist />
      </div>
    </SidebarProvider>
  );
}
