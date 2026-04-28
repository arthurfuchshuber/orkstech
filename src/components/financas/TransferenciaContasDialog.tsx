import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { refreshQueries } from "@/lib/query-refresh";
import { format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  defaultOrigemId?: string;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

export function TransferenciaContasDialog({ open, onOpenChange, defaultOrigemId }: Props) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const targetUserId = empresa?.user_id ?? user?.id;
  const queryClient = useQueryClient();

  const [origemId, setOrigemId] = useState<string>("");
  const [destinoId, setDestinoId] = useState<string>("");
  const [valor, setValor] = useState<number>(0);
  const [data, setData] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [descricao, setDescricao] = useState<string>("");
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (open) {
      setOrigemId(defaultOrigemId ?? "");
      setDestinoId("");
      setValor(0);
      setDescricao("");
      setData(format(new Date(), "yyyy-MM-dd"));
    }
  }, [open, defaultOrigemId]);

  const { data: contas = [] } = useQuery({
    queryKey: ["transferencia-contas", targetUserId, empresaId],
    enabled: open && !!targetUserId,
    queryFn: async () => {
      let q = supabase
        .from("contas_bancarias")
        .select("id, nome, tipo, banco, saldo_inicial, saldo_sincronizado, saldo_ajuste_manual")
        .eq("ativo", true)
        // Cartão de crédito não participa de transferência entre contas
        .neq("tipo", "cartao_credito");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      else q = q.eq("user_id", targetUserId!);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Helper: encurta nomes muito longos / institucionais para exibição no select
  // Ex.: "Nu Pagamentos S.A. - Instituição de Pagamento · Nu Pagamentos S.A. - Instituição de Pagamento (Conta Pré-paga)"
  //  → "Nubank"
  const shortNomeBanco = (raw: string) => {
    const s = (raw || "").trim();
    if (!s) return "";
    const lower = s.toLowerCase();
    if (lower.includes("nu pagamentos") || lower.includes("nubank")) return "Nubank";
    if (lower.includes("btg")) return "BTG";
    if (lower.includes("itau") || lower.includes("itaú")) return "Itaú";
    if (lower.includes("bradesco")) return "Bradesco";
    if (lower.includes("santander")) return "Santander";
    if (lower.includes("inter")) return "Banco Inter";
    if (lower.includes("caixa")) return "Caixa";
    if (lower.includes("banco do brasil") || /\bbb\b/.test(lower)) return "Banco do Brasil";
    if (lower.includes("c6")) return "C6 Bank";
    if (lower.includes("sicoob")) return "Sicoob";
    if (lower.includes("sicredi")) return "Sicredi";
    // Fallback: corta antes de S.A. / Ltda / hífen / parênteses
    const cut = s.split(/\s+(?:S\.?A\.?|S\/A|LTDA|ME|EIRELI)\b|[-–·(]/i)[0].trim();
    return cut.length > 28 ? cut.slice(0, 28) + "…" : cut;
  };

  const labelConta = (c: any) => {
    const nome = shortNomeBanco(c.nome || "");
    const banco = shortNomeBanco(c.banco || "");
    if (!banco || nome === banco || nome.toLowerCase().includes(banco.toLowerCase())) return nome;
    return `${nome} · ${banco}`;
  };

  const podeSalvar =
    !!origemId && !!destinoId && origemId !== destinoId && valor > 0;

  async function handleSalvar() {
    if (!podeSalvar) return;
    setSalvando(true);
    try {
      const { error } = await supabase.rpc("criar_transferencia_entre_contas", {
        p_conta_origem: origemId,
        p_conta_destino: destinoId,
        p_valor: valor,
        p_data: data,
        p_descricao: descricao || null,
      } as any);
      if (error) throw error;
      toast.success("Transferência criada com sucesso!");
      await refreshQueries(queryClient, [
        ["dashboard-manual-accounts"],
        ["dashboard-manual-tx"],
        ["dashboard-manual-tx-all"],
        ["cash_transactions"],
      ]);
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Erro ao criar transferência");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Transferência entre contas
          </DialogTitle>
          <DialogDescription>
            Movimenta valor entre 2 contas. Cria 2 lançamentos espelhados marcados como
            transferência interna — não impacta o DRE, apenas os saldos.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Conta de origem</Label>
            <Select value={origemId} onValueChange={setOrigemId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent className="max-w-[--radix-select-trigger-width]">
                {contas.map((c: any) => (
                  <SelectItem key={c.id} value={c.id} disabled={c.id === destinoId}>
                    <span className="block truncate max-w-[420px]">{labelConta(c)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Conta de destino</Label>
            <Select value={destinoId} onValueChange={setDestinoId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Selecione…" />
              </SelectTrigger>
              <SelectContent className="max-w-[--radix-select-trigger-width]">
                {contas.map((c: any) => (
                  <SelectItem key={c.id} value={c.id} disabled={c.id === origemId}>
                    <span className="block truncate max-w-[420px]">{labelConta(c)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Valor</Label>
              <Input
                type="number"
                step="0.01"
                value={valor || ""}
                onChange={(e) => setValor(Number(e.target.value))}
                placeholder="0,00"
              />
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input
                type="date"
                value={data}
                onChange={(e) => setData(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição (opcional)</Label>
            <Input
              value={descricao}
              maxLength={60}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Reforço para pagamento de boletos"
            />
          </div>

          {podeSalvar && (
            <div className="rounded-md border border-border bg-muted/30 p-3 text-sm">
              Será debitado <span className="font-semibold">{fmt(valor)}</span> de{" "}
              <span className="font-semibold">{contas.find((c: any) => c.id === origemId)?.nome}</span>{" "}
              e creditado o mesmo valor em{" "}
              <span className="font-semibold">{contas.find((c: any) => c.id === destinoId)?.nome}</span>.
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSalvar} disabled={!podeSalvar || salvando}>
            {salvando ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Transferir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
