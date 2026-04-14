import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Landmark,
  Search,
  RefreshCw,
  Filter,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

interface BankAccount {
  id: string;
  name: string;
  type: string;
  balance: number;
  credit_limit: number | null;
  credit_available: number | null;
  credit_bill_amount: number | null;
  credit_bill_due_date: string | null;
  pluggy_account_id: string;
  pluggy_item_id: string;
  connection_id: string;
  bank_data: {
    balanceCloseDate?: string | null;
    openBillAmount?: number | null;
    totalDebt?: number | null;
    automaticallyInvestedBalance?: number | null;
    hasBillData?: boolean;
    hasOpenBillCalc?: boolean;
  } | null;
}

interface Transaction {
  id: string;
  description: string;
  amount: number;
  date: string;
  type: string;
  category: string | null;
  reconciled: boolean;
  pluggy_account_id: string;
}

export default function ExtratoBancario() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const targetUserId = empresa?.user_id ?? user?.id;

  const { data: accounts = [], isLoading: loadingAccounts } = useQuery({
    queryKey: ["pluggy_bank_accounts", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_bank_accounts" as any)
        .select("*")
        .eq("user_id", targetUserId!)
        .order("name");
      if (error) throw error;
      return data as unknown as BankAccount[];
    },
    enabled: !!user && !!targetUserId,
  });

  const { data: allTransactions = [] } = useQuery({
    queryKey: ["pluggy_transactions_summary", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .select("*")
        .eq("user_id", targetUserId!)
        .limit(1000);

      if (error) throw error;
      return data as unknown as Transaction[];
    },
    enabled: !!user && !!targetUserId,
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["pluggy_transactions", selectedAccount, typeFilter, targetUserId],
    queryFn: async () => {
      let query = supabase
        .from("pluggy_transactions" as any)
        .select("*")
        .eq("user_id", targetUserId!)
        .order("date", { ascending: false })
        .limit(1000);

      if (selectedAccount !== "all") {
        query = query.eq("pluggy_account_id", selectedAccount);
      }
      if (typeFilter !== "all") {
        query = query.eq("type", typeFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as Transaction[];
    },
    enabled: !!user && !!targetUserId,
  });

  const handleSync = async (itemId: string) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/pluggy-sync?itemId=${itemId}&action=full_sync`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        await res.text();
        throw new Error("Sync failed");
      }
      await res.json();
      window.location.reload();
    } catch (err) {
      console.error("Sync error:", err);
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (d: string) =>
    new Date(d + "T12:00:00").toLocaleDateString("pt-BR");

  const filteredTx = transactions.filter((tx) =>
    searchTerm === ""
      ? true
      : tx.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const creditCards = accounts.filter((a) => a.type === "CREDIT");
  const bankAccounts = accounts.filter((a) => a.type !== "CREDIT");

  const getInvestedBalance = (account: BankAccount) => {
    const invested = account.bank_data?.automaticallyInvestedBalance ?? 0;
    return invested > account.balance ? invested : 0;
  };

  const totalsByAccount = allTransactions.reduce<
    Record<string, { income: number; expense: number }>
  >((acc, tx) => {
    const key = tx.pluggy_account_id;
    const current = acc[key] ?? { income: 0, expense: 0 };
    const amount = Math.abs(tx.amount);

    if (tx.type === "CREDIT" || tx.amount > 0) {
      current.income += amount;
    } else {
      current.expense += amount;
    }

    acc[key] = current;
    return acc;
  }, {});

  const totalBalance = bankAccounts.reduce(
    (sum, a) => sum + a.balance + getInvestedBalance(a),
    0
  );
  const totalIncome = filteredTx
    .filter((tx) => tx.type === "CREDIT" || tx.amount > 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
  const totalExpense = filteredTx
    .filter((tx) => tx.type === "DEBIT" || tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Landmark className="w-6 h-6 text-primary" />
          <div>
            <h1 className="text-xl font-bold text-foreground">Extrato Bancário</h1>
            <p className="text-sm text-muted-foreground">
              Transações sincronizadas via Open Finance
            </p>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Landmark className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Saldo Total</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalBalance)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">
            {bankAccounts.length} conta(s) conectada(s), incluindo valores guardados quando o banco envia esse saldo separadamente
          </p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingUp className="w-4 h-4 text-emerald-500" />
            <span className="text-xs text-muted-foreground">Entradas</span>
          </div>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(totalIncome)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">No período filtrado</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <TrendingDown className="w-4 h-4 text-destructive" />
            <span className="text-xs text-muted-foreground">Saídas</span>
          </div>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalExpense)}</p>
          <p className="text-[11px] text-muted-foreground mt-1">No período filtrado</p>
        </Card>
      </div>

      {/* Credit Cards */}
      {creditCards.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <CreditCard className="w-4 h-4" /> Cartões de Crédito
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {creditCards.map((cc) => (
              <Card key={cc.id} className="p-4 space-y-3 border-l-4 border-l-primary">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{cc.name}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleSync(cc.pluggy_item_id)}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">
                      {cc.bank_data?.hasBillData || cc.bank_data?.hasOpenBillCalc
                        ? "Fatura Aberta"
                        : "Saldo Devedor"}
                    </p>
                    <p className="text-base font-bold text-destructive">
                      {cc.credit_bill_amount != null
                        ? formatCurrency(cc.credit_bill_amount)
                        : "—"}
                    </p>
                    {(cc.bank_data?.hasBillData || cc.bank_data?.hasOpenBillCalc) && (
                      <p className="text-[10px] text-muted-foreground/70">parcial do ciclo</p>
                    )}
                  </div>
                  <div>
                    <p className="text-muted-foreground">Vencimento</p>
                    <p className="text-base font-bold text-foreground">
                      {cc.credit_bill_due_date
                        ? formatDate(cc.credit_bill_due_date)
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Limite Total</p>
                    <p className="font-semibold text-foreground">
                      {cc.credit_limit != null ? formatCurrency(cc.credit_limit) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Disponível</p>
                    <p className="font-semibold text-emerald-600">
                      {cc.credit_available != null
                        ? formatCurrency(cc.credit_available)
                        : "—"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Bank Accounts */}
      {bankAccounts.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Landmark className="w-4 h-4" /> Contas Bancárias
          </h2>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {bankAccounts.map((acc) => {
              const invested = getInvestedBalance(acc);
              const accountTotal = acc.balance + invested;
              const accountTotals = totalsByAccount[acc.pluggy_account_id] ?? {
                income: 0,
                expense: 0,
              };

              return (
                <Card key={acc.id} className="p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">{acc.name}</p>
                  <p className="text-lg font-bold text-foreground">
                    {formatCurrency(accountTotal)}
                  </p>
                  <div className="text-[11px] text-muted-foreground space-y-0.5 pt-1 border-t border-border">
                    <div className="flex justify-between">
                      <span>Disponível</span>
                      <span className="font-medium text-foreground">{formatCurrency(acc.balance)}</span>
                    </div>
                    {invested > 0 && (
                      <div className="flex justify-between">
                        <span>Caixinhas / Guardado</span>
                        <span className="font-medium text-foreground">{formatCurrency(invested)}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span>Entradas</span>
                      <span className="font-medium text-foreground">{formatCurrency(accountTotals.income)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Saídas</span>
                      <span className="font-medium text-foreground">{formatCurrency(accountTotals.expense)}</span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
          })
        )}
      </Card>
    </div>
  );
}
