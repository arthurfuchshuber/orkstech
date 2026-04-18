import { LucideIcon } from "lucide-react";
import { Card } from "@/components/ui/card";

type Tone = "red" | "amber" | "blue" | "violet";

const toneStyles: Record<Tone, { bg: string; border: string; icon: string; text: string; ring: string }> = {
  red: {
    bg: "bg-red-500/10",
    border: "border-red-200/70",
    icon: "text-red-600 bg-red-500/15",
    text: "text-red-700",
    ring: "hover:ring-red-300",
  },
  amber: {
    bg: "bg-amber-500/10",
    border: "border-amber-200/70",
    icon: "text-amber-600 bg-amber-500/15",
    text: "text-amber-700",
    ring: "hover:ring-amber-300",
  },
  blue: {
    bg: "bg-sky-500/10",
    border: "border-sky-200/70",
    icon: "text-sky-600 bg-sky-500/15",
    text: "text-sky-700",
    ring: "hover:ring-sky-300",
  },
  violet: {
    bg: "bg-violet-500/10",
    border: "border-violet-200/70",
    icon: "text-violet-600 bg-violet-500/15",
    text: "text-violet-700",
    ring: "hover:ring-violet-300",
  },
};

interface DueStatCardProps {
  title: string;
  amount: number;
  count: number;
  icon: LucideIcon;
  tone: Tone;
  onClick?: () => void;
  disabled?: boolean;
}

const formatCurrency = (val: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

export function DueStatCard({ title, amount, count, icon: Icon, tone, onClick, disabled }: DueStatCardProps) {
  const s = toneStyles[tone];
  const clickable = !!onClick && !disabled;

  return (
    <Card
      onClick={clickable ? onClick : undefined}
      className={[
        "p-4 border shadow-sm transition-all duration-300",
        s.bg,
        s.border,
        clickable ? `cursor-pointer hover:shadow-md hover:-translate-y-0.5 hover:ring-2 ${s.ring}` : "opacity-90",
      ].join(" ")}
    >
      <div className="flex items-start justify-between mb-3">
        <span className={`text-xs font-semibold uppercase tracking-wider ${s.text}`}>{title}</span>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${s.icon}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="text-xl font-bold text-foreground tracking-tight">{formatCurrency(amount)}</span>
        <span className="text-xs font-medium text-muted-foreground">
          • {count} {count === 1 ? "conta" : "contas"}
        </span>
      </div>
    </Card>
  );
}
