import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Receipt,
  AlertTriangle,
  Landmark,
  TrendingUp,
  Clock,
  CreditCard,
  Wallet,
  
  PiggyBank,
  Sparkles,
  Info,
} from "lucide-react";
import { format, differenceInDays, startOfMonth, endOfMonth, subMonths, addMonths, isBefore, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CaixaKpis } from "./caixa/CaixaKpis";
import { CaixaCharts } from "./caixa/CaixaCharts";
import { MonthFlowDetailModal, type MonthFlowItem } from "./caixa/MonthFlowDetailModal";
import { useOrfaosFinanceiros } from "@/hooks/useOrfaosFinanceiros";
import { RealocarOrfaosDialog } from "./RealocarOrfaosDialog";
import { UncategorizedBanner } from "./UncategorizedBanner";
import { TransferenciaContasDialog } from "./TransferenciaContasDialog";
import { VincularCardFinanceiroDialog, type CardVinculoTipo } from "./VincularCardFinanceiroDialog";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft } from "lucide-react";

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
    totalInvestments?: number | null;
    automaticallyInvestedBalance?: number | null;
    overdraftContractedLimit?: number | null;
    overdraftUsedLimit?: number | null;
    unarrangedOverdraftAmount?: number | null;
    creditData?: {
      disaggregatedCreditLimits?: { identificationNumber?: string }[];
    };
    owner?: string | null;
    taxNumber?: string | null;
    openBillAmount?: number | null;
    totalDebt?: number | null;
  } | null;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const toTitleCase = (str: string) =>
  str.toLowerCase().replace(/(?:^|\s)\S/g, (c) => c.toUpperCase());

