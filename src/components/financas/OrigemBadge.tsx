import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Link2, Pencil } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

export type OrigemTipo = "manual" | "pluggy" | "asaas" | "clicksign" | "import" | "hibrido";

const LABELS: Record<OrigemTipo, string> = {
  manual: "Lançamento manual",
  pluggy: "Open Finance (Pluggy)",
  asaas: "Asaas",
  clicksign: "ClickSign",
  import: "Importação em lote",
  hibrido: "Híbrido (sincronizado + ajuste manual)",
};

interface Props {
  origem?: OrigemTipo | null;
  ultimaSyncAt?: string | null;
  ajustadaManualmente?: boolean | null;
  ajusteMotivo?: string | null;
  className?: string;
}

/**
 * Badge discreto que indica a origem de um registro financeiro.
 * Padrão: ícone + tooltip explicativo.
 */
export function OrigemBadge({ origem, ultimaSyncAt, ajustadaManualmente, ajusteMotivo, className }: Props) {
  if (!origem || origem === "manual") {
    if (!ajustadaManualmente) return null;
  }

  const isAjustada = !!ajustadaManualmente;
  const Icon = isAjustada ? Pencil : Link2;
  const labelOrigem = origem ? LABELS[origem] : LABELS.manual;

  let tooltip = labelOrigem;
  if (ultimaSyncAt) {
    try {
      tooltip += ` — sincronizado em ${format(parseISO(ultimaSyncAt), "dd/MM/yyyy HH:mm", { locale: ptBR })}`;
    } catch { /* noop */ }
  }
  if (isAjustada) {
    tooltip += ajusteMotivo ? ` • Ajustado manualmente: ${ajusteMotivo}` : " • Ajustado manualmente";
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex h-4 w-4 items-center justify-center text-muted-foreground/70 hover:text-foreground transition-colors ${className ?? ""}`}
            aria-label={tooltip}
          >
            <Icon className="h-3 w-3" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
