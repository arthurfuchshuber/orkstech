import { useState } from "react";
import { LayoutDashboard, Users, CreditCard, ScrollText } from "lucide-react";
import { cn } from "@/lib/utils";
import AdminDashboard from "./AdminDashboard";
import AdminUsers from "./AdminUsers";
import AdminPlans from "./AdminPlans";
import AdminLogs from "./AdminLogs";

const tabs = [
  { id: "dashboard", label: "Visão Geral", icon: LayoutDashboard },
  { id: "users", label: "Usuários & Empresas", icon: Users },
  { id: "plans", label: "Planos & Preços", icon: CreditCard },
  { id: "logs", label: "Logs de Auditoria", icon: ScrollText },
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

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/40">
        {tabs.map((tab) => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors rounded-t-lg",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/30"
              )}
            >
              <tab.icon className="w-4 h-4" />
              <span>{tab.label}</span>
              {isActive && (
                <div className="absolute bottom-0 left-3 right-3 h-[2px] rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="animate-fade-in">
        {activeTab === "dashboard" && <AdminDashboardContent />}
        {activeTab === "users" && <AdminUsers />}
        {activeTab === "plans" && <AdminPlans />}
        {activeTab === "logs" && <AdminLogs />}
      </div>
    </div>
  );
}

// Inline version without the duplicate header
function AdminDashboardContent() {
  return <AdminDashboard />;
}