export default function FinanceiroDashboard() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const targetUserId = empresa?.user_id ?? user?.id;
  const navigate = useNavigate();

  // ── Pluggy accounts ──
  const { data: accounts = [] } = useQuery({
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

  // ── Pluggy investments (real source of truth) ──
  const { data: pluggyInvestmentsTotal = 0 } = useQuery({
    queryKey: ["pluggy_investments_total", targetUserId],
    enabled: !!user && !!targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_investments" as any)
        .select("balance, amount_original, amount_profit, status")
        .eq("user_id", targetUserId!);
      if (error) throw error;
      const rows = (data ?? []) as any[];
      return rows
        .filter((r) => (r.status ?? "ACTIVE") === "ACTIVE")
        .reduce((sum, r) => {
          const v = Number(r.amount_original ?? 0) + Number(r.amount_profit ?? 0);
          return sum + (v > 0 ? v : Number(r.balance ?? 0));
        }, 0);
    },
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

  // ── Manual bank accounts (contas_bancarias) ──
  const { data: manualAccounts = [] } = useQuery({
    queryKey: ["dashboard-manual-accounts", targetUserId, empresaId],
    enabled: !!targetUserId,
    queryFn: async () => {
      let q = supabase
        .from("contas_bancarias")
        .select("id, nome, banco, banco_id, tipo, saldo_inicial, saldo_investimento, saldo_sincronizado, saldo_ajuste_manual, investimento_sincronizado, investimento_ajuste_manual, fatura_aberto_sincronizada, fatura_aberto_ajuste_manual, limite_credito_disponivel_sincronizado, limite_credito_disponivel_ajuste_manual, limite_credito_total, limite_cheque_especial, pluggy_account_id, origem, ativo")
        .eq("ativo", true)
        // Exclui espelhos Pluggy: a integração já é somada via `accounts` (pluggy_bank_accounts)
        .is("pluggy_account_id", null);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      else q = q.eq("user_id", targetUserId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // ── Manual cash transactions for movement totals (per-account) ──
  // Janela ampla (180 dias) para cobrir o gráfico de fluxo mensal (6 meses)
  const { data: manualTx = [] } = useQuery({
    queryKey: ["dashboard-manual-tx", targetUserId, empresaId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const fromDate = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
      let q = supabase
        .from("cash_transactions")
        .select("id, amount, type, transaction_date, bank_account_id, is_internal_transfer, description, categoria_financeira_id")
        .gte("transaction_date", fromDate);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      else q = q.eq("user_id", targetUserId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Saldo atual por conta manual = saldo_inicial + (entradas - saídas) [todas as movimentações]
  const { data: manualTxAll = [] } = useQuery({
    queryKey: ["dashboard-manual-tx-all", targetUserId, empresaId],
    enabled: !!targetUserId,
    queryFn: async () => {
      let q = supabase
        .from("cash_transactions")
        .select("amount, type, bank_account_id");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      else q = q.eq("user_id", targetUserId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: cardVinculos = [] } = useQuery({
    queryKey: ["financeiro-card-vinculos", targetUserId, empresaId],
    enabled: !!targetUserId,
    queryFn: async () => {
      let q = (supabase as any)
        .from("financeiro_card_vinculos")
        .select("card_tipo, bank_account_id")
        .eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      else q = q.eq("user_id", targetUserId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as { card_tipo: CardVinculoTipo; bank_account_id: string }[];
    },
  });

  // ── KPIs ──
  const { data: contasPagar } = useQuery({
    queryKey: ["dashboard-contas-pagar", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("accounts_payable").select("id, amount, status, due_date, description").in("status", ["pending", "overdue"]);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const { data: jurosMultaTotal = 0 } = useQuery({
    queryKey: ["dashboard-juros-multa", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("accounts_payable").select("juros_multa").eq("status", "paid");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return (data ?? []).reduce((s, c) => s + Number(c.juros_multa || 0), 0);
    },
  });

  // ── Bank transactions (last 90 days) for evolution & flow charts ──
  const bankAccountIds = useMemo(
    () => accounts.filter((a) => a.type !== "CREDIT").map((a) => a.pluggy_account_id),
    [accounts]
  );

  const { data: txHistory = [] } = useQuery({
    queryKey: ["dashboard-tx-history", targetUserId, bankAccountIds.join(",")],
    enabled: !!targetUserId && bankAccountIds.length > 0,
    queryFn: async () => {
      // Janela ampla (6 meses) para cobrir o gráfico de fluxo mensal
      const fromDate = format(startOfMonth(subMonths(new Date(), 5)), "yyyy-MM-dd");
      const all: any[] = [];
      const PAGE = 1000;
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pluggy_transactions" as any)
          .select("id, amount, date, type, category, description, pluggy_account_id, is_internal_transfer")
          .eq("user_id", targetUserId!)
          .in("pluggy_account_id", bankAccountIds)
          .gte("date", fromDate)
          .order("date", { ascending: true })
          .range(offset, offset + PAGE - 1);
        if (error) throw error;
        const rows = (data ?? []) as any[];
        all.push(...rows);
        if (rows.length < PAGE) break;
        offset += PAGE;
      }
      return all;
    },
  });

  // ── Derived data: Pluggy ──
  const bankAccounts = accounts.filter((a) => a.type !== "CREDIT");
  const creditCards = accounts.filter((a) => a.type === "CREDIT");

  // Saldo de investimentos REAIS da conta (apenas totalInvestments).
  // automaticallyInvestedBalance NÃO é somado: é uma sub-parcela do `balance` (ex.: caixinha Nubank
  // que rende sozinha mas continua dentro do saldo da conta corrente). Somá-lo causaria duplicidade.
  const getStoredBalance = (account: BankAccount) => {
    return Number(account.bank_data?.totalInvestments ?? 0);
  };

  const totalPluggyBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0);
  // Soma vinda diretamente da tabela pluggy_investments (fonte real),
  // com fallback para bank_data.totalInvestments caso a tabela esteja vazia.
  const totalPluggyInvestments = pluggyInvestmentsTotal > 0
    ? pluggyInvestmentsTotal
    : bankAccounts.reduce((sum, a) => sum + getStoredBalance(a), 0);

  // ── Derived data: Manual ──
  // Saldo atual de cada conta manual = saldo_inicial + saldo_sincronizado + saldo_ajuste_manual + (entradas - saídas)
  const manualBalanceByAccount = useMemo(() => {
    const map = new Map<string, number>();
    manualAccounts.forEach((a) =>
      map.set(
        a.id,
        Number(a.saldo_inicial || 0) +
          Number(a.saldo_sincronizado || 0) +
          Number(a.saldo_ajuste_manual || 0)
      )
    );
    manualTxAll.forEach((t) => {
      if (!t.bank_account_id) return;
      const cur = map.get(t.bank_account_id) ?? 0;
      const v = Number(t.amount || 0);
      map.set(t.bank_account_id, cur + (t.type === "entrada" ? v : -v));
    });
    return map;
  }, [manualAccounts, manualTxAll]);

  const totalManualBalance = useMemo(
    () => manualAccounts.reduce((s, a) => s + (manualBalanceByAccount.get(a.id) ?? 0), 0),
    [manualAccounts, manualBalanceByAccount]
  );
  // Investimento efetivo = sincronizado + ajuste_manual + saldo_investimento legado
  const totalManualInvestments = useMemo(
    () => manualAccounts.reduce(
      (s, a) =>
        s +
        Number(a.investimento_sincronizado || 0) +
        Number(a.investimento_ajuste_manual || 0) +
        Number(a.saldo_investimento || 0),
      0
    ),
    [manualAccounts]
  );
  // Faturas em aberto manualmente registradas
  const totalManualBills = useMemo(
    () => manualAccounts.reduce(
      (s, a) =>
        s +
        Number(a.fatura_aberto_sincronizada || 0) +
        Number(a.fatura_aberto_ajuste_manual || 0),
      0
    ),
    [manualAccounts]
  );
  // Limite cheque especial manual (soma dos contratados nas contas manuais)
  const totalManualOverdraftLimit = useMemo(
    () => manualAccounts.reduce((s, a) => s + Number(a.limite_cheque_especial || 0), 0),
    [manualAccounts]
  );

  // Limite disponível manual (cartões cadastrados manualmente)
  const totalManualCreditAvailable = useMemo(
    () => manualAccounts.reduce(
      (s, a) =>
        s +
        Number(a.limite_credito_disponivel_sincronizado || 0) +
        Number(a.limite_credito_disponivel_ajuste_manual || 0),
      0
    ),
    [manualAccounts]
  );

  // ── Unified totals ──
  const totalBankBalance = totalPluggyBalance + totalManualBalance;
  const totalInvestments = totalPluggyInvestments + totalManualInvestments;
  const totalCreditAvailable = creditCards.reduce((sum, a) => sum + (a.credit_available ?? 0), 0) + totalManualCreditAvailable;

  const getConnectorName = (account: BankAccount) => {
    const conn = connections.find((c) => c.pluggy_item_id === account.pluggy_item_id);
    return conn?.connector_name || "Conta";
  };

  // Identificador do conector usado apenas para agrupar contas do mesmo banco
  // Como connector_id não está mais no schema, usamos connector_name normalizado
  const getConnectorId = (account: BankAccount) => {
    const conn = connections.find((c) => c.pluggy_item_id === account.pluggy_item_id);
    return conn?.connector_name ?? null;
  };

  const getAccountOwner = (account: BankAccount) => {
    const syncedOwner = account.bank_data?.owner?.trim();
    if (syncedOwner) return toTitleCase(syncedOwner);
    const normalizeDoc = (v?: string | null) => v?.replace(/\D/g, "") ?? "";
    const accountDoc = normalizeDoc(account.bank_data?.taxNumber);
    const empresaDoc = normalizeDoc(empresa?.cnpj);
    const profileDoc = normalizeDoc(profileData?.cpf);
    if (accountDoc && empresaDoc && accountDoc === empresaDoc)
      return toTitleCase(empresa?.nome_fantasia || empresa?.razao_social || "");
    if (accountDoc && profileDoc && accountDoc === profileDoc)
      return toTitleCase(profileData?.nome || "");
    return "";
  };

  // Limite total: usa credit_limit; se nulo, deriva de balance(consumo) + credit_available
  const getCreditLimit = (account: BankAccount) => {
    if (account.credit_limit && account.credit_limit > 0) return account.credit_limit;
    const used = Math.abs(account.balance ?? 0);
    const avail = account.credit_available ?? 0;
    if (used > 0 || avail > 0) return used + avail;
    return 0;
  };

  // Fatura PARCIAL atual (em formação, ainda não fechada).
  // Prioridade: (1) /bills da Pluggy (campo persistido `credit_bill_amount`)
  //             (2) cálculo via transações do ciclo aberto (`bank_data.openBillAmount`)
  //             (3) último recurso: total utilizado (limite - disponível) — não é a fatura parcial
  //                 mas é o melhor número quando o emissor não expõe ciclo (ex.: BTG sem balanceCloseDate)
  const getCreditBillAmount = (account: BankAccount) => {
    if (account.credit_bill_amount != null && account.credit_bill_amount > 0) return account.credit_bill_amount;
    const openBill = account.bank_data?.openBillAmount;
    if (openBill != null && openBill > 0) return openBill;
    if (account.credit_limit && account.credit_available != null) {
      const diff = account.credit_limit - account.credit_available;
      return diff > 0 ? diff : 0;
    }
    return Math.abs(account.balance ?? 0);
  };

  const totalCreditBills = creditCards.reduce((sum, c) => sum + getCreditBillAmount(c), 0) + totalManualBills;
  const totalCreditLimit = creditCards.reduce((sum, c) => sum + getCreditLimit(c), 0);

  // ── Cheque Especial (overdraft) — Pluggy + ajustes manuais ──
  const totalOverdraftLimit = bankAccounts.reduce(
    (s, a) => s + Number(a.bank_data?.overdraftContractedLimit ?? 0),
    0
  ) + totalManualOverdraftLimit;
  const totalOverdraftUsed = bankAccounts.reduce(
    (s, a) =>
      s +
      Number(a.bank_data?.overdraftUsedLimit ?? 0) +
      Number(a.bank_data?.unarrangedOverdraftAmount ?? 0),
    0
  );
  const totalOverdraftAvailable = Math.max(totalOverdraftLimit - totalOverdraftUsed, 0);

  // Cartão "manual": tipo cartão OU possui limite/fatura preenchidos (Pluggy às
  // vezes devolve cartões com tipo "corrente").
  const ehCartaoManual = (a: any) => {
    const tipo = String(a?.tipo || "").toLowerCase();
    if (["cartao_credito", "credito", "cartao"].includes(tipo)) return true;
    return (
      Number(a?.limite_credito_total || 0) > 0 ||
      Number(a?.limite_credito_disponivel_sincronizado || 0) > 0 ||
      Number(a?.limite_credito_disponivel_ajuste_manual || 0) > 0 ||
      Number(a?.fatura_aberto_sincronizada || 0) > 0 ||
      Number(a?.fatura_aberto_ajuste_manual || 0) > 0
    );
  };

  const cardsSemVinculo = useMemo(() => {
    const vinculado = new Set(cardVinculos.map((v) => v.card_tipo));

    // Se existe ao menos uma conexão Open Finance (Pluggy) — independente de
    // status — todos os valores trazidos pela integração (saldo, investimento,
    // limite de crédito, fatura, cheque especial) são considerados cobertos
    // pela origem. NUNCA pedimos vínculo manual de algo que já vem da
    // integração ativa.
    const temIntegracaoPluggy = connections.length > 0 || bankAccounts.length > 0 || creditCards.length > 0;

    // Origem implícita: contas/cartões já cadastrados (Pluggy ou manuais) que
    // produzem o valor do card. Se existe ao menos UMA fonte, não há "órfão" a
    // vincular — o número já vem dessas contas.
    const temContaSaldo = bankAccounts.length > 0 || manualAccounts.some((a) => !ehCartaoManual(a));
    const temContaInvestimento =
      pluggyInvestmentsTotal > 0 ||
      bankAccounts.some((a) => Number(a.bank_data?.totalInvestments ?? 0) > 0) ||
      manualAccounts.some(
        (a) =>
          Number(a.investimento_sincronizado || 0) +
            Number(a.investimento_ajuste_manual || 0) +
            Number(a.saldo_investimento || 0) >
          0,
      );
    const temCartao = creditCards.length > 0 || manualAccounts.some(ehCartaoManual);
    const temChequeEspecial =
      bankAccounts.some((a) => Number(a.bank_data?.overdraftContractedLimit ?? 0) > 0) ||
      manualAccounts.some((a) => Number(a.limite_cheque_especial || 0) > 0);

    const cobertoPorOrigem: Record<string, boolean> = {
      saldo: temIntegracaoPluggy || temContaSaldo,
      investimento: temIntegracaoPluggy || temContaInvestimento,
      limite_credito: temIntegracaoPluggy || temCartao,
      fatura: temIntegracaoPluggy || temCartao,
      limite_cheque_especial: temIntegracaoPluggy || temChequeEspecial,
    };

    return [
      { tipo: "saldo" as const, label: "Saldo em Contas", total: totalBankBalance },
      { tipo: "investimento" as const, label: "Investimentos", total: totalInvestments },
      { tipo: "limite_credito" as const, label: "Limite Disponível", total: totalCreditAvailable },
      { tipo: "fatura" as const, label: "Faturas em Aberto", total: totalCreditBills },
      { tipo: "limite_cheque_especial" as const, label: "Cheque Especial", total: totalOverdraftAvailable },
    ].filter(
      (c) =>
        Math.abs(c.total || 0) > 0.01 &&
        !vinculado.has(c.tipo) &&
        !cobertoPorOrigem[c.tipo],
    );
  }, [
    cardVinculos,
    connections,
    bankAccounts,
    manualAccounts,
    creditCards,
    totalBankBalance,
    totalInvestments,
    totalCreditAvailable,
    totalCreditBills,
    totalOverdraftAvailable,
    pluggyInvestmentsTotal,
  ]);

  // Helper: identifica transação de investimento (movimentação interna conta↔aplicação)
  const isInvestmentTx = (t: any) => {
    const cat = (t.category || "").toLowerCase();
    if (cat.includes("invest") || cat.includes("mutual fund")) return true;
    const desc = (t.description || "").toLowerCase();
    return /\b(aplica[cç][aã]o|resgate|cdb|lci|lca|tesouro|fundo|poupan[cç]a)\b/.test(desc);
  };

  // Helper: identifica movimentações que NÃO são entrada/saída efetiva de caixa.
  // Inclui:
  //  - Flag `is_internal_transfer` do Pluggy/manual (transferências entre contas próprias)
  //  - Aplicações/resgates em investimento (caixinhas, CDB, fundos…)
  //  - Pagamento de fatura de cartão (categoria "Credit card payment") — é movimento
  //    interno conta corrente → cartão, não saída real
  //  - Categorias `Transfers` / `Transfer - PIX` em pares espelhados (mesmo valor
  //    creditado e debitado em contas próprias no mesmo dia) — quando o Pluggy não
  //    conseguiu marcar como `is_internal_transfer`
  const isCashflowNeutral = (t: any) => {
    if (t.is_internal_transfer) return true;
    if (isInvestmentTx(t)) return true;
    const cat = (t.category || "").toLowerCase();
    if (cat.includes("credit card payment") || cat.includes("pagamento de cart")) return true;
    // "Same person transfer" do Pluggy = transferência entre contas do mesmo titular (TED/DOC próprio)
    if (cat.includes("same person")) return true;
    return false;
  };

  // Pré-calcula pares espelhados de transferências entre contas próprias que o
  // Pluggy não marcou (mesmo |amount| no mesmo dia, em contas diferentes do usuário,
  // categoria começando com "Transfer"). Esses pares são neutros no fluxo.
  const internalTransferIds = useMemo(() => {
    const ids = new Set<string>();
    const buckets = new Map<string, any[]>();
    txHistory.forEach((t: any) => {
      if (t.is_internal_transfer) return;
      const cat = (t.category || "").toLowerCase();
      if (!cat.startsWith("transfer") && !cat.includes("same person") && !cat.includes("pix")) return;
      const key = `${t.date}|${Math.abs(Number(t.amount)).toFixed(2)}`;
      const arr = buckets.get(key) ?? [];
      arr.push(t);
      buckets.set(key, arr);
    });
    buckets.forEach((arr) => {
      const credits = arr.filter((x) => x.type === "CREDIT");
      const debits = arr.filter((x) => x.type === "DEBIT");
      const n = Math.min(credits.length, debits.length);
      for (let i = 0; i < n; i++) {
        if (credits[i].pluggy_account_id !== debits[i].pluggy_account_id) {
          ids.add(credits[i].id);
          ids.add(debits[i].id);
        }
      }
    });
    return ids;
  }, [txHistory]);


  // ── Chart datasets ──
  // Patrimônio total = saldos liquidos (Pluggy + manual) + investimentos (Pluggy + manual)
  const totalNetWorth = totalBankBalance + totalInvestments;

  const evolutionData = useMemo(() => {
    if (txHistory.length === 0 && manualTx.length === 0) return [];
    const byDay = new Map<string, number>();

    // Pluggy (ignora transferências internas: aplicações, resgates, conta↔conta própria)
    txHistory.forEach((t: any) => {
      if (isCashflowNeutral(t) || internalTransferIds.has(t.id)) return;
      const day = t.date;
      const signed = t.type === "CREDIT" ? Math.abs(Number(t.amount)) : -Math.abs(Number(t.amount));
      byDay.set(day, (byDay.get(day) || 0) + signed);
    });

    // Manual cash_transactions (últimos 90 dias) — ignora transferências entre contas
    manualTx.forEach((t: any) => {
      if (t.is_internal_transfer) return;
      const day = t.transaction_date;
      const v = Number(t.amount || 0);
      const signed = t.type === "entrada" ? v : -v;
      byDay.set(day, (byDay.get(day) || 0) + signed);
    });

    const days: { date: string; saldo: number }[] = [];
    const today = new Date();
    const dailyChanges: { dateKey: string; label: string; change: number }[] = [];
    for (let i = 89; i >= 0; i--) {
      const d = subDays(today, i);
      const dateKey = format(d, "yyyy-MM-dd");
      dailyChanges.push({ dateKey, label: format(d, "dd/MM"), change: byDay.get(dateKey) || 0 });
    }
    const balances: number[] = Array.from({ length: dailyChanges.length }, () => 0);
    balances[balances.length - 1] = totalNetWorth;
    for (let i = balances.length - 2; i >= 0; i--) {
      balances[i] = balances[i + 1] - dailyChanges[i + 1].change;
    }
    for (let i = 0; i < dailyChanges.length; i++) {
      days.push({ date: dailyChanges[i].label, saldo: balances[i] });
    }
    return days.filter((_, idx) => idx % 3 === 0 || idx === days.length - 1);
  }, [txHistory, manualTx, totalNetWorth, internalTransferIds]);

  const balanceDeltaPct = useMemo(() => {
    if (evolutionData.length < 2) return null;
    const first = evolutionData[0].saldo;
    const last = evolutionData[evolutionData.length - 1].saldo;
    if (Math.abs(last) < 1) return null;
    if (first <= 0) return null;
    return ((last - first) / first) * 100;
  }, [evolutionData]);

  // Distribuição por banco — agrupa contas Pluggy + manuais pelo mesmo banco
  // Pluggy: agrupa por connector_id; Manual: agrupa por banco_id
  // Quando o usuário cadastra manualmente, o banco_id casa com o do Pluggy via mesmo nome (fallback)
  const distributionData = useMemo(() => {
    const byBank = new Map<string, { name: string; value: number }>();

    // Pluggy: agrupa por connector_name
    bankAccounts.forEach((a) => {
      const key = `pluggy:${getConnectorId(a) ?? getConnectorName(a)}`;
      const value = Math.max(0, a.balance + getStoredBalance(a));
      if (value <= 0) return;
      const existing = byBank.get(key);
      if (existing) {
        existing.value += value;
      } else {
        byBank.set(key, { name: getConnectorName(a), value });
      }
    });

    // Manual: agrupa por banco_id (ou nome quando não há banco_id)
    manualAccounts.forEach((a) => {
      const balance = manualBalanceByAccount.get(a.id) ?? 0;
      const inv = Number(a.saldo_investimento || 0);
      const value = Math.max(0, balance + inv);
      if (value <= 0) return;
      const bankName = a.banco || a.nome || "Conta manual";
      // Tenta consolidar com Pluggy do mesmo banco (compara nome normalizado)
      const norm = bankName.toLowerCase().replace(/[^a-z0-9]/g, "");
      let merged = false;
      byBank.forEach((entry, key) => {
        if (key.startsWith("pluggy:") && entry.name.toLowerCase().replace(/[^a-z0-9]/g, "").includes(norm.slice(0, 6))) {
          entry.value += value;
          merged = true;
        }
      });
      if (!merged) {
        const key = `manual:${a.banco_id ?? bankName}`;
        const existing = byBank.get(key);
        if (existing) existing.value += value;
        else byBank.set(key, { name: bankName, value });
      }
    });

    return Array.from(byBank.values()).filter((d) => d.value > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankAccounts, manualAccounts, manualBalanceByAccount, connections]);

  const flowData = useMemo(() => {
    if (txHistory.length === 0 && manualTx.length === 0) return [];
    type MonthAgg = {
      entradas: number;
      saidas: number;
      byBank: Map<string, { name: string; entradas: number; saidas: number }>;
      items: import("./caixa/MonthFlowDetailModal").MonthFlowItem[];
    };
    const months = new Map<string, MonthAgg>();
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(today, i);
      months.set(format(d, "yyyy-MM"), { entradas: 0, saidas: 0, byBank: new Map(), items: [] });
    }

    const pluggyNameById = new Map<string, string>();
    bankAccounts.forEach((a: any) => pluggyNameById.set(a.pluggy_account_id, a.name || "Conta"));
    const manualNameById = new Map<string, string>();
    manualAccounts.forEach((a: any) => manualNameById.set(a.id, a.nome || a.banco || "Conta"));

    const bumpBank = (m: MonthAgg, key: string, name: string, valor: number, isEntrada: boolean) => {
      const cur = m.byBank.get(key) ?? { name, entradas: 0, saidas: 0 };
      if (isEntrada) cur.entradas += valor;
      else cur.saidas += valor;
      m.byBank.set(key, cur);
    };

    // Pluggy (exclui transferências internas, investimentos, pagamento de fatura
    // e pares espelhados de Transfer/PIX entre contas próprias)
    txHistory.forEach((t: any) => {
      if (isCashflowNeutral(t) || internalTransferIds.has(t.id)) return;
      const key = t.date.slice(0, 7);
      if (!months.has(key)) return;
      const v = Math.abs(Number(t.amount));
      const m = months.get(key)!;
      const isEntrada = t.type === "CREDIT";
      if (isEntrada) m.entradas += v;
      else m.saidas += v;
      const accId = t.pluggy_account_id;
      const bankName = accId ? (pluggyNameById.get(accId) || "Conta") : "Conta";
      if (accId) bumpBank(m, `p:${accId}`, bankName, v, isEntrada);
      m.items.push({
        id: String(t.id),
        date: String(t.date).slice(0, 10),
        description: t.description || "(sem descrição)",
        category: t.category,
        bankName,
        amount: v,
        isEntrada,
        origem: "pluggy",
      });
    });

    // Manual — ignora transferências entre contas próprias
    manualTx.forEach((t: any) => {
      if (t.is_internal_transfer) return;
      const key = (t.transaction_date || "").slice(0, 7);
      if (!months.has(key)) return;
      const v = Math.abs(Number(t.amount || 0));
      const m = months.get(key)!;
      const isEntrada = t.type === "entrada";
      if (isEntrada) m.entradas += v;
      else m.saidas += v;
      const accId = t.bank_account_id;
      const bankName = accId ? (manualNameById.get(accId) || "Conta") : "Conta manual";
      if (accId) bumpBank(m, `m:${accId}`, bankName, v, isEntrada);
      m.items.push({
        id: String(t.id),
        date: String(t.transaction_date).slice(0, 10),
        description: (t as any).description || (t as any).descricao || "(sem descrição)",
        category: (t as any).category ?? null,
        bankName,
        amount: v,
        isEntrada,
        origem: "manual",
      });
    });

    return Array.from(months.entries()).map(([key, v]) => ({
      month: format(new Date(key + "-01T12:00:00"), "MMM/yy", { locale: ptBR }),
      monthKey: key,
      entradas: Math.round(v.entradas),
      saidas: Math.round(v.saidas),
      byBank: Array.from(v.byBank.values())
        .map((b) => ({ ...b, entradas: Math.round(b.entradas), saidas: Math.round(b.saidas) }))
        .sort((a, b) => (b.entradas + b.saidas) - (a.entradas + a.saidas)),
      items: v.items,
    }));
  }, [txHistory, manualTx, internalTransferIds, bankAccounts, manualAccounts]);

  const pendentes = contasPagar?.filter((c) => c.status === "pending") ?? [];
  const vencidas = contasPagar?.filter((c) => c.status === "overdue") ?? [];
  const totalPendente = pendentes.reduce((s, c) => s + Number(c.amount), 0);
  const totalVencido = vencidas.reduce((s, c) => s + Number(c.amount), 0);

  const proximasVencer = useMemo(() => {
    if (!contasPagar) return [];
    const today = new Date();
    return contasPagar
      .filter((c) => c.status === "pending" && differenceInDays(new Date(c.due_date), today) <= 7 && differenceInDays(new Date(c.due_date), today) >= 0)
      .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
      .slice(0, 5);
  }, [contasPagar]);

  const monthlyData = useMemo(() => {
    if (!contasPagar) return [];
    const today = new Date();
    const currentMonthStart = startOfMonth(today);
    const months = [];
    // Include past months with overdue accounts + next 6 months
    // First, find overdue accounts in past months
    const pastMonthsWithData = new Map<string, { d: Date; total: number }>();
    contasPagar.forEach((c) => {
      const due = new Date(c.due_date);
      const monthKey = format(due, "yyyy-MM");
      const monthStart = startOfMonth(due);
      if (isBefore(monthStart, currentMonthStart)) {
        const existing = pastMonthsWithData.get(monthKey);
        if (existing) {
          existing.total += Number(c.amount);
        } else {
          pastMonthsWithData.set(monthKey, { d: due, total: Number(c.amount) });
        }
      }
    });
    // Add past months (sorted)
    const sortedPast = Array.from(pastMonthsWithData.entries())
      .sort(([a], [b]) => a.localeCompare(b));
    for (const [, { d, total }] of sortedPast) {
      months.push({ label: format(d, "MMM", { locale: ptBR }), total, isOverdue: true });
    }
    // Add current + next 5 months
    for (let i = 0; i < 6; i++) {
      const d = addMonths(currentMonthStart, i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const total = contasPagar.filter((c) => {
        const due = new Date(c.due_date);
        return due >= start && due <= end;
      }).reduce((s, c) => s + Number(c.amount), 0);
      const hasOverdue = contasPagar.some((c) => {
        const due = new Date(c.due_date);
        return due >= start && due <= end && (c.status === "overdue" || (c.status === "pending" && isBefore(due, today)));
      });
      months.push({ label: format(d, "MMM", { locale: ptBR }), total, isOverdue: hasOverdue });
    }
    return months;
  }, [contasPagar]);

  const maxMonthly = Math.max(...monthlyData.map((m) => m.total), 1);

  const hasPluggyData = accounts.length > 0;

  // Última sincronização agregada (mais recente entre todas as conexões Pluggy)
  // Status: "connected" se ao menos 1 OK; senão usa o pior status para alertar reconexão
  const latestSyncAt = useMemo(() => {
    const stamps = connections.map((c) => c.last_sync_at).filter(Boolean) as string[];
    if (stamps.length === 0) return null;
    return stamps.sort().reverse()[0];
  }, [connections]);

  const aggregatedSyncStatus = useMemo(() => {
    if (connections.length === 0) return null;
    const hasConnected = connections.some((c) => c.status === "connected" || c.status === "updating");
    if (hasConnected) return "connected";
    // Nenhuma conexão saudável: retorna o status da primeira para acionar o alerta
    return connections[0]?.status ?? "outdated";
  }, [connections]);

  // ── Detecção de valores órfãos (contas excluídas) ──
  const { data: orfaos } = useOrfaosFinanceiros();
  const [showRealocar, setShowRealocar] = useState(false);
  const [showTransferencia, setShowTransferencia] = useState(false);
  const [vincularCard, setVincularCard] = useState<typeof cardsSemVinculo[number] | null>(null);
  const [monthDetail, setMonthDetail] = useState<{ label: string; monthKey: string; items: MonthFlowItem[] } | null>(null);

  // Popup automático na 1ª visita por sessão — só quando há valor a realocar
  useEffect(() => {
    if (cardsSemVinculo.length === 0) return;
    const flagKey = `card-vinculo-popup-shown:${targetUserId}:${empresaId ?? "no-emp"}`;
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, "1");
    setVincularCard(cardsSemVinculo[0]);
  }, [cardsSemVinculo, targetUserId, empresaId]);

  useEffect(() => {
    if (!orfaos?.temValorRealocavel || cardsSemVinculo.length > 0) return;
    const flagKey = `orfaos-popup-shown:${targetUserId}:${empresaId ?? "no-emp"}`;
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, "1");
    setShowRealocar(true);
  }, [orfaos?.temValorRealocavel, cardsSemVinculo.length, targetUserId, empresaId]);

  return (
    <>
    <Tabs defaultValue="caixa" className="space-y-4 animate-fade-in">
      <TabsList>
        <TabsTrigger value="caixa">Caixa da Empresa</TabsTrigger>
        <TabsTrigger value="contas-pagar">Contas a Pagar</TabsTrigger>
      </TabsList>

      {/* ═══════════ ABA: Caixa da Empresa ═══════════ */}
      <TabsContent value="caixa" className="space-y-5">
        {cardsSemVinculo.length > 0 && (
          <button
            type="button"
            onClick={() => setVincularCard(cardsSemVinculo[0])}
            className="w-full text-left flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 hover:bg-warning/10 hover:border-warning/60 transition-colors px-4 py-3 cursor-pointer"
          >
            <div className="flex items-start gap-3 min-w-0">
              <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
              <div className="text-sm min-w-0">
                <p className="font-semibold text-foreground">
                  {cardsSemVinculo.length} card(s) com valor sem conta/cartão padrão vinculado
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {cardsSemVinculo.map((c) => `${c.label}: ${fmt(c.total)}`).join(" · ")}. Clique para vincular em massa.
                </p>
              </div>
            </div>
            <span className="shrink-0 inline-flex items-center justify-center rounded-md bg-warning/15 hover:bg-warning/25 text-warning text-xs font-semibold px-3 py-1.5 transition-colors">
              Vincular agora
            </span>
          </button>
        )}

        {/* Banner de transações sem categorização DRE */}
        <UncategorizedBanner />

        {/* Banner de valores órfãos / vínculos faltando */}
        {orfaos?.temOrfaos && (() => {
          const handleClick = () => {
            if (orfaos.temValorRealocavel) {
              setShowRealocar(true);
            } else if (orfaos.receivablesOrfaos.length > 0 && orfaos.payablesOrfaos.length === 0) {
              navigate("/app/financas/receber?filtro=sem-conta");
            } else if (orfaos.payablesOrfaos.length > 0 && orfaos.receivablesOrfaos.length === 0) {
              navigate("/app/financas/pagar?filtro=sem-conta");
            } else {
              // Tem dos dois — leva para a página com mais itens
              const dest =
                orfaos.receivablesOrfaos.length >= orfaos.payablesOrfaos.length
                  ? "/app/financas/receber?filtro=sem-conta"
                  : "/app/financas/pagar?filtro=sem-conta";
              navigate(dest);
            }
          };

          return (
            <button
              type="button"
              onClick={handleClick}
              className="w-full text-left flex flex-col md:flex-row md:items-center md:justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/60 transition-colors px-4 py-3 cursor-pointer"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  {orfaos.temValorRealocavel ? (
                    <>
                      <p className="font-semibold text-foreground">
                        Existem {fmt(orfaos.totalGeralAbsoluto)} em valores sem conta vinculada
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Inclui saldos, investimentos, faturas, limites e cheque especial órfãos
                        ({orfaos.lancamentos.length} lançamento(s) + {orfaos.contasInativasComSnapshot?.length ?? 0} conta(s) excluída(s)).
                        Clique para realocar.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold text-foreground">
                        {(orfaos.payablesOrfaos.length + orfaos.receivablesOrfaos.length)} pagamento(s) registrado(s) sem conta de origem
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Não afeta os saldos, mas atrapalha o extrato e o DRE por conta. Clique para revisar e vincular.
                      </p>
                    </>
                  )}
                </div>
              </div>
              <span className="shrink-0 inline-flex items-center justify-center rounded-md bg-amber-500/15 hover:bg-amber-500/25 text-amber-200 text-xs font-semibold px-3 py-1.5 transition-colors">
                {orfaos.temValorRealocavel ? "Realocar agora" : "Revisar agora"}
              </span>
            </button>
          );
        })()}

        {/* Ação rápida: Transferir entre contas */}
        <div className="flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowTransferencia(true)}
          >
            <ArrowRightLeft className="w-4 h-4 mr-1" />
            Transferir entre contas
          </Button>
        </div>

        {/* KPIs aprimorados */}
        <CaixaKpis
          totalBalance={totalBankBalance}
          totalInvestments={totalInvestments}
          totalCreditAvailable={totalCreditAvailable}
          totalCreditBills={totalCreditBills}
          totalCreditLimit={totalCreditLimit}
          totalOverdraftAvailable={totalOverdraftAvailable}
          totalOverdraftLimit={totalOverdraftLimit}
          totalOverdraftUsed={totalOverdraftUsed}
          balanceDeltaPct={balanceDeltaPct}
          lastSyncAt={latestSyncAt}
          syncStatus={aggregatedSyncStatus}
          hasPluggy={hasPluggyData}
        />

        {/* Visualizações */}
        <CaixaCharts
          evolution={evolutionData}
          distribution={distributionData}
          flow={flowData}
          onFlowBarClick={(monthData) => {
            const items = (monthData as any).items as MonthFlowItem[] | undefined;
            const monthKey = (monthData as any).monthKey as string | undefined;
            if (monthKey) {
              setMonthDetail({ label: monthData.month, monthKey, items: items ?? [] });
            }
          }}
        />

      </TabsContent>


      {/* ═══════════ ABA: Contas a Pagar ═══════════ */}
      <TabsContent value="contas-pagar" className="space-y-6">
        {/* KPIs */}
        <TooltipProvider delayDuration={150}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* 1. Total em Aberto */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => navigate("/app/financas/contas-pagar")}
                  className="text-left"
                >
                  <Card className="border-border/50 hover:border-primary/40 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Receipt className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            Total em Aberto <Info className="w-2.5 h-2.5 opacity-50" />
                          </p>
                          <p className="text-xl font-bold text-foreground tabular-nums">{fmt(totalPendente + totalVencido)}</p>
                          <span className="text-[10px] text-muted-foreground">{pendentes.length + vencidas.length} título(s)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                Soma de todas as contas pendentes e vencidas. Clique para abrir Contas a Pagar.
              </TooltipContent>
            </Tooltip>

            {/* 2. Vencendo em 7 Dias */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => navigate("/app/financas/contas-pagar")}
                  className="text-left"
                >
                  <Card className="border-border/50 hover:border-warning/40 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                          <Clock className="w-4 h-4 text-warning" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            Vencendo em 7 dias <Info className="w-2.5 h-2.5 opacity-50" />
                          </p>
                          <p className="text-xl font-bold text-foreground tabular-nums">{fmt(proximasVencer.reduce((s, c) => s + Number(c.amount), 0))}</p>
                          <span className="text-[10px] text-muted-foreground">{proximasVencer.length} título(s)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                Contas com vencimento nos próximos 7 dias. Priorize esses pagamentos.
              </TooltipContent>
            </Tooltip>

            {/* 3. Juros/Multa */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <Card className="border-border/50 hover:border-border transition-colors">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                          <Receipt className="w-4 h-4 text-warning" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            Juros/Multa <Info className="w-2.5 h-2.5 opacity-50" />
                          </p>
                          <p className="text-xl font-bold text-foreground tabular-nums">{fmt(jurosMultaTotal)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                Total acumulado de juros e multas pagos por atraso em contas já quitadas.
              </TooltipContent>
            </Tooltip>

            {/* 4. Vencidas */}
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => navigate("/app/financas/contas-pagar")}
                  className="text-left"
                >
                  <Card className="border-border/50 hover:border-destructive/40 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                          <AlertTriangle className="w-4 h-4 text-destructive" />
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            Vencidas <Info className="w-2.5 h-2.5 opacity-50" />
                          </p>
                          <p className="text-xl font-bold text-foreground tabular-nums">{fmt(totalVencido)}</p>
                          <span className="text-[10px] text-muted-foreground">{vencidas.length} título(s)</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                Contas com prazo expirado. Atenção: podem gerar juros e bloqueios. Clique para revisar.
              </TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>

        {/* Gráfico + Próximas a vencer */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Card className="lg:col-span-2 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                Contas a Pagar — Próximos 6 meses + Vencidas (meses anteriores)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-44">
                {monthlyData.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{fmt(m.total)}</span>
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${m.isOverdue ? "bg-destructive/80" : "bg-primary/80"}`}
                      style={{ height: `${Math.max((m.total / maxMonthly) * 140, 4)}px` }}
                    />
                    <span className="text-[11px] text-muted-foreground capitalize">{m.label}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-warning" />
                Vencendo em 7 dias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {proximasVencer.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">Nenhuma conta próxima do vencimento</p>
              ) : (
                <div className="space-y-2">
                  {proximasVencer.map((c) => (
                    <div key={c.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                      <div>
                        <p className="text-xs text-foreground truncate max-w-[140px]">{(c as any).description || fmt(Number(c.amount))}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {format(new Date(c.due_date), "dd/MM/yyyy")}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-foreground">{fmt(Number(c.amount))}</span>
                        <Badge variant="outline" className="text-[10px] border-warning/30 text-warning">
                          {differenceInDays(new Date(c.due_date), new Date())}d
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
    <RealocarOrfaosDialog open={showRealocar} onOpenChange={setShowRealocar} />
    <TransferenciaContasDialog open={showTransferencia} onOpenChange={setShowTransferencia} />
    <MonthFlowDetailModal
      open={!!monthDetail}
      onOpenChange={(o) => !o && setMonthDetail(null)}
      monthLabel={monthDetail?.label ?? ""}
      monthKey={monthDetail?.monthKey}
      items={monthDetail?.items ?? []}
    />
    {vincularCard && (
      <VincularCardFinanceiroDialog
        open={!!vincularCard}
        onOpenChange={(open) => !open && setVincularCard(null)}
        cardTipo={vincularCard.tipo}
        total={vincularCard.total}
        titulo={vincularCard.label}
      />
    )}
    </>
  );
}
