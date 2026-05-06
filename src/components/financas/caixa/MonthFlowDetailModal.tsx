import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  Plus,
  Search,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { CategoriaFinanceiraModal } from "@/components/modals/CategoriaFinanceiraModal";
import { PluggyTransactionEditDialog } from "@/components/financas/extrato/PluggyTransactionEditDialog";

// Tipo herdado (mantido p/ compat com FinanceiroDashboard que ainda passa items para os cards)
export interface MonthFlowItem {
  id: string;
  date: string;
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
  /** YYYY-MM — usado para filtrar o extrato real do mês */
  monthKey?: string;
  items: MonthFlowItem[];
}

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

// ===== Helpers de descrição (espelhados do ExtratoBancario) =====
const isGenericCounterparty = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return true;
  return /banco\s|^caixa$|s\.?a\.?$|^sa$/i.test(trimmed) && trimmed.split(/\s+/).length <= 5;
};
const toTitleCaseName = (str: string) =>
  str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bDe\b|\bDa\b|\bDo\b|\bDos\b|\bDas\b|\bE\b/g, (m) => m.toLowerCase());
const enhanceDescription = (tx: any): string => {
  const raw = (tx.description || "").trim();
  if (!raw) return "Sem descrição";
  const isCredit = tx.type === "CREDIT" || tx.amount > 0;
  const parts = raw.split("|").map((p: string) => p.trim());
  let typeLabel = parts[0] || "";
  let counterparty = parts.slice(1).join(" | ").trim();
  typeLabel = typeLabel.replace(/\b(Recebida|Recebido|Enviada|Enviado)\b/gi, "").replace(/\s{2,}/g, " ").trim();
  const pd = tx.payment_data;
  if (counterparty && isGenericCounterparty(counterparty) && pd) {
    const realName = isCredit ? pd.payer?.name : pd.receiver?.name;
    if (realName && !isGenericCounterparty(realName)) counterparty = toTitleCaseName(realName);
    else {
      const doc = isCredit ? pd.payer?.documentNumber?.value : pd.receiver?.documentNumber?.value;
      if (doc) counterparty = `${counterparty} · ${doc}`;
    }
  } else if (counterparty && counterparty === counterparty.toUpperCase()) {
    counterparty = toTitleCaseName(counterparty);
  }
  return counterparty ? `${typeLabel} | ${counterparty}` : typeLabel || raw;
};

const isInternalTransaction = (tx: { is_internal_transfer?: boolean | null }) =>
  tx.is_internal_transfer === true;

const formatDate = (date: string) => new Date(date + "T12:00:00").toLocaleDateString("pt-BR");

