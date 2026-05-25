import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

/**
 * Cabeçalho padrão de página.
 * Mobile: empilha (título → descrição → ações em linha horizontal scrollável).
 * Desktop: título à esquerda, ações à direita.
 */
export function PageHeader({ title, description, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col md:flex-row md:items-end md:justify-between gap-3 md:gap-4",
        className
      )}
    >
      <div className="min-w-0 flex-1">
        <h1 className="text-xl md:text-2xl font-bold text-foreground tracking-tight truncate">
          {title}
        </h1>
        {description && (
          <p className="text-muted-foreground text-xs md:text-sm mt-1 leading-snug">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 -mx-3 md:mx-0 px-3 md:px-0 overflow-x-auto custom-scrollbar md:overflow-visible flex-nowrap [&>*]:shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
}
