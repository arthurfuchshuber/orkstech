import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  receivableId: string | null;
}

/**
 * Edição bidirecional: alterações locais são enviadas ao Asaas via update_payment.
 * Em caso de falha na API, NADA é gravado localmente (consistência de origem).
 */
export function AsaasCobrancaEditDialog({ open, onOpenChange, receivableId }: Props) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState<string>("");
  const [dueDate, setDueDate] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [scope, setScope] = useState<"single" | "group">("single");

  const { data: rec } = useQuery({
    queryKey: ["asaas_rec_edit", receivableId],
    queryFn: async () => {
      if (!receivableId) return null;
      const { data, error } = await supabase
        .from("accounts_receivable")
        .select("id, amount, due_date, description, grupo_id, status")
        .eq("id", receivableId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!receivableId && open,
  });

  useEffect(() => {
    if (rec) {
      setAmount(String(rec.amount ?? ""));
      setDueDate(rec.due_date ?? "");
      setDescription(rec.description ?? "");
      setScope("single");
    }
  }, [rec]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!receivableId) throw new Error("Sem cobrança");
      const newAmount = parseFloat(amount);
      if (!Number.isFinite(newAmount) || newAmount <= 0) throw new Error("Valor inválido");
      if (!dueDate) throw new Error("Vencimento obrigatório");

      // 1. Atualiza local primeiro (necessário porque a edge function lê do DB)
      const targetIds = scope === "group" && rec?.grupo_id
        ? (await supabase.from("accounts_receivable").select("id").eq("grupo_id", rec.grupo_id)).data?.map((r: any) => r.id) ?? [receivableId]
        : [receivableId];

      const { error: upErr } = await supabase
        .from("accounts_receivable")
        .update({ amount: newAmount, due_date: dueDate, description })
        .in("id", targetIds);
      if (upErr) throw upErr;

      // 2. Sincroniza com Asaas
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "update_payment", receivable_id: receivableId, scope },
      });
      if (error) throw error;
      const failures = (data?.results ?? []).filter((r: any) => !r.success);
      if (failures.length > 0) {
        throw new Error(`Falha ao sincronizar com Asaas: ${failures[0].error || failures[0].reason}`);
      }
      return data;
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["accounts_receivable"] });
      queryClient.invalidateQueries({ queryKey: ["asaas_cobrancas"] });
      toast.success(`Cobrança sincronizada com Asaas (${data?.ok ?? 0} atualizada(s))`);
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar cobrança"),
  });

  const isPaid = rec && ["paid", "received", "confirmed"].includes((rec.status || "").toLowerCase());

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar cobrança Asaas</DialogTitle>
          <DialogDescription>
            Alterações são enviadas ao Asaas em tempo real. Cobranças já recebidas não podem ser editadas.
          </DialogDescription>
        </DialogHeader>

        <Alert>
          <RefreshCw className="h-4 w-4" />
          <AlertDescription className="text-xs">
            Edição bidirecional: o sistema atualizará o registro no Asaas e refletirá a mudança aqui automaticamente.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div>
            <Label>Valor (R$)</Label>
            <Input
              type="number" step="0.01" min="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isPaid}
            />
          </div>
          <div>
            <Label>Vencimento</Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              disabled={isPaid}
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={500}
              rows={2}
              disabled={isPaid}
            />
          </div>

          {rec?.grupo_id && (
            <div>
              <Label>Aplicar em</Label>
              <RadioGroup value={scope} onValueChange={(v: any) => setScope(v)} className="mt-2">
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="single" id="r-single" />
                  <Label htmlFor="r-single" className="font-normal">Apenas esta parcela</Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="group" id="r-group" />
                  <Label htmlFor="r-group" className="font-normal">Todas as parcelas do grupo (não pagas)</Label>
                </div>
              </RadioGroup>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isPaid}>
            {saveMutation.isPending ? "Sincronizando..." : "Salvar e sincronizar com Asaas"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
