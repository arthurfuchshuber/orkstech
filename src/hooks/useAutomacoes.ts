import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export interface AutomacaoDB {
  id: string;
  user_id: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  evento_gatilho: string;
  acoes: { tipo: string; config: Record<string, string> }[];
  condicoes: unknown[];
  executado_count: number;
  created_at: string;
  updated_at: string;
}

export function useAutomacoes() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["automacoes"];

  const { data: automacoes = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automacoes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AutomacaoDB[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (input: {
      nome: string;
      descricao: string;
      ativo: boolean;
      evento_gatilho: string;
      acoes: { tipo: string; config: Record<string, string> }[];
      condicoes: unknown[];
    }) => {
      const { error } = await supabase.from("automacoes").insert({
        user_id: user!.id,
        nome: input.nome,
        descricao: input.descricao,
        ativo: input.ativo,
        evento_gatilho: input.evento_gatilho,
        acoes: input.acoes as any,
        condicoes: input.condicoes as any,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("automacoes")
        .update({ ativo })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("automacoes")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    automacoes,
    isLoading,
    add: addMutation.mutateAsync,
    toggle: (id: string, currentAtivo: boolean) =>
      toggleMutation.mutateAsync({ id, ativo: !currentAtivo }),
    remove: removeMutation.mutateAsync,
    isAdding: addMutation.isPending,
  };
}
