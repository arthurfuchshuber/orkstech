import { useState, useMemo } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import {
  Clock, Check, AlertTriangle, Ban, ChevronDown, Search, Loader2, Pencil, X,
} from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { updateAccountReceivable } from "@/lib/accounts-receivable-helpers";
import { updateAccountPayable, registerPayment } from "@/lib/accounts-payable-helpers";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

type Mode = "receivable" | "payable";

const statusConfigReceivable: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: Clock },
  paid: { label: "Recebido", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: Check },
  overdue: { label: "Vencido", color: "bg-red-500/10 text-red-600 border-red-200", icon: AlertTriangle },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border", icon: Ban },
};

const statusConfigPayable: Record<string, { label: string; color: string; icon: typeof Clock }> = {
  pending: { label: "Pendente", color: "bg-amber-500/10 text-amber-600 border-amber-200", icon: Clock },
  paid: { label: "Pago", color: "bg-emerald-500/10 text-emerald-600 border-emerald-200", icon: Check },
  overdue: { label: "Vencido", color: "bg-red-500/10 text-red-600 border-red-200", icon: AlertTriangle },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border", icon: Ban },
};

interface QuickListModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: Mode;
  title: string;
  description?: string;
  items: any[];
}

export function QuickListModal({ open, onOpenChange, mode, title, description, items }: QuickListModalProps) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState<string>("");
  const [editDueDate, setEditDueDate] = useState<string>("");
  const [search, setSearch] = useState("");

  const statusConfig = mode === "receivable" ? statusConfigReceivable : statusConfigPayable;

  const filtered = useMemo(() => {
    const t = search.trim().toLowerCase();
    if (!t) return items;
    return items.filter(
      (i) =>
        (i.description || "").toLowerCase().includes(t) ||
        (i.supplier_name || "").toLowerCase().includes(t)
    );
  }, [items, search]);

  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(val);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: [mode === "receivable" ? "accounts-receivable" : "accounts-payable"] });
    qc.invalidateQueries({ queryKey: [mode === "receivable" ? "accounts-receivable-counts" : "accounts-payable-counts"] });
  };

  const statusMutation = useMutation({
    mutationFn: async ({ id, status, item }: { id: string; status: string; item: any }) => {
      if (mode === "receivable") {
        if (status === "paid") {
          await updateAccountReceivable(id, {
            status: "paid",
            payment_date: new Date().toISOString().slice(0, 10),
          });
        } else {
          await updateAccountReceivable(id, { status, payment_date: null });
        }
      } else {
        if (status === "paid") {
          await registerPayment(
            id,
            item.bank_account_id || "",
            new Date().toISOString().slice(0, 10),
            user!.id,
            empresaId,
            0
          );
        } else {
          await updateAccountPayable(id, { status: status as any, payment_date: null });
        }
      }
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Status atualizado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao atualizar"),
  });

  const inlineSaveMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      if (mode === "receivable") await updateAccountReceivable(id, data);
      else await updateAccountPayable(id, data);
    },
    onSuccess: () => {
      invalidateAll();
      setEditingId(null);
      toast.success("Atualizado");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar"),
  });

  const startEdit = (item: any) => {
    setEditingId(item.id);
    setEditAmount(String(item.amount));
    setEditDueDate(item.due_date);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
    setEditDueDate("");
  };

  const saveEdit = (id: string) => {
    const amount = parseFloat(editAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Valor inválido");
      return;
    }
    if (!editDueDate) {
      toast.error("Data inválida");
      return;
    }
    inlineSaveMutation.mutate({ id, data: { amount, due_date: editDueDate } });
  };

  const total = filtered.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-0 gap-0 border-border/50 bg-card shadow-2xl rounded-xl overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/30">
          <DialogTitle className="text-lg font-semibold tracking-tight">{title}</DialogTitle>
          {description && (
            <DialogDescription className="text-sm text-muted-foreground mt-1">{description}</DialogDescription>
          )}
          <div className="flex items-center justify-between gap-3 mt-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-9"
              />
            </div>
            <div className="text-sm text-muted-foreground">
              {filtered.length} conta(s) — <span className="font-semibold text-foreground">{formatCurrency(total)}</span>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead style={{ minWidth: 160 }}>{mode === "receivable" ? "Pagador" : "Fornecedor"}</TableHead>
                <TableHead style={{ minWidth: 200 }}>Descrição</TableHead>
                <TableHead style={{ minWidth: 130 }}>Valor</TableHead>
                <TableHead style={{ minWidth: 130 }}>Vencimento</TableHead>
                <TableHead style={{ minWidth: 140 }}>Status</TableHead>
                <TableHead style={{ width: 100 }} className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhuma conta nesta lista.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((item) => {
                  const isEditing = editingId === item.id;
                  return (
                    <TableRow key={item.id}>
                      <TableCell className="text-sm truncate max-w-[160px]">
                        {item.supplier_name || "—"}
                      </TableCell>
                      <TableCell className="text-sm font-medium truncate max-w-[200px]">
                        {item.description}
                        {item.installment_total > 1 && (
                          <span className="text-xs text-muted-foreground ml-1">
                            ({item.installment_number}/{item.installment_total})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="number"
                            step="0.01"
                            value={editAmount}
                            onChange={(e) => setEditAmount(e.target.value)}
                            className="h-8 w-28"
                          />
                        ) : (
                          <span className="text-sm font-medium">{formatCurrency(Number(item.amount))}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {isEditing ? (
                          <Input
                            type="date"
                            value={editDueDate}
                            onChange={(e) => setEditDueDate(e.target.value)}
                            className="h-8 w-36"
                          />
                        ) : (
                          <span className="text-sm">{format(new Date(item.due_date), "dd/MM/yyyy")}</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="cursor-pointer" disabled={statusMutation.isPending}>
                              {(() => {
                                const cfg = statusConfig[item.status] || statusConfig.pending;
                                const Icon = cfg.icon;
                                return (
                                  <Badge variant="outline" className={`${cfg.color} gap-1 font-medium cursor-pointer hover:opacity-80`}>
                                    <Icon className="w-3 h-3" />
                                    {cfg.label}
                                    <ChevronDown className="w-3 h-3 ml-0.5 opacity-50" />
                                  </Badge>
                                );
                              })()}
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-48">
                            {Object.entries(statusConfig).filter(([k]) => k !== "cancelled").map(([key, cfg]) => {
                              const Icon = cfg.icon;
                              return (
                                <DropdownMenuItem
                                  key={key}
                                  onClick={() => statusMutation.mutate({ id: item.id, status: key, item })}
                                  className="gap-2"
                                >
                                  <Icon className="w-4 h-4" />
                                  {cfg.label}
                                </DropdownMenuItem>
                              );
                            })}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                      <TableCell className="text-right">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0"
                              onClick={() => saveEdit(item.id)}
                              disabled={inlineSaveMutation.isPending}
                            >
                              {inlineSaveMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5 text-emerald-600" />}
                            </Button>
                            <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={cancelEdit}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => startEdit(item)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
