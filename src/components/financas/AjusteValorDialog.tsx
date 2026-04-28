import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Info, AlertTriangle, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { refreshQueries } from "@/lib/query-refresh";

export type AjusteCampo = "saldo" | "investimento" | "fatura" | "limite_cheque_especial" | "limite_credito";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  contaId: string;
  contaNome: string;
  campo: AjusteCampo;
  valorAtual: number;
  valorSincronizado?: number;
  origem?: string | null;
  /** Cartão de crédito: limite total contratado (necessário para reconciliação fatura ↔ disponível) */
  limiteCreditoTotal?: number;
  /** Cartão de crédito: fatura em aberto atual */
  faturaAtual?: number;
  /** Cartão de crédito: limite disponível atual */
  disponivelAtual?: number;
}

const TITULOS: Record<AjusteCampo, string> = {
  saldo: "Ajustar saldo da conta",
  investimento: "Ajustar valor investido",
  fatura: "Ajustar fatura em aberto",
  limite_cheque_especial: "Ajustar limite do cheque especial",
  limite_credito: "Ajustar limite disponível do cartão",
};

const HELPS: Record<AjusteCampo, string> = {
  saldo: "Mostraremos a diferença entre o valor que você informou e a soma dos lançamentos do extrato. Você decide como tratar.",
  investimento: "Útil quando você tem investimentos fora do Open Finance ou precisa corrigir um valor.",
  fatura: "Use para ajustar a fatura quando há lançamentos manuais ou divergência da integração.",
  limite_cheque_especial: "Limite total disponibilizado pelo banco. Editado livremente.",
  limite_credito: "Limite disponível atual do cartão (limite total menos o que já foi consumido). Para cartões conectados via Open Finance este valor vem do banco.",
};

const formatBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

// Reconciliação só faz sentido para o saldo (que tem extrato contábil)
const TEM_RECONCILIACAO = (campo: AjusteCampo) => campo === "saldo";

type Estrategia = "criar_lancamento" | "manter_divergencia";

