import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEmpresa } from "@/hooks/useEmpresa";

export interface TipoGasto {
  id: string;
  nome: string;
  emoji: string;
  ativo: boolean;
  ordem: number;
}

export function useTiposGasto({ onlyActive = true }: { onlyActive?: boolean } = {}) {
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;

  const { data = [], isLoading } = useQuery({
    queryKey: ["tipos_gasto", empresaId, onlyActive],
    enabled: !!empresaId,
    queryFn: async () => {
      let q = supabase
        .from("tipos_gasto" as any)
        .select("*")
        .eq("empresa_id", empresaId!)
        .order("ordem")
        .order("nome");
      if (onlyActive) q = q.eq("ativo", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as TipoGasto[];
    },
  });

  return { tiposGasto: data, isLoading };
}
