import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { CategoriaFinanceiraModal } from "@/components/modals/CategoriaFinanceiraModal";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { GenericImporter } from "@/components/financas/importacoes/GenericImporter";
import { ImportsHistoryTargeted } from "@/components/financas/importacoes/ImportsHistoryTargeted";
import { ManualBankTransactionDialog } from "@/components/financas/extrato/ManualBankTransactionDialog";
import { PluggyTransactionEditDialog } from "@/components/financas/extrato/PluggyTransactionEditDialog";
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
  CalendarIcon,
  PiggyBank,
  ChevronDown,
  Plus,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PluggyLastSyncBadge } from "@/components/PluggyLastSyncBadge";

// Movimentos internos (aplicações/resgates/transferências entre contas próprias)
// são identificados centralmente pela flag is_internal_transfer no banco.
const isInternalTransaction = (tx: { is_internal_transfer?: boolean | null }) =>
  tx.is_internal_transfer === true;

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
    owner?: string | null;
    taxNumber?: string | null;
    marketingName?: string | null;
    number?: string | null;
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
  is_internal_transfer?: boolean | null;
  pluggy_account_id: string;
  categoria_financeira_id: string | null;
  payment_data?: {
    payer?: { name?: string | null; documentNumber?: { value?: string | null } | null } | null;
    receiver?: { name?: string | null; documentNumber?: { value?: string | null } | null } | null;
    paymentMethod?: string | null;
  } | null;
}

/**
 * Improves a Pluggy transaction description by:
 *  - Removing redundant verbs ("Recebida"/"Enviada") from the type prefix.
 *  - Normalizing the "|" separator with surrounding whitespace.
 *  - Replacing generic counterparty names (banks themselves like "BANCO INTER SA")
 *    with the actual payer/receiver name extracted from payment_data when available.
 */
const GENERIC_COUNTERPARTY_REGEX =
  /^(banco\s|caixa\s|nubank\s|itau\s|itaú\s|bradesco\s|santander\s|inter\s|c6\s|sicoob\s|sicredi\s|bb\s|brasil\s)|s\.?a\.?$|sa$|ltda$/i;

const isGenericCounterparty = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return true;
  // Names that are essentially the bank's own legal name (e.g., "BANCO INTER SA")
  return /banco\s|^caixa$|s\.?a\.?$|^sa$/i.test(trimmed) && trimmed.split(/\s+/).length <= 5;
};

const toTitleCaseName = (str: string) =>
  str
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/\bDe\b|\bDa\b|\bDo\b|\bDos\b|\bDas\b|\bE\b/g, (m) => m.toLowerCase());

