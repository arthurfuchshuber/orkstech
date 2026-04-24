import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, CreditCard, TrendingUp, UserPlus, BarChart3, Activity, AlertTriangle, Sparkles } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function AdminDashboard() {
  const { data } = useQuery({
    queryKey: ["admin-overview"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "overview" } });
      if (error) throw error;
      return data as any;
    },
  });

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v / 100);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Building2, label: "Empresas", value: data?.totalEmpresas ?? "—", tone: "primary" },
          { icon: Users, label: "Usuários", value: data?.totalUsers ?? "—", tone: "primary" },
          { icon: UserPlus, label: "Novos (30d)", value: data?.recentUsers ?? "—", tone: "success" },
          { icon: CreditCard, label: "Assinantes", value: data?.activeSubscriptions ?? "—", tone: "warning" },
          { icon: TrendingUp, label: "MRR", value: data ? fmt(data.mrr) : "—", tone: "primary" },
          { icon: Activity, label: "ARR", value: data ? fmt(data.arr) : "—", tone: "primary" },
        ].map((kpi) => (
          <Card key={kpi.label} className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg bg-${kpi.tone}/10 flex items-center justify-center`}>
                  <kpi.icon className={`w-4 h-4 text-${kpi.tone}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{kpi.label}</p>
                  <p className="text-lg font-bold text-foreground">{kpi.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Trial + churn + complimentary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Em trial</p>
            <p className="text-2xl font-bold text-primary mt-1">{data?.trialingSubscriptions ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-info/30 bg-info/5">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-info" /> Sem cobranças
            </p>
            <p className="text-2xl font-bold text-info mt-1">{data?.complimentaryCount ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Cancelados (30d)</p>
            <p className="text-2xl font-bold text-destructive mt-1">{data?.canceledLast30d ?? "—"}</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Churn rate</p>
            <p className="text-2xl font-bold text-warning mt-1">{data ? `${data.churnRate}%` : "—"}</p>
          </CardContent>
        </Card>
      </div>

      {/* Crescimento */}
      {data?.growth && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Crescimento de usuários (6 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={data.growth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Top empresas */}
      {data?.topEmpresas?.length > 0 && (
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Top empresas por atividade
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.topEmpresas.map((e: any) => (
                <div key={e.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                  <span className="text-sm text-foreground font-medium">{e.nome}</span>
                  <span className="text-xs text-muted-foreground">{e.total} lançamentos</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