export function MonthFlowDetailModal({ open, onOpenChange, monthLabel, monthKey, items }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();

  const [tab, setTab] = useState<"all" | "in" | "out">("all");
  const [search, setSearch] = useState("");
  const [batchSelection, setBatchSelection] = useState<Set<string>>(new Set());
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [pluggyEditTx, setPluggyEditTx] = useState<{ id: string; description: string | null; amount: number; date: string } | null>(null);

  const targetUserId = empresa?.user_id ?? user?.id;

  // Range do mês selecionado
  const { dateFromStr, dateToStr } = useMemo(() => {
    if (!monthKey) return { dateFromStr: "2000-01-01", dateToStr: "2099-12-31" };
    const [y, m] = monthKey.split("-").map(Number);
    const last = new Date(y, m, 0).getDate();
    return {
      dateFromStr: `${monthKey}-01`,
      dateToStr: `${monthKey}-${String(last).padStart(2, "0")}`,
    };
  }, [monthKey]);

  // Transações reais do extrato (espelha ExtratoBancario)
  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["month-flow-extrato-tx", targetUserId, dateFromStr, dateToStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .select("id, description, amount, date, type, category, reconciled, is_internal_transfer, pluggy_account_id, categoria_financeira_id, payment_data")
        .eq("user_id", targetUserId!)
        .gte("date", dateFromStr)
        .lte("date", dateToStr)
        .order("date", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: open && !!targetUserId && !!monthKey,
  });

  // Categorias financeiras (mesmo filtro que o Extrato)
  const { data: categoriasFinanceiras = [] } = useQuery({
    queryKey: ["dre-categorias-financeiras", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo, categoria_pai_id, ordem, ativo")
        .eq("user_id", targetUserId!)
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
    enabled: open && !!targetUserId,
  });

  const updateCategoriaMutation = useMutation({
    mutationFn: async ({ id, categoria_financeira_id }: { id: string; categoria_financeira_id: string | null }) => {
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .update({ categoria_financeira_id })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Nenhum registro atualizado.");
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["month-flow-extrato-tx"] });
      queryClient.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      toast.success("Subcategoria atualizada");
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar subcategoria"),
  });

  const batchUpdateCategoriaMutation = useMutation({
    mutationFn: async ({ ids, categoria_financeira_id }: { ids: string[]; categoria_financeira_id: string | null }) => {
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .update({ categoria_financeira_id })
        .in("id", ids)
        .select("id");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["month-flow-extrato-tx"] });
      queryClient.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      toast.success(`${data?.length ?? 0} transação(ões) atualizada(s)`);
      setBatchSelection(new Set());
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao atualizar em lote"),
  });

  const toggleBatch = (id: string) => {
    setBatchSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Filtra transações p/ a tabela (busca + tipo)
  const filteredTx = useMemo(() => {
    return transactions.filter((tx) => {
      const isCredit = tx.type === "CREDIT" || tx.amount > 0;
      if (tab === "in" && !isCredit) return false;
      if (tab === "out" && isCredit) return false;
      if (!search.trim()) return true;
      const term = search.toLowerCase().trim();
      const termDigits = term.replace(/\D/g, "");
      const haystack = [
        tx.description || "",
        enhanceDescription(tx),
        tx.category || "",
        tx.payment_data?.payer?.name || "",
        tx.payment_data?.receiver?.name || "",
        tx.payment_data?.payer?.documentNumber?.value || "",
        tx.payment_data?.receiver?.documentNumber?.value || "",
      ].join(" ").toLowerCase();
      if (haystack.includes(term)) return true;
      if (termDigits.length >= 3 && haystack.replace(/\D/g, "").includes(termDigits)) return true;
      return false;
    });
  }, [transactions, tab, search]);

  const inCount = transactions.filter((t) => t.type === "CREDIT" || t.amount > 0).length;
  const outCount = transactions.length - inCount;

  // Cards: usam os items do flow (consideram pluggy + manual + valores líquidos do dashboard)
  const totalIn = useMemo(() => items.filter((i) => i.isEntrada).reduce((s, i) => s + i.amount, 0), [items]);
  const totalOut = useMemo(() => items.filter((i) => !i.isEntrada).reduce((s, i) => s + i.amount, 0), [items]);
  const resultado = totalIn - totalOut;
  const inCountCards = items.filter((i) => i.isEntrada).length;
  const outCountCards = items.length - inCountCards;

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
          {/* Cards (mantidos) */}
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-lg p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-emerald-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Entradas</p>
                <p className="text-lg font-bold tabular-nums text-emerald-500 truncate">{fmtBRL(totalIn)}</p>
                <p className="text-[10px] text-muted-foreground">{inCountCards} {inCountCards === 1 ? "lançamento" : "lançamentos"}</p>
              </div>
            </div>
            <div className="border border-rose-500/20 bg-rose-500/5 rounded-lg p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-rose-500/10 flex items-center justify-center shrink-0">
                <TrendingDown className="w-5 h-5 text-rose-500" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Saídas</p>
                <p className="text-lg font-bold tabular-nums text-rose-500 truncate">{fmtBRL(totalOut)}</p>
                <p className="text-[10px] text-muted-foreground">{outCountCards} {outCountCards === 1 ? "lançamento" : "lançamentos"}</p>
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

          {/* Filtros + ações em massa */}
          <div className="flex items-center gap-3 flex-wrap">
            <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
              <TabsList>
                <TabsTrigger value="all">Todas ({transactions.length})</TabsTrigger>
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
            {batchSelection.size > 0 && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="gap-1">{batchSelection.size} selecionada(s)</Badge>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="gap-2">
                      Categorizar em massa <ChevronDown className="w-3.5 h-3.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="max-h-[320px] overflow-y-auto custom-scrollbar">
                    {categoriasFinanceiras
                      .filter((c: any) => !categoriasFinanceiras.some((child: any) => child.categoria_pai_id === c.id))
                      .map((c: any) => (
                        <DropdownMenuItem
                          key={c.id}
                          onClick={() =>
                            batchUpdateCategoriaMutation.mutate({
                              ids: Array.from(batchSelection),
                              categoria_financeira_id: c.id,
                            })
                          }
                        >
                          {c.nome}
                        </DropdownMenuItem>
                      ))}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() =>
                        batchUpdateCategoriaMutation.mutate({
                          ids: Array.from(batchSelection),
                          categoria_financeira_id: null,
                        })
                      }
                      className="text-muted-foreground"
                    >
                      Limpar categoria
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button size="sm" variant="ghost" onClick={() => setBatchSelection(new Set())}>
                  Cancelar
                </Button>
              </div>
            )}
          </div>

          {/* Lista — espelhada do ExtratoBancario (com subcategoria editável) */}
          {loadingTx ? (
            <div className="py-12 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
              Carregando transações...
            </div>
          ) : filteredTx.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground border border-dashed border-border/50 rounded-lg">
              Nenhuma movimentação encontrada.
            </div>
          ) : (
            <div className="border border-border/50 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[36px_110px_minmax(0,1.6fr)_200px_130px] gap-4 border-b border-border/50 bg-muted/30 px-4 py-2.5 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                <div className="flex items-center justify-center">
                  <Checkbox
                    checked={filteredTx.length > 0 && filteredTx.every((t) => batchSelection.has(t.id))}
                    onCheckedChange={(checked) => {
                      if (checked) setBatchSelection(new Set(filteredTx.map((t) => t.id)));
                      else setBatchSelection(new Set());
                    }}
                  />
                </div>
                <div>Data</div>
                <div>Descrição</div>
                <div>Subcategoria</div>
                <div className="text-right">Valor</div>
              </div>

              <div className="divide-y divide-border/30">
                {filteredTx.map((tx) => {
                  const isCredit = tx.type === "CREDIT" || tx.amount > 0;
                  const isInternal = isInternalTransaction(tx);
                  const catFin = categoriasFinanceiras.find((c: any) => c.id === tx.categoria_financeira_id);
                  const allowedTipos = isCredit
                    ? ["receita", "receita_financeira", "ajuste"]
                    : ["despesa", "custo", "deducao", "imposto", "despesa_financeira", "distribuicao_lucros", "ajuste"];
                  const subcatOptions = (categoriasFinanceiras as any[])
                    .filter((c) => allowedTipos.includes(c.tipo))
                    .filter((c) => !categoriasFinanceiras.some((child: any) => child.categoria_pai_id === c.id));
                  const enhancedDesc = enhanceDescription(tx);

                  return (
                    <div
                      key={tx.id}
                      className={cn(
                        "grid grid-cols-[36px_110px_minmax(0,1.6fr)_200px_130px] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/20",
                        isInternal && "opacity-60",
                        batchSelection.has(tx.id) && "bg-primary/5"
                      )}
                    >
                      <div className="flex items-center justify-center">
                        <Checkbox
                          checked={batchSelection.has(tx.id)}
                          onCheckedChange={() => toggleBatch(tx.id)}
                        />
                      </div>
                      <div className="text-xs tabular-nums text-muted-foreground">{formatDate(tx.date)}</div>

                      <div className="min-w-0 flex items-center gap-3">
                        <div className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg ${isCredit ? "bg-emerald-500/10" : "bg-rose-500/10"}`}>
                          {isCredit ? (
                            <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                          ) : (
                            <ArrowUpRight className="h-3.5 w-3.5 text-rose-500" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="truncate text-sm font-medium text-foreground" title={enhancedDesc}>
                              {enhancedDesc}
                            </p>
                            {isInternal && (
                              <Badge variant="outline" className="gap-1 text-[10px] border-muted-foreground/30">
                                Interno
                              </Badge>
                            )}
                            {tx.reconciled && (
                              <Badge variant="outline" className="gap-1 text-[10px]">
                                <CheckCircle2 className="h-3 w-3" />
                                Conciliado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="min-w-0">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button
                              className="flex items-center gap-1 text-sm cursor-pointer hover:text-foreground transition-colors group/cat w-full text-left"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <span className="truncate">
                                {catFin?.nome || <span className="text-muted-foreground/50">Selecionar</span>}
                              </span>
                              <ChevronDown className="w-3 h-3 text-muted-foreground opacity-0 group-hover/cat:opacity-100 transition-opacity flex-shrink-0" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="max-h-[260px] overflow-y-auto custom-scrollbar">
                            {subcatOptions.map((c: any) => (
                              <DropdownMenuItem
                                key={c.id}
                                onClick={() => updateCategoriaMutation.mutate({ id: tx.id, categoria_financeira_id: c.id })}
                              >
                                {c.nome}
                              </DropdownMenuItem>
                            ))}
                            {catFin && (
                              <DropdownMenuItem
                                onClick={() => updateCategoriaMutation.mutate({ id: tx.id, categoria_financeira_id: null })}
                                className="text-muted-foreground"
                              >
                                Limpar
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => setPluggyEditTx({ id: tx.id, description: tx.description, amount: tx.amount, date: tx.date })}
                            >
                              Editar (centro, forma, notas)…
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => setCfModalOpen(true)} className="text-primary">
                              <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova subcategoria
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <p className={`whitespace-nowrap text-right text-sm font-semibold ${isCredit ? "text-emerald-500" : "text-rose-500"}`}>
                        {isCredit ? "+" : "-"} {fmtBRL(Math.abs(tx.amount))}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <CategoriaFinanceiraModal
          open={cfModalOpen}
          onOpenChange={setCfModalOpen}
          editingId={null}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ["dre-categorias-financeiras"] });
          }}
        />

        <PluggyTransactionEditDialog
          open={!!pluggyEditTx}
          onOpenChange={(v) => !v && setPluggyEditTx(null)}
          transactionId={pluggyEditTx?.id ?? null}
          readOnly={pluggyEditTx ? { description: pluggyEditTx.description, amount: pluggyEditTx.amount, date: pluggyEditTx.date } : null}
        />
      </DialogContent>
    </Dialog>
  );
}
