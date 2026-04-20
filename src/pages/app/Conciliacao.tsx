import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import {
  CheckCircle2,
  XCircle,
  ArrowRightLeft,
  Search,
  Loader2,
  ArrowDownLeft,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { Input } from "@/components/ui/input";

type TxKind = "DEBIT" | "CREDIT";

interface UnreconciledTx {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: TxKind;
  pluggy_account_id: string;
}

interface PayableCandidate {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  supplier_name: string | null;
}

interface ReceivableCandidate {
  id: string;
  description: string;
  amount: number;
  due_date: string;
  cliente_id: string | null;
}

type Mode = "debit" | "credit";

export default function Conciliacao() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  const [mode, setMode] = useState<Mode>("debit");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [batchSelection, setBatchSelection] = useState<Set<string>>(new Set());

  const targetUserId = empresa?.user_id ?? user?.id;
  const txType: TxKind = mode === "debit" ? "DEBIT" : "CREDIT";

  // Unreconciled transactions (excluding internal transfers)
  const { data: unreconciledTxs = [], isLoading: loadingTx } = useQuery({
    queryKey: ["unreconciled_transactions", targetUserId, txType],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .select("*")
        .eq("user_id", targetUserId!)
        .eq("reconciled", false)
        .eq("is_internal_transfer", false)
        .eq("type", txType)
        .order("date", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data as unknown as UnreconciledTx[];
    },
    enabled: !!user && !!targetUserId,
  });

  // Pending payables (for DEBIT matching)
  const { data: payables = [] } = useQuery({
    queryKey: ["pending_payables_for_reconciliation", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_payable")
        .select("id, description, amount, due_date, supplier_name")
        .eq("user_id", targetUserId!)
        .in("status", ["pending", "overdue"])
        .order("due_date");
      if (error) throw error;
      return data as PayableCandidate[];
    },
    enabled: !!user && !!targetUserId && mode === "debit",
  });

  // Pending receivables (for CREDIT matching)
  const { data: receivables = [] } = useQuery({
    queryKey: ["pending_receivables_for_reconciliation", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_receivable")
        .select("id, description, amount, due_date, cliente_id")
        .eq("user_id", targetUserId!)
        .in("status", ["pending", "overdue"])
        .order("due_date");
      if (error) throw error;
      return data as ReceivableCandidate[];
    },
    enabled: !!user && !!targetUserId && mode === "credit",
  });

  // Reconcile mutation (handles both payable and receivable)
  const reconcileMutation = useMutation({
    mutationFn: async ({
      txId,
      targetId,
    }: {
      txId: string;
      targetId: string;
    }) => {
      const tx = unreconciledTxs.find((t) => t.id === txId);
      if (!tx) throw new Error("Transação não encontrada");

      if (mode === "debit") {
        const payable = payables.find((p) => p.id === targetId);
        if (!payable) throw new Error("Conta a pagar não encontrada");

        const { error: payError } = await supabase
          .from("accounts_payable")
          .update({ status: "paid" as any, payment_date: tx.date })
          .eq("id", targetId);
        if (payError) throw payError;

        const { error: txError } = await supabase
          .from("pluggy_transactions" as any)
          .update({ reconciled: true, reconciled_payable_id: targetId })
          .eq("id", txId);
        if (txError) throw txError;

        const { error: cashError } = await supabase.from("cash_transactions").insert({
          user_id: user!.id,
          empresa_id: empresa?.id ?? null,
          type: "expense" as any,
          amount: Math.abs(tx.amount),
          transaction_date: tx.date,
          description: `Conciliação: ${payable.description}`,
          account_payable_id: targetId,
        });
        if (cashError) throw cashError;
      } else {
        const receivable = receivables.find((r) => r.id === targetId);
        if (!receivable) throw new Error("Conta a receber não encontrada");

        const { error: recError } = await supabase
          .from("accounts_receivable")
          .update({ status: "paid", payment_date: tx.date })
          .eq("id", targetId);
        if (recError) throw recError;

        const { error: txError } = await supabase
          .from("pluggy_transactions" as any)
          .update({ reconciled: true, reconciled_receivable_id: targetId })
          .eq("id", txId);
        if (txError) throw txError;

        const { error: cashError } = await supabase.from("cash_transactions").insert({
          user_id: user!.id,
          empresa_id: empresa?.id ?? null,
          type: "income" as any,
          amount: Math.abs(tx.amount),
          transaction_date: tx.date,
          description: `Conciliação: ${receivable.description}`,
        });
        if (cashError) throw cashError;
      }
    },
    onSuccess: () => {
      toast.success("Transação conciliada");
      setSelectedTx(null);
      qc.invalidateQueries({ queryKey: ["unreconciled_transactions"] });
      qc.invalidateQueries({ queryKey: ["pending_payables_for_reconciliation"] });
      qc.invalidateQueries({ queryKey: ["pending_receivables_for_reconciliation"] });
      qc.invalidateQueries({ queryKey: ["cashflow"] });
    },
    onError: (err) => toast.error(`Erro: ${(err as Error).message}`),
  });

  const dismissMutation = useMutation({
    mutationFn: async (txIds: string[]) => {
      const { error } = await supabase
        .from("pluggy_transactions" as any)
        .update({ reconciled: true })
        .in("id", txIds);
      if (error) throw error;
    },
    onSuccess: (_, txIds) => {
      toast.success(`${txIds.length} transação(ões) descartada(s)`);
      setBatchSelection(new Set());
      qc.invalidateQueries({ queryKey: ["unreconciled_transactions"] });
    },
  });

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

  // Smart suggestions: tokenized description match + amount + date proximity
  const getSuggestions = (tx: UnreconciledTx) => {
    const candidates = mode === "debit" ? payables : receivables;
    const absAmount = Math.abs(tx.amount);
    const txDate = new Date(tx.date);
    const txTokens = (tx.description || "")
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 4);

    return candidates
      .map((c) => {
        const amountDiff = Math.abs(c.amount - absAmount);
        const dateDiff =
          Math.abs(new Date(c.due_date).getTime() - txDate.getTime()) /
          (1000 * 60 * 60 * 24);

        const cTokens = (c.description || "").toLowerCase();
        const tokenMatches = txTokens.filter((t) => cTokens.includes(t)).length;

        // Score: lower is better. Token matches reduce score.
        const score =
          (amountDiff / absAmount) * 100 + dateDiff - tokenMatches * 15;
        return { ...c, score, amountDiff, dateDiff, tokenMatches };
      })
      .filter((c) => c.amountDiff < absAmount * 0.05 && c.dateDiff < 45)
      .sort((a, b) => a.score - b.score)
      .slice(0, 5);
  };

  const filteredTxs = useMemo(
    () =>
      unreconciledTxs.filter((tx) =>
        searchTerm === ""
          ? true
          : tx.description?.toLowerCase().includes(searchTerm.toLowerCase()),
      ),
    [unreconciledTxs, searchTerm],
  );

  const totalAmount = filteredTxs.reduce(
    (sum, tx) => sum + Math.abs(tx.amount),
    0,
  );

  const toggleBatch = (id: string) => {
    setBatchSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const directionColor = mode === "debit" ? "text-destructive" : "text-emerald-500";
  const DirectionIcon = mode === "debit" ? ArrowUpRight : ArrowDownLeft;
  const candidatesCount = mode === "debit" ? payables.length : receivables.length;
  const candidatesLabel = mode === "debit" ? "Contas a pagar em aberto" : "Contas a receber em aberto";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3">
        <ArrowRightLeft className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Conciliação Bancária</h1>
          <p className="text-sm text-muted-foreground">
            Vincule transações bancárias aos lançamentos financeiros
          </p>
        </div>
      </div>

      {/* Mode tabs */}
      <Tabs value={mode} onValueChange={(v) => { setMode(v as Mode); setSelectedTx(null); setBatchSelection(new Set()); }}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="debit" className="gap-2">
            <ArrowUpRight className="w-4 h-4" /> Saídas (Pagar)
          </TabsTrigger>
          <TabsTrigger value="credit" className="gap-2">
            <ArrowDownLeft className="w-4 h-4" /> Entradas (Receber)
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Pendentes de conciliação</p>
          <p className="text-2xl font-bold text-foreground">{unreconciledTxs.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">{candidatesLabel}</p>
          <p className="text-2xl font-bold text-foreground">{candidatesCount}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Valor pendente</p>
          <p className={`text-2xl font-bold ${directionColor}`}>
            {formatCurrency(totalAmount)}
          </p>
        </Card>
      </div>

      {/* Search + batch actions */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar transação..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        {batchSelection.size > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => dismissMutation.mutate(Array.from(batchSelection))}
            disabled={dismissMutation.isPending}
            className="gap-2"
          >
            {dismissMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <XCircle className="w-4 h-4" />
            )}
            Ignorar {batchSelection.size} selecionada(s)
          </Button>
        )}
      </div>

      {/* Transactions list */}
      {loadingTx ? (
        <div className="py-12 text-center text-muted-foreground text-sm">
          <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" />
          Carregando transações...
        </div>
      ) : filteredTxs.length === 0 ? (
        <Card className="py-12 text-center">
          <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">Tudo conciliado!</p>
          <p className="text-xs text-muted-foreground mt-1">
            Não há {mode === "debit" ? "saídas" : "entradas"} pendentes de conciliação.
          </p>
        </Card>
      ) : (
        <div className="space-y-2">
          {filteredTxs.map((tx) => {
            const isSelected = selectedTx === tx.id;
            const isBatched = batchSelection.has(tx.id);
            const suggestions = isSelected ? getSuggestions(tx) : [];
            const hasStrongMatch =
              suggestions.length > 0 && suggestions[0].tokenMatches > 0 && suggestions[0].amountDiff < 0.01;

            return (
              <Card
                key={tx.id}
                className={`overflow-hidden transition-colors ${isBatched ? "ring-1 ring-primary/40" : ""}`}
              >
                <div className="flex items-center gap-3 px-4 py-3">
                  <Checkbox
                    checked={isBatched}
                    onCheckedChange={() => toggleBatch(tx.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div
                    className="flex-1 flex items-center gap-3 cursor-pointer"
                    onClick={() => setSelectedTx(isSelected ? null : tx.id)}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        mode === "debit" ? "bg-destructive/10" : "bg-emerald-500/10"
                      }`}
                    >
                      <DirectionIcon className={`w-4 h-4 ${directionColor}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {tx.description || "Sem descrição"}
                        </p>
                        {!isSelected && hasStrongMatch && (
                          <Badge variant="secondary" className="gap-1 text-[10px] py-0 px-1.5 h-4">
                            <Sparkles className="w-2.5 h-2.5" /> match
                          </Badge>
                        )}
                      </div>
                      <span className="text-[11px] text-muted-foreground">{formatDate(tx.date)}</span>
                    </div>
                    <p className={`text-sm font-semibold whitespace-nowrap ${directionColor}`}>
                      {formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      dismissMutation.mutate([tx.id]);
                    }}
                    title="Ignorar"
                  >
                    <XCircle className="w-4 h-4" />
                  </Button>
                </div>

                {/* Expanded: match suggestions */}
                {isSelected && (
                  <div className="border-t border-border/30 bg-muted/10 px-4 py-3 space-y-2">
                    <p className="text-xs font-medium text-muted-foreground mb-2">
                      Sugestões de conciliação:
                    </p>
                    {suggestions.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-2">
                        Nenhum lançamento compatível encontrado. Tente ignorar ou criar manualmente.
                      </p>
                    ) : (
                      suggestions.map((s) => {
                        const exact = s.amountDiff < 0.01;
                        return (
                          <div
                            key={s.id}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 transition-colors"
                          >
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-xs font-medium text-foreground truncate">
                                  {s.description}
                                </p>
                                {exact && s.tokenMatches > 0 && (
                                  <Badge variant="secondary" className="gap-1 text-[10px] py-0 px-1.5 h-4">
                                    <Sparkles className="w-2.5 h-2.5" /> alta
                                  </Badge>
                                )}
                              </div>
                              <div className="flex gap-2 mt-0.5">
                                <span className="text-[11px] text-muted-foreground">
                                  Venc.: {formatDate(s.due_date)}
                                </span>
                                {"supplier_name" in s && s.supplier_name && (
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
                                reconcileMutation.mutate({ txId: tx.id, targetId: s.id })
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
                        );
                      })
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
