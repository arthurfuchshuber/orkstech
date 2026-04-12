import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Search,
  Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";

interface UnreconciledTx {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  pluggy_account_id: string;
}

interface PayableCandidate {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  supplier_name: string | null;
}

export default function Conciliacao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTx, setSelectedTx] = useState<string | null>(null);

  // Unreconciled debit transactions
  const { data: unreconciledTxs = [], isLoading: loadingTx } = useQuery({
    queryKey: ["unreconciled_transactions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .select("*")
        .eq("user_id", user!.id)
        .eq("reconciled", false)
        .in("type", ["DEBIT"])
        .order("date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data as unknown as UnreconciledTx[];
    },
    enabled: !!user,
  });

  // Pending payables for manual matching
  const { data: payables = [] } = useQuery({
    queryKey: ["pending_payables_for_reconciliation"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_payable")
        .select("id, description, amount, due_date, supplier_name")
        .eq("user_id", user!.id)
        .in("status", ["pending", "overdue"])
        .order("due_date");
      if (error) throw error;
      return data as PayableCandidate[];
    },
    enabled: !!user,
  });

  const reconcileMutation = useMutation({
    mutationFn: async ({ txId, payableId }: { txId: string; payableId: string }) => {
      // Find the tx and payable
      const tx = unreconciledTxs.find((t) => t.id === txId);
      const payable = payables.find((p) => p.id === payableId);
      if (!tx || !payable) throw new Error("Dados não encontrados");

      // Update payable as paid
      const { error: payError } = await supabase
        .from("accounts_payable")
        .update({ status: "paid" as any, payment_date: tx.date })
        .eq("id", payableId);
      if (payError) throw payError;

      // Mark transaction as reconciled
      const { error: txError } = await supabase
        .from("pluggy_transactions" as any)
        .update({ reconciled: true, reconciled_payable_id: payableId })
        .eq("id", txId);
      if (txError) throw txError;

      // Create cash transaction
      const { error: cashError } = await supabase.from("cash_transactions").insert({
        user_id: user!.id,
        type: "expense" as any,
        amount: Math.abs(tx.amount),
        transaction_date: tx.date,
        description: `Conciliação manual: ${payable.description}`,
        account_payable_id: payableId,
      });
      if (cashError) throw cashError;
    },
    onSuccess: () => {
      toast.success("Transação conciliada com sucesso!");
      setSelectedTx(null);
      qc.invalidateQueries({ queryKey: ["unreconciled_transactions"] });
      qc.invalidateQueries({ queryKey: ["pending_payables_for_reconciliation"] });
    },
    onError: (err) => {
      toast.error(`Erro: ${(err as Error).message}`);
    },
  });

  const dismissMutation = useMutation({
    mutationFn: async (txId: string) => {
      const { error } = await supabase
        .from("pluggy_transactions" as any)
        .update({ reconciled: true })
        .eq("id", txId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Transação descartada da conciliação");
      qc.invalidateQueries({ queryKey: ["unreconciled_transactions"] });
    },
  });

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

  // Find suggested payable matches for a transaction
  const getSuggestions = (tx: UnreconciledTx): PayableCandidate[] => {
    const absAmount = Math.abs(tx.amount);
    const txDate = new Date(tx.date);

    return payables
      .map((p) => {
        const amountDiff = Math.abs(p.amount - absAmount);
        const dateDiff = Math.abs(
          new Date(p.due_date).getTime() - txDate.getTime()
        ) / (1000 * 60 * 60 * 24);

        // Score: lower is better
        const score = amountDiff / absAmount * 100 + dateDiff;
        return { ...p, score, amountDiff, dateDiff };
      })
      .filter((p) => p.amountDiff < absAmount * 0.1 && p.dateDiff < 30) // ±10% amount, ±30 days
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
  };

  const filteredTxs = unreconciledTxs.filter((tx) =>
    searchTerm === ""
      ? true
      : tx.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ArrowRightLeft className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Conciliação Bancária</h1>
          <p className="text-sm text-muted-foreground">
            Vincule transações bancárias às contas a pagar
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pendentes de conciliação</p>
          <p className="text-2xl font-bold text-foreground">{unreconciledTxs.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Contas a pagar em aberto</p>
          <p className="text-2xl font-bold text-foreground">{payables.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Valor pendente</p>
          <p className="text-2xl font-bold text-foreground">
            {formatCurrency(
              unreconciledTxs.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
            )}
          </p>
        </Card>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar transação..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Transactions list */}
      {loadingTx ? (
        <div className="py-12 text-center text-muted-foreground text-sm">Carregando...</div>
      ) : filteredTxs.length === 0 ? (
        <Card className="py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Tudo conciliado!</p>
          <p className="text-xs text-muted-foreground mt-1">
            Não há transações pendentes de conciliação.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredTxs.map((tx) => {
            const isSelected = selectedTx === tx.id;
            const suggestions = isSelected ? getSuggestions(tx) : [];

            return (
              <Card key={tx.id} className="overflow-hidden">
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => setSelectedTx(isSelected ? null : tx.id)}
                >
                  <div className="w-8 h-8 rounded-lg bg-destructive/10 flex items-center justify-center flex-shrink-0">
                    <ArrowRightLeft className="w-4 h-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.description || "Sem descrição"}
                    </p>
                    <span className="text-[11px] text-muted-foreground">{formatDate(tx.date)}</span>
                  </div>
                  <p className="text-sm font-semibold text-destructive whitespace-nowrap">
                    {formatCurrency(Math.abs(tx.amount))}
                  </p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissMutation.mutate(tx.id);
                    }}
                    title="Ignorar"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>

                {/* Expanded: show match suggestions */}
                {isSelected && (
                  <div className="border-t border-border/30 bg-muted/10 px-4 py-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Sugestões de conciliação:
                    </p>
                    {suggestions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        Nenhuma conta a pagar compatível encontrada.
                      </p>
                    ) : (
                      suggestions.map((s) => (
                        <div
                          key={s.id}
                          className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">
                              {s.description}
                            </p>
                            <div className="flex gap-2 mt-0.5">
                              <span className="text-[11px] text-muted-foreground">
                                Venc.: {formatDate(s.due_date)}
                              </span>
                              {s.supplier_name && (
                                <span className="text-[11px] text-muted-foreground">
                                  • {s.supplier_name}
                                </span>
                              )}
                            </div>
                          </div>
                          <p className="text-xs font-semibold text-foreground whitespace-nowrap">
                            {formatCurrency(s.amount)}
                          </p>
                          <Button
                            size="sm"
                            className="h-7 text-xs gap-1"
                            disabled={reconcileMutation.isPending}
                            onClick={() =>
                              reconcileMutation.mutate({ txId: tx.id, payableId: s.id })
                            }
                          >
                            {reconcileMutation.isPending ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3 h-3" />
                            )}
                            Conciliar
                          </Button>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
