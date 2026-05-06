import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Search, ArrowUpRight, ArrowDownLeft, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { enhancePluggyDescription, type PluggyTxLike } from "@/lib/pluggy-description";
import { useRegraConflitoDetector } from "@/hooks/useRegraConflitoDetector";
import { RegraConflitoModal } from "@/components/financas/dre/RegraConflitoModal";
import { OfertaCriarRegraModal } from "./OfertaCriarRegraModal";
import { DescricaoComRegra } from "./DescricaoComRegra";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Tx extends PluggyTxLike {
  id: string;
  amount: number;
  date: string;
  pluggy_account_id: string;
  categoria_financeira_id: string | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Modal listando todas as transações Pluggy sem categorização DRE.
 * - Descrição embelezada (enhancePluggyDescription) igual nas outras telas
 * - Filtros internos: busca, conta, tipo (entrada/saída)
 * - Edição inline com auto-save
 * - Mantém o racional: detector de conflito de regra + oferta de criar regra
 *   automática quando o usuário aplica a mesma categoria em ≥2 itens
 */
export function UncategorizedTransactionsModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "in" | "out">("all");

  const { conflito, setConflito, registrar } = useRegraConflitoDetector();

  // Buffer pra detectar quando usuário aplicou a mesma categoria em ≥2 transações
  // dentro do modal — aí ofertamos criar regra automática.
  const [recentApplied, setRecentApplied] = useState<
    { description: string; amount: number; categoriaId: string }[]
  >([]);
  const [oferta, setOferta] = useState<{
    open: boolean;
    descricoes: string[];
    categoriaId: string;
    categoriaNome?: string;
    tipoSugerido: "pagar" | "receber";
  }>({ open: false, descricoes: [], categoriaId: "", tipoSugerido: "pagar" });

  const { data: transactions = [], isLoading } = useQuery({
    queryKey: ["uncategorized-tx-list", targetUserId],
    enabled: !!targetUserId && open,
    queryFn: async () => {
      const all: Tx[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pluggy_transactions" as any)
          .select(
            "id, description, amount, date, type, pluggy_account_id, categoria_financeira_id, payment_data"
          )
          .eq("user_id", targetUserId!)
          .is("categoria_financeira_id", null)
          .or("is_internal_transfer.is.null,is_internal_transfer.eq.false")
          .order("date", { ascending: false })
          .range(from, from + pageSize - 1);
        if (error) throw error;
        const rows = (data ?? []) as unknown as Tx[];
        all.push(...rows);
        if (rows.length < pageSize) break;
        from += pageSize;
      }
      return all;
    },
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["uncategorized-accounts", targetUserId],
    enabled: !!targetUserId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pluggy_accounts" as any)
        .select("pluggy_id, name, marketing_name")
        .eq("user_id", targetUserId!);
      return (data ?? []) as any[];
    },
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["uncategorized-cats", targetUserId],
    enabled: !!targetUserId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, categoria_pai_id, ativo")
        .eq("user_id", targetUserId!)
        .eq("ativo", true)
        .order("ordem");
      return (data ?? []).filter((c: any) => c.categoria_pai_id != null);
    },
  });

  const accountLabel = (id: string) => {
    const a = accounts.find((x: any) => x.pluggy_id === id);
    return a?.marketing_name || a?.name || "—";
  };

  const updateMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      categoria_financeira_id: string;
      description: string;
      amount: number;
      categoriaNome: string;
    }) => {
      const { error } = await supabase
        .from("pluggy_transactions" as any)
        .update({ categoria_financeira_id: vars.categoria_financeira_id })
        .eq("id", vars.id);
      if (error) throw error;
      return vars;
    },
    onSuccess: (vars) => {
      toast.success("Categoria aplicada");
      queryClient.invalidateQueries({ queryKey: ["uncategorized-tx-list"] });
      queryClient.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["uncategorized_tx_count"] });
      // Detector de conflito
      registrar(vars.description, vars.categoria_financeira_id);
      // Buffer de oferta de regra
      setRecentApplied((prev) => {
        const next = [
          ...prev,
          { description: vars.description, amount: vars.amount, categoriaId: vars.categoria_financeira_id },
        ];
        const sameCat = next.filter((r) => r.categoriaId === vars.categoria_financeira_id);
        if (sameCat.length >= 2) {
          const negativos = sameCat.filter((t) => t.amount < 0).length;
          const tipoSugerido: "pagar" | "receber" =
            negativos >= sameCat.length / 2 ? "pagar" : "receber";
          setOferta({
            open: true,
            descricoes: sameCat.map((t) => t.description).filter(Boolean),
            categoriaId: vars.categoria_financeira_id,
            categoriaNome: vars.categoriaNome,
            tipoSugerido,
          });
          // limpa o buffer dessa categoria pra não repetir
          return next.filter((r) => r.categoriaId !== vars.categoria_financeira_id);
        }
        return next;
      });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const enhancedTransactions = useMemo(
    () => transactions.map((tx) => ({ ...tx, _pretty: enhancePluggyDescription(tx) })),
    [transactions]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return enhancedTransactions.filter((t) => {
      if (accountFilter !== "all" && t.pluggy_account_id !== accountFilter) return false;
      if (typeFilter === "in" && t.amount <= 0) return false;
      if (typeFilter === "out" && t.amount >= 0) return false;
      if (q) {
        const hay = `${t._pretty} ${t.description ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enhancedTransactions, search, accountFilter, typeFilter]);

  const totalSaida = filtered.filter((t) => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const totalEntrada = filtered.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              Transações sem categorização
            </DialogTitle>
            <DialogDescription className="text-xs">
              Atribua uma subcategoria DRE diretamente nesta lista. As mudanças são salvas automaticamente.
            </DialogDescription>
          </DialogHeader>

          {/* Filtros */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por descrição..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="h-9 w-[200px] text-xs">
                <Filter className="w-3.5 h-3.5 mr-1.5" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as contas</SelectItem>
                {accounts.map((a: any) => (
                  <SelectItem key={a.pluggy_id} value={a.pluggy_id}>
                    {a.marketing_name || a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
              <SelectTrigger className="h-9 w-[150px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Entradas e saídas</SelectItem>
                <SelectItem value="in">Apenas entradas</SelectItem>
                <SelectItem value="out">Apenas saídas</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>
              {isLoading ? "Carregando..." : `${filtered.length} de ${transactions.length} transação(ões)`}
            </span>
            <span className="flex gap-3">
              <span className="text-success">Entradas: {fmt(totalEntrada)}</span>
              <span className="text-destructive">Saídas: {fmt(totalSaida)}</span>
            </span>
          </div>

          <div className="max-h-[55vh] overflow-y-auto rounded-md border border-border/40 divide-y divide-border/40">
            {isLoading ? (
              <div className="p-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
                <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                Nenhuma transação corresponde aos filtros.
              </div>
            ) : (
              filtered.map((tx) => {
                const isIn = tx.amount > 0;
                return (
                  <div
                    key={tx.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-md bg-muted/40 flex items-center justify-center shrink-0">
                      {isIn ? (
                        <ArrowDownLeft className="w-3.5 h-3.5 text-success" />
                      ) : (
                        <ArrowUpRight className="w-3.5 h-3.5 text-destructive" />
                      )}
                    </div>
                    <div className="w-20 shrink-0 text-[11px] text-muted-foreground">
                      {format(new Date(tx.date), "dd/MM/yy", { locale: ptBR })}
                    </div>
                    <div className="flex-1 min-w-0">
                      <DescricaoComRegra
                        description={tx._pretty}
                        categoriaId={tx.categoria_financeira_id}
                        tipoSugerido={tx.amount < 0 ? "pagar" : "receber"}
                        className="block"
                      >
                        <p className="text-sm text-foreground truncate" title={tx._pretty}>
                          {tx._pretty}
                        </p>
                      </DescricaoComRegra>
                      {accountLabel(tx.pluggy_account_id) !== "—" && (
                        <p className="text-[11px] text-muted-foreground truncate">
                          {accountLabel(tx.pluggy_account_id)}
                        </p>
                      )}
                    </div>
                    <div
                      className={`w-28 shrink-0 text-right text-sm font-semibold tabular-nums ${
                        isIn ? "text-success" : "text-destructive"
                      }`}
                    >
                      {fmt(tx.amount)}
                    </div>
                    <div className="w-56 shrink-0">
                      <Select
                        value={tx.categoria_financeira_id ?? ""}
                        onValueChange={(v) => {
                          const c = categorias.find((x: any) => x.id === v);
                          updateMutation.mutate({
                            id: tx.id,
                            categoria_financeira_id: v,
                            description: tx.description ?? "",
                            amount: tx.amount,
                            categoriaNome: c?.nome ?? "",
                          });
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Selecionar subcategoria" />
                        </SelectTrigger>
                        <SelectContent>
                          {categorias.map((c: any) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Modais empilhados: oferta de regra + conflito de regra */}
      <OfertaCriarRegraModal
        open={oferta.open}
        onOpenChange={(v) => setOferta((p) => ({ ...p, open: v }))}
        descricoes={oferta.descricoes}
        categoriaId={oferta.categoriaId}
        categoriaNome={oferta.categoriaNome}
        tipoSugerido={oferta.tipoSugerido}
      />
      <RegraConflitoModal conflito={conflito} onClose={() => setConflito(null)} />
    </>
  );
}
