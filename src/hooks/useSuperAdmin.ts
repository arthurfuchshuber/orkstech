import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useSuperAdmin() {
  const { user } = useAuth();

  const { data: isSuperAdmin = false, isLoading } = useQuery({
    queryKey: ["is-super-admin", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("nivel_permissao_id")
        .eq("user_id", user!.id)
        .single();
      if (!profile?.nivel_permissao_id) return false;
      const { data: nivel } = await supabase
        .from("niveis_permissao")
        .select("nome")
        .eq("id", profile.nivel_permissao_id)
        .single();
      return nivel?.nome === "Super Admin";
    },
  });

  return { isSuperAdmin, isLoading };
}
