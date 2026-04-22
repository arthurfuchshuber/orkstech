import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plug, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";

const STATUS_MAP = {
  ok: { icon: CheckCircle2, tone: "text-success", label: "Operacional" },
  warn: { icon: AlertTriangle, tone: "text-warning", label: "Atenção" },
  error: { icon: XCircle, tone: "text-destructive", label: "Erro" },
  not_configured: { icon: AlertTriangle, tone: "text-muted-foreground", label: "Não configurado" },
} as const;

function HealthCard({ name, data }: { name: string; data: any }) {
  const meta = STATUS_MAP[data?.status as keyof typeof STATUS_MAP] ?? STATUS_MAP.not_configured;
  const Icon = meta.icon;
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Plug className="w-4 h-4 text-primary" /> {name}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${meta.tone}`} />
          <span className={`text-sm font-medium ${meta.tone}`}>{meta.label}</span>
        </div>
        {data?.recent_webhooks !== undefined && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Webhooks recentes</span>
            <span className="text-foreground">{data.recent_webhooks}</span>
          </div>
        )}
        {data?.failed_webhooks !== undefined && data.failed_webhooks > 0 && (
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Falhas</span>
            <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20 text-[10px]">{data.failed_webhooks}</Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminIntegrations() {
  const { data } = useQuery({
    queryKey: ["admin-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "integrations_health" } });
      if (error) throw error;
      return data;
    },
    refetchInterval: 60_000,
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HealthCard name="Stripe" data={data?.stripe} />
        <HealthCard name="Pluggy (Open Finance)" data={data?.pluggy} />
        <HealthCard name="ClickSign" data={data?.clicksign} />
      </div>
    </div>
  );
}
