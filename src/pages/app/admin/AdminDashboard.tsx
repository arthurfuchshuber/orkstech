import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CreditCard, TrendingUp, UserPlus, BarChart3 } from "lucide-react";
import { PLANS } from "@/hooks/useSubscription";

export default function AdminDashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", {
        body: { action: "overview" },
      });
      if (error) throw error;
      return data as {
        totalEmpresas: number;
        totalUsers: number;
        recentUsers: number;
        activeSubscriptions: number;
        mrr: number;
        planBreakdown: Record<string, number>;
      };
    },
  });

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100);

  const planName = (productId: string) => {
    for (const [, plan] of Object.entries(PLANS)) {
      if (plan.product_id === productId) return plan.name;
    }
    return productId.slice(0, 12);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Painel Admin</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Métricas e gestão do SaaS</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Building2 className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Empresas</p>
                <p className="text-xl font-bold text-foreground">{data?.totalEmpresas ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Usuários</p>
                <p className="text-xl font-bold text-foreground">{data?.totalUsers ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                <UserPlus className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Novos (30d)</p>
                <p className="text-xl font-bold text-foreground">{data?.recentUsers ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Assinantes</p>
                <p className="text-xl font-bold text-foreground">{data?.activeSubscriptions ?? "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">MRR</p>
                <p className="text-xl font-bold text-foreground">{data ? fmt(data.mrr) : "—"}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plan breakdown */}
      {data?.planBreakdown && Object.keys(data.planBreakdown).length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              Assinantes por Plano
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Object.entries(data.planBreakdown).map(([productId, count]) => (
                <div key={productId} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-foreground font-medium">{planName(productId)}</span>
                  <span className="text-lg font-bold text-primary">{count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
