import { useState, type ReactNode } from "react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Pencil, ArrowUpRight, Lock } from "lucide-react";
import { cn } from "@/lib/utils";

export interface KpiDetailItem {
  label: string;
  value: ReactNode;
  highlight?: boolean;
  /** Quando true, exibe um pequeno badge "API" indicando origem de integração. */
  fromApi?: boolean;
}

export interface KpiHoverCardProps {
  /** Conteúdo visual do card (o KPI propriamente dito). */
  children: ReactNode;
  /** Título do tooltip/popover. */
  title: string;
  /** Subtítulo/contexto curto abaixo do título. */
  subtitle?: string;
  /** Linhas de detalhamento mostradas no preview. */
  details?: KpiDetailItem[];
  /** Ação principal: navegar para a página completa do dado. */
  onOpen?: () => void;
  openLabel?: string;
  /** Conteúdo do modo edição. Quando ausente e nenhuma origem API, esconde o botão Editar. */
  editContent?: ReactNode;
  /** Quando true, edição é bloqueada (dado vem de integração API). */
  readOnlyReason?: string;
  className?: string;
}

/**
 * Card KPI com:
 *  - Hover → preview rico (detalhes + ações)
 *  - Clique no botão "Editar" → popover com formulário inline
 *  - Clique no card → onOpen (navega para página completa)
 */
export function KpiHoverCard({
  children,
  title,
  subtitle,
  details = [],
  onOpen,
  openLabel = "Abrir página",
  editContent,
  readOnlyReason,
  className,
}: KpiHoverCardProps) {
  const [editOpen, setEditOpen] = useState(false);

  return (
    <div className={cn("relative", className)}>
      <HoverCard openDelay={120} closeDelay={80}>
        <HoverCardTrigger asChild>
          <button
            type="button"
            onClick={onOpen}
            className="text-left w-full block focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 rounded-lg"
          >
            {children}
          </button>
        </HoverCardTrigger>
        <HoverCardContent
          align="start"
          side="bottom"
          sideOffset={8}
          className="w-80 p-0 border-border/60 shadow-xl bg-popover/95 backdrop-blur-sm"
        >
          <div className="px-4 pt-3 pb-2 border-b border-border/40">
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
              {title}
            </p>
            {subtitle && (
              <p className="text-xs text-foreground/80 mt-0.5">{subtitle}</p>
            )}
          </div>

          {details.length > 0 && (
            <div className="px-4 py-2.5 space-y-1.5">
              {details.map((d, i) => (
                <div key={i} className="flex items-center justify-between gap-3 text-xs">
                  <span className="text-muted-foreground flex items-center gap-1.5">
                    {d.label}
                    {d.fromApi && (
                      <span className="text-[9px] uppercase tracking-wider px-1 py-0 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                        API
                      </span>
                    )}
                  </span>
                  <span
                    className={cn(
                      "tabular-nums",
                      d.highlight ? "font-semibold text-foreground" : "text-foreground/90"
                    )}
                  >
                    {d.value}
                  </span>
                </div>
              ))}
            </div>
          )}

          <div className="px-3 py-2 border-t border-border/40 flex items-center justify-between gap-2 bg-muted/20 rounded-b-md">
            {readOnlyReason ? (
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Lock className="w-3 h-3" /> {readOnlyReason}
              </span>
            ) : editContent ? (
              <Popover open={editOpen} onOpenChange={setEditOpen}>
                <PopoverTrigger asChild>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs gap-1"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setEditOpen(true);
                    }}
                  >
                    <Pencil className="w-3 h-3" /> Editar
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  side="bottom"
                  className="w-80 p-3"
                  onClick={(e) => e.stopPropagation()}
                >
                  {editContent}
                </PopoverContent>
              </Popover>
            ) : (
              <span />
            )}

            {onOpen && (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs gap-1 text-primary hover:text-primary"
                onClick={(e) => {
                  e.stopPropagation();
                  onOpen();
                }}
              >
                {openLabel} <ArrowUpRight className="w-3 h-3" />
              </Button>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    </div>
  );
}

/**
 * Card "shell" leve que pode ser usado dentro do KpiHoverCard, garantindo o hover suave padrão.
 */
export function KpiCardShell({
  children,
  className,
}: { children: ReactNode; className?: string }) {
  return (
    <Card
      className={cn(
        "border-border/50 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200",
        className
      )}
    >
      <CardContent className="p-4">{children}</CardContent>
    </Card>
  );
}