export function AjusteValorDialog({
  open, onOpenChange, contaId, contaNome, campo, valorAtual, valorSincronizado, origem,
  limiteCreditoTotal, faturaAtual, disponivelAtual,
}: Props) {
  const queryClient = useQueryClient();
  const [valor, setValor] = useState<string>("");
  const [motivo, setMotivo] = useState<string>("");
  const [salvando, setSalvando] = useState(false);
  const [valorEsperado, setValorEsperado] = useState<number | null>(null);
  const [estrategia, setEstrategia] = useState<Estrategia>("criar_lancamento");
  const [carregandoEsperado, setCarregandoEsperado] = useState(false);
  const [limiteTotal, setLimiteTotal] = useState<string>("");

  const ehCartao = campo === "limite_credito" || campo === "fatura";

  useEffect(() => {
    if (open) {
      setValor((valorAtual || 0).toFixed(2).replace(".", ","));
      setMotivo("");
      setEstrategia("criar_lancamento");
      setValorEsperado(null);
      // Inicializa limite total: usa o salvo, ou deduz por (disponivel + fatura)
      const limiteInicial = limiteCreditoTotal && limiteCreditoTotal > 0
        ? limiteCreditoTotal
        : (disponivelAtual || 0) + (faturaAtual || 0);
      setLimiteTotal(limiteInicial.toFixed(2).replace(".", ","));

      // Carrega valor esperado (calculado via lançamentos) para reconciliação
      if (TEM_RECONCILIACAO(campo)) {
        setCarregandoEsperado(true);
        supabase.rpc("calcular_saldo_esperado_conta", { p_conta_id: contaId }).then(({ data, error }) => {
          if (!error && data !== null) setValorEsperado(Number(data));
          setCarregandoEsperado(false);
        });
      }
    }
  }, [open, valorAtual, contaId, campo, limiteCreditoTotal, disponivelAtual, faturaAtual]);

  const numerico = Number(String(valor).replace(/\./g, "").replace(",", "."));
  const valorValido = !isNaN(numerico);
  const limiteTotalNum = Number(String(limiteTotal).replace(/\./g, "").replace(",", "."));
  const limiteTotalValido = !isNaN(limiteTotalNum) && limiteTotalNum >= 0;

  // Prévia da reconciliação para cartão (limite_credito ↔ fatura)
  const previaCartao = ehCartao && valorValido && limiteTotalValido ? (() => {
    if (campo === "limite_credito") {
      const novaFatura = limiteTotalNum - numerico;
      const deltaFatura = novaFatura - (faturaAtual || 0);
      return { novoDisponivel: numerico, novaFatura, deltaFatura, novoLimiteTotal: limiteTotalNum };
    } else {
      const novoDisponivel = limiteTotalNum - numerico;
      const deltaFatura = numerico - (faturaAtual || 0);
      return { novoDisponivel, novaFatura: numerico, deltaFatura, novoLimiteTotal: limiteTotalNum };
    }
  })() : null;

  const cartaoExcedeLimite = ehCartao && valorValido && limiteTotalValido && numerico > limiteTotalNum;

  // Delta = quanto falta no extrato para chegar no valor informado
  const deltaReconciliacao = valorEsperado !== null && valorValido ? numerico - valorEsperado : 0;
  const temDivergencia = TEM_RECONCILIACAO(campo) && valorEsperado !== null && Math.abs(deltaReconciliacao) > 0.005;

  const handleSalvar = async () => {
    if (!valorValido) {
      toast.error("Valor inválido");
      return;
    }
    if (ehCartao && !limiteTotalValido) {
      toast.error("Informe o limite total contratado do cartão");
      return;
    }
    if (cartaoExcedeLimite) {
      toast.error("O valor não pode ser maior que o limite total do cartão");
      return;
    }
    setSalvando(true);
    try {
      // Caso 1: campos sem reconciliação contábil — fluxo legado (ajuste_manual)
      // OBS: cartões (limite_credito / fatura) já fazem reconciliação no banco
      // (recalculam o par e geram lançamento de ajuste de fatura no extrato).
      if (!TEM_RECONCILIACAO(campo)) {
        const payload: any = {
          p_conta_id: contaId,
          p_campo: campo,
          p_novo_valor: numerico,
          p_motivo: motivo || null,
        };
        if (ehCartao) payload.p_limite_total = limiteTotalNum;
        const { error } = await supabase.rpc("aplicar_ajuste_conta_bancaria", payload);
        if (error) throw error;
      } else {
        // Caso 2: saldo — pode haver divergência
        if (!temDivergencia) {
          toast.info("Saldo já está reconciliado — nada a alterar");
          setSalvando(false);
          onOpenChange(false);
          return;
        }

        if (estrategia === "criar_lancamento") {
          const { error } = await supabase.rpc("criar_lancamento_ajuste_saldo", {
            p_conta_id: contaId,
            p_delta: deltaReconciliacao,
            p_motivo: motivo || null,
          });
          if (error) throw error;
        } else {
          const { error } = await supabase.rpc("aplicar_ajuste_conta_bancaria", {
            p_conta_id: contaId,
            p_campo: campo,
            p_novo_valor: numerico,
            p_motivo: motivo || "Ajuste sem lançamento contábil",
          });
          if (error) throw error;
        }
      }

      toast.success("Ajuste aplicado com sucesso");
      await refreshQueries(queryClient, [
        ["contas-bancarias"], ["dashboard"], ["fluxo-caixa"],
        ["extrato-bancario"], ["pluggy"], ["cash_transactions"],
        ["accounts-payable"], ["accounts-receivable"], ["dre"],
      ]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error("Erro ao ajustar: " + (e?.message || String(e)));
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
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
            <Label htmlFor="ajuste-valor">Saldo real informado por você (R$)</Label>
            <Input
              id="ajuste-valor"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              inputMode="decimal"
            />
          </div>

          {/* Reconciliação — apenas para o campo "saldo" */}
          {TEM_RECONCILIACAO(campo) && (
            <>
              {carregandoEsperado && (
                <div className="text-xs text-muted-foreground">Calculando saldo esperado...</div>
              )}

              {!carregandoEsperado && valorEsperado !== null && !temDivergencia && (
                <Alert className="border-emerald-500/30 bg-emerald-500/5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <AlertDescription className="text-xs">
                    O valor informado bate exatamente com a soma do extrato ({formatBRL(valorEsperado)}). Sem divergências.
                  </AlertDescription>
                </Alert>
              )}

              {!carregandoEsperado && temDivergencia && (
                <Alert variant="destructive" className="border-amber-500/40 bg-amber-500/5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs space-y-1">
                    <div className="font-semibold">Divergência detectada</div>
                    <div className="grid grid-cols-2 gap-1 mt-1">
                      <span>Soma do extrato:</span>
                      <span className="text-right tabular-nums">{formatBRL(valorEsperado!)}</span>
                      <span>Saldo informado:</span>
                      <span className="text-right tabular-nums">{formatBRL(numerico)}</span>
                      <span className="font-semibold">Diferença:</span>
                      <span className="text-right tabular-nums font-semibold">
                        {deltaReconciliacao > 0 ? "+" : ""}{formatBRL(deltaReconciliacao)}
                      </span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}

              {temDivergencia && (
                <div className="space-y-2">
                  <Label className="text-xs">Como resolver a divergência?</Label>
                  <RadioGroup value={estrategia} onValueChange={(v: any) => setEstrategia(v)}>
                    <label htmlFor="es-criar" className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent/50 has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                      <RadioGroupItem value="criar_lancamento" id="es-criar" className="mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Criar lançamento de ajuste no extrato (recomendado)</div>
                        <div className="text-[11px] text-muted-foreground">
                          Cria uma transação "Ajuste de Saldo" de {formatBRL(Math.abs(deltaReconciliacao))} {deltaReconciliacao > 0 ? "(entrada)" : "(saída)"} no extrato. Dashboard, DRE e fluxo continuam batendo.
                        </div>
                      </div>
                    </label>
                    <label htmlFor="es-manter" className="flex items-start gap-2 rounded-md border p-3 cursor-pointer hover:bg-accent/50 has-[:checked]:border-amber-500 has-[:checked]:bg-amber-500/5">
                      <RadioGroupItem value="manter_divergencia" id="es-manter" className="mt-0.5" />
                      <div className="space-y-0.5">
                        <div className="text-sm font-medium">Apenas ajustar o card (manter divergência)</div>
                        <div className="text-[11px] text-muted-foreground">
                          O card mostra o valor informado, mas o extrato continua sem essa entrada. Um badge âmbar de "Divergência" aparecerá até você reconciliar.
                        </div>
                      </div>
                    </label>
                  </RadioGroup>
                </div>
              )}
            </>
          )}

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
          <Button onClick={handleSalvar} disabled={salvando || !valorValido}>
            {salvando ? "Salvando..." : "Aplicar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
