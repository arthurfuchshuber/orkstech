import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { getMenuPermissionKey, usePermissions } from "@/hooks/usePermissions";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { DynamicIcon } from "@/components/DynamicIcon";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  Building2,
  FileText,
  Activity,
  Sparkles,
  ArrowUpRight,
  AlertTriangle,
  Clock,
  Check,
  ChevronRight,
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}

function flattenMenus(items: MenuItem[]): MenuItem[] {
  const result: MenuItem[] = [];
  const walk = (arr: MenuItem[]) => {
    for (const i of arr) {
      if (i.route && i.is_active && i.is_visible) result.push(i);
      if (i.children?.length) walk(i.children);
    }
  };
  walk(items);
  return result;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export default function DashboardPrincipal() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const { canView } = usePermissions();
  const { tree } = useMenus();
  const navigate = useNavigate();
  const targetUserId = empresa?.user_id ?? user?.id;

  // KPIs operacionais
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["dashboard-principal-kpis", targetUserId, empresa?.id],
    enabled: !!targetUserId,
    queryFn: async () => {
      const filters = (q: any) =>
        empresa?.id ? q.eq("empresa_id", empresa.id) : q.eq("user_id", targetUserId!);
      const [clientes, fornecedores, payables, receivables, overdue] = await Promise.all([
        filters(supabase.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true)),
        filters(supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("ativo", true)),
        filters(supabase.from("accounts_payable").select("id", { count: "exact", head: true }).in("status", ["pending", "overdue"])),
        filters(supabase.from("accounts_receivable").select("id", { count: "exact", head: true }).in("status", ["pending", "overdue"])),
        filters(supabase.from("accounts_payable").select("id", { count: "exact", head: true }).eq("status", "overdue")),
      ]);
      return {
        clientes: clientes.count ?? 0,
        fornecedores: fornecedores.count ?? 0,
        contasPagar: payables.count ?? 0,
        contasReceber: receivables.count ?? 0,
        vencidas: overdue.count ?? 0,
      };
    },
  });

  // Notificações
  const { data: notifs } = useQuery({
    queryKey: ["dashboard-principal-notifs", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data } = await supabase
        .from("notificacoes_sistema")
        .select("id, titulo, descricao, created_at, tipo")
        .eq("user_id", targetUserId!)
        .order("created_at", { ascending: false })
        .limit(5);
      return data ?? [];
    },
  });

  // Clientes recentes
  const { data: clientesRecentes } = useQuery({
    queryKey: ["dashboard-clientes-recentes", targetUserId, empresa?.id],
    enabled: !!targetUserId,
    queryFn: async () => {
      let q = supabase
        .from("clientes")
        .select("id, nome, razao_social, nome_fantasia, ativo, created_at")
        .eq("ativo", true)
        .order("created_at", { ascending: false })
        .limit(3);
      if (empresa?.id) q = q.eq("empresa_id", empresa.id);
      else q = q.eq("user_id", targetUserId!);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Pendências para "Requer atenção": próximas a vencer (7 dias)
  const { data: proximasContas } = useQuery({
    queryKey: ["dashboard-alertas-contas", targetUserId, empresa?.id],
    enabled: !!targetUserId,
    queryFn: async () => {
      let q = supabase
        .from("accounts_payable")
        .select("id, description, due_date, amount, status")
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true })
        .limit(3);
      if (empresa?.id) q = q.eq("empresa_id", empresa.id);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Atalhos
  const shortcuts = useMemo(() => {
    return flattenMenus(tree)
      .filter((m) => {
        if (m.slug === "dashboard-principal") return false;
        const permissionKey = getMenuPermissionKey(m.slug);
        if (permissionKey && !canView(permissionKey)) return false;
        return true;
      })
      .slice(0, 6);
  }, [tree, canView]);

  // Health score
  const healthBars = useMemo(() => {
    const clientesPct = Math.min(100, ((kpis?.clientes ?? 0) > 0 ? 100 : 0));
    const contasPct = kpis?.vencidas ? Math.max(0, 100 - kpis.vencidas * 15) : 100;
    const fornecedoresPct = (kpis?.fornecedores ?? 0) > 0 ? 100 : 40;
    const receberPct = kpis?.contasReceber ? Math.max(50, 100 - kpis.contasReceber * 5) : 100;
    return [
      { name: "Clientes", pct: clientesPct, color: "bg-success" },
      { name: "Contas", pct: contasPct, color: contasPct >= 80 ? "bg-success" : "bg-warning" },
      { name: "Fornecedores", pct: fornecedoresPct, color: "bg-primary" },
      { name: "Recebíveis", pct: receberPct, color: receberPct >= 80 ? "bg-success" : "bg-warning" },
    ];
  }, [kpis]);

  const healthScore = useMemo(
    () => Math.round(healthBars.reduce((s, b) => s + b.pct, 0) / healthBars.length),
    [healthBars]
  );

  const userName = (user?.user_metadata as any)?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const empresaName = empresa?.nome_fantasia || empresa?.razao_social || "sua empresa";

  const kpiCards = [
    { label: "Clientes ativos", value: kpis?.clientes ?? 0, icon: Users, color: "text-primary" },
    { label: "Fornecedores", value: kpis?.fornecedores ?? 0, icon: Building2, color: "text-muted-foreground" },
    { label: "Contas a pagar", value: kpis?.contasPagar ?? 0, icon: FileText, color: "text-warning" },
    { label: "Contas a receber", value: kpis?.contasReceber ?? 0, icon: Activity, color: "text-success" },
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Greeting */}
      <header className="pb-5 border-b border-border/40">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
          <p className="text-[11px] text-muted-foreground capitalize">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <h1 className="text-xl sm:text-2xl font-medium text-foreground tracking-tight">
          {getGreeting()}{userName ? `, ${userName}` : ""} 👋
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Bem-vindo ao painel de <span className="font-medium text-foreground">{empresaName}</span>.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-8">
        {/* ───── Coluna esquerda ───── */}
        <div className="space-y-6">
          {/* Visão geral — KPIs 2x2 */}
          <section>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Visão geral
            </p>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              {kpiCards.map((k) => {
                const Icon = k.icon;
                return (
                  <div key={k.label} className="rounded-2xl border border-border/40 bg-card/40 p-4">
                    <Icon className={cn("w-4 h-4 mb-2", k.color)} />
                    {isLoading ? (
                      <Skeleton className="h-6 w-10" />
                    ) : (
                      <p className="text-xl sm:text-2xl font-medium text-foreground tabular-nums">{k.value}</p>
                    )}
                    <p className="text-[11px] text-muted-foreground mt-0.5">{k.label}</p>
                  </div>
                );
              })}
            </div>
          </section>

          {/* Requer atenção */}
          <section>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Requer atenção
            </p>
            <div className="space-y-2">
              {(proximasContas?.length ?? 0) === 0 ? (
                <div className="rounded-xl border border-border/40 bg-card/40 px-4 py-3 flex items-center gap-3">
                  <Check className="w-4 h-4 text-success shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">Sem pendências</p>
                    <p className="text-[11px] text-muted-foreground">Tudo em dia</p>
                  </div>
                  <span className="text-[10px] font-medium bg-success/10 text-success px-2 py-0.5 rounded-full">OK</span>
                </div>
              ) : (
                proximasContas?.map((c: any) => {
                  const days = differenceInDays(new Date(c.due_date), new Date());
                  const danger = c.status === "overdue" || days < 0;
                  return (
                    <button
                      key={c.id}
                      onClick={() => navigate("/app/financas/contas-pagar")}
                      className={cn(
                        "w-full rounded-xl border px-4 py-3 flex items-center gap-3 text-left transition-colors hover:bg-muted/30",
                        danger
                          ? "border-destructive/25 bg-destructive/5"
                          : days <= 7
                          ? "border-warning/25 bg-warning/5"
                          : "border-border/40 bg-card/40"
                      )}
                    >
                      {danger ? (
                        <Clock className="w-4 h-4 text-destructive shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-warning shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {c.description || "Conta a pagar"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {danger ? `Vencida há ${Math.abs(days)}d` : `Vence em ${days}d`}
                        </p>
                      </div>
                      <span
                        className={cn(
                          "text-[10px] font-medium px-2 py-0.5 rounded-full",
                          danger ? "bg-destructive/12 text-destructive" : "bg-warning/15 text-warning"
                        )}
                      >
                        {danger ? "Urgente" : "Aberto"}
                      </span>
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Saúde da empresa */}
          <section>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Saúde da empresa
            </p>
            <div className="rounded-2xl border border-border/40 bg-card/40 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-medium text-foreground">Score geral</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Baseado em 4 indicadores</p>
                </div>
                <span
                  className={cn(
                    "text-2xl font-medium tabular-nums",
                    healthScore >= 80 ? "text-success" : healthScore >= 60 ? "text-warning" : "text-destructive"
                  )}
                >
                  {healthScore}
                </span>
              </div>
              <div className="space-y-2.5">
                {healthBars.map((b) => (
                  <div key={b.name} className="flex items-center gap-3">
                    <span className="text-[11px] text-muted-foreground w-20 shrink-0">{b.name}</span>
                    <div className="flex-1 h-1 bg-muted/40 rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full transition-all", b.color)}
                        style={{ width: `${b.pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground w-8 text-right tabular-nums">
                      {b.pct}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>

        {/* ───── Coluna direita ───── */}
        <div className="space-y-6">
          {/* Clientes recentes */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                Clientes recentes
              </p>
              <button
                onClick={() => navigate("/app/clientes")}
                className="text-[11px] text-primary hover:text-primary/80 transition-colors"
              >
                Ver todos
              </button>
            </div>
            <div className="rounded-2xl border border-border/40 bg-card/40 overflow-hidden divide-y divide-border/30">
              {(clientesRecentes?.length ?? 0) === 0 ? (
                <p className="px-4 py-5 text-center text-xs text-muted-foreground">Nenhum cliente cadastrado.</p>
              ) : (
                clientesRecentes?.map((c: any) => {
                  const name = c.nome_fantasia || c.razao_social || c.nome || "Cliente";
                  const palette = ["bg-primary/15 text-primary", "bg-success/12 text-success", "bg-warning/12 text-warning"];
                  return (
                    <button
                      key={c.id}
                      onClick={() => navigate(`/app/clientes/${c.id}`)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-muted/20 transition-colors text-left"
                    >
                      <div className={cn("w-9 h-9 rounded-full flex items-center justify-center text-xs font-medium", palette[Math.abs(c.id.charCodeAt(0)) % 3])}>
                        {initials(name)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{name}</p>
                        <p className="text-[11px] text-muted-foreground">
                          Ativo · cadastrado em {format(new Date(c.created_at), "dd/MM")}
                        </p>
                      </div>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                    </button>
                  );
                })
              )}
            </div>
          </section>

          {/* Atividade recente */}
          <section>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Atividade recente
            </p>
            {!notifs?.length ? (
              <div className="rounded-2xl border border-border/40 bg-card/40 px-4 py-5">
                <p className="text-center text-xs text-muted-foreground">Sem atividades.</p>
              </div>
            ) : (
              <div className="space-y-0">
                {notifs.map((n: any, idx: number) => (
                  <div key={n.id} className="flex items-start gap-3">
                    <div className="flex flex-col items-center pt-1.5">
                      <div
                        className={cn(
                          "w-2 h-2 rounded-full shrink-0",
                          n.tipo === "warning" || n.tipo === "warn"
                            ? "bg-warning"
                            : n.tipo === "error" || n.tipo === "danger"
                            ? "bg-destructive"
                            : n.tipo === "success"
                            ? "bg-success"
                            : "bg-primary"
                        )}
                      />
                      {idx < notifs.length - 1 && <div className="w-px flex-1 min-h-[20px] bg-border/40 mt-1" />}
                    </div>
                    <div className="flex-1 pb-3">
                      <p className="text-xs text-foreground leading-snug">{n.titulo}</p>
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        {format(new Date(n.created_at), "dd/MM 'às' HH:mm")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Acesso rápido */}
          <section>
            <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium mb-3">
              Acesso rápido
            </p>
            {shortcuts.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Nenhum módulo disponível.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {shortcuts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => s.route && navigate(s.route)}
                    className="group flex items-center gap-2.5 rounded-xl border border-border/40 bg-card/40 px-3.5 py-3 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    <DynamicIcon name={s.icon} className="w-4 h-4 text-primary shrink-0" />
                    <span className="text-xs font-medium text-foreground flex-1 truncate">{s.name}</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
