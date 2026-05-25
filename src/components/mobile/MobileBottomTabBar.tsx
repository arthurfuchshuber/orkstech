import { NavLink, useLocation } from "react-router-dom";
import { LayoutDashboard, Wallet, Users, Workflow, Menu } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type Tab = {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  to?: string;
  matches?: (path: string) => boolean;
  action?: "openSheet";
};

const TABS: Tab[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    to: "/app/financas/dashboard",
    matches: (p) => p === "/app" || p.startsWith("/app/financas/dashboard") || p === "/app/dashboard",
  },
  {
    label: "Financeiro",
    icon: Wallet,
    to: "/app/financas",
    matches: (p) =>
      (p.startsWith("/app/financas") && !p.startsWith("/app/financas/dashboard") && !p.startsWith("/app/financas/cadastros")) ||
      p.startsWith("/app/contas-a-pagar") ||
      p.startsWith("/app/contas-a-receber") ||
      p.startsWith("/app/extrato") ||
      p.startsWith("/app/fluxo") ||
      p.startsWith("/app/conciliacao") ||
      p.startsWith("/app/dre"),
  },
  {
    label: "Cadastros",
    icon: Users,
    to: "/app/clientes",
    matches: (p) =>
      p.startsWith("/app/clientes") ||
      p.startsWith("/app/fornecedores") ||
      p.startsWith("/app/financas/cadastros") ||
      p.startsWith("/app/rh"),
  },
  {
    label: "Automações",
    icon: Workflow,
    to: "/app/automacoes",
    matches: (p) => p.startsWith("/app/automacoes"),
  },
  {
    label: "Mais",
    icon: Menu,
    action: "openSheet",
  },
];

export function MobileBottomTabBar() {
  const { pathname } = useLocation();
  const { setOpenMobile } = useSidebar();

  return (
    <nav
      aria-label="Navegação principal"
      className={cn(
        "md:hidden fixed bottom-0 inset-x-0 z-50",
        "border-t border-border/40",
        "bg-background/85 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70",
        "pb-safe"
      )}
      style={{ height: "calc(var(--bottom-tab-h) + env(safe-area-inset-bottom, 0px))" }}
    >
      <ul className="grid grid-cols-5 h-[var(--bottom-tab-h)]">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.matches ? tab.matches(pathname) : false;

          const content = (
            <div
              className={cn(
                "relative flex flex-col items-center justify-center gap-0.5 h-full w-full tap-target transition-colors",
                "text-[10px] font-medium tracking-tight",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground/70 hover:text-foreground active:text-foreground"
              )}
            >
              {isActive && (
                <span
                  aria-hidden
                  className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-primary"
                />
              )}
              <Icon
                className={cn(
                  "w-[22px] h-[22px] transition-transform",
                  isActive && "scale-105"
                )}
                strokeWidth={isActive ? 2.25 : 1.75}
              />
              <span className="leading-tight">{tab.label}</span>
            </div>
          );

          if (tab.action === "openSheet") {
            return (
              <li key={tab.label}>
                <button
                  type="button"
                  onClick={() => setOpenMobile(true)}
                  className="w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md"
                  aria-label="Abrir menu completo"
                >
                  {content}
                </button>
              </li>
            );
          }

          return (
            <li key={tab.label}>
              <NavLink
                to={tab.to!}
                className="block w-full h-full focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md"
              >
                {content}
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
