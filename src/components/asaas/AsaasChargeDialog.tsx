import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Copy, ExternalLink, RefreshCw, X, FileBarChart2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AsaasChargeDialogProps {
  receivableId: string | null;
  empresaId: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

const STATUS_LABEL: Record<string, { label: string; tone: "default" | "secondary" | "destructive" }> = {
  PENDING: { label: "Aguardando pagamento", tone: "secondary" },
  RECEIVED: { label: "Pago", tone: "default" },
  CONFIRMED: { label: "Confirmado", tone: "default" },
  OVERDUE: { label: "Vencido", tone: "destructive" },
  REFUNDED: { label: "Estornado", tone: "secondary" },
  CANCELED: { label: "Cancelado", tone: "secondary" },
};

const BILLING_LABEL: Record<string, string> = {
  BOLETO: "Boleto",
  PIX: "PIX",
  CREDIT_CARD: "Cartão de Crédito",
  UNDEFINED: "Múltiplas formas",
};

export function AsaasChargeDialog({ receivableId, empresaId, onOpenChange, onChanged }: AsaasChargeDialogProps) {
  const [billingType, setBillingType] = useState<string>("BOLETO");
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const { data: cred } = useQuery({
    queryKey: ["asaas-cred", empresaId],
    queryFn: async () => {
      if (!empresaId) return null;
      const { data } = await supabase
        .from("integracoes_credenciais")
        .select("id, ativo")
        .eq("empresa_id", empresaId)
        .eq("provider", "asaas")
        .eq("ativo", true)
        .maybeSingle();
      return data;
    },
    enabled: !!empresaId,
  });

  const { data: cobranca, refetch } = useQuery({
    queryKey: ["asaas-cobranca-by-receivable", receivableId],
    queryFn: async () => {
      if (!receivableId) return null;
      const { data } = await supabase
        .from("asaas_cobrancas")
        .select("*")
        .eq("account_receivable_id", receivableId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!receivableId,
  });

  useEffect(() => {
    if (!receivableId) {
      setBillingType("BOLETO");
      setGenerating(false);
      setRefreshing(false);
    }
  }, [receivableId]);

  const handleGenerate = async () => {
    if (!receivableId) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "create_payment", receivable_id: receivableId, billing_type: billingType, empresa_id: empresaId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Cobrança gerada no Asaas!");
      await refetch();
      onChanged?.();
    } catch (e) {
      toast.error(`Falha ao gerar: ${(e as Error).message}`);
    } finally {
      setGenerating(false);
    }
  };

  const handleRefresh = async () => {
    if (!cobranca?.id) return;
    setRefreshing(true);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "refresh_payment", cobranca_id: cobranca.id, empresa_id: empresaId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Status atualizado");
      await refetch();
      onChanged?.();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    } finally {
      setRefreshing(false);
    }
  };

  const handleCancel = async () => {
    if (!cobranca?.id) return;
    try {
      const { data, error } = await supabase.functions.invoke("asaas-api", {
        body: { action: "cancel_payment", cobranca_id: cobranca.id, empresa_id: empresaId },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success("Cobrança cancelada");
      setConfirmCancel(false);
      await refetch();
      onChanged?.();
    } catch (e) {
      toast.error(`Erro: ${(e as Error).message}`);
    }
  };

  const copy = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  const statusCfg = cobranca?.status ? STATUS_LABEL[cobranca.status] : null;
  const isActive = cobranca && !["CANCELED", "REFUNDED"].includes(cobranca.status);

  return (
    <>
      <Dialog open={!!receivableId} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileBarChart2 className="w-5 h-5 text-primary" />
              Cobrança Asaas
            </DialogTitle>
            <DialogDescription>
              Gere boletos, PIX ou cobrança por cartão para este lançamento.
            </DialogDescription>
          </DialogHeader>

          {!cred ? (
            <div className="p-4 rounded-lg bg-muted/40 text-sm text-muted-foreground">
              Asaas não está configurado para esta empresa. Acesse{" "}
              <a href="/app/config/integracoes" className="text-primary underline">Configurações → Integrações</a>{" "}
              para conectar.
            </div>
          ) : isActive && cobranca ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Status atual</p>
                  <Badge variant={statusCfg?.tone || "secondary"} className="mt-1">
                    {statusCfg?.label || cobranca.status}
                  </Badge>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Forma</p>
                  <p className="text-sm font-medium">{BILLING_LABEL[cobranca.billing_type] || cobranca.billing_type}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Vencimento</p>
                  <p className="text-sm font-medium">{format(new Date(cobranca.due_date), "dd/MM/yyyy")}</p>
                </div>
              </div>

              {cobranca.invoice_url && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Link de pagamento</p>
                  <div className="flex gap-2">
                    <a
                      href={cobranca.invoice_url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 text-xs font-mono px-3 py-2 rounded-md border border-input bg-background hover:bg-accent flex items-center gap-2 truncate"
                    >
                      <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{cobranca.invoice_url}</span>
                    </a>
                    <Button variant="outline" size="icon" onClick={() => copy(cobranca.invoice_url!, "Link")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {cobranca.identification_field && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">Linha digitável</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs font-mono px-3 py-2 rounded-md border border-input bg-background truncate">
                      {cobranca.identification_field}
                    </code>
                    <Button variant="outline" size="icon" onClick={() => copy(cobranca.identification_field!, "Código")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              {cobranca.pix_payload && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1.5">PIX Copia e Cola</p>
                  <div className="flex gap-2">
                    <code className="flex-1 text-xs font-mono px-3 py-2 rounded-md border border-input bg-background truncate">
                      {cobranca.pix_payload}
                    </code>
                    <Button variant="outline" size="icon" onClick={() => copy(cobranca.pix_payload!, "PIX")}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 pt-2">
                <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
                  {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Atualizar status
                </Button>
                <Button variant="ghost" onClick={() => setConfirmCancel(true)} className="text-destructive">
                  <X className="w-4 h-4" /> Cancelar cobrança
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {cobranca && (
                <div className="text-xs text-muted-foreground p-2 rounded-md bg-muted/40">
                  Última cobrança: <Badge variant="outline" className="ml-1">{statusCfg?.label || cobranca.status}</Badge>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-2">Forma de pagamento</p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { v: "BOLETO", l: "Boleto" },
                    { v: "PIX", l: "PIX" },
                    { v: "CREDIT_CARD", l: "Cartão" },
                  ].map((opt) => (
                    <button
                      key={opt.v}
                      type="button"
                      onClick={() => setBillingType(opt.v)}
                      className={`px-3 py-2.5 rounded-md text-sm font-medium border transition-colors ${
                        billingType === opt.v
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-input hover:bg-accent"
                      }`}
                    >
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
              <Button onClick={handleGenerate} disabled={generating} className="w-full">
                {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Gerar cobrança no Asaas
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancelar cobrança no Asaas?</AlertDialogTitle>
            <AlertDialogDescription>
              A cobrança será cancelada no Asaas e o cliente não conseguirá mais pagá-la.
              O lançamento no sistema continua intacto.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Cancelar cobrança
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
