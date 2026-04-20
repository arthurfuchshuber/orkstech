import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Truck, FileText, Activity, Clock, ArrowRight, BarChart3 } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useMemo } from "react";
import { Link } from "react-router-dom";

/**
 * Dashboard Executivo — visão macro do negócio (não-financeira).
 * O cockpit financeiro 360º vive em /app/financeiro.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const { data: clientes } = useQuery({
    queryKey: ["dash-exec-clientes", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("clientes").select("id", { count: "exact", head: true }).eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const { data: fornecedores } = useQuery({
    queryKey: ["dash-exec-fornecedores", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("fornecedores").select("id", { count: "exact", head: true }).eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const { data: documentos } = useQuery({
    queryKey: ["dash-exec-documentos", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("cliente_documentos").select("id", { count: "exact", head: true });
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  const { data: interacoes } = useQuery({
    queryKey: ["dash-exec-interacoes", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase.from("cliente_interacoes").select("id", { count: "exact", head: true });
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { count } = await q;
      return count ?? 0;
    },
  });

  // Próximas contas a pagar (link operacional, sem mostrar montantes)
  const { data: proximasContas } = useQuery({
    queryKey: ["dash-exec-vencimentos", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("accounts_payable")
        .select("id, description, due_date, status")
        .in("status", ["pending", "overdue"])
        .order("due_date", { ascending: true })
        .limit(5);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  // Atividades recentes (interações com clientes)
  const { data: atividades } = useQuery({
    queryKey: ["dash-exec-atividades", user?.id, empresaId],
    enabled: !!user,
    queryFn: async () => {
      let q = supabase
        .from("cliente_interacoes")
        .select("id, tipo, descricao, created_at, usuario_nome, cliente_id")
        .order("created_at", { ascending: false })
        .limit(6);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      const { data } = await q;
      return data ?? [];
    },
  });

  const proximasComDias = useMemo(() => {
    if (!proximasContas) return [];
    const today = new Date();
    return proximasContas.map((c) => ({
      ...c,
      diasParaVencer: differenceInDays(new Date(c.due_date), today),
    }));
  }, [proximasContas]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Visão Executiva</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Panorama operacional do seu negócio. Para análise financeira completa, acesse o Dashboard Financeiro.
          </p>
        </div>
        <Button asChild variant="outline" size="sm" className="gap-2">
          <Link to="/app/financeiro">
            <BarChart3 className="w-4 h-4" />
            Ver visão financeira completa
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </Button>
      </div>

      {/* KPIs Operacionais (não financeiros) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard icon={Users} label="Clientes ativos" value={clientes ?? 0} accent="primary" link="/app/clientes" />
        <KpiCard icon={Truck} label="Fornecedores" value={fornecedores ?? 0} accent="primary" link="/app/fornecedores" />
        <KpiCard icon={FileText} label="Documentos" value={documentos ?? 0} accent="success" />
        <KpiCard icon={Activity} label="Interações" value={interacoes ?? 0} accent="warning" />
      </div>

      {/* Próximos vencimentos + Atividade recente */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="border-border/50">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4 text-warning" />
              Próximos vencimentos
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Link to="/app/contas-pagar">Ver todos <ArrowRight className="w-3 h-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {proximasComDias.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma conta a vencer</p>
            ) : (
              <div className="space-y-2">
                {proximasComDias.map((c) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="text-xs text-foreground truncate">{c.description}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(c.due_date), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge
                      variant="outline"
                      className={
                        c.status === "overdue" || c.diasParaVencer < 0
                          ? "text-[10px] border-destructive/30 text-destructive"
                          : c.diasParaVencer <= 3
                          ? "text-[10px] border-warning/30 text-warning"
                          : "text-[10px] border-muted-foreground/30 text-muted-foreground"
                      }
                    >
                      {c.diasParaVencer < 0
                        ? `${Math.abs(c.diasParaVencer)}d atrás`
                        : c.diasParaVencer === 0
                        ? "hoje"
                        : `${c.diasParaVencer}d`}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              Atividade recente
            </CardTitle>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Link to="/app/clientes">Ver clientes <ArrowRight className="w-3 h-3" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {!atividades || atividades.length === 0 ? (
              <p className="text-xs text-muted-foreground py-6 text-center">Nenhuma atividade registrada</p>
            ) : (
              <div className="space-y-2">
                {atividades.map((a) => (
                  <Link
                    key={a.id}
                    to={`/app/clientes/${a.cliente_id}`}
                    className="block py-2 border-b border-border/30 last:border-0 hover:bg-muted/30 -mx-2 px-2 rounded transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-foreground truncate flex-1">{a.descricao}</p>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                        {format(new Date(a.created_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground capitalize mt-0.5">
                      {a.tipo} {a.usuario_nome ? `• ${a.usuario_nome}` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  accent,
  link,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number;
  accent: "primary" | "success" | "warning";
  link?: string;
}) {
  const accentBg = accent === "success" ? "bg-success/10" : accent === "warning" ? "bg-warning/10" : "bg-primary/10";
  const accentText = accent === "success" ? "text-success" : accent === "warning" ? "text-warning" : "text-primary";
  const inner = (
    <Card className="border-border/50 hover:border-border transition-colors h-full">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg ${accentBg} flex items-center justify-center`}>
            <Icon className={`w-4 h-4 ${accentText}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-xl font-bold text-foreground">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
  return link ? <Link to={link}>{inner}</Link> : inner;
}
