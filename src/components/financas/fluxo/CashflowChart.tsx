import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface Props {
  data: { date: string; inflow: number; outflow: number; balance: number }[];
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtDate = (d: string) => {
  const [, m, day] = d.split("-");
  return `${day}/${m}`;
};

export function CashflowChart({ data }: Props) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">Saldo Projetado Acumulado</CardTitle>
      </CardHeader>
      <CardContent className="p-4">
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="balCol" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" tickFormatter={fmtDate} stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis tickFormatter={fmt} stroke="hsl(var(--muted-foreground))" fontSize={11} width={80} />
            <Tooltip
              contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
              labelFormatter={(l) => `Data: ${fmtDate(String(l))}`}
              formatter={(v: number, name: string) => {
                const map: Record<string, string> = { balance: "Saldo", inflow: "Entradas", outflow: "Saídas" };
                return [fmt(v), map[name] ?? name];
              }}
            />
            <Area type="monotone" dataKey="balance" stroke="hsl(var(--primary))" fill="url(#balCol)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
