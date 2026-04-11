import {
  LayoutDashboard, DollarSign, Receipt, TrendingUp, FileText, PiggyBank,
  Users, HeartHandshake, BarChart2, Target, UserCheck,
  Building2, Truck, Package, FileSearch,
  Zap, Workflow, Webhook, Bell,
  Settings, Shield, Palette, User, Database,
  ChevronDown,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

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
      { title: "Inventário", url: "/app/inventario", icon: Package },
      { title: "Contratos", url: "/app/contratos", icon: FileSearch },
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

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center flex-shrink-0">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          {!collapsed && <span className="text-base font-bold text-foreground">NexusOS</span>}
        </div>
      </SidebarHeader>
      <SidebarContent>
        {sections.map((section) => {
          const isActive = section.items.some((i) => location.pathname === i.url);
          return (
            <Collapsible key={section.label} defaultOpen={isActive || section.label === "Geral"}>
              <SidebarGroup>
                <CollapsibleTrigger asChild>
                  <SidebarGroupLabel className="cursor-pointer flex items-center justify-between text-xs uppercase tracking-wider text-muted-foreground/60 hover:text-muted-foreground transition-colors">
                    {!collapsed && <span>{section.label}</span>}
                    {!collapsed && <ChevronDown className="w-3 h-3" />}
                  </SidebarGroupLabel>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {section.items.map((item) => (
                        <SidebarMenuItem key={item.url}>
                          <SidebarMenuButton asChild>
                            <NavLink
                              to={item.url}
                              end={item.url === "/app"}
                              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                              activeClassName="bg-primary/10 text-primary font-medium"
                            >
                              <item.icon className="w-4 h-4 flex-shrink-0" />
                              {!collapsed && <span>{item.title}</span>}
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      ))}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          );
        })}
      </SidebarContent>
    </Sidebar>
  );
}
