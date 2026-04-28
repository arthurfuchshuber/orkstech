import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { refreshQueries } from "@/lib/refreshQueries";

export type AjusteCampo = "saldo" | "investimento" | "fatura" | "limite_cheque_especial";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contaId: string;
  contaNome: string;
  campo: AjusteCampo;
  valorAtual: number;
  valorSincronizado?: number;
  origem?: string | null;
}

const TITULOS: Record<AjusteCampo, string> = {
  saldo: "Ajustar saldo da conta",
  investimento: "Ajustar valor investido",
  fatura: "Ajustar fatura em aberto",
  limite_cheque_especial: "Ajustar limite do cheque especial",
};

const HELPS: Record<AjusteCampo, string> = {
  saldo: "O ajuste preserva o saldo vindo da integração e adiciona/subtrai a diferença para refletir a realidade.",
  investimento: "Útil quando você tem investimentos fora do Open Finance ou precisa corrigir um valor.",
  fatura: "Use para ajustar a fatura quando há lançamentos manuais ou divergência da integração.",
  limite_cheque_especial: "Limite total disponibilizado pelo banco. Editado livremente.",
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

export function AjusteValorDialog({
  open, onOpenChange, contaId, contaNome, campo, valorAtual, valorSincronizado, origem,
}: Props) {
  const [valor, setValor] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setValor((valorAtual || 0).toFixed(2).replace(".", ","));
      setMotivo("");
    }
  }, [open, valorAtual]);

  const handleSalvar = async () => {
    const numerico = Number(valor.replace(/\./g, "").replace(",", "."));
    if (isNaN(numerico)) {
      toast.error("Valor inválido");
      return;
    }
    setSalvando(true);
    const { error } = await supabase.rpc("aplicar_ajuste_conta_bancaria", {
      p_conta_id: contaId,
      p_campo: campo,
      p_novo_valor: numerico,
      p_motivo: motivo || null,
    });
    setSalvando(false);
    if (error) {
      toast.error("Erro ao ajustar: " + error.message);
      return;
    }
    toast.success("Ajuste aplicado com sucesso");
    await refreshQueries(["contas-bancarias", "dashboard", "fluxo-caixa", "extrato-bancario", "pluggy"]);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{TITULOS[campo]}</DialogTitle>
          <DialogDescription className="text-xs">{contaNome}</DialogDescription>
        </DialogHeader>

        <Alert className="border-primary/20 bg-primary/5">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">{HELPS[campo]}</AlertDescription>
        </Alert>

        {origem && origem !== "manual" && valorSincronizado !== undefined && campo !== "limite_cheque_especial" && (
          <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Sincronizado:</span><span className="font-medium">{formatBRL(valorSincronizado)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Valor efetivo atual:</span><span className="font-medium">{formatBRL(valorAtual)}</span></div>
          </div>
        )}

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="ajuste-valor">Novo valor (R$)</Label>
            <Input
              id="ajuste-valor"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ajuste-motivo">Motivo do ajuste (opcional)</Label>
            <Textarea
              id="ajuste-motivo"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ex.: rendimento de outubro não refletido, depósito em dinheiro, etc."
              rows={2}
              maxLength={200}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={salvando}>Cancelar</Button>
          <Button onClick={handleSalvar} disabled={salvando}>{salvando ? "Salvando..." : "Aplicar ajuste"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
