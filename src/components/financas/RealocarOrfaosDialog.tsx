import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Plus, Trash2, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { useOrfaosFinanceiros } from "@/hooks/useOrfaosFinanceiros";
import { refreshQueries } from "@/lib/query-refresh";
import { ContaBancariaModal } from "@/components/modals/ContaBancariaModal";

interface Linha {
  bank_account_id: string;
  valor: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const NEW_ACCOUNT_TOKEN = "__new__";

export function RealocarOrfaosDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const targetUserId = empresa?.user_id ?? user?.id;
  const queryClient = useQueryClient();

  const { data: orfaos, isLoading: loadingOrfaos } = useOrfaosFinanceiros();

  const { data: contas = [], refetch: refetchContas } = useQuery({
    queryKey: ["realocar-contas", targetUserId, empresaId],
    enabled: open && !!targetUserId,
    queryFn: async () => {
      let q = supabase
        .from("contas_bancarias")
        .select("id, nome, tipo, banco")
        .eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      else q = q.eq("user_id", targetUserId!);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const [linhas, setLinhas] = useState<Linha[]>([]);
  const [motivo, setMotivo] = useState("");
  // Modal original de Conta Bancária para criar/editar contas e cartões
  const [contaModalOpen, setContaModalOpen] = useState(false);
  const [linhaPendenteIdx, setLinhaPendenteIdx] = useState<number | null>(null);
  const [salvando, setSalvando] = useState(false);

  const totalOrfao = orfaos?.saldoLiquido ?? 0;
  const breakdown = orfaos?.breakdown;

  useEffect(() => {
    if (open) {
      setLinhas([{ bank_account_id: "", valor: 0 }]);
      setMotivo("");
      setLinhaPendenteIdx(null);
    }
  }, [open]);

  const totalAlocado = useMemo(
    () => linhas.reduce((s, l) => s + Number(l.valor || 0), 0),
    [linhas]
  );
  const diff = totalOrfao - totalAlocado;
  const podeSalvar =
    Math.abs(diff) < 0.01 &&
    linhas.every((l) => l.bank_account_id && l.bank_account_id !== NEW_ACCOUNT_TOKEN && l.valor > 0);

  const addLinha = () => setLinhas((p) => [...p, { bank_account_id: "", valor: 0 }]);
  const removeLinha = (i: number) => setLinhas((p) => p.filter((_, idx) => idx !== i));
  const updateLinha = (i: number, patch: Partial<Linha>) =>
    setLinhas((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  function handleSelectChange(i: number, value: string) {
    if (value === NEW_ACCOUNT_TOKEN) {
      // Abre o modal ORIGINAL de conta bancária
      setLinhaPendenteIdx(i);
      setContaModalOpen(true);
      return;
    }
    updateLinha(i, { bank_account_id: value });
  }

  async function handleContaCriada(novaContaId: string) {
    await refetchContas();
    if (linhaPendenteIdx !== null) {
      updateLinha(linhaPendenteIdx, { bank_account_id: novaContaId });
      setLinhaPendenteIdx(null);
    }
  }

  async function handleSalvar() {
    if (!podeSalvar) {
      toast.error(`Soma das alocações precisa bater com ${fmt(totalOrfao)}`);
      return;
    }
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("realocar_lancamentos_orfaos", {
        p_alocacoes: linhas.map((l) => ({
          bank_account_id: l.bank_account_id,
          valor: Number(l.valor),
        })),
        p_motivo: motivo || null,
      } as any);
      if (error) throw error;
      toast.success("Valores realocados com sucesso!");
      await refreshQueries(queryClient, [
        ["orfaos-financeiros"],
        ["dashboard-manual-accounts"],
        ["dashboard-manual-tx"],
        ["dashboard-manual-tx-all"],
      ]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao realocar valores");
    } finally {
      setSalvando(false);
    }
  }

  const breakdownItems = breakdown
    ? [
        { label: "Saldo de lançamentos sem conta", value: breakdown.saldoLancamentos },
        { label: "Saldo de contas excluídas", value: breakdown.saldoContasInativas },
        { label: "Investimentos", value: breakdown.investimentos },
        { label: "Faturas de cartão", value: breakdown.faturasCartao, info: true },
        { label: "Limite de crédito", value: breakdown.limiteCredito, info: true },
        { label: "Cheque especial", value: breakdown.chequeEspecial, info: true },
      ].filter((b) => Math.abs(b.value) > 0.01)
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Realocar valores órfãos
          </DialogTitle>
          <DialogDescription>
            Detectamos lançamentos e snapshots sem conta vinculada (totalizando{" "}
            <span className="font-semibold text-foreground">{fmt(totalOrfao)}</span>).
            Distribua o saldo entre as contas abaixo. A soma das alocações precisa bater com o total.
          </DialogDescription>
        </DialogHeader>

        {loadingOrfaos ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Resumo top-level */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Total a realocar</div>
                <div className="font-semibold text-foreground">{fmt(totalOrfao)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Alocado</div>
                <div className="font-semibold text-foreground">{fmt(totalAlocado)}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Diferença</div>
                <div
                  className={`font-semibold ${
                    Math.abs(diff) < 0.01 ? "text-emerald-500" : "text-amber-500"
                  }`}
                >
                  {fmt(diff)}
                </div>
              </div>
            </div>

            {/* Breakdown detalhado */}
            {breakdownItems.length > 0 && (
              <div className="rounded-lg border border-border/60 p-4 space-y-2">
                <div className="text-xs uppercase tracking-wider text-muted-foreground font-medium">
                  Composição dos valores órfãos
                </div>
                <div className="space-y-1.5">
                  {breakdownItems.map((b) => (
                    <div key={b.label} className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-2">
                        {b.label}
                        {b.info && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                            informativo
                          </Badge>
                        )}
                      </span>
                      <span className="font-medium tabular-nums text-foreground">{fmt(b.value)}</span>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-muted-foreground pt-2 border-t border-border/40">
                  Apenas saldos e investimentos entram na soma de realocação. Faturas e limites são preservados nas próprias contas excluídas e ficam visíveis no extrato histórico.
                </p>
              </div>
            )}

            {/* Linhas de alocação */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Distribuição entre contas</Label>
                <Button type="button" variant="ghost" size="sm" onClick={addLinha}>
                  <Plus className="h-4 w-4 mr-1" /> Adicionar conta
                </Button>
              </div>
              {linhas.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <select
                    className="flex-1 h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={l.bank_account_id}
                    onChange={(e) => handleSelectChange(i, e.target.value)}
                  >
                    <option value="">Selecione uma conta…</option>
                    {contas.map((c: any) => {
                      const tipoLabel = c.tipo === "cartao_credito"
                        ? "Cartão"
                        : c.tipo === "corrente" ? "Corrente"
                        : c.tipo === "poupanca" ? "Poupança"
                        : c.tipo === "caixa" ? "Caixa"
                        : c.tipo === "carteira_digital" ? "Carteira" : c.tipo;
                      return (
                        <option key={c.id} value={c.id}>
                          [{tipoLabel}] {c.nome} {c.banco ? `· ${c.banco}` : ""}
                        </option>
                      );
                    })}
                    <option value={NEW_ACCOUNT_TOKEN}>+ Cadastrar nova conta / cartão…</option>
                  </select>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="0,00"
                    value={l.valor || ""}
                    onChange={(e) => updateLinha(i, { valor: Number(e.target.value) })}
                    className="w-36"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeLinha(i)}
                    disabled={linhas.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            {/* Motivo */}
            <div className="space-y-2">
              <Label htmlFor="motivo-realocacao">Motivo (opcional)</Label>
              <Input
                id="motivo-realocacao"
                value={motivo}
                onChange={(e) => setMotivo(e.target.value)}
                maxLength={60}
                placeholder="Ex: Migração após exclusão da conta XYZ"
              />
            </div>

            <Badge variant="outline" className="border-amber-500/40 text-amber-500">
              Os lançamentos órfãos serão marcados como transferência interna e não impactarão o DRE novamente.
            </Badge>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={!podeSalvar || salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Realocar {fmt(totalOrfao)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Modal ORIGINAL de cadastro de conta/cartão */}
    <ContaBancariaModal
      open={contaModalOpen}
      onOpenChange={(v) => {
        setContaModalOpen(v);
        if (!v) setLinhaPendenteIdx(null);
      }}
      onSaved={handleContaCriada}
    />
    </>
  );
}
