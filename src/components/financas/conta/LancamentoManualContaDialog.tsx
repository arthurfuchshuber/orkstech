import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { refreshQueries } from "@/lib/query-refresh";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ArrowDownLeft, ArrowUpRight } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contaId: string;
  contaNome: string;
}

export function LancamentoManualContaDialog({ open, onOpenChange, contaId, contaNome }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();
  const [tipo, setTipo] = useState<"income" | "expense">("expense");
  const [amount, setAmount] = useState("");
  const [descricao, setDescricao] = useState("");
  const [data, setData] = useState(() => new Date().toISOString().slice(0, 10));

  useEffect(() => {
    if (open) {
      setAmount(""); setDescricao(""); setTipo("expense");
      setData(new Date().toISOString().slice(0, 10));
    }
  }, [open]);

  const mut = useMutation({
    mutationFn: async () => {
      const v = parseFloat(amount);
      if (!v || v <= 0) throw new Error("Valor inválido");
      if (!descricao.trim()) throw new Error("Descrição obrigatória");
      const { error } = await supabase.from("cash_transactions").insert({
        user_id: user!.id,
        empresa_id: empresa?.id,
        bank_account_id: contaId,
        type: tipo,
        amount: v,
        transaction_date: data,
        description: descricao.trim(),
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshQueries(qc, [
        ["contas_bancarias"], ["cash_transactions"], ["conta_saldo"],
      ]);
      toast.success("Lançamento registrado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao registrar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Novo lançamento — {contaNome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div>
            <label className="text-sm font-medium mb-1.5 block">Tipo</label>
            <RadioGroup value={tipo} onValueChange={(v) => setTipo(v as any)} className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-md border border-border/50 p-2.5 cursor-pointer hover:bg-muted/30">
                <RadioGroupItem value="income" />
                <ArrowDownLeft className="w-4 h-4 text-emerald-500" />
                <span className="text-sm">Entrada</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border/50 p-2.5 cursor-pointer hover:bg-muted/30">
                <RadioGroupItem value="expense" />
                <ArrowUpRight className="w-4 h-4 text-warning" />
                <span className="text-sm">Saída</span>
              </label>
            </RadioGroup>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Data</label>
              <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium mb-1.5 block">Valor (R$)</label>
              <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição</label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={120} rows={2} placeholder="Ex: Saque ATM, Depósito em dinheiro..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending}>Registrar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
