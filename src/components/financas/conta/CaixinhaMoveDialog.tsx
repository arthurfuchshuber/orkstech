import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { refreshQueries } from "@/lib/query-refresh";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { PiggyBank, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contaId: string;
  contaNome: string;
  saldoConta: number;
  saldoCaixinha: number;
}

const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function CaixinhaMoveDialog({ open, onOpenChange, contaId, contaNome, saldoConta, saldoCaixinha }: Props) {
  const qc = useQueryClient();
  const [direcao, setDirecao] = useState<"aplicar" | "resgatar">("resgatar");
  const [amount, setAmount] = useState("");
  const [descricao, setDescricao] = useState("");

  useEffect(() => {
    if (open) { setAmount(""); setDescricao(""); setDirecao("resgatar"); }
  }, [open]);

  const mut = useMutation({
    mutationFn: async () => {
      const v = parseFloat(amount);
      if (!v || v <= 0) throw new Error("Valor inválido");
      const { error } = await supabase.rpc("mover_caixinha_conta" as any, {
        p_conta_id: contaId,
        p_amount: v,
        p_direcao: direcao,
        p_descricao: descricao || null,
      });
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshQueries(qc, [
        ["contas_bancarias"], ["contas-bancarias"],
        ["cash_transactions"], ["conta_saldo"],
      ]);
      toast.success(direcao === "aplicar" ? "Aplicação registrada" : "Resgate registrado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Erro ao mover caixinha"),
  });

  const max = direcao === "aplicar" ? saldoConta : saldoCaixinha;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PiggyBank className="w-5 h-5 text-primary" /> Mover Aplicação — {contaNome}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-md border border-border/50 bg-muted/20 p-2">
              <p className="text-muted-foreground">Saldo da conta</p>
              <p className="font-semibold text-foreground">{fmt(saldoConta)}</p>
            </div>
            <div className="rounded-md border border-border/50 bg-muted/20 p-2">
              <p className="text-muted-foreground">Aplicação</p>
              <p className="font-semibold text-emerald-500">{fmt(saldoCaixinha)}</p>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Operação</label>
            <RadioGroup value={direcao} onValueChange={(v) => setDirecao(v as any)} className="grid grid-cols-2 gap-2">
              <label className="flex items-center gap-2 rounded-md border border-border/50 p-2.5 cursor-pointer hover:bg-muted/30">
                <RadioGroupItem value="resgatar" />
                <ArrowDownToLine className="w-4 h-4 text-emerald-500" />
                <span className="text-sm">Resgatar p/ conta</span>
              </label>
              <label className="flex items-center gap-2 rounded-md border border-border/50 p-2.5 cursor-pointer hover:bg-muted/30">
                <RadioGroupItem value="aplicar" />
                <ArrowUpFromLine className="w-4 h-4 text-warning" />
                <span className="text-sm">Aplicar</span>
              </label>
            </RadioGroup>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Valor (R$)</label>
            <Input type="number" step="0.01" min="0" max={max} value={amount}
              onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
            <p className="text-[11px] text-muted-foreground mt-1">Máx. disponível: {fmt(max)}</p>
          </div>

          <div>
            <label className="text-sm font-medium mb-1.5 block">Descrição (opcional)</label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} maxLength={120} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => mut.mutate()} disabled={mut.isPending || !amount}>Confirmar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
