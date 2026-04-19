import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConsolidatedRow } from "@/lib/cashflow-helpers";

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

const originLabel: Record<string, string> = {
  system: "Sistema",
  manual: "Manual",
  csv: "CSV",
  xlsx: "Excel",
  google_sheets: "Sheets",
};
const originTone: Record<string, string> = {
  system: "bg-primary/10 text-primary border-primary/20",
  manual: "bg-muted text-muted-foreground border-border",
  csv: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  xlsx: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  google_sheets: "bg-sky-500/10 text-sky-600 border-sky-500/20",
};

const tableLabel: Record<string, string> = {
  accounts_receivable: "A Receber",
  accounts_payable: "A Pagar",
  cashflow_forecasts: "Previsão",
};

export function CashflowExtrato({ rows }: { rows: ConsolidatedRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">
        Nenhuma movimentação prevista no período.
      </div>
    );
  }

  // Group by date with running balance per row
  let acc = 0;
  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[110px]">Data</TableHead>
            <TableHead>Descrição</TableHead>
            <TableHead className="w-[120px]">Fonte</TableHead>
            <TableHead className="w-[110px]">Origem</TableHead>
            <TableHead className="w-[120px]">Categoria</TableHead>
            <TableHead className="w-[140px] text-right">Valor</TableHead>
            <TableHead className="w-[140px] text-right">Saldo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => {
            const value = Number(r.amount);
            acc += r.direction === "inflow" ? value : -value;
            const isIn = r.direction === "inflow";
            return (
              <TableRow key={`${r.source_table}-${r.source_id}`}>
                <TableCell className="text-xs tabular-nums">{fmtDate(r.movement_date)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center", isIn ? "bg-emerald-500/10" : "bg-rose-500/10")}>
                      {isIn ? <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" /> : <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground line-clamp-1">{r.description}</p>
                      {r.document_number && <p className="text-[10px] text-muted-foreground">Doc: {r.document_number}</p>}
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="text-[10px]">{tableLabel[r.source_table] ?? r.source_table}</Badge>
                </TableCell>
                <TableCell>
                  <span className={cn("inline-block text-[10px] uppercase tracking-wider font-medium px-2 py-0.5 rounded border", originTone[r.origin] ?? originTone.manual)}>
                    {originLabel[r.origin] ?? r.origin}
                  </span>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground line-clamp-1">{r.category ?? "—"}</TableCell>
                <TableCell className={cn("text-right text-sm font-semibold tabular-nums", isIn ? "text-emerald-600" : "text-rose-600")}>
                  {isIn ? "+" : "−"} {fmt(value)}
                </TableCell>
                <TableCell className={cn("text-right text-sm font-bold tabular-nums", acc >= 0 ? "text-foreground" : "text-rose-600")}>
                  {fmt(acc)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
