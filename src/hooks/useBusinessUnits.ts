import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

export interface BusinessUnit {
  id: string;
  empresa_id: string;
  user_id: string;
  nome: string;
  descricao: string | null;
  cor: string | null;
  ordem: number;
  ativo: boolean;
}

/** Carrega unidades de negócio (produtos / operações) da empresa ativa. */
export function useBusinessUnits({ onlyActive = true }: { onlyActive?: boolean } = {}) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const { data = [], isLoading } = useQuery({
    queryKey: ["business_units", empresaId, onlyActive],
    enabled: !!user && !!empresaId,
    staleTime: 60_000,
    queryFn: async () => {
      let q = supabase.from("business_units" as any).select("*").order("ordem").order("nome");
      if (empresaId) q = q.eq("empresa_id", empresaId);
      if (onlyActive) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as BusinessUnit[];
    },
  });

  return { businessUnits: data, isLoading };
}
