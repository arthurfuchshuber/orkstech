import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

interface ResponsiveDataTableProps {
  /** Conteúdo da tabela (desktop) */
  desktop: React.ReactNode;
  /** Conteúdo em cards (mobile) */
  mobile: React.ReactNode;
  className?: string;
}

/**
 * Renderiza tabela em desktop e lista de cards em mobile.
 * Em ambos os modos respeita 100% de largura.
 */
export function ResponsiveDataTable({ desktop, mobile, className }: ResponsiveDataTableProps) {
  const isMobile = useIsMobile();
  return (
    <div className={cn("w-full", className)}>
      {isMobile ? (
        <div className="flex flex-col gap-2">{mobile}</div>
      ) : (
        <div className="overflow-x-auto">{desktop}</div>
      )}
    </div>
  );
}
