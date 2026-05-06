import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PendenciasIndicator } from "@/components/financas/PendenciasIndicator";
import { UncategorizedTransactionsModal } from "@/components/financas/extrato/UncategorizedTransactionsModal";
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
import { OfertaCriarRegraModal } from "@/components/financas/extrato/OfertaCriarRegraModal";
import { DescricaoComRegra } from "@/components/financas/extrato/DescricaoComRegra";
import { useRegraConflitoDetector } from "@/hooks/useRegraConflitoDetector";
import { RegraConflitoModal } from "@/components/financas/dre/RegraConflitoModal";
import { classifyInternalSubtype, INTERNAL_SUBTYPE_LABEL, type InternalSubtype } from "@/lib/internal-tx-subtype";
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
  Sparkles,
} from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { PluggyLastSyncBadge } from "@/components/PluggyLastSyncBadge";

// Movimentos internos (aplicações/resgates/transferências entre contas próprias)
// são identificados centralmente pela flag is_internal_transfer no banco.
// Pagamentos de fatura em conta CREDIT (amount < 0) também são contrapartes da
// saída do banco — marcamos como interno para evitar duplicidade no extrato.
const isInternalTransaction = (
  tx: { is_internal_transfer?: boolean | null; amount?: number; pluggy_account_id?: string },
  creditAccountIds?: Set<string>,
) => {
  if (tx.is_internal_transfer === true) return true;
  if (creditAccountIds && tx.pluggy_account_id && creditAccountIds.has(tx.pluggy_account_id)) {
    // Pagamento da fatura no cartão (entrada): contraparte da saída no banco
    if (typeof tx.amount === "number" && tx.amount < 0) return true;
  }
  return false;
};

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

/** Remove o prefixo "Tipo |" mantendo só a contraparte para exibição limpa. */
const stripTypePrefix = (s: string) => {
  const idx = s.indexOf("|");
  return idx >= 0 ? s.slice(idx + 1).trim() : s.trim();
};

