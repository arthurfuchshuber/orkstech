import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ChevronDown, Loader2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { useRegraConflitoDetector } from "@/hooks/useRegraConflitoDetector";
import { RegraConflitoModal } from "./RegraConflitoModal";
import { enhancePluggyDescription } from "@/lib/pluggy-description";
import { MixedTypeBulkDialog } from "@/components/financas/MixedTypeBulkDialog";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  categoryId: string | null;
  categoryLabel: string;
  year: number;
  monthFrom: number; // 0-indexed
  monthTo: number;   // 0-indexed
  bankAccountId?: string;
  costCenterId?: string;
}

interface Mov {
  id: string;
  source: "accounts_payable" | "accounts_receivable" | "pluggy_transactions";
  date: string;
  description: string;
  amount: number;
  type: "income" | "expense";
  categoria_financeira_id: string | null;
  pluggy_account_id?: string | null;
  payment_data?: any;
}

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const fmtDate = (d: string) => {
  try { return format(new Date(d + "T12:00:00"), "dd/MM/yyyy"); } catch { return d; }
};

const sourceLabel: Record<Mov["source"], string> = {
  accounts_payable: "A Pagar",
  accounts_receivable: "A Receber",
  pluggy_transactions: "Extrato",
};

/** Mantém só a parte após o "|" (contraparte limpa) — espelha o Extrato. */
const cleanDescription = (m: Mov): string => {
  if (m.source === "pluggy_transactions") {
    const enhanced = enhancePluggyDescription({
      description: m.description,
      amount: m.type === "income" ? m.amount : -m.amount,
      payment_data: m.payment_data,
    });
    const idx = enhanced.indexOf("|");
    return idx >= 0 ? enhanced.slice(idx + 1).trim() : enhanced.trim();
  }
  const raw = (m.description || "").trim();
  const idx = raw.indexOf("|");
  return idx >= 0 ? raw.slice(idx + 1).trim() : raw || "—";
};

const ALLOWED_INCOME = ["receita", "resultado_financeiro", "ajuste"];
const ALLOWED_EXPENSE = ["despesa", "despesa_comercial", "custo", "deducao", "imposto", "resultado_financeiro", "distribuicao_lucros", "ajuste"];

