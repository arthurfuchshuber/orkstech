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
import { AlertTriangle, Plus, Trash2, Wallet, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { useOrfaosFinanceiros } from "@/hooks/useOrfaosFinanceiros";
import { refreshQueries } from "@/lib/query-refresh";

interface Linha {
  bank_account_id: string;
  valor: number;
}

interface NovaContaDraft {
  nome: string;
  tipo: "corrente" | "poupanca" | "cartao_credito";
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function RealocarOrfaosDialog({ open, onOpenChange }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const targetUserId = empresa?.user_id ?? user?.id;

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
  const [novasContas, setNovasContas] = useState<NovaContaDraft[]>([]);
  const [criandoContas, setCriandoContas] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const totalOrfao = orfaos?.saldoLiquido ?? 0;

  // Inicializa com 1 linha vazia ao abrir
  useEffect(() => {
    if (open) {
      setLinhas([{ bank_account_id: "", valor: 0 }]);
      setNovasContas([]);
      setMotivo("");
    }
  }, [open]);

  const totalAlocado = useMemo(
    () => linhas.reduce((s, l) => s + Number(l.valor || 0), 0),
    [linhas]
  );
  const diff = totalOrfao - totalAlocado;
  const podeSalvar = Math.abs(diff) < 0.01 && linhas.every((l) => l.bank_account_id && l.valor > 0);

  const addLinha = () => setLinhas((p) => [...p, { bank_account_id: "", valor: 0 }]);
  const removeLinha = (i: number) => setLinhas((p) => p.filter((_, idx) => idx !== i));
  const updateLinha = (i: number, patch: Partial<Linha>) =>
    setLinhas((p) => p.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const addNovaConta = () =>
    setNovasContas((p) => [...p, { nome: "", tipo: "corrente" }]);
  const removeNovaConta = (i: number) =>
    setNovasContas((p) => p.filter((_, idx) => idx !== i));
  const updateNovaConta = (i: number, patch: Partial<NovaContaDraft>) =>
    setNovasContas((p) => p.map((c, idx) => (idx === i ? { ...c, ...patch } : c)));

  async function criarContasNovas(): Promise<string[]> {
    if (novasContas.length === 0) return [];
    setCriandoContas(true);
    try {
      const payload = novasContas
        .filter((c) => c.nome.trim().length > 0)
        .map((c) => ({
          user_id: targetUserId!,
          empresa_id: empresaId ?? null,
          nome: c.nome.trim(),
          tipo: c.tipo,
          ativo: true,
          origem: "manual" as const,
        }));
      if (payload.length === 0) return [];
      const { data, error } = await supabase
        .from("contas_bancarias")
        .insert(payload)
        .select("id");
      if (error) throw error;
      await refetchContas();
      return (data ?? []).map((d: any) => d.id);
    } finally {
      setCriandoContas(false);
    }
  }

  async function handleSalvar() {
    if (!podeSalvar) {
      toast.error(`Soma das alocações precisa bater com ${fmt(totalOrfao)}`);
      return;
    }
    setSalvando(true);
    try {
      // Cria contas novas primeiro (se houver placeholders pendentes)
      await criarContasNovas();

      const { error } = await supabase.rpc("realocar_lancamentos_orfaos", {
        p_alocacoes: linhas.map((l) => ({
          bank_account_id: l.bank_account_id,
          valor: Number(l.valor),
        })),
        p_motivo: motivo || null,
      } as any);
      if (error) throw error;
      toast.success("Valores realocados com sucesso!");
      await refreshQueries([
        "orfaos-financeiros",
        "dashboard-manual-accounts",
        "dashboard-manual-tx",
        "dashboard-manual-tx-all",
      ]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao realocar valores");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Realocar valores órfãos
          </DialogTitle>
          <DialogDescription>
            Detectamos lançamentos sem conta bancária vinculada (totalizando{" "}
            <span className="font-semibold text-foreground">{fmt(totalOrfao)}</span>).
            Distribua esse saldo entre as contas abaixo. A soma das alocações precisa
            bater exatamente com o total.
          </DialogDescription>
        </DialogHeader>

        {loadingOrfaos ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Resumo */}
            <div className="rounded-lg border border-border bg-muted/30 p-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Total órfão</div>
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
                    Math.abs(diff) < 0.01
                      ? "text-emerald-500"
                      : "text-amber-500"
                  }`}
                >
                  {fmt(diff)}
                </div>
              </div>
            </div>

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
                    onChange={(e) => updateLinha(i, { bank_account_id: e.target.value })}
                  >
                    <option value="">Selecione uma conta…</option>
                    {contas.map((c: any) => (
                      <option key={c.id} value={c.id}>
                        {c.nome} {c.banco ? `· ${c.banco}` : ""}
                      </option>
                    ))}
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

            {/* Cadastro inline de novas contas */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-sm">Cadastrar contas novas (opcional)</Label>
                <Button type="button" variant="outline" size="sm" onClick={addNovaConta}>
                  <Wallet className="h-4 w-4 mr-1" /> Nova conta
                </Button>
              </div>
              {novasContas.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Não tem a conta certa? Crie aqui mesmo e ela já fica disponível na lista acima depois de salvar.
                </p>
              )}
              {novasContas.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Input
                    placeholder="Nome da conta"
                    value={c.nome}
                    maxLength={60}
                    onChange={(e) => updateNovaConta(i, { nome: e.target.value })}
                    className="flex-1"
                  />
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={c.tipo}
                    onChange={(e) =>
                      updateNovaConta(i, { tipo: e.target.value as NovaContaDraft["tipo"] })
                    }
                  >
                    <option value="corrente">Corrente</option>
                    <option value="poupanca">Poupança</option>
                    <option value="cartao_credito">Cartão de Crédito</option>
                  </select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeNovaConta(i)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              {novasContas.length > 0 && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={async () => {
                    try {
                      const ids = await criarContasNovas();
                      setNovasContas([]);
                      toast.success(`${ids.length} conta(s) criadas`);
                    } catch (e: any) {
                      toast.error(e.message || "Erro ao criar contas");
                    }
                  }}
                  disabled={criandoContas}
                >
                  {criandoContas ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Criar contas agora
                </Button>
              )}
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

            <Badge
              variant="outline"
              className="border-amber-500/40 text-amber-500"
            >
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
  );
}
