import { Workflow, Zap, Clock, CheckCircle, Play, Pause } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";

const workflows = [
  { nome: "Onboarding Novo Cliente", trigger: "Novo cadastro", execucoes: 128, status: "Ativo", ultimaExec: "5 min atrás" },
  { nome: "Cobrança Automática", trigger: "Fatura vencida (3 dias)", execucoes: 45, status: "Ativo", ultimaExec: "1h atrás" },
  { nome: "Alerta Health Score", trigger: "Score < 60", execucoes: 23, status: "Ativo", ultimaExec: "30 min atrás" },
  { nome: "Welcome Email", trigger: "Novo contato", execucoes: 312, status: "Pausado", ultimaExec: "2 dias atrás" },
  { nome: "Relatório Semanal", trigger: "Toda segunda, 8h", execucoes: 52, status: "Ativo", ultimaExec: "3 dias atrás" },
];

export default function Automacoes() {
  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automações</h1>
          <p className="text-muted-foreground text-sm">Workflows e integrações automatizadas</p>
        </div>
        <Button className="glow">
          <Zap className="w-4 h-4 mr-2" /> Novo Workflow
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Workflow} title="Workflows Ativos" value="12" change="4 criados este mês" changeType="positive" />
        <StatCard icon={CheckCircle} title="Execuções (mês)" value="1.847" change="+23% vs anterior" changeType="positive" />
        <StatCard icon={Clock} title="Tempo Médio" value="1.2s" change="Execução média" changeType="neutral" />
      </div>

      <div className="rounded-xl glass overflow-hidden">
        <div className="p-5 border-b border-border/30">
          <h3 className="text-sm font-semibold text-foreground">Workflows</h3>
        </div>
        <div className="divide-y divide-border/20">
          {workflows.map((wf) => (
            <div key={wf.nome} className="p-5 flex items-center justify-between hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${wf.status === "Ativo" ? "bg-success/10" : "bg-muted"}`}>
                  <Workflow className={`w-5 h-5 ${wf.status === "Ativo" ? "text-success" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{wf.nome}</p>
                  <p className="text-xs text-muted-foreground">Trigger: {wf.trigger}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right hidden sm:block">
                  <p className="text-sm text-foreground">{wf.execucoes} execuções</p>
                  <p className="text-xs text-muted-foreground">{wf.ultimaExec}</p>
                </div>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  wf.status === "Ativo" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                }`}>{wf.status}</span>
                <Button variant="ghost" size="icon" className="text-muted-foreground">
                  {wf.status === "Ativo" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
