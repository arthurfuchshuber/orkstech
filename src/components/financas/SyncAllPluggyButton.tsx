import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { usePluggyConnections } from "@/components/PluggyConnectButton";
import { toast } from "sonner";

export function SyncAllPluggyButton() {
  const { connections } = usePluggyConnections();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  if (!connections || connections.length === 0) return null;

  const handleSyncAll = async () => {
    setLoading(true);
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      toast.info(`Sincronizando ${connections.length} ${connections.length === 1 ? "conexão" : "conexões"}…`);

      const results = await Promise.allSettled(
        connections.map((c: any) =>
          fetch(
            `https://${projectId}.supabase.co/functions/v1/pluggy-sync?itemId=${c.pluggy_item_id}&action=full_sync`,
            { headers: { Authorization: `Bearer ${token}` } }
          ).then((r) => {
            if (!r.ok) throw new Error("Falha");
            return r.json();
          })
        )
      );

      const ok = results.filter((r) => r.status === "fulfilled").length;
      const fail = results.length - ok;

      qc.invalidateQueries({ queryKey: ["pluggy_connections"] });
      qc.invalidateQueries({ queryKey: ["pluggy_bank_accounts"] });
      qc.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      qc.invalidateQueries({ queryKey: ["contas_bancarias"] });
      qc.invalidateQueries({ queryKey: ["cash_transactions"] });

      if (fail === 0) toast.success(`${ok} ${ok === 1 ? "conexão sincronizada" : "conexões sincronizadas"}`);
      else if (ok === 0) toast.error("Falha ao sincronizar conexões");
      else toast.warning(`${ok} sincronizada(s), ${fail} com erro`);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao sincronizar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSyncAll}
          disabled={loading}
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Sincronizando…" : "Sincronizar agora"}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        Atualiza saldos e transações de todas as conexões Open Finance
      </TooltipContent>
    </Tooltip>
  );
}
