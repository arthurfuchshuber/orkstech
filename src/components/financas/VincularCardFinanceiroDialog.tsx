import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { ManagedSelectInput } from "@/components/inputs/ManagedSelectInput";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { refreshQueries } from "@/lib/query-refresh";
import { shortNomeBanco } from "@/lib/format-conta-bancaria";
import { Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export type CardVinculoTipo = "saldo" | "investimento" | "limite_credito" | "fatura" | "limite_cheque_especial" | "contas_pagar" | "contas_receber";

type Linha = { bank_account_id: string; valor: number };

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cardTipo: CardVinculoTipo;
  total: number;
  titulo?: string;
}

const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v || 0);

const CARD_LABEL: Record<CardVinculoTipo, string> = {
  saldo: "Saldo em Contas",
  investimento: "Investimentos",
  limite_credito: "Limite Disponível",
  fatura: "Faturas em Aberto",
  limite_cheque_especial: "Cheque Especial",
  contas_pagar: "Contas a Pagar",
  contas_receber: "Contas a Receber",
};

const isCardField = (cardTipo: CardVinculoTipo) => cardTipo === "limite_credito" || cardTipo === "fatura";
// Saldo, investimento, cheque especial e contas a receber referem-se a caixa → apenas contas (sem cartões).
// Contas a pagar aceita contas E cartões (pagamentos podem ser feitos via cartão de crédito).
const isAccountOnlyField = (cardTipo: CardVinculoTipo) =>
  ["saldo", "investimento", "limite_cheque_especial", "contas_receber"].includes(cardTipo);

