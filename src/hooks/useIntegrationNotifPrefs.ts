import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

export type IntegrationProvider = "pluggy" | "asaas" | "clicksign";

export interface NotifPref {
  id?: string;
  provider: IntegrationProvider;
  silenced_popup: boolean;
  silenced_banner: boolean;
  silenced_bell: boolean;
}

export function useIntegrationNotifPrefs() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const qc = useQueryClient();

  const { data: prefs = [] } = useQuery({
    queryKey: ["integration_notif_prefs", user?.id, empresa?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("integration_notification_prefs" as any)
        .select("*")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data ?? []) as any as NotifPref[];
    },
    enabled: !!user,
  });

  const getPref = (provider: IntegrationProvider): NotifPref =>
    prefs.find((p) => p.provider === provider) ?? {
      provider,
      silenced_popup: false,
      silenced_banner: false,
      silenced_bell: false,
    };

  const update = useMutation({
    mutationFn: async (next: NotifPref) => {
      if (!user) throw new Error("not authed");
      const payload: any = {
        user_id: user.id,
        empresa_id: empresa?.id ?? null,
        provider: next.provider,
        silenced_popup: next.silenced_popup,
        silenced_banner: next.silenced_banner,
        silenced_bell: next.silenced_bell,
      };
      const { error } = await supabase
        .from("integration_notification_prefs" as any)
        .upsert(payload, { onConflict: "user_id,empresa_id,provider" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["integration_notif_prefs"] }),
  });

  return { prefs, getPref, update };
}
