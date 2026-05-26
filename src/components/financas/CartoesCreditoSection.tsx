import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Link2 } from "lucide-react";
import { PluggyConnectButton } from "@/components/PluggyConnectButton";

interface PluggyCard {
  id: string;
  pluggy_account_id: string;
  pluggy_item_id: string;
  type: string;
  subtype: string | null;
  bank_data: any;
}

interface PluggyConn {
  pluggy_item_id: string;
  connector_name: string | null;
  last_sync_at: string | null;
  status: string | null;
}

const fmtDate = (d: string | null) =>
  d ? new Date(d).toLocaleDateString("pt-BR") : "Nunca sincronizado";

export function CartoesCreditoSection({
  readOnly = false,
  hideOpenFinanceButton = false,
  bare = false,
}: {
  readOnly?: boolean;
  hideOpenFinanceButton?: boolean;
  /** When true, renders only the list rows (no Card wrapper, no header). */
  bare?: boolean;
}) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;

  const { data: cards = [], isLoading } = useQuery({
    queryKey: ["pluggy_credit_cards_section", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_bank_accounts" as any)
        .select("id, pluggy_account_id, pluggy_item_id, type, subtype, bank_data")
        .eq("user_id", targetUserId!)
        .eq("type", "CREDIT");
      if (error) throw error;
      return (data ?? []) as unknown as PluggyCard[];
    },
  });

  const { data: connections = [] } = useQuery({
    queryKey: ["pluggy_connections_names_section", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_connections" as any)
        .select("pluggy_item_id, connector_name, last_sync_at, status")
        .eq("user_id", targetUserId!);
      if (error) throw error;
      return (data ?? []) as unknown as PluggyConn[];
    },
  });

  const getDisplayName = (card: PluggyCard) => {
    const conn = connections.find((c) => c.pluggy_item_id === card.pluggy_item_id);
    const connectorName = conn?.connector_name || "Cartão";
    const last4 =
      card.bank_data?.creditData?.disaggregatedCreditLimits?.[0]?.identificationNumber ||
      (card.bank_data?.number ?? "").toString().slice(-4);
    return last4 ? `${connectorName} •••${last4}` : connectorName;
  };

  const hasAny = cards.length > 0;

  return (
    <Card className="border-border/40 shadow-sm flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4 flex flex-col items-stretch gap-2 space-y-0 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <CreditCard className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-sm font-semibold truncate">Cartões de Crédito</CardTitle>
            <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
              Cartões sincronizados via Open Finance
            </p>
          </div>
        </div>
        {!hideOpenFinanceButton && !readOnly && (
          <div className="sm:shrink-0"><PluggyConnectButton size="sm" /></div>
        )}
      </CardHeader>

      <CardContent className="px-2 pb-3 flex-1 overflow-auto">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-xs">Carregando...</div>
        ) : !hasAny ? (
          <div className="py-8 text-center text-muted-foreground text-xs">
            Nenhum cartão de crédito vinculado. Conecte uma instituição via Open Finance.
          </div>
        ) : (
          <div className="space-y-0.5">
            {cards.map((card) => {
              const conn = connections.find((c) => c.pluggy_item_id === card.pluggy_item_id);
              return (
                <div
                  key={card.id}
                  className="flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors hover:bg-muted/30"
                >
                  <Link2 className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground truncate block">
                      {getDisplayName(card)}
                    </span>
                    <span className="text-[10px] text-muted-foreground truncate block">
                      Sincronizado: {fmtDate(conn?.last_sync_at ?? null)}
                    </span>
                  </div>
                  <Badge
                    variant={
                      conn?.status === "connected"
                        ? "default"
                        : conn?.status === "updating"
                        ? "secondary"
                        : "destructive"
                    }
                    className="text-[9px] px-1 py-0 leading-4 flex-shrink-0"
                  >
                    {conn?.status === "connected"
                      ? "Conectado"
                      : conn?.status === "updating"
                      ? "Sincronizando"
                      : "Reconectar"}
                  </Badge>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