export function VincularCardFinanceiroDialog({ open, onOpenChange, cardTipo, total, titulo }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const targetUserId = empresa?.user_id ?? user?.id;
  const queryClient = useQueryClient();

  const [modo, setModo] = useState<"uma" | "varias">("uma");
  const [linhas, setLinhas] = useState<Linha[]>([{ bank_account_id: "", valor: 0 }]);
  const [motivo, setMotivo] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [contaModalOpen, setContaModalOpen] = useState(false);
  const [linhaPendenteIdx, setLinhaPendenteIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setModo("uma");
    setLinhas([{ bank_account_id: "", valor: Math.abs(total || 0) }]);
    setMotivo("");
    setLinhaPendenteIdx(null);
  }, [open, total, cardTipo]);

  const { data: contas = [], refetch: refetchContas } = useQuery({
    queryKey: ["vincular-card-contas", targetUserId, empresaId, cardTipo],
    enabled: open && !!targetUserId,
    queryFn: async () => {
      let q = supabase.from("contas_bancarias").select("id, nome, tipo, banco").eq("ativo", true).order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      else q = q.eq("user_id", targetUserId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((c: any) => {
        const ehCartao = c.tipo === "cartao_credito";
        if (isCardField(cardTipo)) return ehCartao;
        if (isAccountOnlyField(cardTipo)) return !ehCartao;
        return true;
      });
    },
  });

  const options = useMemo(
    () => contas.map((c: any) => {
      const nome = shortNomeBanco(c.nome) || "Conta";
      const banco = shortNomeBanco(c.banco);
      const tipo = c.tipo === "cartao_credito" ? "Cartão" : "Conta";
      const label = banco && banco !== nome ? `${tipo} · ${nome} · ${banco}` : `${tipo} · ${nome}`;
      return { value: c.id, label, tooltip: `${c.nome}${c.banco ? ` · ${c.banco}` : ""}` };
    }),
    [contas]
  );

  const totalAlocado = useMemo(() => linhas.reduce((s, l) => s + Number(l.valor || 0), 0), [linhas]);
  const diff = Math.abs(total || 0) - totalAlocado;
  const podeSalvar = Math.abs(diff) < 0.01 && linhas.every((l) => l.bank_account_id && Number(l.valor) > 0);

  const updateLinha = (idx: number, patch: Partial<Linha>) => setLinhas((old) => old.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLinha = () => setLinhas((old) => [...old, { bank_account_id: "", valor: 0 }]);
  const removeLinha = (idx: number) => setLinhas((old) => old.filter((_, i) => i !== idx));

  const handleContaCriada = async (id: string) => {
    await refetchContas();
    if (linhaPendenteIdx !== null) updateLinha(linhaPendenteIdx, { bank_account_id: id });
    setLinhaPendenteIdx(null);
  };

  const handleSalvar = async () => {
    if (!podeSalvar || !empresaId) return;
    setSalvando(true);
    try {
      const { error } = await (supabase as any).rpc("aplicar_vinculo_card_financeiro", {
        p_card_tipo: cardTipo,
        p_alocacoes: linhas.map((l) => ({ bank_account_id: l.bank_account_id, valor: Number(l.valor) })),
        p_motivo: motivo || null,
        p_empresa_id: empresaId,
      });
      if (error) throw error;
      toast.success("Vínculo aplicado aos registros retroativos e aos próximos lançamentos.");
      await refreshQueries(queryClient, [
        ["orfaos-financeiros"], ["financeiro-card-vinculos"], ["dashboard-manual-accounts"],
        ["dashboard-manual-tx"], ["dashboard-manual-tx-all"], ["dashboard-contas-pagar"],
        ["accounts-payable"], ["accounts-receivable"], ["cash_transactions"], ["dre"],
      ]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Erro ao aplicar vínculo");
    } finally {
      setSalvando(false);
    }
  };

  const precisaCartao = isCardField(cardTipo);
  const entidadeLabel = precisaCartao ? "cartão" : "conta";
  const entidadeLabelPlural = precisaCartao ? "cartões" : "contas";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Link2 className="h-5 w-5" /> Vincular {titulo || CARD_LABEL[cardTipo]}</DialogTitle>
            <DialogDescription>
              Selecione {precisaCartao ? "o cartão responsável" : "a conta responsável"} por {fmt(Math.abs(total || 0))}. O vínculo será aplicado em massa nos registros retroativos sem vínculo e usado nos próximos lançamentos.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="rounded-lg border border-border bg-muted/30 p-4 grid grid-cols-3 gap-4 text-sm">
              <div><div className="text-xs text-muted-foreground">Total do card</div><div className="font-semibold tabular-nums">{fmt(Math.abs(total || 0))}</div></div>
              <div><div className="text-xs text-muted-foreground">Vinculado</div><div className="font-semibold tabular-nums">{fmt(totalAlocado)}</div></div>
              <div><div className="text-xs text-muted-foreground">Diferença</div><div className="font-semibold tabular-nums">{fmt(diff)}</div></div>
            </div>

            <RadioGroup value={modo} onValueChange={(v) => {
              const next = v as "uma" | "varias";
              setModo(next);
              if (next === "uma") setLinhas([{ bank_account_id: linhas[0]?.bank_account_id || "", valor: Math.abs(total || 0) }]);
            }} className="grid grid-cols-2 gap-3">
              <Label className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer">
                <RadioGroupItem value="uma" /> Uma única {entidadeLabel}
              </Label>
              <Label className="flex items-center gap-2 rounded-lg border border-border p-3 cursor-pointer">
                <RadioGroupItem value="varias" /> Mais de {precisaCartao ? "um cartão" : "uma conta"}
              </Label>
            </RadioGroup>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Distribuição do vínculo</Label>
                {modo === "varias" && <Button type="button" variant="ghost" size="sm" onClick={addLinha}><Plus className="h-4 w-4 mr-1" /> Adicionar</Button>}
              </div>
              {linhas.map((linha, idx) => (
                <div key={idx} className="grid grid-cols-[minmax(0,1fr)_140px_36px] gap-2 items-end">
                  <ManagedSelectInput
                    value={linha.bank_account_id}
                    onValueChange={(value) => updateLinha(idx, { bank_account_id: value })}
                    options={options}
                    placeholder={precisaCartao ? "Selecione um cartão…" : "Selecione uma conta…"}
                    onAddModal={() => { setLinhaPendenteIdx(idx); setContaModalOpen(true); }}
                    addLabel={precisaCartao ? "Cadastrar novo cartão" : "Cadastrar nova conta"}
                  />
                  <Input type="number" step="0.01" value={linha.valor || ""} onChange={(e) => updateLinha(idx, { valor: Number(e.target.value) })} disabled={modo === "uma"} />
                  <Button type="button" variant="ghost" size="icon" disabled={linhas.length === 1} onClick={() => removeLinha(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <Label htmlFor="motivo-vinculo-card">Motivo (opcional)</Label>
              <Input id="motivo-vinculo-card" value={motivo} onChange={(e) => setMotivo(e.target.value)} maxLength={60} placeholder="Ex: Vínculo padrão do dashboard" />
            </div>

            <Badge variant="outline" className="border-border text-muted-foreground">
              Com {precisaCartao ? "um único cartão" : "uma única conta"}, o vínculo é aplicado nos registros sem vínculo; com {entidadeLabelPlural === "cartões" ? "múltiplos cartões" : "múltiplas contas"}, a regra de distribuição fica registrada para uso operacional.
            </Badge>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button onClick={handleSalvar} disabled={!podeSalvar || salvando}>
              {salvando && <Loader2 className="h-4 w-4 animate-spin mr-1" />} Vincular {fmt(Math.abs(total || 0))}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ContaBancariaModal
        open={contaModalOpen}
        onOpenChange={(v) => { setContaModalOpen(v); if (!v) setLinhaPendenteIdx(null); }}
        onSaved={handleContaCriada}
        defaultTipo={precisaCartao ? "cartao_credito" : "corrente"}
      />
    </>
  );
}