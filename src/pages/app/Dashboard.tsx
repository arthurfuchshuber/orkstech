import { DollarSign, TrendingUp, Users, Activity, Plus, ArrowRight, Zap, FileSearch, Clock } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useHistory, useAutomations, useNotifications } from "@/hooks/useEventBus";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const history = useHistory();
  const { automations } = useAutomations();
  const { notifications } = useNotifications();

  const activeAutomations = automations.filter(a => a.ativo).length;
  const totalExec = automations.reduce((s, a) => s + a.executadoCount, 0);
  const unreadNotifs = notifications.filter(n => !n.lida).length;

  const formatTime = (d: Date) => {
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
    return `${Math.floor(diff / 86400)}d atrás`;
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Visão geral da sua operação</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={DollarSign} title="Receita Mensal" value="R$ 0,00" />
        <StatCard icon={Users} title="Clientes Ativos" value="0" />
        <StatCard icon={Zap} title="Automações Ativas" value={String(activeAutomations)} />
        <StatCard icon={Activity} title="Eventos Processados" value={String(totalExec)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* Recent Activity */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Atividade Recente</h3>
              <Badge variant="outline" className="text-[10px] px-2">{history.length} eventos</Badge>
            </div>
            {history.length === 0 ? (
              <div className="py-8 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
                  <Clock className="w-4 h-4 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground">Nenhuma atividade registrada</p>
                <p className="text-[11px] text-muted-foreground/50 mt-1">Ações no sistema serão registradas aqui</p>
              </div>
            ) : (
              <div className="space-y-1">
                {history.slice(0, 8).map((entry) => (
                  <div key={entry.id} className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-muted/20 transition-colors">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary/60 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{entry.acao}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{entry.descricao}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{formatTime(entry.data)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications Summary */}
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">Notificações</h3>
              {unreadNotifs > 0 && (
                <Badge className="text-[10px] px-2">{unreadNotifs} não lidas</Badge>
              )}
            </div>
            {notifications.length === 0 ? (
              <div className="py-8 flex flex-col items-center text-center">
                <div className="w-10 h-10 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
                  <Activity className="w-4 h-4 text-muted-foreground/30" />
                </div>
                <p className="text-xs text-muted-foreground">Sem notificações</p>
                <p className="text-[11px] text-muted-foreground/50 mt-1">Automações gerarão notificações automaticamente</p>
              </div>
            ) : (
              <div className="space-y-1">
                {notifications.slice(0, 8).map((n) => (
                  <div key={n.id} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${!n.lida ? "bg-primary/[0.04]" : "hover:bg-muted/20"}`}>
                    <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                      n.tipo === "alerta" ? "bg-destructive" : n.tipo === "lembrete" ? "bg-warning" : "bg-primary/60"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{n.titulo}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{n.descricao}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{formatTime(n.timestamp)}</span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Automations Overview */}
      <Card className="border-border/50 shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground">Automações do Sistema</h3>
            <span className="text-xs text-muted-foreground">{activeAutomations} ativas de {automations.length}</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {automations.slice(0, 6).map((auto) => (
              <div key={auto.id} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/15 border border-border/20">
                <Zap className={`w-3.5 h-3.5 flex-shrink-0 ${auto.ativo ? "text-primary" : "text-muted-foreground/30"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{auto.nome}</p>
                  <p className="text-[10px] text-muted-foreground">{auto.executadoCount} execuções</p>
                </div>
                <div className={`w-1.5 h-1.5 rounded-full ${auto.ativo ? "bg-success" : "bg-muted-foreground/20"}`} />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