export function DRECategoriaMovimentacoesModal({
  open, onOpenChange, categoryId, categoryLabel,
  year, monthFrom, monthTo, bankAccountId, costCenterId,
}: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;
  const empresaId = empresa?.id;
  const qc = useQueryClient();

  const startStr = `${year}-${String(monthFrom + 1).padStart(2, "0")}-01`;
  const endDate = new Date(year, monthTo + 1, 0);
  const endStr = format(endDate, "yyyy-MM-dd");

  const [selection, setSelection] = useState<Set<string>>(new Set());
  const [mixedDialog, setMixedDialog] = useState<{ open: boolean; categoriaId: string | null; categoriaTipo: "income" | "expense" | "both" }>({
    open: false, categoriaId: null, categoriaTipo: "both",
  });

  const { data: categorias = [] } = useQuery({
    queryKey: ["dre-cat-mov-cats", targetUserId],
    enabled: !!targetUserId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categorias_financeiras")
        .select("id, nome, tipo, categoria_pai_id, ativo")
        .eq("user_id", targetUserId!)
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pluggyAccounts = [] } = useQuery({
    queryKey: ["dre-cat-mov-pluggy-accounts", targetUserId],
    enabled: !!targetUserId && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("pluggy_bank_accounts" as any)
        .select("pluggy_account_id, type")
        .eq("user_id", targetUserId!);
      return (data ?? []) as any[];
    },
  });
  const isCreditCardAccount = (id: string | null | undefined) => {
    if (!id) return false;
    const a = pluggyAccounts.find((x: any) => x.pluggy_account_id === id);
    return a?.type === "CREDIT";
  };

  const idsAlvo = useMemo(() => {
    if (!categoryId) return [] as string[];
    const ids = new Set<string>([categoryId]);
    let added = true;
    while (added) {
      added = false;
      for (const c of categorias) {
        if (c.categoria_pai_id && ids.has(c.categoria_pai_id) && !ids.has(c.id)) {
          ids.add(c.id);
          added = true;
        }
      }
    }
    return Array.from(ids);
  }, [categoryId, categorias]);

  const folhas = useMemo(
    () => categorias.filter((c: any) => !categorias.some((cc: any) => cc.categoria_pai_id === c.id)),
    [categorias],
  );

  const { data: movs = [], isLoading } = useQuery<Mov[]>({
    queryKey: ["dre-cat-movs", targetUserId, empresaId, idsAlvo.join(","), startStr, endStr, bankAccountId ?? "", costCenterId ?? "", pluggyAccounts.length],
    enabled: !!targetUserId && open && idsAlvo.length > 0,
    queryFn: async () => {
      let qPay = supabase.from("accounts_payable")
        .select("id, amount, payment_date, description, categoria_financeira_id, bank_account_id, cost_center_id, empresa_id, user_id")
        .eq("status", "paid").gte("payment_date", startStr).lte("payment_date", endStr)
        .in("categoria_financeira_id", idsAlvo);
      if (empresaId) qPay = qPay.eq("empresa_id", empresaId); else qPay = qPay.eq("user_id", targetUserId!);
      if (bankAccountId) qPay = qPay.eq("bank_account_id", bankAccountId);
      if (costCenterId) qPay = qPay.eq("cost_center_id", costCenterId);

      let qRec = supabase.from("accounts_receivable")
        .select("id, amount, payment_date, description, categoria_financeira_id, bank_account_id, cost_center_id, empresa_id, user_id")
        .eq("status", "paid").gte("payment_date", startStr).lte("payment_date", endStr)
        .in("categoria_financeira_id", idsAlvo);
      if (empresaId) qRec = qRec.eq("empresa_id", empresaId); else qRec = qRec.eq("user_id", targetUserId!);
      if (bankAccountId) qRec = qRec.eq("bank_account_id", bankAccountId);
      if (costCenterId) qRec = qRec.eq("cost_center_id", costCenterId);

      const qPlu = supabase.from("pluggy_transactions" as any)
        .select("id, amount, date, description, categoria_financeira_id, type, user_id, reconciled, is_internal_transfer, pluggy_account_id, payment_data")
        .eq("user_id", targetUserId!)
        .eq("reconciled", false)
        .eq("is_internal_transfer", false)
        .gte("date", startStr).lte("date", endStr)
        .in("categoria_financeira_id", idsAlvo);

      const [payRes, recRes, pluRes] = await Promise.all([qPay, qRec, qPlu]);
      if (payRes.error) throw payRes.error;
      if (recRes.error) throw recRes.error;
      if (pluRes.error) throw pluRes.error;

      const out: Mov[] = [];
      (payRes.data ?? []).forEach((r: any) => out.push({
        id: r.id, source: "accounts_payable", date: r.payment_date,
        description: r.description ?? "—", amount: Math.abs(Number(r.amount)),
        type: "expense", categoria_financeira_id: r.categoria_financeira_id,
      }));
      (recRes.data ?? []).forEach((r: any) => out.push({
        id: r.id, source: "accounts_receivable", date: r.payment_date,
        description: r.description ?? "—", amount: Math.abs(Number(r.amount)),
        type: "income", categoria_financeira_id: r.categoria_financeira_id,
      }));
      (pluRes.data ?? []).forEach((r: any) => {
        const isCredit = isCreditCardAccount(r.pluggy_account_id);
        const isIn = isCredit ? Number(r.amount) < 0 : Number(r.amount) > 0;
        out.push({
          id: r.id, source: "pluggy_transactions", date: r.date,
          description: r.description ?? "—", amount: Math.abs(Number(r.amount)),
          type: isIn ? "income" : "expense",
          categoria_financeira_id: r.categoria_financeira_id,
          pluggy_account_id: r.pluggy_account_id,
          payment_data: r.payment_data,
        });
      });
      out.sort((a, b) => (a.date < b.date ? 1 : -1));
      return out;
    },
  });

  const totalIn = movs.filter((m) => m.type === "income").reduce((s, m) => s + m.amount, 0);
  const totalOut = movs.filter((m) => m.type === "expense").reduce((s, m) => s + m.amount, 0);

  const { conflito, setConflito, registrar } = useRegraConflitoDetector();

  const updateCat = useMutation({
    mutationFn: async ({ mov, novaCatId }: { mov: Mov; novaCatId: string | null }) => {
      const { error } = await supabase
        .from(mov.source as any)
        .update({ categoria_financeira_id: novaCatId })
        .eq("id", mov.id);
      if (error) throw error;
      return { mov, novaCatId };
    },
    onSuccess: ({ mov, novaCatId }) => {
      toast.success("Subcategoria atualizada");
      qc.invalidateQueries({ queryKey: ["dre-cat-movs"] });
      qc.invalidateQueries({ queryKey: ["dre-monthly-tx"] });
      qc.invalidateQueries({ queryKey: ["dre-transactions"] });
      qc.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      registrar(mov.description, novaCatId);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar"),
  });

  /** Atualiza em massa, agrupando por source. */
  const bulkUpdate = useMutation({
    mutationFn: async ({ targets, novaCatId }: { targets: Mov[]; novaCatId: string | null }) => {
      const bySource: Record<string, string[]> = {};
      targets.forEach((m) => {
        bySource[m.source] = bySource[m.source] || [];
        bySource[m.source].push(m.id);
      });
      for (const [src, ids] of Object.entries(bySource)) {
        const { error } = await supabase.from(src as any).update({ categoria_financeira_id: novaCatId }).in("id", ids);
        if (error) throw error;
      }
      return targets.length;
    },
    onSuccess: (count) => {
      toast.success(`${count} lançamento(s) recategorizados`);
      setSelection(new Set());
      qc.invalidateQueries({ queryKey: ["dre-cat-movs"] });
      qc.invalidateQueries({ queryKey: ["dre-monthly-tx"] });
      qc.invalidateQueries({ queryKey: ["dre-transactions"] });
      qc.invalidateQueries({ queryKey: ["pluggy_transactions"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao recategorizar"),
  });

  const toggleRow = (id: string) => {
    setSelection((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    if (selection.size === movs.length) setSelection(new Set());
    else setSelection(new Set(movs.map((m) => m.id)));
  };

  const selectedMovs = useMemo(() => movs.filter((m) => selection.has(m.id)), [movs, selection]);
  const selectedIn = selectedMovs.filter((m) => m.type === "income");
  const selectedOut = selectedMovs.filter((m) => m.type === "expense");

  /** Tenta aplicar categoria em massa, validando tipo. */
  const tryBulkCategorize = (catId: string | null) => {
    if (selectedMovs.length === 0) return;

    if (catId === null) {
      bulkUpdate.mutate({ targets: selectedMovs, novaCatId: null });
      return;
    }

    const cat: any = folhas.find((c: any) => c.id === catId);
    if (!cat) return;

    const isIncomeCat = ALLOWED_INCOME.includes(cat.tipo);
    const isExpenseCat = ALLOWED_EXPENSE.includes(cat.tipo);

    // Se a categoria pertence a ambos os lados (ex.: resultado_financeiro), permite tudo.
    if (isIncomeCat && isExpenseCat) {
      bulkUpdate.mutate({ targets: selectedMovs, novaCatId: catId });
      return;
    }

    const hasIn = selectedIn.length > 0;
    const hasOut = selectedOut.length > 0;
    const conflitoTipo = (isIncomeCat && hasOut) || (isExpenseCat && hasIn);

    if (conflitoTipo && hasIn && hasOut) {
      setMixedDialog({
        open: true,
        categoriaId: catId,
        categoriaTipo: isIncomeCat ? "income" : "expense",
      });
      return;
    }

    if (conflitoTipo) {
      toast.error(
        isIncomeCat
          ? "Esta categoria é de entrada e a seleção contém apenas saídas."
          : "Esta categoria é de saída e a seleção contém apenas entradas.",
      );
      return;
    }

    bulkUpdate.mutate({ targets: selectedMovs, novaCatId: catId });
  };

  const allChecked = movs.length > 0 && selection.size === movs.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[92vh] max-h-[92vh] flex flex-col p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b border-border/40 flex-shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <span>{categoryLabel}</span>
            <Badge variant="outline" className="text-[10px]">
              {format(new Date(year, monthFrom, 1), "MM/yyyy")} – {format(endDate, "MM/yyyy")}
            </Badge>
          </DialogTitle>
          <DialogDescription>
            Movimentações financeiras dentro desta categoria no período.
          </DialogDescription>
        </DialogHeader>

        {/* Resumo */}
        <div className="grid grid-cols-3 gap-3 px-6 py-3 border-b border-border/40 flex-shrink-0">
          <div className="rounded-md border border-border/50 bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Entradas</p>
            <p className="text-lg font-semibold tabular-nums text-success">{fmtBRL(totalIn)}</p>
          </div>
          <div className="rounded-md border border-border/50 bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Saídas</p>
            <p className="text-lg font-semibold tabular-nums text-warning">{fmtBRL(totalOut)}</p>
          </div>
          <div className="rounded-md border border-border/50 bg-card p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Lançamentos</p>
            <p className="text-lg font-semibold tabular-nums text-foreground">{movs.length}</p>
          </div>
        </div>

        {/* Toolbar de seleção em massa */}
        {selection.size > 0 && (
          <div className="flex items-center justify-between gap-3 px-6 py-2.5 border-b border-border/40 bg-primary/5 flex-shrink-0">
            <div className="flex items-center gap-2 text-xs">
              <Badge variant="secondary">{selection.size} selecionada(s)</Badge>
              {selectedIn.length > 0 && <span className="text-success">{selectedIn.length} entrada(s)</span>}
              {selectedOut.length > 0 && <span className="text-warning">{selectedOut.length} saída(s)</span>}
            </div>
            <div className="flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="sm" variant="outline" className="gap-2">
                    Categorizar em massa <ChevronDown className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-[320px] overflow-y-auto custom-scrollbar">
                  {folhas.map((c: any) => (
                    <DropdownMenuItem key={c.id} onClick={() => tryBulkCategorize(c.id)}>
                      {c.nome}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => tryBulkCategorize(null)} className="text-muted-foreground">
                    Limpar categoria
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button size="sm" variant="ghost" onClick={() => setSelection(new Set())}>Cancelar</Button>
            </div>
          </div>
        )}

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-6 py-4">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              <Loader2 className="w-4 h-4 mx-auto mb-2 animate-spin" />
              Carregando movimentações...
            </div>
          ) : movs.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              Nenhuma movimentação nesta categoria no período.
            </div>
          ) : (
            <div className="border border-border/40 rounded-md overflow-hidden">
              <div className="grid grid-cols-[36px_100px_90px_minmax(0,1fr)_220px_140px] gap-3 border-b border-border/40 bg-muted/20 px-3 py-2 text-[11px] uppercase tracking-wider text-muted-foreground items-center">
                <Checkbox checked={allChecked} onCheckedChange={toggleAll} aria-label="Selecionar todos" />
                <div>Data</div>
                <div>Origem</div>
                <div>Descrição</div>
                <div>Subcategoria</div>
                <div className="text-right">Valor</div>
              </div>
              <div className="divide-y divide-border/20">
                {movs.map((m) => {
                  const isIn = m.type === "income";
                  const cat = categorias.find((c: any) => c.id === m.categoria_financeira_id);
                  const allowedTipos = isIn ? ALLOWED_INCOME : ALLOWED_EXPENSE;
                  const opts = folhas.filter((c: any) => allowedTipos.includes(c.tipo));
                  const desc = cleanDescription(m);
                  const checked = selection.has(m.id);

                  return (
                    <div key={`${m.source}-${m.id}`}
                      className={cn(
                        "grid grid-cols-[36px_100px_90px_minmax(0,1fr)_220px_140px] gap-3 px-3 py-2 items-center hover:bg-muted/20 transition-colors",
                        checked && "bg-primary/5",
                      )}>
                      <Checkbox checked={checked} onCheckedChange={() => toggleRow(m.id)} aria-label="Selecionar linha" />
                      <div className="text-xs tabular-nums text-muted-foreground">{fmtDate(m.date)}</div>
                      <Badge variant="outline" className="text-[10px] w-fit">{sourceLabel[m.source]}</Badge>
                      <div className="flex items-center gap-2 min-w-0">
                        <div className={cn(
                          "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0",
                          isIn ? "bg-success/10" : "bg-warning/10",
                        )}>
                          {isIn ? <ArrowDownLeft className="w-3 h-3 text-success" /> : <ArrowUpRight className="w-3 h-3 text-warning" />}
                        </div>
                        <span className="text-sm truncate" title={desc}>{desc}</span>
                      </div>
                      <div className="min-w-0">
                        <CategoriaTreeSelect
                          categorias={categorias as any}
                          value={m.categoria_financeira_id}
                          direction={isIn ? "in" : "out"}
                          placeholder="Selecionar"
                          onChange={(v) => updateCat.mutate({ mov: m, novaCatId: v })}
                        />
                      </div>
                      <div className={cn("text-sm font-semibold tabular-nums text-right", isIn ? "text-success" : "text-warning")}>
                        {isIn ? "+" : "−"} {fmtBRL(m.amount)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-border/40 flex-shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button>
        </div>
      </DialogContent>

      <RegraConflitoModal conflito={conflito} onClose={() => setConflito(null)} />

      <MixedTypeBulkDialog
        open={mixedDialog.open}
        onOpenChange={(v) => setMixedDialog((p) => ({ ...p, open: v }))}
        totalIn={selectedIn.length}
        totalOut={selectedOut.length}
        onApplyIncome={() => mixedDialog.categoriaId && bulkUpdate.mutate({ targets: selectedIn, novaCatId: mixedDialog.categoriaId })}
        onApplyExpense={() => mixedDialog.categoriaId && bulkUpdate.mutate({ targets: selectedOut, novaCatId: mixedDialog.categoriaId })}
      />
    </Dialog>
  );
}
