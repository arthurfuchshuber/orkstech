import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { usePermissions } from "@/hooks/usePermissions";
import { useMenus, type MenuItem } from "@/hooks/useMenus";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DynamicIcon } from "@/components/DynamicIcon";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Building2, FileText, Activity, Sparkles, ArrowUpRight } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

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

export default function DashboardPrincipal() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const { canView } = usePermissions();
  const { tree } = useMenus();
  const navigate = useNavigate();
  const targetUserId = empresa?.user_id ?? user?.id;

  // KPIs operacionais (somente contagens)
  const { data: kpis, isLoading } = useQuery({
    queryKey: ["dashboard-principal-kpis", targetUserId, empresa?.id],
    enabled: !!targetUserId,
    queryFn: async () => {
      const filters = (q: any) =>
        empresa?.id ? q.eq("empresa_id", empresa.id) : q.eq("user_id", targetUserId!);

      const [clientes, fornecedores, payables, receivables] = await Promise.all([
        filters(supabase.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true)),
        filters(supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("ativo", true)),
        filters(supabase.from("accounts_payable").select("id", { count: "exact", head: true }).in("status", ["pending", "overdue"])),
        filters(supabase.from("accounts_receivable").select("id", { count: "exact", head: true }).in("status", ["pending", "overdue"])),
      ]);

      return {
        clientes: clientes.count ?? 0,
        fornecedores: fornecedores.count ?? 0,
        contasPagar: payables.count ?? 0,
        contasReceber: receivables.count ?? 0,
      };
    },
  });

  // Últimas notificações do sistema (mensagens neutras)
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

  // Atalhos: itens de menu permitidos para o usuário (excluindo dashboard principal e configurações sensíveis)
  const shortcuts = useMemo(() => {
    return flattenMenus(tree)
      .filter((m) => {
        if (m.slug === "dashboard-principal") return false;
        if (!canView(`menu:${m.slug}`)) return false;
        return true;
      })
      .slice(0, 8);
  }, [tree, canView]);

  const userName = (user?.user_metadata as any)?.full_name?.split(" ")[0] || user?.email?.split("@")[0] || "";
  const empresaName = empresa?.nome_fantasia || empresa?.razao_social || "sua empresa";

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header com saudação */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <p className="text-xs text-muted-foreground capitalize">
            {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}
          </p>
        </div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">
          {getGreeting()}{userName ? `, ${userName}` : ""} 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Bem-vindo ao painel de <span className="font-medium text-foreground">{empresaName}</span>.
        </p>
      </div>

      {/* KPIs operacionais (sem valores monetários) */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Clientes ativos", value: kpis?.clientes, icon: Users, color: "text-primary" },
          { label: "Fornecedores", value: kpis?.fornecedores, icon: Building2, color: "text-info" },
          { label: "Contas a pagar", value: kpis?.contasPagar, icon: FileText, color: "text-warning" },
          { label: "Contas a receber", value: kpis?.contasReceber, icon: Activity, color: "text-success" },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="border-border/50">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide">{k.label}</p>
                    {isLoading ? (
                      <Skeleton className="h-7 w-12 mt-1" />
                    ) : (
                      <p className="text-2xl font-bold text-foreground mt-0.5">{k.value ?? 0}</p>
                    )}
                  </div>
                  <Icon className={`w-5 h-5 ${k.color}`} />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Atalhos */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Acesso rápido</CardTitle>
          </CardHeader>
          <CardContent>
            {shortcuts.length === 0 ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Nenhum módulo disponível.</p>
            ) : (
              <div className="grid gap-2 grid-cols-2 sm:grid-cols-3">
                {shortcuts.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => s.route && navigate(s.route)}
                    className="group relative flex items-center gap-2.5 rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5 text-left transition-all hover:border-primary/40 hover:bg-primary/5"
                  >
                    <DynamicIcon name={s.icon} className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-xs font-medium text-foreground flex-1 truncate">{s.name}</span>
                    <ArrowUpRight className="w-3 h-3 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notificações recentes */}
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium">Atividades recentes</CardTitle>
          </CardHeader>
          <CardContent>
            {!notifs?.length ? (
              <p className="py-6 text-center text-xs text-muted-foreground">Sem atividades.</p>
            ) : (
              <ul className="space-y-2.5">
                {notifs.map((n: any) => (
                  <li key={n.id} className="flex items-start gap-2 pb-2.5 last:pb-0 border-b border-border/30 last:border-0">
                    <Badge variant="outline" className="text-[9px] mt-0.5 px-1.5 py-0 h-4">
                      {n.tipo || "info"}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{n.titulo}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(n.created_at), "dd/MM 'às' HH:mm")}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
