import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CreditCard } from "lucide-react";
import { format } from "date-fns";

const STATUS_TONES: Record<string, string> = {
  active: "bg-success/10 text-success border-success/20",
  trialing: "bg-primary/10 text-primary border-primary/20",
  past_due: "bg-warning/10 text-warning border-warning/20",
  canceled: "bg-destructive/10 text-destructive border-destructive/20",
  unpaid: "bg-destructive/10 text-destructive border-destructive/20",
  incomplete: "bg-muted text-muted-foreground",
};

export default function AdminSubscriptions() {
  const { data, isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-dashboard", { body: { action: "list_subscriptions" } });
      if (error) throw error;
      return data.subscriptions as any[];
    },
  });

  const fmt = (cents: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(cents / 100);

  return (
    <div className="space-y-4 animate-fade-in">
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-primary" /> Assinaturas Stripe
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">Cliente</TableHead>
                  <TableHead className="w-[12%]">Status</TableHead>
                  <TableHead className="w-[15%]">Valor</TableHead>
                  <TableHead className="w-[15%]">Ciclo</TableHead>
                  <TableHead className="w-[18%]">Próx. cobrança</TableHead>
                  <TableHead className="w-[15%]">Criada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
                ) : !data?.length ? (
                  <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhuma assinatura</TableCell></TableRow>
                ) : data.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="text-sm text-foreground truncate">{s.customer_name || s.customer_email || "—"}</p>
                      {s.customer_name && <p className="text-[10px] text-muted-foreground truncate">{s.customer_email}</p>}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_TONES[s.status] ?? ""}`}>{s.status}</Badge>
                      {s.cancel_at_period_end && <p className="text-[9px] text-warning mt-1">Cancela ao fim</p>}
                    </TableCell>
                    <TableCell className="text-xs text-foreground font-medium">{fmt(s.amount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {s.interval === "year" ? "Anual" : s.interval_count === 6 ? "Semestral" : "Mensal"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {s.current_period_end ? format(new Date(s.current_period_end), "dd/MM/yy") : "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">{format(new Date(s.created), "dd/MM/yy")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
