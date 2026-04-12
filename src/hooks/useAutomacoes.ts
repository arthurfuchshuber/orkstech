import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { useEffect, useCallback } from "react";

// ==================== Types ====================
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

export interface GatilhoDB {
  id: string;
  user_id: string;
  nome: string;
  label: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

export interface AcaoTipoDB {
  id: string;
  user_id: string;
  nome: string;
  label: string;
  descricao: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

// ==================== Automações ====================
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
    mutationFn: async (input: Omit<AutomacaoDB, "id" | "user_id" | "executado_count" | "created_at" | "updated_at">) => {
      const { error } = await supabase.from("automacoes").insert({
        user_id: user!.id,
        ...input,
        acoes: input.acoes as any,
        condicoes: input.condicoes as any,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...fields }: Partial<AutomacaoDB> & { id: string }) => {
      const { error } = await supabase
        .from("automacoes")
        .update({ ...fields, acoes: fields.acoes as any, condicoes: fields.condicoes as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("automacoes").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automacoes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    automacoes,
    isLoading,
    add: addMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    toggle: (id: string, currentAtivo: boolean) => toggleMutation.mutateAsync({ id, ativo: !currentAtivo }),
    remove: removeMutation.mutateAsync,
    isAdding: addMutation.isPending,
  };
}

// ==================== Gatilhos ====================
export function useGatilhos() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["automacao_gatilhos"];

  const { data: gatilhos = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automacao_gatilhos")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as GatilhoDB[];
    },
    enabled: !!user,
  });

  // Seed defaults if empty
  const seedDefaults = useCallback(async () => {
    if (!user || gatilhos.length > 0) return;
    await supabase.rpc("seed_default_automacao_config", { p_user_id: user.id });
    qc.invalidateQueries({ queryKey });
  }, [user, gatilhos.length, qc]);

  useEffect(() => { seedDefaults(); }, [seedDefaults]);

  const addMutation = useMutation({
    mutationFn: async (input: { nome: string; label: string; descricao: string }) => {
      const { error } = await supabase.from("automacao_gatilhos").insert({
        user_id: user!.id,
        ...input,
        ordem: gatilhos.length,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; nome?: string; label?: string; descricao?: string; ativo?: boolean }) => {
      const { error } = await supabase.from("automacao_gatilhos").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automacao_gatilhos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    gatilhos,
    isLoading,
    add: addMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
  };
}

// ==================== Ações ====================
export function useAcoesTipo() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ["automacao_acoes_tipo"];

  const { data: acoes = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automacao_acoes_tipo")
        .select("*")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data ?? []) as AcaoTipoDB[];
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (input: { nome: string; label: string; descricao: string }) => {
      const { error } = await supabase.from("automacao_acoes_tipo").insert({
        user_id: user!.id,
        ...input,
        ordem: acoes.length,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, ...fields }: { id: string; nome?: string; label?: string; descricao?: string; ativo?: boolean }) => {
      const { error } = await supabase.from("automacao_acoes_tipo").update(fields).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("automacao_acoes_tipo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey }),
  });

  return {
    acoes,
    isLoading,
    add: addMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    remove: removeMutation.mutateAsync,
  };
}
