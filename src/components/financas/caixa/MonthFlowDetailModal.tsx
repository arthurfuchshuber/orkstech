import { useMemo, useState } from "react";
import { FormModal } from "@/components/FormModal";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ArrowDownRight, ArrowUpRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface MonthFlowItem {
  id: string;
  date: string; // YYYY-MM-DD
  description: string;
  category?: string | null;
  bankName: string;
  amount: number;
  isEntrada: boolean;
  origem: "pluggy" | "manual";
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  monthLabel: string;
  items: MonthFlowItem[];
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtDate = (d: string) => {
  const [y, m, day] = d.split("-");
  return `${day}/${m}/${y}`;
};

export function MonthFlowDetailModal({ open, onOpenChange, monthLabel, items }: Props) {
  const [tab, setTab] = useState<"all" | "in" | "out">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    let list = items;
    if (tab === "in") list = list.filter((i) => i.isEntrada);
    if (tab === "out") list = list.filter((i) => !i.isEntrada);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (i) =>
          i.description.toLowerCase().includes(q) ||
          (i.category || "").toLowerCase().includes(q) ||
          i.bankName.toLowerCase().includes(q)
      );
    }
    return [...list].sort((a, b) => b.date.localeCompare(a.date));
  }, [items, tab, search]);

  const totalIn = useMemo(() => items.filter((i) => i.isEntrada).reduce((s, i) => s + i.amount, 0), [items]);
  const totalOut = useMemo(() => items.filter((i) => !i.isEntrada).reduce((s, i) => s + i.amount, 0), [items]);

  return (
    <FormModal
      open={open}
      onOpenChange={onOpenChange}
      title={`Extrato de ${monthLabel}`}
      description="Detalhamento de todas as entradas e saídas computadas no fluxo do mês"
      size="xl"
    >
      <div className="space-y-4">
        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3">
          <div className="border border-border/50 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entradas</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: "hsl(160 84% 39%)" }}>
              {fmtBRL(totalIn)}
            </p>
          </div>
          <div className="border border-border/50 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saídas</p>
            <p className="text-lg font-bold tabular-nums" style={{ color: "hsl(0 72% 51%)" }}>
              {fmtBRL(totalOut)}
            </p>
          </div>
          <div className="border border-border/50 rounded-lg p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Resultado</p>
            <p className={cn("text-lg font-bold tabular-nums", totalIn - totalOut >= 0 ? "text-emerald-600" : "text-rose-600")}>
              {fmtBRL(totalIn - totalOut)}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex items-center gap-3">
          <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
            <TabsList>
              <TabsTrigger value="all">Todas ({items.length})</TabsTrigger>
              <TabsTrigger value="in">Entradas</TabsTrigger>
              <TabsTrigger value="out">Saídas</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar por descrição, categoria ou banco..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Tabela */}
        {filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Nenhuma movimentação encontrada.
          </div>
        ) : (
          <div className="border border-border/50 rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[100px]">Data</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead className="w-[160px]">Banco/Conta</TableHead>
                  <TableHead className="w-[140px]">Categoria</TableHead>
                  <TableHead className="w-[140px] text-right">Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((r) => (
                  <TableRow key={`${r.origem}-${r.id}`}>
                    <TableCell className="text-xs tabular-nums">{fmtDate(r.date)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0", r.isEntrada ? "bg-emerald-500/10" : "bg-rose-500/10")}>
                          {r.isEntrada ? (
                            <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                          )}
                        </div>
                        <p className="text-sm font-medium text-foreground line-clamp-2">{r.description}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-xs text-foreground line-clamp-1">{r.bankName}</span>
                        <Badge variant="outline" className="text-[9px] w-fit">
                          {r.origem === "pluggy" ? "Sincronizado" : "Manual"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground line-clamp-1">{r.category || "—"}</TableCell>
                    <TableCell className={cn("text-right text-sm font-semibold tabular-nums", r.isEntrada ? "text-emerald-600" : "text-rose-600")}>
                      {r.isEntrada ? "+" : "−"} {fmtBRL(r.amount)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </FormModal>
  );
}
