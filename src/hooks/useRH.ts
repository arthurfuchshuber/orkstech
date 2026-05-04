import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

function useTargetUserId() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  return empresa?.user_id ?? user?.id ?? null;
}

function makeListHook<T = any>(table: string, key: string) {
  return () => {
    const targetUserId = useTargetUserId();
    return useQuery({
      queryKey: [key, targetUserId],
      enabled: !!targetUserId,
      queryFn: async () => {
        const { data, error } = await (supabase as any)
          .from(table).select("*").eq("user_id", targetUserId!).order("ordem").order("nome");
        if (error) throw error;
        return (data ?? []) as T[];
      },
    });
  };
}

export const useDepartamentos = makeListHook("rh_departamentos", "rh_departamentos");
export const useCargos = makeListHook("rh_cargos", "rh_cargos");
export const useTiposVinculo = makeListHook("rh_tipos_vinculo", "rh_tipos_vinculo");
export const useTiposBeneficio = makeListHook("rh_tipos_beneficio", "rh_tipos_beneficio");
export const useTiposAusencia = makeListHook("rh_tipos_ausencia", "rh_tipos_ausencia");
export const useCategoriasEquipamento = makeListHook("rh_categorias_equipamento", "rh_categorias_equipamento");
export const useFerramentas = makeListHook("rh_ferramentas", "rh_ferramentas");

export function useColaboradores() {
  const targetUserId = useTargetUserId();
  return useQuery({
    queryKey: ["rh_colaboradores", targetUserId],
    enabled: !!targetUserId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("colaboradores")
        .select("*")
        .eq("user_id", targetUserId!)
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useColaborador(id: string | undefined) {
  return useQuery({
    queryKey: ["rh_colaborador", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from("colaboradores").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
}
