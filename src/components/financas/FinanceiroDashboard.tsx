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
  ArrowDownRight,
  PiggyBank,
} from "lucide-react";
import { format, differenceInDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";

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

  // ── Derived data ──
  const bankAccounts = accounts.filter((a) => a.type !== "CREDIT");
  const creditCards = accounts.filter((a) => a.type === "CREDIT");

  const getStoredBalance = (account: BankAccount) => {
    const inv = account.bank_data?.totalInvestments ?? 0;
    const autoInv = account.bank_data?.automaticallyInvestedBalance ?? 0;
    return inv > 0 ? inv : autoInv;
  };

  const totalBankBalance = bankAccounts.reduce(
    (sum, a) => sum + a.balance + getStoredBalance(a),
    0
  );

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

  const getCreditBillAmount = (account: BankAccount) => {
    const bill = account.bank_data?.openBillAmount;
    if (bill != null && bill > 0) return bill;
    const totalDebt = account.bank_data?.totalDebt;
    if (totalDebt != null && totalDebt > 0) return totalDebt;
    if (account.credit_bill_amount != null && account.credit_bill_amount > 0) return account.credit_bill_amount;
    if (account.credit_limit && account.credit_available != null) {
      const used = account.credit_limit - account.credit_available;
      return used > 0 ? used : 0;
    }
    return 0;
  };

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
    const months = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const total = contasPagar.filter((c) => {
        const due = new Date(c.due_date);
        return due >= start && due <= end;
      }).reduce((s, c) => s + Number(c.amount), 0);
      months.push({ label: format(d, "MMM", { locale: ptBR }), total });
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
      <TabsContent value="caixa" className="space-y-6">
        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Landmark className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Saldo em Contas</p>
                  <p className="text-xl font-bold text-foreground">{fmt(totalBankBalance)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <CreditCard className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Limite Disponível</p>
                  <p className="text-xl font-bold text-foreground">{fmt(totalCreditAvailable)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center">
                  <ArrowDownRight className="w-4 h-4 text-success" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Cartões conectados</p>
                  <p className="text-xl font-bold text-foreground">{creditCards.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Wallet className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Contas bancárias</p>
                  <p className="text-xl font-bold text-foreground">{bankAccounts.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Contas Bancárias + Cartões */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Landmark className="w-4 h-4 text-primary" />
                Contas Bancárias
              </CardTitle>
            </CardHeader>
            <CardContent>
              {bankAccounts.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  {hasPluggyData ? "Nenhuma conta corrente encontrada" : "Nenhuma conexão bancária ativa"}
                </p>
              ) : (
                <div className="space-y-2">
                  {bankAccounts.map((account) => (
                    <div key={account.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                      <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Wallet className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">{getBankDisplayName(account)}</p>
                          {getStoredBalance(account) > 0 && (
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <PiggyBank className="w-2.5 h-2.5" />
                              Guardado: {fmt(getStoredBalance(account))}
                            </p>
                          )}
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-foreground">{fmt(account.balance + getStoredBalance(account))}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-primary" />
                Cartões de Crédito
              </CardTitle>
            </CardHeader>
            <CardContent>
              {creditCards.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">
                  Nenhum cartão de crédito conectado
                </p>
              ) : (
                <div className="space-y-2">
                  {creditCards.map((card) => {
                    const billAmount = getCreditBillAmount(card);
                    return (
                      <div key={card.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-lg bg-accent/50 flex items-center justify-center">
                            <CreditCard className="w-3.5 h-3.5 text-primary" />
                          </div>
                          <div>
                            <p className="text-sm font-medium text-foreground">{getCreditCardLabel(card)}</p>
                            <p className="text-[10px] text-muted-foreground">
                              Limite: {fmt(card.credit_limit ?? 0)} · Disponível: {fmt(card.credit_available ?? 0)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="text-sm font-semibold text-foreground">{fmt(billAmount)}</span>
                          <p className="text-[10px] text-muted-foreground">
                            {card.credit_bill_due_date ? `Venc. ${format(new Date(card.credit_bill_due_date + "T12:00:00"), "dd/MM")}` : "Fatura"}
                          </p>
                        </div>
                      </div>
                    );
                  })}
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
                Contas a Pagar — Últimos 6 meses
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-end gap-3 h-44">
                {monthlyData.map((m, i) => (
                  <div key={i} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-muted-foreground">{fmt(m.total)}</span>
                    <div
                      className="w-full rounded-t-md bg-primary/80 transition-all duration-500"
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
