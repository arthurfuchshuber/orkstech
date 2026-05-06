import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Sparkles, Loader2, Search, ArrowUpRight, ArrowDownLeft } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

interface Tx {
  id: string;
  description: string | null;
  amount: number;
  date: string;
  categoria_financeira_id: string | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

/**
 * Modal que lista TODAS as transações Pluggy sem categorização DRE,
 * permitindo editar a subcategoria inline (sem sair / sem filtrar a página).
 */
export function UncategorizedTransactionsModal({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");

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
          .select("id, description, amount, date, categoria_financeira_id")
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

  const updateMutation = useMutation({
    mutationFn: async ({ id, categoria_financeira_id }: { id: string; categoria_financeira_id: string }) => {
      const { error } = await supabase
        .from("pluggy_transactions" as any)
        .update({ categoria_financeira_id })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria aplicada");
      queryClient.invalidateQueries({ queryKey: ["uncategorized-tx-list"] });
      queryClient.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["uncategorized_tx_count"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return transactions;
    return transactions.filter((t) => (t.description || "").toLowerCase().includes(q));
  }, [transactions, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            Transações sem categorização
          </DialogTitle>
          <DialogDescription className="text-xs">
            Atribua uma subcategoria DRE diretamente nesta lista. As mudanças são salvas automaticamente.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="text-xs text-muted-foreground">
          {isLoading ? "Carregando..." : `${filtered.length} transação(ões)`}
        </div>

        <div className="max-h-[55vh] overflow-y-auto rounded-md border border-border/40 divide-y divide-border/40">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-sm text-muted-foreground gap-2">
              <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nenhuma transação pendente. 🎉
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
                    <p className="text-sm text-foreground truncate">{tx.description || "Sem descrição"}</p>
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
                      onValueChange={(v) =>
                        updateMutation.mutate({ id: tx.id, categoria_financeira_id: v })
                      }
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
  );
}
