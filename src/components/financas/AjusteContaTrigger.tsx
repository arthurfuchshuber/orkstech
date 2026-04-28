import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Settings2, Pencil, Plus, Link2, Lock, ArrowRightLeft } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";
import { useNavigate } from "react-router-dom";
import { AjusteValorDialog, type AjusteCampo } from "./AjusteValorDialog";
import { toast } from "sonner";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";
import { RealocarOrfaosDialog } from "./RealocarOrfaosDialog";

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
  limite_credito: "Limite disponível",
};

const CAMPO_VALOR_KEY: Record<AjusteCampo, (c: any) => number> = {
  saldo: (c) => Number(c.saldo_inicial || 0) + Number(c.saldo_sincronizado || 0) + Number(c.saldo_ajuste_manual || 0),
  investimento: (c) => Number(c.investimento_sincronizado || 0) + Number(c.investimento_ajuste_manual || 0) + Number(c.saldo_investimento || 0),
  fatura: (c) => Number(c.fatura_aberto_sincronizada || 0) + Number(c.fatura_aberto_ajuste_manual || 0),
  limite_cheque_especial: (c) => Number(c.limite_cheque_especial || 0),
  limite_credito: (c) => Number(c.limite_credito_disponivel_sincronizado || 0) + Number(c.limite_credito_disponivel_ajuste_manual || 0),
};

const CAMPO_SYNC_KEY: Record<AjusteCampo, (c: any) => number> = {
  saldo: (c) => Number(c.saldo_inicial || 0) + Number(c.saldo_sincronizado || 0),
  investimento: (c) => Number(c.investimento_sincronizado || 0) + Number(c.saldo_investimento || 0),
  fatura: (c) => Number(c.fatura_aberto_sincronizada || 0),
  limite_cheque_especial: (c) => Number(c.limite_cheque_especial_sincronizado || 0),
  limite_credito: (c) => Number(c.limite_credito_disponivel_sincronizado || 0),
};

// Tipos relacionados a cartão de crédito (limite_credito só lista cartões)
const TIPOS_CARTAO = ["cartao_credito", "credito", "cartao"];
const ehCartao = (c: any) => TIPOS_CARTAO.includes(String(c.tipo || "").toLowerCase());

/**
 * Botão que abre seletor de conta -> dialog de ajuste manual.
 */
export function AjusteContaTrigger({ campo, iconOnly = true }: Props) {
  const { empresa } = useEmpresa();
  const navigate = useNavigate();
  const empresaId = empresa?.id;
  const [openSeletor, setOpenSeletor] = useState(false);
  const [contaSelecionada, setContaSelecionada] = useState<any | null>(null);
  const [openCadastro, setOpenCadastro] = useState(false);
  const [openRealocar, setOpenRealocar] = useState(false);

  const { data: contas = [] } = useQuery({
    queryKey: ["contas-bancarias", empresaId, "para-ajuste", campo],
    enabled: openSeletor && !!empresaId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contas_bancarias")
        .select("*")
        .eq("empresa_id", empresaId!)
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      const todas = data || [];
      // Para limite_credito mostra só cartões; demais campos mostram contas que não sejam cartão
      if (campo === "limite_credito") return todas.filter(ehCartao);
      if (campo === "fatura") return todas.filter(ehCartao);
      return todas.filter((c) => !ehCartao(c));
    },
  });

  const isPluggyReadOnly = (c: any) => c.origem === "pluggy"; // Pluggy = fonte da verdade

  const handleSelecionar = (c: any) => {
    if (isPluggyReadOnly(c)) {
      toast.info(
        "Esta conta vem do Open Finance. Os valores são a fonte da verdade do banco e não podem ser editados manualmente.",
      );
      return;
    }
    setContaSelecionada(c);
    setOpenSeletor(false);
  };

  // Mensagens contextuais para o empty state
  const emptyTitulo = campo === "limite_credito" || campo === "fatura"
    ? "Nenhum cartão de crédito cadastrado"
    : "Nenhuma conta cadastrada";
  const emptyDescricao = campo === "limite_credito" || campo === "fatura"
    ? "Para ajustar manualmente, cadastre um cartão de crédito em Cadastros > Contas Bancárias, ou conecte via Open Finance para puxar automaticamente."
    : "Para ajustar manualmente, cadastre uma conta em Cadastros > Contas Bancárias, ou conecte via Open Finance para puxar saldos automaticamente.";

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
              Selecione a conta para ajustar. Contas conectadas via Open Finance ficam bloqueadas (valor vem do banco).
            </DialogDescription>
          </DialogHeader>

          {/* Ações sempre visíveis: realocar para múltiplas contas + cadastrar nova */}
          <div className="flex flex-col sm:flex-row gap-2 pb-2 border-b">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setOpenSeletor(false);
                setOpenRealocar(true);
              }}
            >
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1.5" />
              Realocar para múltiplas contas
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => {
                setOpenSeletor(false);
                setOpenCadastro(true);
              }}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Cadastrar nova
            </Button>
          </div>

          <div className="space-y-1 max-h-[60vh] overflow-y-auto py-2">
            {contas.length === 0 ? (
              <div className="space-y-4 py-4 text-center">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{emptyTitulo}</p>
                  <p className="text-xs text-muted-foreground px-2">{emptyDescricao}</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-2 px-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setOpenSeletor(false);
                      navigate("/app/cadastros/contas-bancarias?tab=open-finance");
                    }}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1.5" />
                    Conectar Open Finance
                  </Button>
                </div>
              </div>
            ) : (
              contas.map((c: any) => {
                const bloqueado = isPluggyReadOnly(c);
                return (
                  <button
                    key={c.id}
                    onClick={() => handleSelecionar(c)}
                    className={`w-full text-left rounded-md border p-3 transition flex items-center justify-between ${
                      bloqueado ? "opacity-60 cursor-not-allowed" : "hover:bg-accent cursor-pointer"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm flex items-center gap-1.5">
                        {bloqueado && <Lock className="h-3 w-3 text-muted-foreground" />}
                        {c.nome}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {c.banco || "—"} · {c.origem === "pluggy" ? "Open Finance (somente leitura)" : "Manual"}
                      </p>
                    </div>
                    <span className="text-sm tabular-nums font-medium ml-2 whitespace-nowrap">
                      {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(CAMPO_VALOR_KEY[campo](c))}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>

      <ContaBancariaModal
        open={openCadastro}
        onOpenChange={setOpenCadastro}
      />

      <RealocarOrfaosDialog
        open={openRealocar}
        onOpenChange={setOpenRealocar}
      />

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
          limiteCreditoTotal={Number(contaSelecionada.limite_credito_total || 0)}
          faturaAtual={
            Number(contaSelecionada.fatura_aberto_sincronizada || 0) +
            Number(contaSelecionada.fatura_aberto_ajuste_manual || 0)
          }
          disponivelAtual={
            Number(contaSelecionada.limite_credito_disponivel_sincronizado || 0) +
            Number(contaSelecionada.limite_credito_disponivel_ajuste_manual || 0)
          }
        />
      )}
    </>
  );
}
