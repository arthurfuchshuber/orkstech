import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";

interface ListItemCardProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** Valor à direita (ex: BRL) */
  rightTop?: React.ReactNode;
  rightBottom?: React.ReactNode;
  /** Badges/chips abaixo do título */
  badges?: React.ReactNode;
  leading?: React.ReactNode;
  onClick?: () => void;
  /** Mostra o chevron à direita */
  showChevron?: boolean;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Padrão mobile para itens de lista (Linear/Stripe-like).
 * Substitui linhas de tabela em < md.
 */
export function ListItemCard({
  title,
  subtitle,
  rightTop,
  rightBottom,
  badges,
  leading,
  onClick,
  showChevron,
  className,
  children,
}: ListItemCardProps) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm",
        "p-3.5 transition-colors active:bg-card hover:border-border",
        onClick && "tap-target focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
        className
      )}
    >
      <div className="flex items-start gap-3">
        {leading && <div className="shrink-0 mt-0.5">{leading}</div>}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-foreground truncate">{title}</div>
              {subtitle && (
                <div className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</div>
              )}
            </div>
            {(rightTop || rightBottom) && (
              <div className="text-right shrink-0">
                {rightTop && (
                  <div className="text-sm font-semibold tabular-nums text-foreground whitespace-nowrap">
                    {rightTop}
                  </div>
                )}
                {rightBottom && (
                  <div className="text-[11px] text-muted-foreground mt-0.5 whitespace-nowrap">
                    {rightBottom}
                  </div>
                )}
              </div>
            )}
            {showChevron && (
              <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-1" />
            )}
          </div>
          {badges && <div className="flex flex-wrap items-center gap-1.5 mt-2">{badges}</div>}
          {children && <div className="mt-2">{children}</div>}
        </div>
      </div>
    </Wrapper>
  );
}
