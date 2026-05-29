import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface Props {
  patrimonio: number;
  deltaPct: number | null;
  deltaAbs: number | null;
  /** Série diária (saldos) últimos N dias, mais antigo → mais recente */
  series: { date: string; saldo: number }[];
  /** Métricas resumo da 2×2 grid */
  metrics: {
    label: string;
    value: number;
    tone?: "pos" | "neg" | "dim" | "neutral";
  }[];
}

export function HeroPatrimonio({ patrimonio, deltaPct, deltaAbs, series, metrics }: Props) {
  // build sparkline path
  const W = 600, H = 64;
  const values = series.map((d) => d.saldo);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 1;
  const range = Math.max(max - min, 1);
  const step = values.length > 1 ? W / (values.length - 1) : 0;
  const points = values.map((v, i) => {
    const x = i * step;
    const y = H - 4 - ((v - min) / range) * (H - 8);
    return [x, y] as const;
  });
  const linePath = points.length
    ? "M" + points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L")
    : "";
  const areaPath = points.length
    ? `${linePath} L${W},${H} L0,${H} Z`
    : "";

  const up = (deltaPct ?? 0) >= 0;
  const toneMap: Record<string, string> = {
    pos: "text-success",
    neg: "text-destructive",
    dim: "text-muted-foreground/60",
    neutral: "text-foreground",
  };

  return (
    <section className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden">
      {/* Hero */}
      <div className="p-5 sm:p-6 border-b border-border/40">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          Patrimônio líquido
        </p>
        <p className="text-3xl sm:text-4xl font-medium text-foreground mt-1.5 tracking-tight tabular-nums">
          {fmt(patrimonio)}
        </p>
        {deltaPct !== null && (
          <span
            className={cn(
              "inline-flex items-center gap-1 mt-3 px-2.5 py-1 rounded-full text-xs font-medium",
              up
                ? "bg-success/10 text-success"
                : "bg-destructive/10 text-destructive"
            )}
          >
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {up ? "+" : ""}
            {deltaAbs !== null ? fmt(deltaAbs).replace("R$", "R$") : `${deltaPct.toFixed(1)}%`}
            <span className="opacity-70"> em 90 dias</span>
          </span>
        )}
      </div>

      {/* Sparkline */}
      {points.length > 1 && (
        <div className="px-5 sm:px-6 pt-4">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-16 block" preserveAspectRatio="none">
            <defs>
              <linearGradient id="hero-spark-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.18" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#hero-spark-grad)" />
            <path
              d={linePath}
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {points.length > 0 && (
              <circle
                cx={points[points.length - 1][0]}
                cy={points[points.length - 1][1]}
                r="3"
                fill="hsl(var(--primary))"
              />
            )}
          </svg>
        </div>
      )}

      {/* Métricas grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 mt-4 border-t border-border/40">
        {metrics.map((m, i) => (
          <div
            key={m.label}
            className={cn(
              "p-4 sm:p-5",
              i < metrics.length - 1 && "border-r border-border/40",
              "border-b border-border/40 md:border-b-0",
              i < 2 && metrics.length > 2 && "md:border-b-0"
            )}
          >
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              {m.label}
            </p>
            <p
              className={cn(
                "text-base sm:text-lg font-medium mt-1 tabular-nums truncate",
                toneMap[m.tone ?? "neutral"]
              )}
            >
              {fmt(m.value)}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