export default function ExtratoBancario() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedAccount, setSelectedAccount] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "sem-categoria" | "com-categoria">("all");
  const [uncatModalOpen, setUncatModalOpen] = useState(false);
  const [internoFilter, setInternoFilter] = useState<"all" | "ocultar" | "somente" | InternalSubtype>("all");
  const [allPeriod, setAllPeriod] = useState(false);

  // Lê ?filtro=sem-categoria da URL e ativa o filtro + período "todo"
  useEffect(() => {
    const f = searchParams.get("filtro");
    if (f === "sem-categoria") {
      setCategoryFilter("sem-categoria");
      setAllPeriod(true);
    }
  }, [searchParams]);
  const [cfModalOpen, setCfModalOpen] = useState(false);
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [editingManual, setEditingManual] = useState<any>(null);
  const [batchSelection, setBatchSelection] = useState<Set<string>>(new Set());
  const [ofertaRegra, setOfertaRegra] = useState<{
    open: boolean;
    descricoes: string[];
    categoriaId: string;
    categoriaNome?: string;
    tipoSugerido: "pagar" | "receber";
  }>({ open: false, descricoes: [], categoriaId: "", tipoSugerido: "pagar" });
  const [pluggyEditTx, setPluggyEditTx] = useState<{ id: string; description: string | null; amount: number; date: string } | null>(null);
  const [contasCardsExpanded, setContasCardsExpanded] = useState(false);

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

  // Nome curto para os cards (sem owner): "BTGPactual Empresas" ou "BTGPactual Empresas •••1962"
  const getShortName = (account: BankAccount) => {
    const conn = connections.find((c) => c.pluggy_item_id === account.pluggy_item_id);
    const connectorName = conn?.connector_name || "Conta";
    if (account.type === "CREDIT") {
      const creditData = (account.bank_data as any)?.creditData;
      const last4 = creditData?.disaggregatedCreditLimits?.[0]?.identificationNumber || "";
      return last4 ? `${connectorName} •••${last4}` : connectorName;
    }
    return connectorName;
  };

  const getOwnerLabel = (account: BankAccount) => getAccountOwner(account);

  const creditCards = accounts.filter((account) => account.type === "CREDIT");
  const bankAccounts = accounts.filter((account) => account.type !== "CREDIT");
  const creditAccountIds = new Set(creditCards.map((c) => c.pluggy_account_id));

  // Em contas de cartão de crédito, o Pluggy inverte a convenção de sinal:
  // compras vêm com amount > 0 (débito no cartão) e pagamentos com amount < 0.
  // Esta função normaliza: retorna true quando é entrada de caixa para o titular.
  const isInflow = (tx: { type: string; amount: number; pluggy_account_id: string }) => {
    const isCreditCard = creditAccountIds.has(tx.pluggy_account_id);
    if (isCreditCard) {
      // Cartão: amount negativo = pagamento da fatura (entrada/redução de dívida);
      // amount positivo = compra (saída).
      return tx.amount < 0;
    }
    return tx.type === "CREDIT" || tx.amount > 0;
  };

  const bankAccountIds = bankAccounts.map((a) => a.pluggy_account_id);
  // IDs de TODAS as contas (incluindo cartões) — usado para somar Entradas/Saídas
  // dos cards do topo, que devem refletir tudo que aparece na lista de lançamentos.
  const allAccountIds = accounts.map((a) => a.pluggy_account_id);

  // Fetch ALL transactions (paginated) filtered by date range — inclui cartões
  const { data: allTransactions = [] } = useQuery({
    queryKey: ["pluggy_transactions_summary", targetUserId, allAccountIds.join(","), dateFromStr, dateToStr],
    queryFn: async () => {
      if (allAccountIds.length === 0) return [];
      const allResults: Transaction[] = [];
      for (const accId of allAccountIds) {
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
    enabled: !!user && !!targetUserId && allAccountIds.length > 0,
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

  const { conflito, setConflito, registrar } = useRegraConflitoDetector();

  const updateCategoriaMutation = useMutation({
    mutationFn: async ({ id, categoria_financeira_id, description }: { id: string; categoria_financeira_id: string | null; description?: string }) => {
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .update({ categoria_financeira_id })
        .eq("id", id)
        .select("id, description");
      if (error) throw error;
      if (!data || data.length === 0) {
        throw new Error("Nenhum registro atualizado. Verifique suas permissões.");
      }
      return { rows: data, description: description ?? (data[0] as any)?.description, categoria_financeira_id };
    },
    onSuccess: ({ description, categoria_financeira_id }) => {
      queryClient.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      toast.success("Subcategoria atualizada");
      if (description) registrar(description, categoria_financeira_id);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Erro ao atualizar subcategoria");
    },
  });

  const batchUpdateCategoriaMutation = useMutation({
    mutationFn: async ({ ids, categoria_financeira_id }: { ids: string[]; categoria_financeira_id: string | null; categoriaNome?: string }) => {
      const { data, error } = await supabase
        .from("pluggy_transactions" as any)
        .update({ categoria_financeira_id })
        .in("id", ids)
        .select("id, description, amount");
      if (error) throw error;
      return data as any[];
    },
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      toast.success(`${data?.length ?? 0} transação(ões) atualizada(s)`);
      const ids = new Set(variables.ids);
      const selecionadas = (data ?? []).filter((t: any) => ids.has(t.id));
      // Registra cada uma para detector de conflito
      selecionadas.forEach((t: any) => registrar(t.description || "", variables.categoria_financeira_id));
      // Se categorizou 2+ itens com uma categoria real, oferece criar regra
      if (variables.categoria_financeira_id && selecionadas.length >= 2) {
        const negativos = selecionadas.filter((t: any) => Number(t.amount) < 0).length;
        const tipoSugerido: "pagar" | "receber" =
          negativos >= selecionadas.length / 2 ? "pagar" : "receber";
        setOfertaRegra({
          open: true,
          descricoes: selecionadas.map((t: any) => t.description || "").filter(Boolean),
          categoriaId: variables.categoria_financeira_id,
          categoriaNome: variables.categoriaNome,
          tipoSugerido,
        });
      }
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
        throw new Error("Falha na sincronização");
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

  // IDs das contas de cartão de crédito — usado para ocultar a linha "Pagamento"
  // do lado do cartão (contraparte da Fatura no banco), evitando duplicidade visual.
  const creditAccountIdsForFilter = new Set(
    accounts.filter((a) => a.type === "CREDIT").map((a) => a.pluggy_account_id),
  );

  const filteredTx = transactions.filter((tx) => {
    // Oculta o "Pagamento" do lado do cartão (já representado pela Fatura no banco)
    if (
      creditAccountIdsForFilter.has(tx.pluggy_account_id) &&
      tx.amount < 0 &&
      (tx.category || "").toLowerCase().includes("credit card payment")
    ) {
      return false;
    }

    // Filtro por categorização
    if (categoryFilter === "sem-categoria" && tx.categoria_financeira_id) return false;
    if (categoryFilter === "com-categoria" && !tx.categoria_financeira_id) return false;

    // Filtro por movimentações internas
    const subtype = classifyInternalSubtype(tx, creditAccountIdsForFilter);
    if (internoFilter === "ocultar" && subtype) return false;
    if (internoFilter === "somente" && !subtype) return false;
    if (internoFilter !== "all" && internoFilter !== "ocultar" && internoFilter !== "somente" && subtype !== internoFilter) return false;
    if (searchTerm === "") return true;
    const term = searchTerm.toLowerCase().trim();
    const termDigits = term.replace(/\D/g, "");

    // Busca literal: só casa contra o que é EXIBIDO na linha (descrição visível).
    // Não considera payment_data oculto — evita falsos positivos em movimentações
    // internas que carregam o nome da empresa nos metadados.
    const haystack = `${tx.description || ""} ${enhanceDescription(tx)}`.toLowerCase();

    if (haystack.includes(term)) return true;

    // Match por dígitos só se o documento aparecer no texto visível
    if (termDigits.length >= 3) {
      const haystackDigits = haystack.replace(/\D/g, "");
      if (haystackDigits.includes(termDigits)) return true;
    }

    return false;
  });

  // Saldo investido por item (caixinhas + CDBs/fundos ativos), agregado por pluggy_item_id.
  // Usa a tabela pluggy_investments (status ACTIVE) — fonte real do saldo guardado.
  // automaticallyInvestedBalance NÃO é somado para evitar duplicidade com balance da conta.
  const investedByItem = (investments ?? []).reduce<Record<string, number>>((acc, inv) => {
    if (inv.status === "ACTIVE") {
      acc[inv.pluggy_item_id] = (acc[inv.pluggy_item_id] ?? 0) + Number(inv.balance ?? 0);
    }
    return acc;
  }, {});

  const getStoredBalance = (account: BankAccount) => {
    return investedByItem[account.pluggy_item_id] ?? 0;
  };

  const getAccountTotalBalance = (account: BankAccount) =>
    account.balance + getStoredBalance(account);

  // Toda movimentação interna (transferência entre contas próprias, aplicações/resgates,
  // pagamento de fatura) NÃO conta como Entrada/Saída — apenas remaneja patrimônio.
  const externalTransactions = allTransactions.filter((tx) => !isInternalTransaction(tx, creditAccountIds));
  const internalTransactions = allTransactions.filter((tx) => isInternalTransaction(tx, creditAccountIds));

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

  // Movimentações internas — separadas por subtipo via classifyInternalSubtype
  // (transferência, pagamento de fatura, aplicação, resgate). NÃO contam no DRE.
  // Pré-detecta pagamentos de fatura pelo lado CARTÃO (amount<0 em conta credit).
  // Bank-side counterparts (mesma data + valor absoluto) também serão classificados como pagamento_fatura.
  const faturaPaymentKeys = new Set<string>();
  internalTransactions.forEach((tx) => {
    if (creditAccountIds.has(tx.pluggy_account_id) && tx.amount < 0) {
      faturaPaymentKeys.add(`${tx.date}|${Math.abs(tx.amount).toFixed(2)}`);
    }
  });

  const internalByAccount = internalTransactions.reduce<
    Record<
      string,
      {
        transfersIn: number; transfersOut: number;
        investIn: number; investOut: number;
        faturaPaga: number;
      }
    >
  >((acc, tx) => {
    const current =
      acc[tx.pluggy_account_id] ?? {
        transfersIn: 0, transfersOut: 0, investIn: 0, investOut: 0, faturaPaga: 0,
      };
    const isIn = tx.type === "CREDIT" || tx.amount > 0;
    const amt = Math.abs(tx.amount);
    let subtype = classifyInternalSubtype(tx, creditAccountIds);
    // Bank-side fatura payment: outgoing internal transfer matching a credit-side payment
    if (
      subtype !== "pagamento_fatura" &&
      !creditAccountIds.has(tx.pluggy_account_id) &&
      tx.amount < 0 &&
      faturaPaymentKeys.has(`${tx.date}|${amt.toFixed(2)}`)
    ) {
      subtype = "pagamento_fatura";
    }
    if (subtype === "pagamento_fatura") {
      current.faturaPaga += amt;
    } else if (subtype === "aplicacao_investimento") {
      current.investOut += amt;
    } else if (subtype === "resgate_investimento") {
      current.investIn += amt;
    } else {
      if (isIn) current.transfersIn += amt;
      else current.transfersOut += amt;
    }
    acc[tx.pluggy_account_id] = current;
    return acc;
  }, {});

  const totalBalance = bankAccounts.reduce(
    (sum, account) => sum + getAccountTotalBalance(account),
    0
  );

  const totalIncome = externalTransactions
    .filter((tx) => isInflow(tx))
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const totalExpense = externalTransactions
    .filter((tx) => !isInflow(tx))
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
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <TabsList>
            <TabsTrigger value="lista">Lista</TabsTrigger>
            <TabsTrigger value="importacoes">Importações</TabsTrigger>
          </TabsList>
          <PendenciasIndicator
            cardsSemVinculo={[]}
            onCategorizar={() => setUncatModalOpen(true)}
            onRealocar={() => {}}
            onRevisarOrfaos={() => {}}
            onVincularCard={() => {}}
          />
        </div>
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
          <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Em conta: <span className="font-medium text-foreground">{formatCurrency(bankAccounts.reduce((s, a) => s + a.balance, 0))}</span></span>
            <span>·</span>
            <span>Aplicações: <span className="font-medium text-emerald-500">{formatCurrency(bankAccounts.reduce((s, a) => s + getStoredBalance(a), 0))}</span></span>
          </div>
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

      {(creditCards.length > 0 || bankAccounts.length > 0) && (
        <Card className="p-4">
          <div className="flex items-center gap-2">
            <Landmark className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Contas & Cartões</h2>
            <Badge variant="outline" className="ml-1 text-[10px] font-normal">
              {bankAccounts.length} conta{bankAccounts.length !== 1 ? "s" : ""} · {creditCards.length} cartão{creditCards.length !== 1 ? "ões" : ""}
            </Badge>
            <Button
              variant="ghost"
              size="icon"
              className="ml-auto h-7 w-7"
              onClick={() => setContasCardsExpanded((v) => !v)}
              aria-label={contasCardsExpanded ? "Recolher" : "Expandir"}
            >
              <ChevronDown className={cn("h-4 w-4 transition-transform", contasCardsExpanded && "rotate-180")} />
            </Button>
          </div>

          {contasCardsExpanded && (
          <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
            {bankAccounts.map((account) => {
              const stored = getStoredBalance(account);
              const totals = totalsByAccount[account.pluggy_account_id] ?? { income: 0, expense: 0 };
              const internal = internalByAccount[account.pluggy_account_id] ?? {
                transfersIn: 0, transfersOut: 0, investIn: 0, investOut: 0, faturaPaga: 0,
              };
              const conn = connections.find((c) => c.pluggy_item_id === account.pluggy_item_id);
              const totalAccount = getAccountTotalBalance(account);
              return (
                <div key={account.id} className="rounded-md border border-border/50 bg-muted/10 p-3 hover:bg-muted/20 transition-colors">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Landmark className="h-3 w-3 text-muted-foreground shrink-0" />
                        <p className="truncate text-xs font-semibold text-foreground" title={getDisplayName(account)}>
                          {getShortName(account)}
                        </p>
                      </div>
                      {getOwnerLabel(account) && (
                        <p className="truncate text-[10px] text-muted-foreground" title={getOwnerLabel(account)}>
                          {getOwnerLabel(account)}
                        </p>
                      )}
                    </div>
                    <PluggyLastSyncBadge lastSyncAt={conn?.last_sync_at} status={conn?.status} />
                  </div>

                  <div className="mb-2">
                    <p className="text-lg font-bold text-foreground tabular-nums">{formatCurrency(totalAccount)}</p>
                    <p className="text-[10px] text-muted-foreground">Saldo total (conta + aplicações)</p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-border/40 pt-2 text-[10px]">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Em conta</span>
                      <span className={`font-medium tabular-nums ${account.balance > 0 ? "text-emerald-500" : "text-foreground"}`}>{formatCurrency(account.balance)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Aplicações</span>
                      <span className={`font-medium tabular-nums ${stored > 0 ? "text-emerald-500" : "text-foreground"}`}>{formatCurrency(stored)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Entradas</span>
                      <span className="font-medium tabular-nums text-emerald-500">{formatCurrency(totals.income)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Saídas</span>
                      <span className="font-medium tabular-nums text-warning">{formatCurrency(totals.expense)}</span>
                    </div>
                    {(internal.transfersIn > 0 || internal.transfersOut > 0) && (
                      <>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Transf. recebidas</span>
                          <span className="font-medium tabular-nums text-foreground">{formatCurrency(internal.transfersIn)}</span>
                        </div>
                        <div className="flex justify-between text-muted-foreground">
                          <span>Transf. enviadas</span>
                          <span className="font-medium tabular-nums text-foreground">{formatCurrency(internal.transfersOut)}</span>
                        </div>
                      </>
                    )}
                    {internal.faturaPaga > 0 && (
                      <div className="col-span-2 flex justify-between text-muted-foreground">
                        <span>Pagamento de Fatura de Cartão</span>
                        <span className="font-medium tabular-nums text-foreground">{formatCurrency(internal.faturaPaga)}</span>
                      </div>
                    )}
                    {(internal.investIn > 0 || internal.investOut > 0) && (
                      <>
                        {internal.investOut > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Aplicação</span>
                            <span className="font-medium tabular-nums text-foreground">{formatCurrency(internal.investOut)}</span>
                          </div>
                        )}
                        {internal.investIn > 0 && (
                          <div className="flex justify-between text-muted-foreground">
                            <span>Resgate</span>
                            <span className="font-medium tabular-nums text-foreground">{formatCurrency(internal.investIn)}</span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {creditCards.map((card) => {
              const conn = connections.find((c) => c.pluggy_item_id === card.pluggy_item_id);
              const billLabel = card.bank_data?.hasBillData || card.bank_data?.hasOpenBillCalc ? "Fatura aberta" : "Saldo devedor";
              return (
                <div key={card.id} className="rounded-md border border-border/50 bg-muted/10 p-3 hover:bg-muted/20 transition-colors">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <CreditCard className="h-3 w-3 text-primary shrink-0" />
                        <p className="truncate text-xs font-semibold text-foreground" title={getDisplayName(card)}>
                          {getShortName(card)}
                        </p>
                      </div>
                      {getOwnerLabel(card) && (
                        <p className="truncate text-[10px] text-muted-foreground" title={getOwnerLabel(card)}>
                          {getOwnerLabel(card)}
                        </p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 shrink-0"
                      onClick={() => handleSync(card.pluggy_item_id)}
                      disabled={syncing === card.pluggy_item_id}
                    >
                      <RefreshCw className={cn("h-3 w-3", syncing === card.pluggy_item_id && "animate-spin")} />
                    </Button>
                  </div>

                  <div className="mb-2">
                    <p className="text-lg font-bold text-destructive tabular-nums">
                      {card.credit_bill_amount != null ? formatCurrency(card.credit_bill_amount) : "—"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {billLabel}
                      {card.credit_bill_due_date && ` · vence ${formatDate(card.credit_bill_due_date)}`}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 border-t border-border/40 pt-2 text-[10px]">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Limite</span>
                      <span className="font-medium tabular-nums text-foreground">
                        {card.credit_limit != null ? formatCurrency(card.credit_limit) : "—"}
                      </span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Disponível</span>
                      <span className="font-medium tabular-nums text-emerald-500">
                        {card.credit_available != null ? formatCurrency(card.credit_available) : "—"}
                      </span>
                    </div>
                    <div className="col-span-2 mt-0.5">
                      <PluggyLastSyncBadge lastSyncAt={conn?.last_sync_at} status={conn?.status} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </Card>
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

          <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as any)}>
            <SelectTrigger className="w-full md:w-[180px]">
              <Sparkles className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Categorização" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas categorizações</SelectItem>
              <SelectItem value="sem-categoria">Sem categoria</SelectItem>
              <SelectItem value="com-categoria">Com categoria</SelectItem>
            </SelectContent>
          </Select>

          <Select value={internoFilter} onValueChange={(v) => setInternoFilter(v as any)}>
            <SelectTrigger className="w-full md:w-[200px]">
              <Filter className="mr-2 h-3.5 w-3.5" />
              <SelectValue placeholder="Movimentos internos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as movimentações</SelectItem>
              <SelectItem value="ocultar">Ocultar internas</SelectItem>
              <SelectItem value="somente">Somente internas</SelectItem>
              <SelectItem value="transferencia_entre_contas">{INTERNAL_SUBTYPE_LABEL.transferencia_entre_contas}</SelectItem>
              <SelectItem value="pagamento_fatura">{INTERNAL_SUBTYPE_LABEL.pagamento_fatura}</SelectItem>
              <SelectItem value="aplicacao_investimento">{INTERNAL_SUBTYPE_LABEL.aplicacao_investimento}</SelectItem>
              <SelectItem value="resgate_investimento">{INTERNAL_SUBTYPE_LABEL.resgate_investimento}</SelectItem>
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
                            categoriaNome: c.nome,
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
                const isCredit = isInflow(tx);
                const isInternal = isInternalTransaction(tx, creditAccountIds);
                let internalSubtype = classifyInternalSubtype(tx, creditAccountIds);
                if (
                  isInternal &&
                  internalSubtype !== "pagamento_fatura" &&
                  !creditAccountIds.has(tx.pluggy_account_id) &&
                  tx.amount < 0 &&
                  faturaPaymentKeys.has(`${tx.date}|${Math.abs(tx.amount).toFixed(2)}`)
                ) {
                  internalSubtype = "pagamento_fatura";
                }
                const catFin = categoriasFinanceiras.find((c: any) => c.id === tx.categoria_financeira_id);

                // Filtra por tipo financeiro pertinente ao fluxo (entrada x saída) e mostra apenas folhas finais
                const allowedTipos = isCredit
                  ? ["receita", "receita_financeira", "ajuste"]
                  : ["despesa", "custo", "deducao", "imposto", "despesa_financeira", "distribuicao_lucros", "ajuste"];
                const subcatOptions = categoriasFinanceiras
                  .filter((c: any) => allowedTipos.includes(c.tipo))
                  .filter((c: any) => !categoriasFinanceiras.some((child: any) => child.categoria_pai_id === c.id));

                const enhancedDesc = stripTypePrefix(enhanceDescription(tx));
                const isCreditCardTx = creditAccountIds.has(tx.pluggy_account_id);

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
                          <DescricaoComRegra
                            description={enhancedDesc}
                            categoriaId={tx.categoria_financeira_id}
                            tipoSugerido={isCredit ? "receber" : "pagar"}
                          >
                            <p className="truncate text-sm font-medium text-foreground" title={enhancedDesc}>
                              {enhancedDesc}
                            </p>
                          </DescricaoComRegra>
                          {internalSubtype && (
                            <Badge variant="outline" className="gap-1 text-[10px] border-muted-foreground/30 text-muted-foreground">
                              {INTERNAL_SUBTYPE_LABEL[internalSubtype]}
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
                      {isInternal ? (
                        <span className="text-xs text-muted-foreground/40 italic">—</span>
                      ) : (
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
                                onClick={() => updateCategoriaMutation.mutate({ id: tx.id, categoria_financeira_id: c.id, description: tx.description })}
                              >
                                {c.nome}
                              </DropdownMenuItem>
                            ))}
                            {catFin && (
                              <DropdownMenuItem
                                onClick={() => updateCategoriaMutation.mutate({ id: tx.id, categoria_financeira_id: null, description: tx.description })}
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
                      )}
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

      <OfertaCriarRegraModal
        open={ofertaRegra.open}
        onOpenChange={(v) => setOfertaRegra((p) => ({ ...p, open: v }))}
        descricoes={ofertaRegra.descricoes}
        categoriaId={ofertaRegra.categoriaId}
        categoriaNome={ofertaRegra.categoriaNome}
        tipoSugerido={ofertaRegra.tipoSugerido}
      />

      <RegraConflitoModal conflito={conflito} onClose={() => setConflito(null)} />

      <UncategorizedTransactionsModal open={uncatModalOpen} onOpenChange={setUncatModalOpen} />
    </div>
  );
}


