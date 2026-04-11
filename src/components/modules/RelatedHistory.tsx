import { Clock, User } from "lucide-react";

interface HistoryItem {
  id: string;
  acao: string;
  descricao: string;
  data: string;
  usuario?: string;
}

interface RelatedHistoryProps {
  entries?: HistoryItem[];
}

export function RelatedHistory({ entries = [] }: RelatedHistoryProps) {
  if (entries.length === 0) {
    return (
      <div className="py-12 flex flex-col items-center justify-center text-center">
        <div className="w-11 h-11 rounded-xl bg-muted/30 flex items-center justify-center mb-3">
          <Clock className="w-5 h-5 text-muted-foreground/30" />
        </div>
        <p className="text-sm text-muted-foreground font-medium">Nenhum registro no histórico</p>
        <p className="text-xs text-muted-foreground/60 mt-1">Alterações serão registradas automaticamente</p>
      </div>
    );
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border/40" />
      <div className="space-y-4">
        {entries.map((entry) => (
          <div key={entry.id} className="relative flex gap-3">
            <div className="absolute -left-[14px] top-1.5 w-2 h-2 rounded-full bg-primary/60 ring-2 ring-background" />
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-foreground">{entry.acao}</span>
                <span className="text-xs text-muted-foreground">{entry.data}</span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{entry.descricao}</p>
              {entry.usuario && (
                <span className="text-xs text-muted-foreground/60 flex items-center gap-1 mt-1">
                  <User className="w-3 h-3" />{entry.usuario}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
