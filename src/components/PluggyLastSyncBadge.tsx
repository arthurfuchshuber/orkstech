import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  lastSyncAt?: string | null;
  status?: string | null;
  className?: string;
};

function formatRelative(iso: string): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diffMin = Math.max(0, Math.floor((now - then) / 60000));
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `há ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  if (diffD < 30) return `há ${diffD}d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

/**
 * Indicador discreto de frescor da última sincronização Open Finance.
 */
export function PluggyLastSyncBadge({ lastSyncAt, className }: Props) {
  if (!lastSyncAt) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[10px] text-muted-foreground/80",
        className
      )}
      title={`Última sincronização: ${new Date(lastSyncAt).toLocaleString("pt-BR")}`}
    >
      <Clock className="h-2.5 w-2.5" />
      Atualizado {formatRelative(lastSyncAt)}
    </span>
  );
}