const enhanceDescription = (tx: Transaction): string => {
  const raw = (tx.description || "").trim();
  if (!raw) return "Sem descrição";

  const isCredit = tx.type === "CREDIT" || tx.amount > 0;

  // Split by "|" — Pluggy uses this as the separator between type and counterparty
  const parts = raw.split("|").map((p) => p.trim());
  let typeLabel = parts[0] || "";
  let counterparty = parts.slice(1).join(" | ").trim();

  // Strip "Recebida/Enviada" verbs
  typeLabel = typeLabel
    .replace(/\b(Recebida|Recebido|Enviada|Enviado)\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // If counterparty looks generic (just a bank name), try to enrich from payment_data
  const pd = tx.payment_data;
  if (counterparty && isGenericCounterparty(counterparty) && pd) {
    const realName = isCredit ? pd.payer?.name : pd.receiver?.name;
    if (realName && !isGenericCounterparty(realName)) {
      counterparty = toTitleCaseName(realName);
    } else {
      // Fall back to showing document number for traceability
      const doc = isCredit
        ? pd.payer?.documentNumber?.value
        : pd.receiver?.documentNumber?.value;
      if (doc) counterparty = `${counterparty} · ${doc}`;
    }
  } else if (counterparty) {
    // Normalize casing for ALL CAPS names
    if (counterparty === counterparty.toUpperCase()) {
      counterparty = toTitleCaseName(counterparty);
    }
  }

  return counterparty ? `${typeLabel} | ${counterparty}` : typeLabel || raw;
};

export default function ExtratoBancario() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [allPeriod, setAllPeriod] = useState(false);
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [editingManual, setEditingManual] = useState<any>(null);
  const [batchSelection, setBatchSelection] = useState<Set<string>>(new Set());
  const [pluggyEditTx, setPluggyEditTx] = useState<{ id: string; description: string | null; amount: number; date: string } | null>(null);

  // Date range filter — default to current month
  const now = new Date();
  const [dateFrom, setDateFrom] = useState<Date>(startOfMonth(now));
  const [dateTo, setDateTo] = useState<Date>(endOfMonth(now));

  const targetUserId = empresa?.user_id ?? user?.id;

  const dateFromStr = allPeriod ? "2000-01-01" : format(dateFrom, "yyyy-MM-dd");
  const dateToStr = allPeriod ? "2099-12-31" : format(dateTo, "yyyy-MM-dd");

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

  const { data: connections = [] } = useQuery({
    queryKey: ["pluggy_connections_names", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_connections" as any)
        .select("pluggy_item_id, connector_name, last_sync_at, status")
        .eq("user_id", targetUserId!);
      if (error) throw error;
      return data as unknown as { pluggy_item_id: string; connector_name: string | null; last_sync_at: string | null; status: string | null }[];
    },
    enabled: !!user && !!targetUserId,
  });

  // Query real investment data from Pluggy
  const { data: investments = [] } = useQuery({
    queryKey: ["pluggy_investments", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_investments" as any)
        .select("pluggy_item_id, name, balance, amount_original, amount_profit, status, type")
        .eq("user_id", targetUserId!);
      if (error) throw error;
      return data as unknown as {
        pluggy_item_id: string;
        name: string;
        balance: number;
        amount_original: number | null;
        amount_profit: number | null;
        status: string | null;
        type: string | null;
      }[];
    },
    enabled: !!user && !!targetUserId,
  });

  const { data: profileData } = useQuery({
    queryKey: ["profile_name", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("nome, cpf")
        .eq("user_id", targetUserId!)
        .maybeSingle();
      if (error) throw error;
      return data as { nome: string | null; cpf: string | null } | null;
    },
    enabled: !!user && !!targetUserId,
  });

  const toTitleCase = (str: string) =>
    str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

  const normalizeDocument = (value?: string | null) => value?.replace(/\D/g, "") ?? "";

  const getAccountOwner = (account: BankAccount) => {
    const syncedOwner = account.bank_data?.owner?.trim();
    if (syncedOwner) return toTitleCase(syncedOwner);

    const accountDocument = normalizeDocument(account.bank_data?.taxNumber);
    const empresaDocument = normalizeDocument(empresa?.cnpj);
    const profileDocument = normalizeDocument(profileData?.cpf);

    if (accountDocument && empresaDocument && accountDocument === empresaDocument) {
      return toTitleCase(empresa?.nome_fantasia || empresa?.razao_social || "");
    }

    if (accountDocument && profileDocument && accountDocument === profileDocument) {
      return toTitleCase(profileData?.nome || "");
    }

    const conn = connections.find((c) => c.pluggy_item_id === account.pluggy_item_id);
    const connectorName = conn?.connector_name || "Conta";
    const isEmpresaConnector = connectorName.toLowerCase().includes("empresa");
    const fallbackOwner = isEmpresaConnector
      ? empresa?.nome_fantasia || empresa?.razao_social || ""
      : profileData?.nome || "";

    return fallbackOwner ? toTitleCase(fallbackOwner) : "";
  };

  const getDisplayName = (account: BankAccount) => {
    const conn = connections.find((c) => c.pluggy_item_id === account.pluggy_item_id);
    const connectorName = conn?.connector_name || "Conta";
    const displayOwner = getAccountOwner(account);

    if (account.type === "CREDIT") {
      const creditData = (account.bank_data as any)?.creditData;
      const last4 = creditData?.disaggregatedCreditLimits?.[0]?.identificationNumber || "";
      const suffix = last4 ? ` (${last4})` : "";
      const ownerSuffix = displayOwner ? ` - ${displayOwner}` : "";
      return `${connectorName} Cartão de Crédito${suffix}${ownerSuffix}`;
    }

    return displayOwner ? `${connectorName} (${displayOwner})` : connectorName;
  };

  const creditCards = accounts.filter((account) => account.type === "CREDIT");
  const bankAccounts = accounts.filter((account) => account.type !== "CREDIT");

  const bankAccountIds = bankAccounts.map((a) => a.pluggy_account_id);

  // Fetch ALL bank account transactions (paginated) filtered by date range
  const { data: allTransactions = [] } = useQuery({
    queryKey: ["pluggy_transactions_summary", targetUserId, bankAccountIds.join(","), dateFromStr, dateToStr],
    queryFn: async () => {
      if (bankAccountIds.length === 0) return [];
      const allResults: Transaction[] = [];
      for (const accId of bankAccountIds) {
        let from = 0;
        const pageSize = 1000;
        while (true) {
          const { data, error } = await supabase
            .from("pluggy_transactions" as any)
            .select("id, amount, type, category, pluggy_account_id, is_internal_transfer")
            .eq("user_id", targetUserId!)
            .eq("pluggy_account_id", accId)
            .gte("date", dateFromStr)
            .lte("date", dateToStr)
            .range(from, from + pageSize - 1);
          if (error) throw error;
          const rows = data as unknown as Transaction[];
          allResults.push(...rows);
          if (rows.length < pageSize) break;
          from += pageSize;
        }
      }
      return allResults;
    },
    enabled: !!user && !!targetUserId && bankAccountIds.length > 0,
  });

  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["pluggy_transactions", selectedAccount, typeFilter, targetUserId, dateFromStr, dateToStr],
    queryFn: async () => {
      let query = supabase
        .from("pluggy_transactions" as any)
        .select("id, description, amount, date, type, category, reconciled, is_internal_transfer, pluggy_account_id, categoria_financeira_id, payment_data")
        .eq("user_id", targetUserId!)
        .gte("date", dateFromStr)
        .lte("date", dateToStr)
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

  // Categorias financeiras (hierárquicas) — só folhas (subcategorias) podem ser selecionadas
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
    enabled: !!user && !!targetUserId,
  });

  const updateCategoriaMutation = useMutation({
    mutationFn: async ({ id, categoria_financeira_id }: { id: string; categoria_financeira_id: string | null }) => {
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .update({ categoria_financeira_id })
        .eq("id", id)
        .select("id");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nenhum registro atualizado. Verifique suas permissões.");
      }
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      toast.success("Subcategoria atualizada");
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar subcategoria");
    },
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
      queryClient.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      toast.success(`${data?.length ?? 0} transação(ões) atualizada(s)`);
      setBatchSelection(new Set());
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar em lote");
    },
  });

  const toggleBatch = (id: string) => {
    setBatchSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const [syncing, setSyncing] = useState<string | null>(null);

  const handleSync = async (itemId: string) => {
    setSyncing(itemId);
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
    } finally {
      setSyncing(null);
    }
  };

  const formatCurrency = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (date: string) =>
    new Date(date + "T12:00:00").toLocaleDateString("pt-BR");

  const filteredTx = transactions.filter((tx) => {
    if (searchTerm === "") return true;
    const term = searchTerm.toLowerCase().trim();
    const termDigits = term.replace(/\D/g, "");

    // Build a haystack of all searchable fields
    const haystackParts: string[] = [
      tx.description || "",
      enhanceDescription(tx),
      tx.category || "",
      tx.payment_data?.payer?.name || "",
      tx.payment_data?.receiver?.name || "",
      tx.payment_data?.payer?.documentNumber?.value || "",
      tx.payment_data?.receiver?.documentNumber?.value || "",
    ];
    const haystack = haystackParts.join(" ").toLowerCase();

    if (haystack.includes(term)) return true;

    // Document-aware match: compare digits-only (handles CPF/CNPJ with or without mask)
    if (termDigits.length >= 3) {
      const haystackDigits = haystack.replace(/\D/g, "");
      if (haystackDigits.includes(termDigits)) return true;
    }

    return false;
  });

  // Saldo de investimentos REAIS da conta (somente totalInvestments).
  // automaticallyInvestedBalance NÃO é somado: já está incluso no `balance` da conta corrente
  // (ex.: caixinha Nubank). Somá-lo causaria duplicidade no card de saldo total.
  const getStoredBalance = (account: BankAccount) => {
    return Number(account.bank_data?.totalInvestments ?? 0);
  };

  const getAccountTotalBalance = (account: BankAccount) =>
    account.balance + getStoredBalance(account);

  // Filter out internal transactions (caixinhas/investments) for totals
  const externalTransactions = allTransactions.filter((tx) => !isInternalTransaction(tx));

  const totalsByAccount = externalTransactions.reduce<
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

  const totalIncome = externalTransactions
    .filter((tx) => tx.type === "CREDIT" || tx.amount > 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const totalExpense = externalTransactions
    .filter((tx) => tx.type === "DEBIT" || tx.amount < 0)
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const resultado = totalIncome - totalExpense;

  const periodLabel = allPeriod ? "Todo o período" : `${format(dateFrom, "dd/MM/yyyy")} a ${format(dateTo, "dd/MM/yyyy")}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Landmark className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Extrato Bancário</h1>
          <p className="text-sm text-muted-foreground">
            Transações sincronizadas via Open Finance + lançamentos manuais
          </p>
        </div>
      </div>

      <Tabs defaultValue="lista">
        <TabsList>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="importacoes">Importações</TabsTrigger>
        </TabsList>
        <TabsContent value="importacoes" className="mt-4 space-y-4">
          <GenericImporter target="bank_statement" onImported={() => queryClient.invalidateQueries()} />
          <ImportsHistoryTargeted target="bank_statement" onDeleted={() => queryClient.invalidateQueries()} />
        </TabsContent>
        <TabsContent value="lista" className="space-y-6 mt-4">

      {/* Date range filter */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-foreground">Período:</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal text-sm", allPeriod && "opacity-50")}>
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {allPeriod ? "Início" : format(dateFrom, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateFrom}
                onSelect={(d) => { if (d) { setAllPeriod(false); setDateFrom(d); } }}
                locale={ptBR}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <span className="text-sm text-muted-foreground">até</span>

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("w-[150px] justify-start text-left font-normal text-sm", allPeriod && "opacity-50")}>
                <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                {allPeriod ? "Hoje" : format(dateTo, "dd/MM/yyyy")}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="single"
                selected={dateTo}
                onSelect={(d) => { if (d) { setAllPeriod(false); setDateTo(d); } }}
                locale={ptBR}
                initialFocus
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>

          <div className="flex gap-2">
            <Button
              variant={!allPeriod && format(dateFrom, "yyyy-MM") === format(now, "yyyy-MM") ? "default" : "secondary"}
              size="sm"
              onClick={() => {
                setAllPeriod(false);
                setDateFrom(startOfMonth(now));
                setDateTo(endOfMonth(now));
              }}
            >
              Mês atual
            </Button>
            <Button
              variant={!allPeriod && format(dateFrom, "yyyy-MM") === format(new Date(now.getFullYear(), now.getMonth() - 1, 1), "yyyy-MM") ? "default" : "secondary"}
              size="sm"
              onClick={() => {
                setAllPeriod(false);
                const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                setDateFrom(startOfMonth(prev));
                setDateTo(endOfMonth(prev));
              }}
            >
              Mês anterior
            </Button>
            <Button
              variant={!allPeriod && format(dateFrom, "yyyy-MM-dd") === format(new Date(now.getFullYear(), 0, 1), "yyyy-MM-dd") && format(dateTo, "yyyy-MM") === format(now, "yyyy-MM") ? "default" : "secondary"}
              size="sm"
              onClick={() => {
                setAllPeriod(false);
                setDateFrom(new Date(now.getFullYear(), 0, 1));
                setDateTo(endOfMonth(now));
              }}
            >
              Ano atual
            </Button>
            <Button
              variant={allPeriod ? "default" : "secondary"}
              size="sm"
              onClick={() => setAllPeriod(true)}
            >
              Todo o período
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Saldo Total</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalBalance)}</p>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {bankAccounts.length} conta(s) conectada(s)
          </p>
        </Card>

        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-primary" />
            <span className="text-xs text-muted-foreground">Entradas</span>
          </div>
          <p className="text-xl font-bold text-foreground">{formatCurrency(totalIncome)}</p>
        </Card>

        <Card className="p-4">
          <div className="mb-1 flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-destructive" />
            <span className="text-xs text-muted-foreground">Saídas</span>
          </div>
          <p className="text-xl font-bold text-destructive">{formatCurrency(totalExpense)}</p>
        </Card>

        {(() => {
          const isPositive = resultado >= 0;
          return (
            <Card className={cn("p-4 border-l-4", isPositive ? "border-l-primary" : "border-l-destructive")}>
              <div className="mb-1 flex items-center gap-2">
                {isPositive ? (
                  <TrendingUp className="h-4 w-4 text-primary" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-destructive" />
                )}
                <span className="text-xs text-muted-foreground">Resultado</span>
              </div>
              <p className={cn("text-xl font-bold", isPositive ? "text-primary" : "text-destructive")}>
                {isPositive ? "+" : ""}{formatCurrency(resultado)}
              </p>
            </Card>
          );
        })()}
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
                    disabled={syncing === card.pluggy_item_id}
                  >
                    <RefreshCw className={cn("h-3.5 w-3.5", syncing === card.pluggy_item_id && "animate-spin")} />
                  </Button>
                </div>
                {(() => {
                  const conn = connections.find((c) => c.pluggy_item_id === card.pluggy_item_id);
                  return <PluggyLastSyncBadge lastSyncAt={conn?.last_sync_at} status={conn?.status} />;
                })()}

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
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs text-muted-foreground">{getDisplayName(account)}</p>
                    {(() => {
                      const conn = connections.find((c) => c.pluggy_item_id === account.pluggy_item_id);
                      return <PluggyLastSyncBadge lastSyncAt={conn?.last_sync_at} status={conn?.status} />;
                    })()}
                  </div>
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

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-foreground">Lançamentos</h2>
          {batchSelection.size > 0 && (
            <Badge variant="secondary" className="gap-1">
              {batchSelection.size} selecionada(s)
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {batchSelection.size > 0 && (
            <>
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
            </>
          )}
          <Button
            size="sm"
            onClick={() => { setEditingManual(null); setManualDialogOpen(true); }}
          >
            <Plus className="w-4 h-4 mr-2" /> Novo lançamento manual
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
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
          <>
            <div className="grid grid-cols-[36px_120px_minmax(0,1.6fr)_220px_140px] gap-4 border-b border-border/50 bg-card px-4 py-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-center">
                <Checkbox
                  checked={
                    filteredTx.length > 0 &&
                    filteredTx.every((t) => batchSelection.has(t.id))
                  }
                  onCheckedChange={(checked) => {
                    if (checked) {
                      setBatchSelection(new Set(filteredTx.map((t) => t.id)));
                    } else {
                      setBatchSelection(new Set());
                    }
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

                // Filtra por tipo financeiro pertinente ao fluxo (entrada x saída) e mostra apenas folhas finais
                const allowedTipos = isCredit
                  ? ["receita", "receita_financeira", "ajuste"]
                  : ["despesa", "custo", "deducao", "imposto", "despesa_financeira", "ajuste"];
                const subcatOptions = categoriasFinanceiras
                  .filter((c: any) => allowedTipos.includes(c.tipo))
                  .filter((c: any) => !categoriasFinanceiras.some((child: any) => child.categoria_pai_id === c.id));

                const enhancedDesc = enhanceDescription(tx);

                return (
                  <div
                    key={tx.id}
                    className={cn(
                      "grid grid-cols-[36px_120px_minmax(0,1.6fr)_220px_140px] items-center gap-4 px-4 py-3 transition-colors hover:bg-muted/30",
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
                    <div className="text-sm text-muted-foreground">
                      {formatDate(tx.date)}
                    </div>

                    <div className="min-w-0 flex items-center gap-3">
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

                    <p
                      className={`whitespace-nowrap text-right text-sm font-semibold ${
                        isCredit ? "text-primary" : "text-destructive"
                      }`}
                    >
                      {isCredit ? "+" : "-"} {formatCurrency(Math.abs(tx.amount))}
                    </p>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>

      <CategoriaFinanceiraModal
        open={cfModalOpen}
        onOpenChange={setCfModalOpen}
        editingId={null}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["dre-categorias-financeiras"] });
        }}
      />
        </TabsContent>
      </Tabs>

      <ManualBankTransactionDialog
        open={manualDialogOpen}
        onOpenChange={setManualDialogOpen}
        editing={editingManual}
      />

      <PluggyTransactionEditDialog
        open={!!pluggyEditTx}
        onOpenChange={(v) => !v && setPluggyEditTx(null)}
        transactionId={pluggyEditTx?.id ?? null}
        readOnly={pluggyEditTx ? { description: pluggyEditTx.description, amount: pluggyEditTx.amount, date: pluggyEditTx.date } : null}
      />
    </div>
  );
}


