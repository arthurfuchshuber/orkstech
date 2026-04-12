import { Bell, Check, AlertTriangle, Clock, Info, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNotificacoesSistema } from "@/hooks/useNotificacoesSistema";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

const iconMap: Record<string, typeof Info> = {
  alerta: AlertTriangle,
  erro: AlertTriangle,
  sucesso: CheckCircle,
  info: Info,
  lembrete: Clock,
  informacao: Info,
};

const colorMap: Record<string, string> = {
  alerta: "text-destructive",
  erro: "text-destructive",
  sucesso: "text-success",
  info: "text-primary",
  lembrete: "text-warning",
  informacao: "text-primary",
};

const bgMap: Record<string, string> = {
  alerta: "bg-destructive/10",
  erro: "bg-destructive/10",
  sucesso: "bg-success/10",
  info: "bg-primary/10",
  lembrete: "bg-warning/10",
  informacao: "bg-primary/10",
};

export function NotificationDropdown() {
  const { notificacoes, unreadCount, markRead, markAllRead } = useNotificacoesSistema();

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return "agora";
    if (diff < 3600) return `${Math.floor(diff / 60)}min`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center animate-in zoom-in">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
          <h4 className="text-sm font-semibold text-foreground">Notificações</h4>
          {unreadCount > 0 && (
            <button onClick={markAllRead} className="text-xs text-primary hover:underline flex items-center gap-1">
              <Check className="w-3 h-3" /> Marcar todas como lidas
            </button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notificacoes.length === 0 ? (
            <div className="py-8 text-center">
              <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">Nenhuma notificação</p>
            </div>
          ) : (
            <div className="divide-y divide-border/20">
              {notificacoes.slice(0, 20).map((n) => {
                const Icon = iconMap[n.tipo] || Info;
                return (
                  <button
                    key={n.id}
                    onClick={() => markRead(n.id)}
                    className={`w-full flex gap-3 px-4 py-3 text-left hover:bg-muted/30 transition-colors ${
                      !n.lida ? "bg-primary/[0.03]" : ""
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg ${bgMap[n.tipo] || "bg-primary/10"} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                      <Icon className={`w-3.5 h-3.5 ${colorMap[n.tipo] || "text-primary"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground truncate">{n.titulo}</span>
                        {!n.lida && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{n.descricao}</p>
                      <span className="text-[10px] text-muted-foreground/50 mt-1 block">{formatTime(n.created_at)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
