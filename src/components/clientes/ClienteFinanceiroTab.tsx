import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp, AlertCircle, Receipt, Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";

interface Props {
  clienteId: string;
}

function currency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

const statusMap: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending: { label: "Pendente", variant: "outline" },
  paid: { label: "Pago", variant: "default" },
  overdue: { label: "Vencido", variant: "destructive" },
  cancelled: { label: "Cancelado", variant: "secondary" },
};

export function ClienteFinanceiroTab({ clienteId }: Props) {
  // For now, show accounts_payable linked to this client via supplier_id
  // In a real scenario this would be accounts_receivable
  const { data: financeiro = [], isLoading } = useQuery({
    queryKey: ["cliente-financeiro", clienteId],
    queryFn: async () => {
      // Query accounts payable where supplier_id matches (as placeholder)
      // This will be replaced with proper client financial when accounts_receivable exists
      const { data, error } = await supabase
        .from("accounts_payable")
        .select("*")
        .order("due_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      // Filter client-related in the future
      return data || [];
    },
  });

  const totalFaturado = financeiro.reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalPago = financeiro.filter((f) => f.status === "paid").reduce((sum, f) => sum + (f.amount || 0), 0);
  const emAberto = financeiro.filter((f) => f.status === "pending" || f.status === "overdue").reduce((sum, f) => sum + (f.amount || 0), 0);
  const ticketMedio = financeiro.length > 0 ? totalFaturado / financeiro.length : 0;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Faturado", value: currency(totalFaturado), icon: DollarSign },
          { label: "Total Pago", value: currency(totalPago), icon: TrendingUp },
          { label: "Em Aberto", value: currency(emAberto), icon: AlertCircle },
          { label: "Ticket Médio", value: currency(ticketMedio), icon: Receipt },
        ].map((stat) => (
          <Card key={stat.label} className="p-4 border-border/50 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</span>
              <stat.icon className="w-4 h-4 text-primary" />
            </div>
            <p className="text-lg font-bold text-foreground">{stat.value}</p>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Descrição</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Valor</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Vencimento</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider">Pagamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : financeiro.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <DollarSign className="w-8 h-8 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Nenhum registro financeiro</p>
                    <p className="text-xs text-muted-foreground/70">Registros financeiros vinculados ao cliente aparecerão aqui</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              financeiro.map((f) => {
                const st = statusMap[f.status] || statusMap.pending;
                return (
                  <TableRow key={f.id} className="border-border/20">
                    <TableCell className="font-medium text-foreground">{f.description}</TableCell>
                    <TableCell className="text-sm font-mono">{currency(f.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(f.due_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {f.payment_date ? format(new Date(f.payment_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
