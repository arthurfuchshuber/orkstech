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

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["pluggy_transactions", selectedAccount, typeFilter, targetUserId],
    queryFn: async () => {
      let query = supabase
        .from("pluggy_transactions" as any)
        .select("*")
        .eq("user_id", targetUserId!)
        .order("date", { ascending: false })
        .limit(200);

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
    enabled: !!user,
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

  const totalBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0);
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
            {bankAccounts.length} conta(s) conectada(s)
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
                    <p className="text-muted-foreground">Fatura Atual</p>
                    <p className="text-base font-bold text-destructive">
                      {cc.credit_bill_amount != null
                        ? formatCurrency(cc.credit_bill_amount)
                        : "—"}
                    </p>
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
            {bankAccounts.map((acc) => (
              <Card key={acc.id} className="p-3">
                <p className="text-xs text-muted-foreground">{acc.name}</p>
                <p className="text-lg font-bold text-foreground">
                  {formatCurrency(acc.balance)}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar transação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-full md:w-[200px]">
              <SelectValue placeholder="Todas as contas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map((acc) => (
                <SelectItem key={acc.pluggy_account_id} value={acc.pluggy_account_id}>
                  {acc.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[160px]">
              <Filter className="w-3.5 h-3.5 mr-2" />
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="CREDIT">Entradas</SelectItem>
              <SelectItem value="DEBIT">Saídas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </Card>

      {/* Transactions List */}
      <Card className="divide-y divide-border/30">
        {loadingAccounts || loadingTx ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            Carregando transações...
          </div>
        ) : filteredTx.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            {accounts.length === 0
              ? "Nenhuma conta conectada. Conecte um banco em Contas Bancárias."
              : "Nenhuma transação encontrada."}
          </div>
        ) : (
          filteredTx.map((tx) => {
            const isCredit = tx.type === "CREDIT" || tx.amount > 0;
            return (
              <div
                key={tx.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    isCredit ? "bg-emerald-500/10" : "bg-destructive/10"
                  }`}
                >
                  {isCredit ? (
                    <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                  ) : (
                    <ArrowUpRight className="w-4 h-4 text-destructive" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.description || "Sem descrição"}
                    </p>
                    {tx.reconciled && (
                      <Badge
                        variant="outline"
                        className="text-[10px] gap-1 text-emerald-600 border-emerald-200"
                      >
                        <CheckCircle2 className="w-3 h-3" />
                        Conciliado
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[11px] text-muted-foreground">
                      {formatDate(tx.date)}
                    </span>
                    {tx.category && (
                      <Badge variant="secondary" className="text-[10px]">
                        {tx.category}
                      </Badge>
                    )}
                  </div>
                </div>
                <p
                  className={`text-sm font-semibold whitespace-nowrap ${
                    isCredit ? "text-emerald-600" : "text-destructive"
                  }`}
                >
                  {isCredit ? "+" : "-"} {formatCurrency(Math.abs(tx.amount))}
                </p>
              </div>
            );
          })
        )}
      </Card>
    </div>
  );
}
