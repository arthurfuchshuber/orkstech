import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";
import type { ManagedOption } from "@/components/inputs/ManagedSelectInput";

type TableName = "categorias_financeiras" | "centros_custo" | "contas_bancarias" | "formas_pagamento" | "cliente_interacao_tipos";

interface TableConfig {
  table: TableName;
  queryKey: string;
  labelField: string;
  extraLabel?: (row: any) => string;
  /** Extra fields to include when inserting */
  insertDefaults?: Record<string, any>;
}

const configs: Record<string, TableConfig> = {
  "categorias_financeiras": {
    table: "categorias_financeiras",
    queryKey: "categorias-financeiras",
    labelField: "nome",
  },
  "centros_custo": {
    table: "centros_custo",
    queryKey: "centros-custo",
    labelField: "nome",
  },
  "contas_bancarias": {
    table: "contas_bancarias",
    queryKey: "contas-bancarias",
    labelField: "nome",
    extraLabel: (row: any) => row.banco ? `${row.nome} - ${row.banco}` : row.nome,
  },
  "formas_pagamento": {
    table: "formas_pagamento",
    queryKey: "formas-pagamento",
    labelField: "nome",
  },
  "tipos_forma_pagamento": {
    table: "tipos_forma_pagamento" as any,
    queryKey: "tipos-forma-pagamento",
    labelField: "nome",
  },
  "bancos": {
    table: "bancos" as any,
    queryKey: "bancos",
    labelField: "nome",
    extraLabel: (row: any) => row.codigo ? `${row.codigo} - ${row.nome}` : row.nome,
  },
  "cliente_interacao_tipos": {
    table: "cliente_interacao_tipos" as any,
    queryKey: "cliente-interacao-tipos",
    labelField: "nome",
  },
};

export function useManagedSelect(
  tableName: string,
  opts?: { insertDefaults?: Record<string, any> }
) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const queryClient = useQueryClient();
  const config = configs[tableName];

  const invalidate = useCallback(() => {
    if (config) {
      queryClient.invalidateQueries({ queryKey: [config.queryKey] });
      queryClient.invalidateQueries({ queryKey: [config.table] });
    }
  }, [config, queryClient]);

  const onAdd = useCallback(async (label: string): Promise<string | null> => {
    if (!config || !user) return null;
    try {
      const payload: any = {
        [config.labelField]: label,
        user_id: user.id,
        empresa_id: empresa?.id || null,
        ...opts?.insertDefaults,
      };
      const { data, error } = await supabase
        .from(config.table)
        .insert(payload)
        .select("id")
        .single();
      if (error) throw error;
      invalidate();
      return data.id;
    } catch {
      return null;
    }
  }, [config, user, empresa, opts?.insertDefaults, invalidate]);

  const onEdit = useCallback(async (id: string, label: string): Promise<boolean> => {
    if (!config) return false;
    try {
      const { error } = await supabase
        .from(config.table)
        .update({ [config.labelField]: label } as any)
        .eq("id", id);
      if (error) throw error;
      invalidate();
      return true;
    } catch {
      return false;
    }
  }, [config, invalidate]);

  const onDelete = useCallback(async (id: string): Promise<boolean> => {
    if (!config) return false;
    try {
      const { error } = await supabase
        .from(config.table)
        .delete()
        .eq("id", id);
      if (error) throw error;
      invalidate();
      return true;
    } catch {
      return false;
    }
  }, [config, invalidate]);

  const onReorder = useCallback(async (orderedIds: string[]): Promise<boolean> => {
    if (!config) return false;
    try {
      const updates = orderedIds.map((id, idx) => {
        if (config.table === "categorias_financeiras") {
          return supabase.from(config.table).update({ ordem: idx } as any).eq("id", id);
        }
        return null;
      }).filter(Boolean);

      if (updates.length > 0) {
        await Promise.all(updates);
        invalidate();
      }
      return true;
    } catch {
      return false;
    }
  }, [config, invalidate]);

  return { onAdd, onEdit, onDelete, onReorder };
}
