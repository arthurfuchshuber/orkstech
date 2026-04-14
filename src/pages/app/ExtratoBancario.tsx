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
  connection_id: string | null;
  bank_data: {
    balanceCloseDate?: string | null;
    openBillAmount?: number | null;
    totalDebt?: number | null;
    automaticallyInvestedBalance?: number | null;
    totalInvestments?: number | null;
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

  // Fetch connections (connector_name) and profile (nome) for display names
  const { data: connections = [] } = useQuery({
    queryKey: ["pluggy_connections_names", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_connections" as any)
        .select("pluggy_item_id, connector_name")
        .eq("user_id", targetUserId!);
      if (error) throw error;
      return data as unknown as { pluggy_item_id: string; connector_name: string | null }[];
    },
    enabled: !!user && !!targetUserId,
  });

  const { data: profileData } = useQuery({
    queryKey: ["profile_name", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nome")
        .eq("user_id", targetUserId!)
        .maybeSingle();
      if (error) throw error;
      return data as { nome: string | null } | null;
    },
    enabled: !!user && !!targetUserId,
  });

  const { data: empresaData } = useQuery({
    queryKey: ["empresa_name", empresa?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("empresas")
        .select("nome_fantasia, razao_social")
        .eq("id", empresa!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { nome_fantasia: string | null; razao_social: string } | null;
    },
    enabled: !!empresa?.id,
  });

  const getDisplayName = (account: BankAccount) => {
    const conn = connections.find((c) => c.pluggy_item_id === account.pluggy_item_id);
    const connectorName = conn?.connector_name || "Conta";
    const isEmpresaConnector = connectorName.toLowerCase().includes("empresa");
    const ownerLabel = isEmpresaConnector
      ? (empresaData?.nome_fantasia || empresaData?.razao_social || "")
      : (profileData?.nome || "");

    // Title case helper
    const toTitleCase = (str: string) =>
      str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

    const displayOwner = ownerLabel ? toTitleCase(ownerLabel) : "";

    if (account.type === "CREDIT") {
      const creditData = (account.bank_data as any)?.creditData;
      const last4 = creditData?.disaggregatedCreditLimits?.[0]?.identificationNumber || "";
      const suffix = last4 ? ` (${last4})` : "";
      const prefix = `${connectorName} Cartão de Crédito${suffix}`;
      return displayOwner ? `${prefix} - ${displayOwner}` : prefix;
    }

    return displayOwner ? `${connectorName} (${displayOwner})` : connectorName;
  };

  const { data: allTransactions = [] } = useQuery({
    queryKey: ["pluggy_transactions_summary", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .select("*")
        .eq("user_id", targetUserId!)
        .order("date", { ascending: false })
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

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (date: string) =>
    new Date(date + "T12:00:00").toLocaleDateString("pt-BR");

  const filteredTx = transactions.filter((tx) =>
    searchTerm === ""
      ? true
      : tx.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const creditCards = accounts.filter((account) => account.type === "CREDIT");
  const bankAccounts = accounts.filter((account) => account.type !== "CREDIT");

  const getStoredBalance = (account: BankAccount) => {
    // Prefer totalInvestments (from investments API), fallback to automaticallyInvestedBalance
    const investments = account.bank_data?.totalInvestments ?? 0;
    const autoInvested = account.bank_data?.automaticallyInvestedBalance ?? 0;
    return investments > 0 ? investments : autoInvested;
  };

  const getAccountTotalBalance = (account: BankAccount) =>
    account.balance + getStoredBalance(account);

  const totalsByAccount = allTransactions.reduce<
    Record<string, { income: number; expense: number }>
  >((accumulator, tx) => {
    const current = accumulator[tx.pluggy_account_id] ?? { income: 0, expense: 0 };
    const amount = Math.abs(tx.amount);

    if (tx.type === "CREDIT" || tx.amount > 0) {
      current.income += amount;
    } else {
      current.expense += amount;
    }

    accumulator[tx.pluggy_account_id] = current;
    return accumulator;
  }, {});

  const totalBalance = bankAccounts.reduce(
    (sum, account) => sum + getAccountTotalBalance(account),
    0
  );

  // Use allTransactions (unfiltered) so general cards always match per-account cards
  const totalIncome = allTransactions
    .filter((tx) => tx.type === "CREDIT" || tx.amount > 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const totalExpense = allTransactions
    .filter((tx) => tx.type === "DEBIT" || tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  return (
    <div className="space-y-6">
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Saldo Total</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalBalance)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {bankAccounts.length} conta(s) conectada(s), incluindo valores guardados quando enviados separadamente
          </p>
        </Card>

        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Entradas</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalIncome)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">No período filtrado</p>
        </Card>

        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-xs text-muted-foreground">Saídas</span>
          </div>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalExpense)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">No período filtrado</p>
        </Card>
      </div>

      {creditCards.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <CreditCard className="h-4 w-4" /> Cartões de Crédito
          </h2>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {creditCards.map((card) => (
              <Card key={card.id} className="space-y-3 border-l-4 border-l-primary p-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-foreground">{getDisplayName(card)}</p>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleSync(card.pluggy_item_id)}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <p className="text-muted-foreground">
                      {card.bank_data?.hasBillData || card.bank_data?.hasOpenBillCalc
                        ? "Fatura Aberta"
                        : "Saldo Devedor"}
                    </p>
                    <p className="text-base font-bold text-destructive">
                      {card.credit_bill_amount != null
                        ? formatCurrency(card.credit_bill_amount)
                        : "—"}
                    </p>
                    {(card.bank_data?.hasBillData || card.bank_data?.hasOpenBillCalc) && (
                      <p className="text-[10px] text-muted-foreground/70">parcial do ciclo</p>
                    )}
                  </div>

                  <div>
                    <p className="text-muted-foreground">Vencimento</p>
                    <p className="text-base font-bold text-foreground">
                      {card.credit_bill_due_date ? formatDate(card.credit_bill_due_date) : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Limite Total</p>
                    <p className="font-semibold text-foreground">
                      {card.credit_limit != null ? formatCurrency(card.credit_limit) : "—"}
                    </p>
                  </div>

                  <div>
                    <p className="text-muted-foreground">Disponível</p>
                    <p className="font-semibold text-foreground">
                      {card.credit_available != null
                        ? formatCurrency(card.credit_available)
                        : "—"}
                    </p>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {bankAccounts.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <Landmark className="h-4 w-4" /> Contas Bancárias
          </h2>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {bankAccounts.map((account) => {
              const stored = getStoredBalance(account);
              const totals = totalsByAccount[account.pluggy_account_id] ?? {
                income: 0,
                expense: 0,
              };

              return (
                <Card key={account.id} className="space-y-1 p-3">
                  <p className="text-xs text-muted-foreground">{getDisplayName(account)}</p>
                  <p className="text-lg font-bold text-foreground">
                    {formatCurrency(getAccountTotalBalance(account))}
                  </p>
                  <div className="space-y-0.5 border-t border-border pt-1 text-[11px] text-muted-foreground">
                    <div className="flex justify-between gap-3">
                      <span>Disponível</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(account.balance)}
                      </span>
                    </div>
                    {stored > 0 && (
                      <div className="flex justify-between gap-3">
                        <span>Caixinhas / Guardado</span>
                        <span className="font-medium text-foreground">
                          {formatCurrency(stored)}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between gap-3">
                      <span>Entradas</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(totals.income)}
                      </span>
                    </div>
                    <div className="flex justify-between gap-3">
                      <span>Saídas</span>
                      <span className="font-medium text-foreground">
                        {formatCurrency(totals.expense)}
                      </span>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      <Card className="p-4">
        <div className="flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar transação..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={selectedAccount} onValueChange={setSelectedAccount}>
            <SelectTrigger className="w-full md:w-[220px]">
              <SelectValue placeholder="Todas as contas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as contas</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.pluggy_account_id} value={account.pluggy_account_id}>
                  {getDisplayName(account)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full md:w-[160px]">
              <Filter className="mr-2 h-3.5 w-3.5" />
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

      <Card className="divide-y divide-border/30">
        {loadingAccounts || loadingTx ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
            Carregando transações...
          </div>
        ) : filteredTx.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">
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
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/30"
              >
                <div
                  className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${
                    isCredit ? "bg-primary/10" : "bg-destructive/10"
                  }`}
                >
                  {isCredit ? (
                    <ArrowDownLeft className="h-4 w-4 text-primary" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-destructive" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-foreground">
                      {tx.description || "Sem descrição"}
                    </p>
                    {tx.reconciled && (
                      <Badge variant="outline" className="gap-1 text-[10px]">
                        <CheckCircle2 className="h-3 w-3" />
                        Conciliado
                      </Badge>
                    )}
                  </div>

                  <div className="mt-0.5 flex items-center gap-2">
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
                  className={`whitespace-nowrap text-sm font-semibold ${
                    isCredit ? "text-primary" : "text-destructive"
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
