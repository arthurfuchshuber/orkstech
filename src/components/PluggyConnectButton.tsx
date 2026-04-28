import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PluggyConnect } from "react-pluggy-connect";
import { Link2, RefreshCw, Trash2, Loader2 } from "lucide-react";
import { RemoveIntegrationDialog } from "@/components/integrations/RemoveIntegrationDialog";

export function usePluggyConnections() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();

  // Use empresa owner's user_id for Super Admin cross-tenant visibility
  const targetUserId = empresa?.user_id ?? user?.id;

  const { data: connections = [] } = useQuery({
    queryKey: ["pluggy_connections", targetUserId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_connections" as any)
        .select("*")
        .eq("user_id", targetUserId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user && !!targetUserId,
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, purge }: { id: string; purge: boolean }) => {
      // Lookup pluggy_item_id antes de excluir
      const { data: conn } = await supabase
        .from("pluggy_connections" as any)
        .select("pluggy_item_id")
        .eq("id", id)
        .maybeSingle();
      const pluggyItemId = (conn as any)?.pluggy_item_id as string | undefined;

      if (purge && pluggyItemId) {
        // Remove transações e contas vinculadas a este item (preserva conciliações em accounts_payable/receivable)
        await supabase.from("pluggy_transactions" as any).delete().eq("pluggy_item_id", pluggyItemId);
        await supabase.from("pluggy_bank_accounts" as any).delete().eq("pluggy_item_id", pluggyItemId);
        await supabase.from("pluggy_investments" as any).delete().eq("pluggy_item_id", pluggyItemId);
      }

      const { error } = await supabase.from("pluggy_connections" as any).delete().eq("id", id);
      if (error) throw error;
      return { purge };
    },
    onSuccess: ({ purge }) => {
      qc.invalidateQueries({ queryKey: ["pluggy_connections"] });
      qc.invalidateQueries({ queryKey: ["pluggy_connections_exist"] });
      qc.invalidateQueries({ queryKey: ["pluggy_bank_accounts"] });
      qc.invalidateQueries({ queryKey: ["pluggy_transactions"] });
      toast.success(purge ? "Conexão e dados sincronizados removidos" : "Conexão removida — dados preservados");
    },
  });

  const handleSync = async (itemId: string) => {
    try {
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/pluggy-sync?itemId=${itemId}&action=full_sync`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) {
        throw new Error("Sync failed");
      }
      const result = await res.json();
      toast.success(result.message || "Sincronizado com sucesso!");
      qc.invalidateQueries({ queryKey: ["pluggy_connections"] });
      qc.invalidateQueries({ queryKey: ["pluggy_bank_accounts"] });
      qc.invalidateQueries({ queryKey: ["pluggy_transactions"] });
    } catch (err) {
      console.error("Sync error:", err);
      toast.error("Erro ao sincronizar");
    }
  };

  return { connections, deleteMutation, handleSync };
}

export function PluggyConnectButton({ size = "default" }: { size?: "default" | "sm" }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [connectToken, setConnectToken] = useState<string | null>(null);

  const handleConnect = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-connect-token", {
        method: "POST",
        body: {},
      });
      if (error) throw error;
      const token = data.connectToken;
      if (!token) throw new Error("Token não recebido");
      setConnectToken(token);
    } catch (err) {
      console.error("Pluggy connect error:", err);
      toast.error("Erro ao gerar token de conexão");
      setLoading(false);
    }
  };

  const onSuccess = useCallback(async (itemData: { item: { id: string; connector?: { name?: string } } }) => {
    if (!user) return;
    const item = itemData.item;
    const { error: insertError } = await supabase.from("pluggy_connections" as any).insert({
      user_id: user.id,
      pluggy_item_id: item.id,
      connector_name: item.connector?.name || "Banco conectado",
      status: "connected",
    });
    if (insertError) {
      console.error("Insert error:", insertError);
      toast.error("Erro ao salvar conexão");
    } else {
      toast.success(`${item.connector?.name || "Banco"} conectado! Sincronizando dados...`);
      qc.invalidateQueries({ queryKey: ["pluggy_connections"] });
      qc.invalidateQueries({ queryKey: ["pluggy_connections_exist"] });

      // Auto-sync with retry: Pluggy item may still be processing
      const syncWithRetry = async (retries = 3, delayMs = 5000) => {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;

        for (let attempt = 1; attempt <= retries; attempt++) {
          if (attempt > 1) {
            toast.info(`Aguardando processamento do banco... tentativa ${attempt}/${retries}`);
            await new Promise((r) => setTimeout(r, delayMs));
          }

          try {
            const res = await fetch(
              `https://${projectId}.supabase.co/functions/v1/pluggy-sync?itemId=${item.id}&action=full_sync`,
              { headers: { Authorization: `Bearer ${token}` } }
            );
            if (res.ok) {
              const result = await res.json();
              toast.success(result.message || "Dados sincronizados!");
              qc.invalidateQueries({ queryKey: ["pluggy_bank_accounts"] });
              qc.invalidateQueries({ queryKey: ["pluggy_transactions"] });
              return;
            }
            const errText = await res.text();
            console.error(`Auto-sync attempt ${attempt} failed:`, errText);
          } catch (syncErr) {
            console.error(`Auto-sync attempt ${attempt} error:`, syncErr);
          }
        }
        toast.error("Conexão salva, mas erro ao sincronizar. Clique no botão de sincronizar para tentar novamente.");
      };

      syncWithRetry().catch(console.error);
    }
    setConnectToken(null);
    setLoading(false);
  }, [user, qc]);

  const onError = useCallback((error: any) => {
    console.error("Pluggy widget error:", error);
    toast.error("Erro na conexão bancária");
    setConnectToken(null);
    setLoading(false);
  }, []);

  const onClose = useCallback(() => {
    setConnectToken(null);
    setLoading(false);
  }, []);

  const isSmall = size === "sm";

  return (
    <>
      <Button
        onClick={handleConnect}
        disabled={loading}
        variant="outline"
        size={isSmall ? "sm" : "default"}
        className={isSmall ? "h-7 text-xs gap-1.5 rounded-md" : "gap-2"}
      >
        {loading ? <Loader2 className={`${isSmall ? "w-3 h-3" : "w-4 h-4"} animate-spin`} /> : <Link2 className={isSmall ? "w-3 h-3" : "w-4 h-4"} />}
        Conectar Open Finance
      </Button>

      {connectToken && (
        <PluggyConnect
          connectToken={connectToken}
          onSuccess={onSuccess}
          onError={onError}
          onClose={onClose}
        />
      )}
    </>
  );
}

