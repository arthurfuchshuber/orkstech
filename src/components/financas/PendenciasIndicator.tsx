import { useNavigate } from "react-router-dom";
import { AlertTriangle, Sparkles, ChevronRight } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useUncategorizedTransactions } from "@/hooks/useUncategorizedTransactions";
import { useOrfaosFinanceiros } from "@/hooks/useOrfaosFinanceiros";

interface CardSemVinculo {
  tipo: string;
  label: string;
  total: number;
}

interface Props {
  cardsSemVinculo: CardSemVinculo[];
  onCategorizar: () => void;
  onRealocar: () => void;
  onRevisarOrfaos: () => void;
  onVincularCard: (card: any) => void;
}

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

/**
 * Indicador compacto de pendências (substitui banners empilhados).
 * Mostra um triângulo âmbar pulsante com contador. Ao clicar, abre um popover
 * listando cada pendência com ação rápida.
 */
export function PendenciasIndicator({
  cardsSemVinculo,
  onCategorizar,
  onRealocar,
  onRevisarOrfaos,
  onVincularCard,
}: Props) {
  const navigate = useNavigate();
  const { count: uncatCount } = useUncategorizedTransactions();
  const { data: orfaos } = useOrfaosFinanceiros();

  const items: Array<{
    key: string;
    icon: JSX.Element;
    title: string;
    subtitle: string;
    actionLabel: string;
    onClick: () => void;
    tone: "primary" | "warning" | "amber";
  }> = [];

  if (uncatCount > 0) {
    items.push({
      key: "uncat",
      icon: <Sparkles className="w-4 h-4 text-primary" />,
      title: `${uncatCount} transação${uncatCount !== 1 ? "ões" : ""} sem categorização`,
      subtitle: "Categorize para manter o DRE preciso.",
      actionLabel: "Categorizar",
      onClick: () => {
        if (onCategorizar) onCategorizar();
        else navigate("/app/financas/extrato?filtro=sem-categoria");
      },
      tone: "primary",
    });
  }

  cardsSemVinculo.forEach((c) => {
    items.push({
      key: `card-${c.tipo}`,
      icon: <AlertTriangle className="w-4 h-4 text-warning" />,
      title: `${c.label} sem vínculo`,
      subtitle: `${fmt(c.total)} aguardando vínculo de conta/cartão padrão.`,
      actionLabel: "Vincular",
      onClick: () => onVincularCard(c),
      tone: "warning",
    });
  });

  if (orfaos?.temOrfaos) {
    if (orfaos.temValorRealocavel) {
      items.push({
        key: "orfaos-realocar",
        icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        title: `${fmt(orfaos.totalGeralAbsoluto)} em valores sem conta vinculada`,
        subtitle: `${orfaos.lancamentos.length} lançamento(s) + ${orfaos.contasInativasComSnapshot?.length ?? 0} conta(s) excluída(s).`,
        actionLabel: "Realocar",
        onClick: onRealocar,
        tone: "amber",
      });
    } else {
      const total = orfaos.payablesOrfaos.length + orfaos.receivablesOrfaos.length;
      items.push({
        key: "orfaos-revisar",
        icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        title: `${total} pagamento(s) sem conta de origem`,
        subtitle: "Não afeta saldos, mas atrapalha extrato e DRE por conta.",
        actionLabel: "Revisar",
        onClick: onRevisarOrfaos,
        tone: "amber",
      });
    }
  }

  if (items.length === 0) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20 hover:border-amber-500/60 transition-colors px-3 py-1.5 cursor-pointer"
          aria-label={`${items.length} pendência(s)`}
        >
          <span className="relative flex h-4 w-4 items-center justify-center">
            <span className="absolute inline-flex h-full w-full rounded-full bg-amber-500/40 animate-ping" />
            <AlertTriangle className="relative w-4 h-4 text-amber-400" />
          </span>
          <span className="text-xs font-semibold text-amber-200">
            {items.length} pendência{items.length !== 1 ? "s" : ""}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[380px] p-2">
        <div className="px-2 py-1.5 mb-1 border-b border-border/50">
          <p className="text-xs font-semibold text-foreground">Pendências do financeiro</p>
          <p className="text-[10px] text-muted-foreground">Clique em uma pendência para resolver.</p>
        </div>
        <div className="flex flex-col gap-1 max-h-[360px] overflow-y-auto pr-1">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={it.onClick}
              className="w-full text-left flex items-start gap-2.5 rounded-md px-2 py-2 hover:bg-muted/50 transition-colors group"
            >
              <span className="mt-0.5 shrink-0">{it.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{it.title}</p>
                <p className="text-[11px] text-muted-foreground line-clamp-2">{it.subtitle}</p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-0.5 text-[10px] font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                {it.actionLabel}
                <ChevronRight className="w-3 h-3" />
              </span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
