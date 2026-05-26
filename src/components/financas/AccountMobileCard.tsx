import { useState, ReactNode } from "react";
import { ChevronDown, ChevronUp, Calendar, MoreHorizontal, LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface AccountMobileCardDetail {
  icon: LucideIcon;
  label: string;
  content: ReactNode;
}

interface Props {
  title: ReactNode;
  amount: string;
  dueDateLabel: string;
  status: { label: string; color: string; icon: LucideIcon };
  statusDropdown?: ReactNode;
  accent: "overdue" | "near" | "paid" | "neutral";
  details: AccountMobileCardDetail[];
  actions?: ReactNode;
  onTitleClick?: () => void;
}

const accentBar: Record<Props["accent"], string> = {
  overdue: "bg-red-500",
  near: "bg-amber-500",
  paid: "bg-emerald-500",
  neutral: "bg-border",
};

const accentText: Record<Props["accent"], string> = {
  overdue: "text-red-600",
  near: "text-amber-600",
  paid: "text-emerald-600",
  neutral: "text-foreground",
};

export function AccountMobileCard({
  title, amount, dueDateLabel, status, statusDropdown, accent, details, actions, onTitleClick,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const StatusIcon = status.icon;

  return (
    <div className="relative rounded-xl border border-border/50 bg-card overflow-hidden">
      {/* Accent bar */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1", accentBar[accent])} />

      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-3 pl-4">
        <div className="flex-1 min-w-0">
          <button
            type="button"
            onClick={onTitleClick}
            className="text-left text-sm font-semibold text-foreground truncate block w-full"
          >
            {title}
          </button>
        </div>

        {statusDropdown ? (
          statusDropdown
        ) : (
          <Badge variant="outline" className={cn(status.color, "gap-1 font-medium shrink-0")}>
            <StatusIcon className="w-3 h-3" />
            {status.label}
          </Badge>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="shrink-0 w-8 h-8 rounded-md border border-border/60 flex items-center justify-center hover:bg-muted/40 transition-colors"
          aria-label={expanded ? "Recolher" : "Expandir"}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Sub-header: due date + amount */}
      <div className="flex items-center justify-between px-3 pb-3 pl-4">
        <div className={cn("flex items-center gap-1.5 text-sm", accentText[accent])}>
          <Calendar className="w-3.5 h-3.5 opacity-70" />
          <span className="tabular-nums font-medium">{dueDateLabel}</span>
        </div>
        <div className={cn("text-base font-bold tabular-nums", accentText[accent])}>
          {amount}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t border-border/40 pl-4">
          {details.map((d, i) => {
            const Icon = d.icon;
            return (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5",
                  i > 0 && "border-t border-border/30"
                )}
              >
                <Icon className="w-4 h-4 text-muted-foreground/70 shrink-0" />
                <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium w-32 shrink-0">
                  {d.label}
                </span>
                <div className="flex-1 min-w-0 flex justify-end">{d.content}</div>
              </div>
            );
          })}

          <div className="flex items-center justify-between border-t border-border/30 px-3 py-2.5">
            {actions ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 px-2 text-xs">
                    <MoreHorizontal className="w-4 h-4 mr-1" /> Ações
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">{actions}</DropdownMenuContent>
              </DropdownMenu>
            ) : <span />}
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 uppercase tracking-wider px-2 py-1"
            >
              Ver menos <ChevronUp className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
