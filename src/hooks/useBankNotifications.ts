import { useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { eventBus } from "@/lib/events";

interface PluggyNotification {
  id: string;
  user_id: string;
  tipo: string;
  titulo: string;
  descricao: string;
  lida: boolean;
  created_at: string;
}

export function useBankNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["pluggy_notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pluggy_notifications" as any)
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as unknown as PluggyNotification[];
    },
    enabled: !!user,
    refetchInterval: 30000, // poll every 30s as fallback
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("pluggy-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "pluggy_notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as PluggyNotification;
          qc.invalidateQueries({ queryKey: ["pluggy_notifications"] });

          // Push to client-side Event Bus for immediate UI feedback
          const tipoMap: Record<string, "alerta" | "lembrete" | "informacao"> = {
            alerta: "alerta",
            lembrete: "lembrete",
            informacao: "informacao",
          };

          eventBus.addNotification({
            tipo: tipoMap[newNotif.tipo] || "informacao",
            titulo: newNotif.titulo,
            descricao: newNotif.descricao,
            moduloOrigem: "bancario",
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, qc]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pluggy_notifications" as any)
        .update({ lida: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pluggy_notifications"] }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("pluggy_notifications" as any)
        .update({ lida: true })
        .eq("user_id", user!.id)
        .eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pluggy_notifications"] }),
  });

  return {
    notifications,
    unreadCount: notifications.filter((n) => !n.lida).length,
    markRead: (id: string) => markRead.mutate(id),
    markAllRead: () => markAllRead.mutate(),
  };
}
