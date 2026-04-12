import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEffect } from "react";

export interface NotificacaoSistema {
  id: string;
  user_id: string;
  automacao_id: string | null;
  titulo: string;
  descricao: string;
  tipo: string;
  lida: boolean;
  entidade_tipo: string | null;
  entidade_id: string | null;
  created_at: string;
}

export function useNotificacoesSistema() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["notificacoes_sistema"];

  const { data: notificacoes = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notificacoes_sistema")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []) as NotificacaoSistema[];
    },
    enabled: !!user,
    refetchInterval: 30000, // Poll every 30s
  });

  // Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notificacoes_sistema_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificacoes_sistema" },
        () => qc.invalidateQueries({ queryKey })
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, qc]);

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notificacoes_sistema")
        .update({ lida: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const markAllRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notificacoes_sistema")
        .update({ lida: true })
        .eq("lida", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const unreadCount = notificacoes.filter((n) => !n.lida).length;

  return {
    notificacoes,
    isLoading,
    unreadCount,
    markRead: (id: string) => markRead.mutateAsync(id),
    markAllRead: () => markAllRead.mutateAsync(),
  };
}
