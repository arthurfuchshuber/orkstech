import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
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
  const { data: financeiro = [], isLoading } = useQuery({
    queryKey: ["cliente-financeiro", clienteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("accounts_payable")
        .select("*")
        .eq("cliente_id", clienteId)
        .order("due_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
  });

  const pendente = financeiro
    .filter((f) => f.status === "pending" || f.status === "overdue")
    .reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalPago = financeiro
    .filter((f) => f.status === "paid")
    .reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalRegistros = financeiro.length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="p-5 border-amber-500/20 bg-amber-500/[0.04] shadow-sm">
          <p className="text-xs font-medium text-amber-400 uppercase tracking-wider mb-1">Pendente</p>
          <p className="text-2xl font-bold text-amber-400">{currency(pendente)}</p>
        </Card>
        <Card className="p-5 border-emerald-500/20 bg-emerald-500/[0.04] shadow-sm">
          <p className="text-xs font-medium text-emerald-400 uppercase tracking-wider mb-1">Total Pago</p>
          <p className="text-2xl font-bold text-emerald-400">{currency(totalPago)}</p>
        </Card>
        <Card className="p-5 border-border/50 shadow-sm">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Total de Registros</p>
          <p className="text-2xl font-bold text-foreground">{totalRegistros}</p>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border/50 shadow-sm overflow-hidden">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[30%]">Descrição</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[18%]">Vencimento</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[18%]">Valor</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[16%]">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[18%] text-right">Ação</TableHead>
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
                  <p className="text-sm text-muted-foreground">Nenhum registro financeiro</p>
                </TableCell>
              </TableRow>
            ) : (
              financeiro.map((f) => {
                const st = statusMap[f.status] || statusMap.pending;
                return (
                  <TableRow key={f.id} className="border-border/20">
                    <TableCell className="font-medium text-foreground">{f.description}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(f.due_date), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="text-sm font-mono text-foreground">{currency(f.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={st.variant} className="text-xs">{st.label}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <span className="text-xs text-muted-foreground">
                        {f.payment_date ? format(new Date(f.payment_date), "dd/MM/yyyy", { locale: ptBR }) : "—"}
                      </span>
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
