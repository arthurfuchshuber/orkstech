import { DollarSign, TrendingUp, Users, ArrowUpRight, ArrowDownRight, Activity, BarChart3 } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";

const revenueData = [
  { month: "Jan", receita: 42000, despesa: 28000 },
  { month: "Fev", receita: 48000, despesa: 31000 },
  { month: "Mar", receita: 55000, despesa: 29000 },
  { month: "Abr", receita: 51000, despesa: 33000 },
  { month: "Mai", receita: 62000, despesa: 30000 },
  { month: "Jun", receita: 68000, despesa: 35000 },
];

const csData = [
  { name: "Promotores", value: 65 },
  { name: "Neutros", value: 22 },
  { name: "Detratores", value: 13 },
];

const recentActivity = [
  { action: "Fatura #1234 paga", time: "2 min atrás", type: "positive" as const },
  { action: "Novo cliente: Tech Solutions", time: "15 min atrás", type: "neutral" as const },
  { action: "Health score caiu - Acme Corp", time: "1h atrás", type: "negative" as const },
  { action: "Workflow 'Onboarding' executado", time: "2h atrás", type: "neutral" as const },
  { action: "Pagamento recebido: R$ 12.500", time: "3h atrás", type: "positive" as const },
];

export default function Dashboard() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Visão geral da sua operação</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Receita Mensal" value="R$ 68.400" change="+12.5% vs mês anterior" changeType="positive" />
        <StatCard icon={TrendingUp} title="Lucro Líquido" value="R$ 33.200" change="+8.2% vs mês anterior" changeType="positive" />
        <StatCard icon={Users} title="Clientes Ativos" value="284" change="+5 novos este mês" changeType="positive" />
        <StatCard icon={Activity} title="Health Score Médio" value="82/100" change="-2 pts vs mês anterior" changeType="negative" />
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 p-5 rounded-xl glass">
          <h3 className="text-sm font-semibold text-foreground mb-4">Receita vs Despesas</h3>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={revenueData}>
              <defs>
                <linearGradient id="receita" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217 91% 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217 91% 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="despesa" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(0 72% 51%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(0 72% 51%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 15%)" />
              <XAxis dataKey="month" stroke="hsl(215 15% 50%)" fontSize={12} />
              <YAxis stroke="hsl(215 15% 50%)" fontSize={12} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip
                contentStyle={{ background: "hsl(220 18% 7%)", border: "1px solid hsl(220 13% 15%)", borderRadius: "8px", color: "hsl(210 20% 95%)" }}
              />
              <Area type="monotone" dataKey="receita" stroke="hsl(217 91% 60%)" fill="url(#receita)" strokeWidth={2} />
              <Area type="monotone" dataKey="despesa" stroke="hsl(0 72% 51%)" fill="url(#despesa)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="p-5 rounded-xl glass">
          <h3 className="text-sm font-semibold text-foreground mb-4">NPS Score</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={csData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 13% 15%)" />
              <XAxis dataKey="name" stroke="hsl(215 15% 50%)" fontSize={11} />
              <YAxis stroke="hsl(215 15% 50%)" fontSize={11} />
              <Bar dataKey="value" fill="hsl(217 91% 60%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div className="mt-3 text-center">
            <span className="text-3xl font-bold gradient-text">+52</span>
            <p className="text-xs text-muted-foreground mt-1">NPS Score</p>
          </div>
        </div>
      </div>

      <div className="p-5 rounded-xl glass">
        <h3 className="text-sm font-semibold text-foreground mb-4">Atividade Recente</h3>
        <div className="space-y-3">
          {recentActivity.map((item, i) => (
            <div key={i} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${item.type === "positive" ? "bg-success" : item.type === "negative" ? "bg-destructive" : "bg-muted-foreground"}`} />
                <span className="text-sm text-foreground">{item.action}</span>
              </div>
              <span className="text-xs text-muted-foreground">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
