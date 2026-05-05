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
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useBankNotifications } from "@/hooks/useBankNotifications";
import { toast } from "sonner";

export default function AppLayout() {
  const { user, signOut } = useAuth();
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  // Initialize bank notifications (realtime listener)
  useBankNotifications();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Sessão encerrada");
    navigate("/login");
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <SubscriptionStatusBanner />
          <header className="h-14 flex items-center justify-between border-b border-border/30 px-5 bg-background/80 backdrop-blur-lg sticky top-0 z-40">
            <div className="flex items-center gap-3">
              <SidebarTrigger className="text-muted-foreground hover:text-foreground transition-colors" />
              <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/30 border border-border/30 text-sm text-muted-foreground w-60 cursor-pointer hover:bg-muted/50 transition-colors">
                <Search className="w-3.5 h-3.5" />
                <span className="text-xs">Buscar...</span>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <NotificationDropdown />
              <span className="text-xs text-muted-foreground hidden sm:block mr-1 max-w-[120px] truncate">
                {user?.email}
              </span>
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-border/50">
                <User className="w-3.5 h-3.5 text-primary" />
              </div>
              <button onClick={handleSignOut} className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors" title="Sair">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>
          <IntegrationFailureBanner />
          <main key={empresa?.id ?? "no-empresa"} className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
        <EmpresaCnpjGuard>{null}</EmpresaCnpjGuard>
        <SubscriptionGuard>{null}</SubscriptionGuard>
        <OnboardingWelcomeWizard />
        <OnboardingChecklist />
      </div>
    </SidebarProvider>
  );
}
