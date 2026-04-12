import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Link2, RefreshCw, Trash2, Loader2 } from "lucide-react";

export function PluggyConnectButton() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const { data: connections = [] } = useQuery({
    queryKey: ["pluggy_connections"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_connections" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pluggy_connections" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pluggy_connections"] });
      toast.success("Conexão removida");
    },
  });

  const handleConnect = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-connect-token", {
        method: "POST",
        body: {},
      });

      if (error) throw error;

      const connectToken = data.connectToken;
      if (!connectToken) throw new Error("Token não recebido");

      // Open Pluggy Connect widget
      const pluggyWidget = window.open(
        `https://connect.pluggy.ai/?connect_token=${connectToken}`,
        "pluggy_connect",
        "width=500,height=700,left=200,top=100"
      );

      // Listen for message from widget
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== "https://connect.pluggy.ai") return;
        
        if (event.data?.type === "pluggy-connect" && event.data?.item) {
          const item = event.data.item;
          
          // Save connection
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
            toast.success(`${item.connector?.name || "Banco"} conectado com sucesso!`);
            qc.invalidateQueries({ queryKey: ["pluggy_connections"] });
          }

          window.removeEventListener("message", handleMessage);
        }
      };

      window.addEventListener("message", handleMessage);

      // Cleanup if window closed without completing
      const checkClosed = setInterval(() => {
        if (pluggyWidget?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener("message", handleMessage);
          setLoading(false);
        }
      }, 1000);
    } catch (err) {
      console.error("Pluggy connect error:", err);
      toast.error("Erro ao conectar banco");
      setLoading(false);
    }
  };

  const handleSync = async (itemId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("pluggy-sync", {
        method: "GET",
        headers: {},
        body: undefined,
      });
      // For GET we need to use query params - use fetch directly
      const session = await supabase.auth.getSession();
      const token = session.data.session?.access_token;
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(
        `https://${projectId}.supabase.co/functions/v1/pluggy-sync?itemId=${itemId}&action=summary`,
        { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
      );
      if (!res.ok) throw new Error("Sync failed");
      const result = await res.json();
      
      toast.success("Sincronizado com sucesso!");
      qc.invalidateQueries({ queryKey: ["pluggy_connections"] });
      console.log("Pluggy sync result:", result);
    } catch (err) {
      console.error("Sync error:", err);
      toast.error("Erro ao sincronizar");
    }
  };

  return (
    <div className="space-y-4">
      <Button onClick={handleConnect} disabled={loading} variant="outline" className="gap-2">
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
        Conectar Banco via Open Finance
      </Button>

      {connections.length > 0 && (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((conn: any) => (
            <Card key={conn.id} className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-foreground">{conn.connector_name || "Banco"}</p>
                  <p className="text-xs text-muted-foreground">
                    {conn.last_sync_at
                      ? `Sincronizado: ${new Date(conn.last_sync_at).toLocaleDateString("pt-BR")}`
                      : "Nunca sincronizado"}
                  </p>
                </div>
                <Badge variant={conn.status === "connected" ? "default" : "destructive"} className="text-[10px]">
                  {conn.status === "connected" ? "Conectado" : conn.status}
                </Badge>
              </div>
              <div className="flex gap-1 justify-end border-t border-border/50 pt-2">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleSync(conn.pluggy_item_id)}>
                  <RefreshCw className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteMutation.mutate(conn.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