export function PluggyConnectionsList() {
  const { connections, deleteMutation, handleSync } = usePluggyConnections();

  if (connections.length === 0) return null;

  return (
    <div className="space-y-0.5">
      {connections.map((conn: any) => (
        <div
          key={conn.id}
          className="flex items-center gap-2 py-1.5 px-2 rounded-md transition-colors group hover:bg-muted/30"
        >
          <Link2 className="w-3.5 h-3.5 text-muted-foreground/60 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-foreground truncate block">
              {conn.connector_name || "Banco"}
            </span>
            <span className="text-[10px] text-muted-foreground truncate block">
              {conn.last_sync_at
                ? `Sincronizado: ${new Date(conn.last_sync_at).toLocaleDateString("pt-BR")}`
                : "Nunca sincronizado"}
            </span>
          </div>
          <Badge
            variant={conn.status === "connected" ? "default" : conn.status === "updating" ? "secondary" : "destructive"}
            className="text-[9px] px-1 py-0 leading-4 flex-shrink-0"
          >
            {conn.status === "connected"
              ? "Conectado"
              : conn.status === "updating"
              ? "Sincronizando"
              : "Reconectar"}
          </Badge>
          <div className="flex gap-0.5">
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => handleSync(conn.pluggy_item_id)}>
              <RefreshCw className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="icon" className="h-5 w-5 text-destructive" onClick={() => deleteMutation.mutate(conn.id)}>
              <Trash2 className="w-3 h-3" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
