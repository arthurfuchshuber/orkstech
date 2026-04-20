import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, ComposedChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend } from "recharts";

interface Props {
  data: {
    date: string;
    inflow: number;
    outflow: number;
    balance: number;
    realizedBalance: number | null;
    projectedBalance: number | null;
  }[];
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);

const fmtDate = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
};

const NAME_MAP: Record<string, string> = {
  realizedBalance: "Realizado",
  projectedBalance: "Projetado",
  inflow: "Entradas",
  outflow: "Saídas",
};

export function CashflowChart({ data }: Props) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span>Saldo Acumulado — Realizado × Projetado</span>
          <span className="text-[11px] font-normal text-muted-foreground">
            <span className="inline-block w-3 h-0.5 bg-primary align-middle mr-1" /> Realizado &nbsp;
            <span className="inline-block w-3 h-0.5 border-t border-dashed border-primary align-middle mr-1" /> Projetado
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={280}>
          <ComposedChart data={data}>
            <defs>
              <linearGradient id="balCol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tickFormatter={fmtDate} stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelFormatter={(l) => `Data: ${fmtDate(String(l))}`}
              formatter={(v: number | null, name: string) => {
                if (v == null) return ["—", NAME_MAP[name] ?? name];
                return [fmt(v), NAME_MAP[name] ?? name];
              }}
            />
            {/* Área de fundo cobrindo o saldo total para preencher visualmente */}
            <Area
              type="monotone"
              dataKey="balance"
              stroke="transparent"
              fill="url(#balCol)"
              isAnimationActive={false}
              connectNulls
            />
            {/* Linha sólida — passado / realizado */}
            <Line
              type="monotone"
              dataKey="realizedBalance"
              stroke="hsl(var(--primary))"
              strokeWidth={2.5}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            {/* Linha tracejada — futuro / projetado */}
            <Line
              type="monotone"
              dataKey="projectedBalance"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeDasharray="6 4"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
