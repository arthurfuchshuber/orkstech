import {
  LayoutDashboard, DollarSign, Receipt, TrendingUp, FileText, PiggyBank,
  Users, HeartHandshake, BarChart2, Target, UserCheck,
  Building2, Truck, Package, FileSearch,
  Zap, Workflow, Webhook, Bell,
  Settings, Shield, Palette, User, Database,
  ChevronRight, ShoppingBag,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useState } from "react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";

const sections = [
  {
    label: "Geral",
    items: [
      { title: "Dashboard", url: "/app", icon: LayoutDashboard },
    ],
  },
  {
    label: "Finanças",
    items: [
      { title: "Visão Geral", url: "/app/financas", icon: DollarSign },
      { title: "Contas a Pagar", url: "/app/financas/pagar", icon: Receipt },
      { title: "Contas a Receber", url: "/app/financas/receber", icon: TrendingUp },
      { title: "Fluxo de Caixa", url: "/app/financas/fluxo", icon: PiggyBank },
      { title: "DRE", url: "/app/financas/dre", icon: FileText },
    ],
  },
  {
    label: "Customer Success",
    items: [
      { title: "Visão Geral", url: "/app/cs", icon: HeartHandshake },
      { title: "Health Score", url: "/app/cs/health", icon: BarChart2 },
      { title: "NPS", url: "/app/cs/nps", icon: Target },
      { title: "Onboarding", url: "/app/cs/onboarding", icon: UserCheck },
    ],
  },
  {
    label: "Cadastros",
    items: [
      { title: "Clientes", url: "/app/clientes", icon: Users },
      { title: "Fornecedores", url: "/app/fornecedores", icon: Truck },
      { title: "Empresas", url: "/app/empresas", icon: Building2 },
      { title: "Contratos", url: "/app/contratos", icon: FileSearch },
      { title: "Produtos & Serviços", url: "/app/produtos", icon: ShoppingBag },
      { title: "Inventário", url: "/app/inventario", icon: Package },
    ],
  },
  {
    label: "Automações",
    items: [
      { title: "Workflows", url: "/app/automacoes/workflows", icon: Workflow },
      { title: "Integrações", url: "/app/automacoes/integracoes", icon: Webhook },
      { title: "Notificações", url: "/app/automacoes/notificacoes", icon: Bell },
    ],
  },
  {
    label: "Configurações",
    items: [
      { title: "Geral", url: "/app/config", icon: Settings },
      { title: "Usuários", url: "/app/config/usuarios", icon: User },
      { title: "Permissões", url: "/app/config/permissoes", icon: Shield },
      { title: "Aparência", url: "/app/config/aparencia", icon: Palette },
      { title: "Dados", url: "/app/config/dados", icon: Database },
    ],
  },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();

  const initialOpen = sections.reduce((acc, section) => {
    acc[section.label] = section.items.some((i) => location.pathname === i.url) || section.label === "Geral";
    return acc;
  }, {} as Record<string, boolean>);

  const [openSections, setOpenSections] = useState<Record<string, boolean>>(initialOpen);

  const toggleSection = (label: string) => {
    setOpenSections((prev) => ({ ...prev, [label]: !prev[label] }));
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
            <Zap className="w-3.5 h-3.5 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-sm font-semibold tracking-tight text-foreground">NexusOS</span>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {sections.map((section) => {
          const isOpen = openSections[section.label] ?? false;
          const hasActive = section.items.some((i) => location.pathname === i.url);

          return (
            <SidebarGroup key={section.label} className="py-0.5">
              {!collapsed && (
                <button
                  onClick={() => toggleSection(section.label)}
                  className="w-full flex items-center justify-between px-3 py-1.5 mb-0.5 group"
                >
                  <span className={`text-[10px] font-semibold uppercase tracking-[0.08em] transition-colors ${
                    hasActive ? "text-primary/70" : "text-muted-foreground/40 group-hover:text-muted-foreground/60"
                  }`}>
                    {section.label}
                  </span>
                  <ChevronRight className={`w-3 h-3 text-muted-foreground/30 transition-transform duration-200 ${
                    isOpen ? "rotate-90" : ""
                  }`} />
                </button>
              )}

              {(isOpen || collapsed) && (
                <SidebarGroupContent>
                  <SidebarMenu>
                    {section.items.map((item) => {
                      const isActive = location.pathname === item.url;
                      return (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              end={item.url === "/app"}
                              className={`relative flex items-center gap-2.5 px-3 py-1.5 rounded-md text-[13px] transition-all duration-200 ${
                                isActive
                                  ? "text-primary font-medium bg-primary/[0.08]"
                                  : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/40"
                              }`}
                              activeClassName=""
                            >
                              {isActive && (
                                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-full bg-primary" />
                              )}
                              <item.icon className={`w-[15px] h-[15px] flex-shrink-0 ${
                                isActive ? "text-primary" : ""
                              }`} />
                              {!collapsed && <span>{item.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              )}
            </SidebarGroup>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
