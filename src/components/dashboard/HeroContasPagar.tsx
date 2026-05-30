import { AlertTriangle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

type Tone = "pos" | "neg" | "warn" | "dim" | "neutral";

interface Metric {
  label: string;
  value: number | string;
  sub?: string;
  tone?: Tone;
  /** Quando true, renderiza `value` como texto (não formata como BRL). */
  asText?: boolean;
  onClick?: () => void;
}

interface MonthBar {
  label: string;
  total: number;
  isOverdue: boolean;
}

interface Props {
  totalLabel?: string;
  totalValue: number;
  subtitle?: string;
  metrics: Metric[];
  months: MonthBar[];
  onTotalClick?: () => void;
}

export function HeroContasPagar({
  totalLabel = "Total em aberto",
  totalValue,
  subtitle,
  metrics,
  months,
  onTotalClick,
}: Props) {
  const max = Math.max(...months.map((m) => m.total), 1);
  const toneText: Record<Tone, string> = {
    pos: "text-success",
    neg: "text-destructive",
    warn: "text-warning",
    dim: "text-muted-foreground/60",
    neutral: "text-foreground",
  };

  return (
    <section className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden">
      {/* Hero */}
      <button
        type="button"
        onClick={onTotalClick}
        disabled={!onTotalClick}
        className={cn(
          "w-full text-left p-5 sm:p-6 border-b border-border/40 transition-colors",
          onTotalClick && "hover:bg-card/60 cursor-pointer"
        )}
      >
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          {totalLabel}
        </p>
        <p className="text-3xl sm:text-4xl font-medium text-foreground mt-1.5 tracking-tight tabular-nums">
          {fmt(totalValue)}
        </p>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1.5">{subtitle}</p>
        )}
      </button>

      {/* Métricas 2×2 / 4col */}
      <div className="grid grid-cols-2 md:grid-cols-4">
        {metrics.map((m, i) => {
          const Comp: any = m.onClick ? "button" : "div";
          return (
            <Comp
              key={m.label}
              type={m.onClick ? "button" : undefined}
              onClick={m.onClick}
              className={cn(
                "text-left p-4 sm:p-5 border-border/40",
                i < metrics.length - 1 && "border-r",
                i < 2 && "border-b md:border-b-0",
                m.onClick && "hover:bg-card/60 transition-colors cursor-pointer"
              )}
            >
              <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {m.label}
              </p>
              <p
                className={cn(
                  "font-medium mt-1 tabular-nums truncate",
                  m.asText ? "text-sm sm:text-base" : "text-base sm:text-lg",
                  toneText[m.tone ?? "neutral"]
                )}
              >
                {m.asText ? (m.value as string) : fmt(Number(m.value))}
              </p>
              {m.sub && (
                <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5 truncate">
                  {m.sub}
                </p>
              )}
            </Comp>
          );
        })}
      </div>

      {/* Projeção — barras mensais */}
      {months.length > 0 && (
        <div className="border-t border-border/40 px-5 sm:px-6 py-4">
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
            Projeção — próximos 6 meses
          </p>
          <div className="flex items-end gap-1.5 sm:gap-2 h-20">
            {months.map((m, i) => {
              const h = m.total > 0 ? Math.max((m.total / max) * 64, 4) : 4;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <span className="text-[9px] text-muted-foreground/60 tabular-nums truncate w-full text-center">
                    {m.total > 0 ? fmt(m.total).replace("R$", "").trim() : ""}
                  </span>
                  <div className="w-full flex items-end justify-center" style={{ height: 64 }}>
                    <div
                      className={cn(
                        "w-full rounded-t-sm transition-all",
                        m.isOverdue ? "bg-destructive" : m.total > 0 ? "bg-primary/70" : "bg-border"
                      )}
                      style={{ height: `${h}px` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground capitalize">{m.label}</span>
                </div>
              );
            })}
          </div>
          <div className="flex gap-4 mt-3">
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-destructive" /> Vencida
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-primary/70" /> A vencer
            </span>
            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <span className="w-2 h-2 rounded-full bg-border" /> Sem conta
            </span>
          </div>
        </div>
      )}
    </section>
  );
}
