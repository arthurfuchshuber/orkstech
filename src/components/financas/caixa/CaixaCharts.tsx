import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, Tooltip, PieChart, Pie, Cell, BarChart, Bar, Legend, CartesianGrid } from "recharts";
import { TrendingUp, PieChart as PieIcon, BarChart3 } from "lucide-react";

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 }).format(v);
const fmtFull = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

interface ChartsProps {
  evolution: { date: string; saldo: number }[];
  distribution: { name: string; value: number }[];
  flow: {
    month: string;
    entradas: number;
    saidas: number;
    byBank?: { name: string; entradas: number; saidas: number }[];
    items?: any[];
  }[];
  onFlowBarClick?: (monthData: any) => void;
}

const FlowTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload;
  if (!row) return null;
  const banks = (row.byBank ?? []) as { name: string; entradas: number; saidas: number }[];
  return (
    <div
      style={{
        background: "hsl(var(--card))",
        border: "1px solid hsl(var(--border))",
        borderRadius: 8,
        fontSize: 12,
        padding: "10px 12px",
        minWidth: 240,
        maxWidth: 320,
        boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
      }}
    >
      <div style={{ fontWeight: 600, marginBottom: 6, color: "hsl(var(--foreground))" }}>{label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--foreground))" }}>
        <span style={{ color: "hsl(160 84% 39%)" }}>Entradas</span>
        <span>{fmtFull(row.entradas)}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--foreground))", marginTop: 2 }}>
        <span style={{ color: "hsl(0 72% 51%)" }}>Saídas</span>
        <span>{fmtFull(row.saidas)}</span>
      </div>
      {banks.length > 0 && (
        <>
          <div style={{ height: 1, background: "hsl(var(--border))", margin: "8px 0" }} />
          <div style={{ fontSize: 10, color: "hsl(var(--muted-foreground))", marginBottom: 4, textTransform: "uppercase", letterSpacing: 0.5 }}>
            Por conta
          </div>
          {banks.map((b) => (
            <div key={b.name} style={{ marginBottom: 4 }}>
              <div style={{ color: "hsl(var(--foreground))", fontWeight: 500, marginBottom: 1 }}>{b.name}</div>
              <div style={{ display: "flex", justifyContent: "space-between", color: "hsl(var(--muted-foreground))", fontSize: 11 }}>
                <span>↑ {fmtFull(b.entradas)}</span>
                <span>↓ {fmtFull(b.saidas)}</span>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

const PIE_COLORS = [
  "hsl(var(--primary))",
  "hsl(217 91% 60%)",
  "hsl(160 84% 39%)",
  "hsl(38 92% 50%)",
  "hsl(280 80% 60%)",
  "hsl(340 82% 52%)",
  "hsl(190 80% 50%)",
];

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: 8,
  fontSize: 12,
  padding: "8px 12px",
};

export function CaixaCharts({ evolution, distribution, flow, onFlowBarClick }: ChartsProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Evolução do saldo */}
      <Card className="border-border/50 lg:col-span-2">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Evolução do Patrimônio (90 dias)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {evolution.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
              Sem dados de transações para gerar a evolução
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={evolution} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id="saldoGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: "hsl(var(--muted-foreground))", fontSize: 11 }}
                  formatter={(v: number) => [fmtFull(v), "Saldo"]}
                />
                <Line type="monotone" dataKey="saldo" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} fill="url(#saldoGrad)" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Distribuição por banco */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <PieIcon className="w-4 h-4 text-primary" />
            Distribuição por Banco
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {distribution.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
              Nenhuma conta conectada
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={distribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {distribution.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="hsl(var(--background))" strokeWidth={2} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(v: number, n) => [fmtFull(v), n]}
                />
                <Legend wrapperStyle={{ fontSize: 10 }} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Entradas vs Saídas */}
      <Card className="border-border/50 lg:col-span-3">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            Fluxo Mensal (Entradas × Saídas)
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-2">
          {flow.length === 0 ? (
            <div className="h-[220px] flex items-center justify-center text-xs text-muted-foreground">
              Sem movimentações no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={flow} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} width={70} />
                <Tooltip content={<FlowTooltip />} cursor={{ fill: "hsl(var(--muted) / 0.3)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" formatter={(v) => v === "entradas" ? "Entradas" : "Saídas"} />
                <Bar dataKey="entradas" fill="hsl(160 84% 39%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="saidas" fill="hsl(0 72% 51%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
