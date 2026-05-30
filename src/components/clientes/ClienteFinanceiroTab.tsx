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
      const [pagar, receber] = await Promise.all([
        supabase.from("accounts_payable").select("*").eq("cliente_id", clienteId).order("due_date", { ascending: false }).limit(50),
        supabase.from("accounts_receivable").select("*").eq("cliente_id", clienteId).order("due_date", { ascending: false }).limit(50),
      ]);
      if (pagar.error) throw pagar.error;
      if (receber.error) throw receber.error;
      const pagarTagged = (pagar.data || []).map((r) => ({ ...r, kind: "pagar" as const }));
      const receberTagged = (receber.data || []).map((r) => ({ ...r, kind: "receber" as const }));
      return [...pagarTagged, ...receberTagged].sort((a, b) =>
        new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
      );
    },
  });

  const aReceber = financeiro
    .filter((f) => f.kind === "receber" && (f.status === "pending" || f.status === "overdue"))
    .reduce((sum, f) => sum + (f.amount || 0), 0);
  const recebido = financeiro
    .filter((f) => f.kind === "receber" && f.status === "paid")
    .reduce((sum, f) => sum + (f.amount || 0), 0);
  const aPagar = financeiro
    .filter((f) => f.kind === "pagar" && (f.status === "pending" || f.status === "overdue"))
    .reduce((sum, f) => sum + (f.amount || 0), 0);

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Stats — mobile: 3 colunas compactas estilo mockup */}
      <div className="grid grid-cols-3 gap-px md:gap-4 bg-border/40 md:bg-transparent rounded-xl md:rounded-none overflow-hidden border border-border/40 md:border-0">
        <Card className="p-3 md:p-5 rounded-none md:rounded-xl border-0 md:border-emerald-500/20 bg-card md:bg-emerald-500/[0.04] shadow-none md:shadow-sm">
          <p className="text-[10px] md:text-xs font-medium text-emerald-400 uppercase tracking-wider mb-1">A Receber</p>
          <p className="text-sm md:text-2xl font-semibold md:font-bold text-emerald-400 tabular-nums truncate">{currency(aReceber)}</p>
        </Card>
        <Card className="p-3 md:p-5 rounded-none md:rounded-xl border-0 md:border-primary/20 bg-card md:bg-primary/[0.04] shadow-none md:shadow-sm">
          <p className="text-[10px] md:text-xs font-medium text-primary uppercase tracking-wider mb-1">Recebido</p>
          <p className={`text-sm md:text-2xl font-semibold md:font-bold tabular-nums truncate ${recebido === 0 ? "text-muted-foreground/50" : "text-primary"}`}>{currency(recebido)}</p>
        </Card>
        <Card className="p-3 md:p-5 rounded-none md:rounded-xl border-0 md:border-amber-500/20 bg-card md:bg-amber-500/[0.04] shadow-none md:shadow-sm">
          <p className="text-[10px] md:text-xs font-medium text-amber-400 uppercase tracking-wider mb-1">A Pagar</p>
          <p className={`text-sm md:text-2xl font-semibold md:font-bold tabular-nums truncate ${aPagar === 0 ? "text-muted-foreground/50" : "text-amber-400"}`}>{currency(aPagar)}</p>
        </Card>
      </div>

      {/* Mobile list */}
      <div className="md:hidden">
        {isLoading ? (
          <div className="py-12 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
        ) : financeiro.length === 0 ? (
          <div className="py-12 text-center text-sm text-muted-foreground">Nenhum registro financeiro</div>
        ) : (
          <div className="flex flex-col gap-px rounded-xl overflow-hidden border border-border/40 bg-border/40">
            {financeiro.map((f) => {
              const st = statusMap[f.status] || statusMap.pending;
              const isOverdue = f.status === "overdue";
              return (
                <div key={`${f.kind}-${f.id}`} className="bg-card px-3.5 py-3 flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${isOverdue ? "bg-destructive" : f.status === "paid" ? "bg-emerald-500" : f.kind === "receber" ? "bg-emerald-500/60" : "bg-amber-500/60"}`} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{f.description}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {f.kind === "receber" ? "Receber" : "Pagar"} · venc. {format(new Date(f.due_date), "dd/MM/yyyy", { locale: ptBR })}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-semibold tabular-nums ${isOverdue ? "text-destructive" : "text-foreground"}`}>{currency(f.amount)}</div>
                    <Badge variant={st.variant} className="text-[10px] mt-1 px-1.5 py-0">{st.label}</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Desktop Table */}
      <Card className="hidden md:block border-border/50 shadow-sm overflow-hidden">
        <Table className="table-fixed w-full">
          <TableHeader>
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[10%]">Tipo</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[26%]">Descrição</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[16%]">Vencimento</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[16%]">Valor</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[14%]">Status</TableHead>
              <TableHead className="text-xs font-semibold uppercase tracking-wider text-muted-foreground w-[18%] text-right">Pagamento</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : financeiro.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12">
                  <p className="text-sm text-muted-foreground">Nenhum registro financeiro</p>
                </TableCell>
              </TableRow>
            ) : (
              financeiro.map((f) => {
                const st = statusMap[f.status] || statusMap.pending;
                return (
                  <TableRow key={`${f.kind}-${f.id}`} className="border-border/20">
                    <TableCell>
                      <Badge variant="outline" className={`text-xs ${f.kind === "receber" ? "border-emerald-500/30 text-emerald-400" : "border-amber-500/30 text-amber-400"}`}>
                        {f.kind === "receber" ? "Receber" : "Pagar"}
                      </Badge>
                    </TableCell>
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
