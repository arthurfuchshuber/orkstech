import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Truck, Receipt, AlertTriangle, Landmark, TrendingUp, Clock } from "lucide-react";
import { format, differenceInDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";

export default function Dashboard() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const { data: clientes } = useQuery({
    queryKey: ["dashboard-clientes", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["dashboard-fornecedores", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const { data: contasPagar } = useQuery({
    queryKey: ["dashboard-contas-pagar", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("accounts_payable").select("id, amount, status, due_date").in("status", ["pending", "overdue"]);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: saldoBancario } = useQuery({
    queryKey: ["dashboard-saldo", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("saldo_inicial").eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data?.reduce((sum, c) => sum + Number(c.saldo_inicial), 0) ?? 0;
    },
  });

  const pendentes = contasPagar?.filter((c) => c.status === "pending") ?? [];
  const vencidas = contasPagar?.filter((c) => c.status === "overdue") ?? [];
  const totalPendente = pendentes.reduce((s, c) => s + Number(c.amount), 0);
  const totalVencido = vencidas.reduce((s, c) => s + Number(c.amount), 0);

  const proximasVencer = useMemo(() => {
    if (!contasPagar) return [];
    const today = new Date();
    return contasPagar
      .filter((c) => c.status === "pending" && differenceInDays(new Date(c.due_date), today) <= 7 && differenceInDays(new Date(c.due_date), today) >= 0)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5);
  }, [contasPagar]);

  // Monthly data for chart
  const monthlyData = useMemo(() => {
    if (!contasPagar) return [];
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const total = contasPagar.filter((c) => {
        const due = new Date(c.due_date);
        return due >= start && due <= end;
      }).reduce((s, c) => s + Number(c.amount), 0);
      months.push({ label: format(d, "MMM", { locale: ptBR }), total });
    }
    return months;
  }, [contasPagar]);

  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Visão geral do seu negócio</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Clientes</p>
                <p className="text-xl font-bold text-foreground">{clientes ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Truck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fornecedores</p>
                <p className="text-xl font-bold text-foreground">{fornecedores ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-warning" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pendentes</p>
                <p className="text-xl font-bold text-foreground">{fmt(totalPendente)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4 text-destructive" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Vencidas</p>
                <p className="text-xl font-bold text-foreground">{fmt(totalVencido)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                <Landmark className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Saldo</p>
                <p className="text-xl font-bold text-foreground">{fmt(saldoBancario ?? 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts + Upcoming */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar chart */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Contas a Pagar — Últimos 6 meses
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-3 h-44">
              {monthlyData.map((m, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] text-muted-foreground">{fmt(m.total)}</span>
                  <div
                    className="w-full rounded-t-md bg-primary/80 transition-all duration-500"
                    style={{ height: `${Math.max((m.total / maxMonthly) * 140, 4)}px` }}
                  />
                  <span className="text-[11px] text-muted-foreground capitalize">{m.label}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Próximas a vencer */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              Vencendo em 7 dias
            </CardTitle>
          </CardHeader>
          <CardContent>
            {proximasVencer.length === 0 ? (
              <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma conta próxima do vencimento</p>
            ) : (
              <div className="space-y-2">
                {proximasVencer.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                    <div>
                      <p className="text-xs text-foreground truncate max-w-[140px]">{fmt(Number(c.amount))}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(c.due_date), "dd/MM/yyyy")}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                      {differenceInDays(new Date(c.due_date), new Date())}d
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
