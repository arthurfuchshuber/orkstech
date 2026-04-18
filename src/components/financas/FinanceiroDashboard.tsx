import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
} from "lucide-react";
import { format, differenceInDays, startOfMonth, endOfMonth, subMonths, addMonths, isBefore, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";
import { CaixaKpis } from "./caixa/CaixaKpis";
import { CaixaCharts } from "./caixa/CaixaCharts";

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
        .select("nome, cpf")
        .eq("user_id", targetUserId!)
        .maybeSingle();
      if (error) throw error;
      return data as { nome: string | null; cpf: string | null } | null;
    },
    enabled: !!user && !!targetUserId,
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
      const fromDate = format(subDays(new Date(), 90), "yyyy-MM-dd");
      const all: any[] = [];
      const PAGE = 1000;
      let offset = 0;
      while (true) {
        const { data, error } = await supabase
          .from("pluggy_transactions" as any)
          .select("id, amount, date, type, category, description, pluggy_account_id")
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

  // ── Derived data ──
  const bankAccounts = accounts.filter((a) => a.type !== "CREDIT");
  const creditCards = accounts.filter((a) => a.type === "CREDIT");

  const getStoredBalance = (account: BankAccount) => {
    const inv = account.bank_data?.totalInvestments ?? 0;
    const autoInv = account.bank_data?.automaticallyInvestedBalance ?? 0;
    return inv > 0 ? inv : autoInv;
  };

  const totalBankBalance = bankAccounts.reduce((sum, a) => sum + a.balance, 0);
  const totalInvestments = bankAccounts.reduce((sum, a) => sum + getStoredBalance(a), 0);
  const totalCreditAvailable = creditCards.reduce((sum, a) => sum + (a.credit_available ?? 0), 0);

  const getConnectorName = (account: BankAccount) => {
    const conn = connections.find((c) => c.pluggy_item_id === account.pluggy_item_id);
    return conn?.connector_name || "Conta";
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

  const getCreditCardLabel = (account: BankAccount) => {
    const connName = getConnectorName(account);
    const creditData = (account.bank_data as any)?.creditData;
    const last4 = creditData?.disaggregatedCreditLimits?.[0]?.identificationNumber || "";
    const suffix = last4 ? ` •••• ${last4}` : "";
    return `${connName}${suffix}`;
  };

  const getBankDisplayName = (account: BankAccount) => {
    const connName = getConnectorName(account);
    const owner = getAccountOwner(account);
    return owner ? `${connName} (${owner})` : connName;
  };

  // Limite total: usa credit_limit; se nulo, deriva de balance(consumo) + credit_available
  const getCreditLimit = (account: BankAccount) => {
    if (account.credit_limit && account.credit_limit > 0) return account.credit_limit;
    const used = Math.abs(account.balance ?? 0);
    const avail = account.credit_available ?? 0;
    if (used > 0 || avail > 0) return used + avail;
    return 0;
  };

  // Fatura/consumo atual: prioriza dados oficiais, depois deriva do balance (consumo do cartão)
  const getCreditBillAmount = (account: BankAccount) => {
    const bill = account.bank_data?.openBillAmount;
    if (bill != null && bill > 0) return bill;
    const totalDebt = account.bank_data?.totalDebt;
    if (totalDebt != null && totalDebt > 0) return totalDebt;
    if (account.credit_bill_amount != null && account.credit_bill_amount > 0) return account.credit_bill_amount;
    // Fallback: para cartão, balance representa o consumo atual (valor utilizado)
    const used = Math.abs(account.balance ?? 0);
    if (used > 0) return used;
    if (account.credit_limit && account.credit_available != null) {
      const diff = account.credit_limit - account.credit_available;
      return diff > 0 ? diff : 0;
    }
    return 0;
  };

  const totalCreditBills = creditCards.reduce((sum, c) => sum + getCreditBillAmount(c), 0);
  // Recalcula totalCreditLimit usando o helper (cobre casos onde credit_limit é null)
  const totalCreditLimitDerived = creditCards.reduce((sum, c) => sum + getCreditLimit(c), 0);

  // Helper: identifica transação de investimento (movimentação interna conta↔aplicação)
  const isInvestmentTx = (t: any) => {
    const cat = (t.category || "").toLowerCase();
    if (cat.includes("invest") || cat.includes("mutual fund")) return true;
    const desc = (t.description || "").toLowerCase();
    return /\b(aplica[cç][aã]o|resgate|cdb|lci|lca|tesouro|fundo|poupan[cç]a)\b/.test(desc);
  };

  // ── Chart datasets ──
  // Patrimônio total (saldo + investimentos) — investimentos não somem do total quando o dinheiro é aplicado
  const totalNetWorth = totalBankBalance + totalInvestments;

  const evolutionData = useMemo(() => {
    if (txHistory.length === 0) return [];
    // Para evolução do patrimônio: ignoramos movimentações entre conta e investimento
    // (não alteram o patrimônio total, só transferem entre "bolsos")
    const byDay = new Map<string, number>();
    txHistory.forEach((t: any) => {
      if (isInvestmentTx(t)) return; // pular aplicações/resgates
      const day = t.date;
      const signed = t.type === "CREDIT" ? Math.abs(Number(t.amount)) : -Math.abs(Number(t.amount));
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
    // Saldo de hoje = patrimônio total (saldo em conta + investimentos)
    const balances: number[] = Array.from({ length: dailyChanges.length }, () => 0);
    balances[balances.length - 1] = totalNetWorth;
    for (let i = balances.length - 2; i >= 0; i--) {
      balances[i] = balances[i + 1] - dailyChanges[i + 1].change;
    }
    for (let i = 0; i < dailyChanges.length; i++) {
      days.push({ date: dailyChanges[i].label, saldo: Math.round(balances[i]) });
    }
    return days.filter((_, idx) => idx % 3 === 0 || idx === days.length - 1);
  }, [txHistory, totalNetWorth]);

  const balanceDeltaPct = useMemo(() => {
    if (evolutionData.length < 2) return null;
    const first = evolutionData[0].saldo;
    const last = evolutionData[evolutionData.length - 1].saldo;
    if (Math.abs(first) < 0.01) return null;
    return ((last - first) / Math.abs(first)) * 100;
  }, [evolutionData]);

  const distributionData = useMemo(() => {
    return bankAccounts
      .map((a) => ({ name: getConnectorName(a), value: Math.max(0, a.balance + getStoredBalance(a)) }))
      .filter((d) => d.value > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bankAccounts, connections]);

  const flowData = useMemo(() => {
    if (txHistory.length === 0) return [];
    const months = new Map<string, { entradas: number; saidas: number }>();
    const today = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(today, i);
      months.set(format(d, "yyyy-MM"), { entradas: 0, saidas: 0 });
    }
    txHistory.forEach((t: any) => {
      if (isInvestmentTx(t)) return; // aplicações/resgates não são entrada nem saída
      const key = t.date.slice(0, 7);
      if (!months.has(key)) return;
      const v = Math.abs(Number(t.amount));
      const m = months.get(key)!;
      if (t.type === "CREDIT") m.entradas += v;
      else m.saidas += v;
    });
    return Array.from(months.entries()).map(([key, v]) => ({
      month: format(new Date(key + "-01T12:00:00"), "MMM/yy", { locale: ptBR }),
      entradas: Math.round(v.entradas),
      saidas: Math.round(v.saidas),
    }));
  }, [txHistory]);

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

  return (
    <Tabs defaultValue="caixa" className="space-y-4 animate-fade-in">
      <TabsList>
        <TabsTrigger value="caixa">Caixa da Empresa</TabsTrigger>
        <TabsTrigger value="contas-pagar">Contas a Pagar</TabsTrigger>
      </TabsList>

      {/* ═══════════ ABA: Caixa da Empresa ═══════════ */}
      <TabsContent value="caixa" className="space-y-5">
        {/* KPIs aprimorados */}
        <CaixaKpis
          totalBalance={totalBankBalance}
          totalInvestments={totalInvestments}
          totalCreditAvailable={totalCreditAvailable}
          totalCreditBills={totalCreditBills}
          totalCreditLimit={totalCreditLimit}
          balanceDeltaPct={balanceDeltaPct}
        />

        {/* Visualizações */}
        <CaixaCharts
          evolution={evolutionData}
          distribution={distributionData}
          flow={flowData}
        />

        {/* Contas Bancárias + Cartões + Investimentos */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Contas bancárias */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Landmark className="w-4 h-4 text-primary" />
                Contas Bancárias
                <Badge variant="outline" className="ml-auto text-[10px] font-normal">{bankAccounts.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bankAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  {hasPluggyData ? "Nenhuma conta corrente encontrada" : "Nenhuma conexão bancária ativa"}
                </p>
              ) : (
                <div className="space-y-1">
                  {bankAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <Wallet className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{getBankDisplayName(account)}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{account.type === "BANK" ? "Conta corrente" : account.type.toLowerCase()}</p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-foreground tabular-nums">{fmt(account.balance)}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Cartões */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Cartões de Crédito
                <Badge variant="outline" className="ml-auto text-[10px] font-normal">{creditCards.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creditCards.length === 0 ? (
                <p className="text-xs text-muted-foreground py-6 text-center">
                  Nenhum cartão de crédito conectado
                </p>
              ) : (
                <div className="space-y-1">
                  {creditCards.map((card) => {
                    const billAmount = getCreditBillAmount(card);
                    const limit = card.credit_limit ?? 0;
                    const used = limit - (card.credit_available ?? 0);
                    const usedPct = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;
                    return (
                      <div key={card.id} className="py-2 border-b border-border/30 last:border-0">
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-accent/50 flex items-center justify-center flex-shrink-0">
                              <CreditCard className="w-3.5 h-3.5 text-primary" />
                            </div>
                            <p className="text-sm font-medium text-foreground truncate">{getCreditCardLabel(card)}</p>
                          </div>
                          <span className="text-sm font-semibold text-foreground tabular-nums">{fmt(billAmount)}</span>
                        </div>
                        <div className="h-1 bg-muted/40 rounded-full overflow-hidden ml-9">
                          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${usedPct}%` }} />
                        </div>
                        <div className="flex justify-between mt-1 ml-9 text-[10px] text-muted-foreground">
                          <span>Disp. {fmt(card.credit_available ?? 0)}</span>
                          <span>{card.credit_bill_due_date ? `Venc. ${format(new Date(card.credit_bill_due_date + "T12:00:00"), "dd/MM")}` : "—"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Investimentos */}
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <PiggyBank className="w-4 h-4 text-emerald-400" />
                Investimentos & Reservas
                <Badge variant="outline" className="ml-auto text-[10px] font-normal">{fmt(totalInvestments)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {totalInvestments <= 0 ? (
                <div className="py-6 text-center">
                  <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">Nenhuma reserva ou investimento sincronizado</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {bankAccounts
                    .filter((a) => getStoredBalance(a) > 0)
                    .map((account) => (
                      <div key={account.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                            <PiggyBank className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate">{getConnectorName(account)}</p>
                            <p className="text-[10px] text-muted-foreground">Reserva automática</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-emerald-400 tabular-nums">{fmt(getStoredBalance(account))}</span>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </TabsContent>


      {/* ═══════════ ABA: Contas a Pagar ═══════════ */}
      <TabsContent value="contas-pagar" className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* 1. Total em Aberto */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Total em Aberto</p>
                  <p className="text-xl font-bold text-foreground">{fmt(totalPendente + totalVencido)}</p>
                  <span className="text-[10px] text-muted-foreground">{pendentes.length + vencidas.length} título(s)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 2. Vencendo em 7 Dias */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencendo em 7 dias</p>
                  <p className="text-xl font-bold text-foreground">{fmt(proximasVencer.reduce((s, c) => s + Number(c.amount), 0))}</p>
                  <span className="text-[10px] text-muted-foreground">{proximasVencer.length} título(s)</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3. Juros/Multa */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Juros/Multa</p>
                  <p className="text-xl font-bold text-foreground">{fmt(jurosMultaTotal)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 4. Vencidas */}
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Vencidas</p>
                  <p className="text-xl font-bold text-foreground">{fmt(totalVencido)}</p>
                  <span className="text-[10px] text-muted-foreground">{vencidas.length} título(s)</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

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
  );
}
