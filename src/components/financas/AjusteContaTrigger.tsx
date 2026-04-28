import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings2, Pencil } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { AjusteValorDialog, type AjusteCampo } from "./AjusteValorDialog";

interface Props {
  campo: AjusteCampo;
  /** Se true mostra como botão pequeno no canto do card (ícone só) */
  iconOnly?: boolean;
}

const CAMPO_LABEL: Record<AjusteCampo, string> = {
  saldo: "Saldo",
  investimento: "Investimento",
  fatura: "Fatura cartão",
  limite_cheque_especial: "Limite cheque especial",
};

const CAMPO_VALOR_KEY: Record<AjusteCampo, (c: any) => number> = {
  saldo: (c) => Number(c.saldo_inicial || 0) + Number(c.saldo_sincronizado || 0) + Number(c.saldo_ajuste_manual || 0),
  investimento: (c) => Number(c.investimento_sincronizado || 0) + Number(c.investimento_ajuste_manual || 0) + Number(c.saldo_investimento || 0),
  fatura: (c) => Number(c.fatura_aberto_sincronizada || 0) + Number(c.fatura_aberto_ajuste_manual || 0),
  limite_cheque_especial: (c) => Number(c.limite_cheque_especial || 0),
};

const CAMPO_SYNC_KEY: Record<AjusteCampo, (c: any) => number> = {
  saldo: (c) => Number(c.saldo_inicial || 0) + Number(c.saldo_sincronizado || 0),
  investimento: (c) => Number(c.investimento_sincronizado || 0) + Number(c.saldo_investimento || 0),
  fatura: (c) => Number(c.fatura_aberto_sincronizada || 0),
  limite_cheque_especial: (c) => Number(c.limite_cheque_especial_sincronizado || 0),
};

/**
 * Botão que abre seletor de conta -> dialog de ajuste manual.
 * Permite que o usuário ajuste qualquer campo financeiro de qualquer conta,
 * mesmo com integração ativa. Os ajustes são preservados nos próximos syncs.
 */
export function AjusteContaTrigger({ campo, iconOnly = true }: Props) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const [openSeletor, setOpenSeletor] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState<any | null>(null);

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-bancarias", empresaId, "para-ajuste"],
    enabled: openSeletor && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data || [];
    },
  });

  return (
    <>
      <Button
        size="icon"
        variant="ghost"
        className="h-6 w-6 text-muted-foreground/60 hover:text-foreground"
        onClick={() => setOpenSeletor(true)}
        title={`Ajustar ${CAMPO_LABEL[campo]} manualmente`}
      >
        {iconOnly ? <Pencil className="h-3 w-3" /> : <Settings2 className="h-3 w-3" />}
      </Button>

      <Dialog open={openSeletor} onOpenChange={setOpenSeletor}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar {CAMPO_LABEL[campo]}</DialogTitle>
            <DialogDescription className="text-xs">
              Selecione a conta. O ajuste será preservado nos próximos sincronismos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 max-h-[60vh] overflow-y-auto py-2">
            {contas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">Nenhuma conta cadastrada.</p>
            )}
            {contas.map((c: any) => (
              <button
                key={c.id}
                onClick={() => { setContaSelecionada(c); setOpenSeletor(false); }}
                className="w-full text-left rounded-md border p-3 hover:bg-accent transition flex items-center justify-between"
              >
                <div>
                  <p className="font-medium text-sm">{c.nome}</p>
                  <p className="text-xs text-muted-foreground">{c.banco || "—"} · {c.origem === "pluggy" ? "Open Finance" : "Manual"}</p>
                </div>
                <span className="text-sm tabular-nums font-medium">
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(CAMPO_VALOR_KEY[campo](c))}
                </span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {contaSelecionada && (
        <AjusteValorDialog
          open={!!contaSelecionada}
          onOpenChange={(v) => !v && setContaSelecionada(null)}
          contaId={contaSelecionada.id}
          contaNome={contaSelecionada.nome}
          campo={campo}
          valorAtual={CAMPO_VALOR_KEY[campo](contaSelecionada)}
          valorSincronizado={CAMPO_SYNC_KEY[campo](contaSelecionada)}
          origem={contaSelecionada.origem}
        />
      )}
    </>
  );
}
