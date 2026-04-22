import { useState } from "react";
import { LayoutDashboard, Users, CreditCard, Settings2, Plug, Shield, History, Trash2, Building2, Receipt } from "lucide-react";
import { cn } from "@/lib/utils";
import AdminDashboard from "./AdminDashboard";
import AdminUsers from "./AdminUsers";
import AdminCompanies from "./AdminCompanies";
import AdminPlans from "./AdminPlans";
import AdminSubscriptions from "./AdminSubscriptions";
import AdminIntegrations from "./AdminIntegrations";
import AdminRequests from "./AdminRequests";
import AdminAuditLogs from "./AdminAuditLogs";
import AdminLogs from "./AdminLogs";

const mainTabs = [
  { id: "overview", label: "Visão Geral", icon: LayoutDashboard },
  { id: "people", label: "Empresas & Usuários", icon: Users },
  { id: "billing", label: "Planos & Receita", icon: CreditCard },
  { id: "system", label: "Sistema", icon: Settings2 },
] as const;

type MainTabId = (typeof mainTabs)[number]["id"];

const subTabsMap: Record<MainTabId, { id: string; label: string; icon: any }[]> = {
  overview: [],
  people: [
    { id: "companies", label: "Empresas", icon: Building2 },
    { id: "users", label: "Usuários", icon: Users },
  ],
  billing: [
    { id: "plans", label: "Planos & Preços", icon: CreditCard },
    { id: "subscriptions", label: "Assinaturas", icon: Receipt },
  ],
  system: [
    { id: "integrations", label: "Integrações", icon: Plug },
    { id: "audit", label: "Auditoria Admin", icon: Shield },
    { id: "logs", label: "Histórico de Ações", icon: History },
    { id: "requests", label: "Solicitações", icon: Trash2 },
  ],
};

const defaultSubTab: Record<MainTabId, string> = {
  overview: "",
  people: "companies",
  billing: "plans",
  system: "integrations",
};

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<MainTabId>("overview");
  const [activeSubTab, setActiveSubTab] = useState<string>(defaultSubTab.people);

  const handleMainTabChange = (id: MainTabId) => {
    setActiveTab(id);
    setActiveSubTab(defaultSubTab[id]);
  };

  const subTabs = subTabsMap[activeTab];

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Painel Admin</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Métricas, gestão e auditoria do SaaS</p>
      </div>

      {/* Main Tabs */}
      <div className="flex items-center gap-1 border-b border-border/40 overflow-x-auto">
        {mainTabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleMainTabChange(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg whitespace-nowrap",
                isActive ? "text-primary" : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {isActive && <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary" />}
            </button>
          );
        })}
      </div>

      {/* Sub Tabs (when applicable) */}
      {subTabs.length > 0 && (
        <div className="flex items-center gap-1 -mt-2 flex-wrap">
          {subTabs.map((sub) => {
            const isActive = activeSubTab === sub.id;
            return (
              <button
                key={sub.id}
                onClick={() => setActiveSubTab(sub.id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary border border-primary/20"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent"
                )}
              >
                <sub.icon className="w-3.5 h-3.5" />
                <span>{sub.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="animate-fade-in">
        {activeTab === "overview" && <AdminDashboard />}
        {activeTab === "people" && activeSubTab === "companies" && <AdminCompanies />}
        {activeTab === "people" && activeSubTab === "users" && <AdminUsers />}
        {activeTab === "billing" && activeSubTab === "plans" && <AdminPlans />}
        {activeTab === "billing" && activeSubTab === "subscriptions" && <AdminSubscriptions />}
        {activeTab === "system" && activeSubTab === "integrations" && <AdminIntegrations />}
        {activeTab === "system" && activeSubTab === "audit" && <AdminAuditLogs />}
        {activeTab === "system" && activeSubTab === "logs" && <AdminLogs />}
        {activeTab === "system" && activeSubTab === "requests" && <AdminRequests />}
      </div>
    </div>
  );
}
