import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Props {
  delta: number;
  label?: string;
  className?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Math.abs(v));

/**
 * Badge âmbar exibido em cards quando o valor efetivo difere da soma do extrato.
 * Tooltip explica o que significa e como reconciliar.
 */
export function DivergenciaBadge({ delta, label = "Divergência", className }: Props) {
  if (Math.abs(delta) < 0.005) return null;

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded border border-amber-500/40 bg-amber-500/10 text-amber-500 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-medium cursor-help",
              className,
            )}
          >
            <AlertTriangle className="h-3 w-3" />
            {label}: {delta > 0 ? "+" : "−"}{fmt(delta)}
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[260px] text-xs">
          O valor mostrado no card está {delta > 0 ? "acima" : "abaixo"} da soma dos lançamentos do extrato em <strong>{fmt(delta)}</strong>.
          Use o botão de ajuste (lápis) e escolha "Criar lançamento" para reconciliar.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
