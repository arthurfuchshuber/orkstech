import { HeartHandshake, Target, UserCheck, TrendingDown, BarChart2 } from "lucide-react";
import { StatCard } from "@/components/StatCard";

const clients = [
  { nome: "Alpha Technologies", health: 95, nps: 9, status: "Saudável", mrr: "R$ 12.500" },
  { nome: "Beta Solutions", health: 78, nps: 7, status: "Atenção", mrr: "R$ 8.200" },
  { nome: "Gamma Services", health: 45, nps: 4, status: "Risco", mrr: "R$ 15.000" },
  { nome: "Delta Corp", health: 88, nps: 8, status: "Saudável", mrr: "R$ 22.000" },
  { nome: "Epsilon Digital", health: 62, nps: 6, status: "Atenção", mrr: "R$ 6.800" },
];

function HealthBar({ value }: { value: number }) {
  const color = value >= 80 ? "bg-success" : value >= 60 ? "bg-warning" : "bg-destructive";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-2 rounded-full bg-muted">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${value}%` }} />
      </div>
      <span className="text-xs text-muted-foreground">{value}</span>
    </div>
  );
}

export default function CustomerSuccess() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Customer Success</h1>
        <p className="text-muted-foreground text-sm">Monitore a saúde e satisfação dos seus clientes</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={HeartHandshake} title="Health Score Médio" value="82/100" change="+3 pts" changeType="positive" />
        <StatCard icon={Target} title="NPS Score" value="+52" change="Zona de qualidade" changeType="positive" />
        <StatCard icon={TrendingDown} title="Churn Rate" value="2.1%" change="-0.5% vs anterior" changeType="positive" />
        <StatCard icon={UserCheck} title="Onboarding Ativo" value="8" change="3 concluindo esta semana" changeType="neutral" />
      </div>

      <div className="rounded-xl glass overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground">Clientes - Health Score</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/30">
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Cliente</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Health Score</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">NPS</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">MRR</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr key={c.nome} className="border-b border-border/20 hover:bg-muted/30 transition-colors">
                  <td className="p-4 text-sm font-medium text-foreground">{c.nome}</td>
                  <td className="p-4"><HealthBar value={c.health} /></td>
                  <td className="p-4 text-sm text-foreground">{c.nps}/10</td>
                  <td className="p-4 text-sm text-muted-foreground">{c.mrr}</td>
                  <td className="p-4">
                    <span className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      c.status === "Saudável" ? "bg-success/10 text-success" :
                      c.status === "Atenção" ? "bg-warning/10 text-warning" : "bg-destructive/10 text-destructive"
                    }`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
