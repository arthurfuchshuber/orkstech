import { useState } from "react";
import { LayoutDashboard, Users, CreditCard, ScrollText, Building2, Receipt, Plug, Trash2, Shield } from "lucide-react";
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

const tabs = [
  { id: "dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { id: "users", label: "Usuários & Empresas", icon: Users },
  { id: "companies", label: "Empresas", icon: Building2 },
  { id: "plans", label: "Planos & Preços", icon: CreditCard },
  { id: "subscriptions", label: "Assinaturas", icon: Receipt },
  { id: "integrations", label: "Integrações", icon: Plug },
  { id: "requests", label: "Solicitações", icon: Trash2 },
  { id: "audit", label: "Auditoria Admin", icon: Shield },
  { id: "logs", label: "Logs Gerais", icon: ScrollText },
] as const;

type TabId = (typeof tabs)[number]["id"];

export default function AdminPanel() {
  const [activeTab, setActiveTab] = useState<TabId>("dashboard");

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Painel Admin</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Métricas, gestão e auditoria do SaaS</p>
      </div>

      <div className="flex items-center gap-1 border-b border-border/40 overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
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

      <div className="animate-fade-in">
        {activeTab === "dashboard" && <AdminDashboard />}
        {activeTab === "users" && <AdminUsers />}
        {activeTab === "companies" && <AdminCompanies />}
        {activeTab === "plans" && <AdminPlans />}
        {activeTab === "subscriptions" && <AdminSubscriptions />}
        {activeTab === "integrations" && <AdminIntegrations />}
        {activeTab === "requests" && <AdminRequests />}
        {activeTab === "audit" && <AdminAuditLogs />}
        {activeTab === "logs" && <AdminLogs />}
      </div>
    </div>
  );
}
