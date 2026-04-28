import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { ArrowDownRight, ArrowUpRight, Search, TrendingUp, TrendingDown, Wallet } from "lucide-react";
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
  const resultado = totalIn - totalOut;

  const inCount = items.filter((i) => i.isEntrada).length;
  const outCount = items.length - inCount;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl p-0 gap-0 border-border/50 bg-card shadow-2xl rounded-xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30">
          <DialogTitle className="text-lg font-semibold tracking-tight capitalize">
            Extrato de {monthLabel}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Detalhamento de todas as entradas e saídas computadas no fluxo do mês
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-5 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
          {/* Resumo — 3 cards alinhados */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Entradas</p>
                <p className="text-lg font-bold tabular-nums text-emerald-500 truncate">{fmtBRL(totalIn)}</p>
                <p className="text-[10px] text-muted-foreground">{inCount} {inCount === 1 ? "lançamento" : "lançamentos"}</p>
              </div>
            </div>
            <div className="border border-rose-500/20 bg-rose-500/5 rounded-lg p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5 text-rose-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Saídas</p>
                <p className="text-lg font-bold tabular-nums text-rose-500 truncate">{fmtBRL(totalOut)}</p>
                <p className="text-[10px] text-muted-foreground">{outCount} {outCount === 1 ? "lançamento" : "lançamentos"}</p>
              </div>
            </div>
            <div className={cn(
              "border rounded-lg p-4 flex items-center gap-3",
              resultado >= 0 ? "border-primary/20 bg-primary/5" : "border-rose-500/20 bg-rose-500/5"
            )}>
              <div className={cn(
                "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                resultado >= 0 ? "bg-primary/10" : "bg-rose-500/10"
              )}>
                <Wallet className={cn("w-5 h-5", resultado >= 0 ? "text-primary" : "text-rose-500")} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Resultado</p>
                <p className={cn("text-lg font-bold tabular-nums truncate", resultado >= 0 ? "text-primary" : "text-rose-500")}>
                  {fmtBRL(resultado)}
                </p>
                <p className="text-[10px] text-muted-foreground">Saldo do mês</p>
              </div>
            </div>
          </div>

          {/* Filtros */}
          <div className="flex items-center gap-3 flex-wrap">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="all">Todas ({items.length})</TabsTrigger>
                <TabsTrigger value="in">Entradas ({inCount})</TabsTrigger>
                <TabsTrigger value="out">Saídas ({outCount})</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="relative flex-1 min-w-[240px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição, categoria ou banco..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
          </div>

          {/* Lista — layout em grid próprio (sem overflow horizontal) */}
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
              Nenhuma movimentação encontrada.
            </div>
          ) : (
            <div className="border border-border/50 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[90px_1fr_180px_140px_140px] gap-3 px-4 py-2.5 bg-muted/30 border-b border-border/50 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                <div>Data</div>
                <div>Descrição</div>
                <div>Banco/Conta</div>
                <div>Categoria</div>
                <div className="text-right">Valor</div>
              </div>
              {/* Rows */}
              <div className="divide-y divide-border/40">
                {filtered.map((r) => (
                  <div
                    key={`${r.origem}-${r.id}`}
                    className="grid grid-cols-[90px_1fr_180px_140px_140px] gap-3 px-4 py-3 items-center hover:bg-muted/20 transition-colors"
                  >
                    <div className="text-xs tabular-nums text-muted-foreground">{fmtDate(r.date)}</div>
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                        r.isEntrada ? "bg-emerald-500/10" : "bg-rose-500/10"
                      )}>
                        {r.isEntrada ? (
                          <ArrowUpRight className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <ArrowDownRight className="w-3.5 h-3.5 text-rose-500" />
                        )}
                      </div>
                      <p className="text-sm font-medium text-foreground line-clamp-2 break-words" title={r.description}>
                        {r.description}
                      </p>
                    </div>
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-xs text-foreground truncate" title={r.bankName}>{r.bankName}</span>
                      <Badge variant="outline" className="text-[9px] w-fit h-4 px-1.5">
                        {r.origem === "pluggy" ? "Sincronizado" : "Manual"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground truncate" title={r.category || ""}>
                      {r.category || "—"}
                    </div>
                    <div className={cn(
                      "text-right text-sm font-semibold tabular-nums",
                      r.isEntrada ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {r.isEntrada ? "+" : "−"} {fmtBRL(r.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
