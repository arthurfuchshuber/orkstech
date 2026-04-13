import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function SuperAdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  const { data: isSuperAdmin, isLoading } = useQuery({
    queryKey: ["is-super-admin", user?.id],
    enabled: !!user,
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

  if (loading || isLoading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <>{children}</>;
}
