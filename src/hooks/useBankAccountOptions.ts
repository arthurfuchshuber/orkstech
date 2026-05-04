import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

/**
 * Opção padronizada de conta/cartão para qualquer dropdown.
 *
 * Regra (mem://ui/dropdown-source-of-truth):
 *  - `primaryLabel`: nome amigável exibido na tela de Cadastro de Contas Bancárias.
 *    - Para contas Pluggy → `pluggy_connections.connector_name` (ex.: "BTGPactual Empresas").
 *    - Para contas manuais → `contas_bancarias.nome`.
 *  - `secondaryLabel`: linha menor abaixo (banco, nome técnico Pluggy, etc.).
 */
export interface BankAccountOption {
  id: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  tipo: string;
  isCard: boolean;
  origem: string | null;
  raw: any;
}

const CHUNK = 100;
const TIPOS_CARTAO = new Set(["cartao_credito", "credito", "cartao"]);

const isCard = (c: any) => {
  if (TIPOS_CARTAO.has(String(c.tipo || "").toLowerCase())) return true;
  return (
    Number(c.limite_credito_total || 0) > 0 ||
    Number(c.fatura_aberto_sincronizada || 0) > 0 ||
    Number(c.fatura_aberto_ajuste_manual || 0) > 0
  );
};

export interface UseBankAccountOptionsParams {
  /** Filtra para mostrar apenas cartões, apenas contas, ou tudo (default). */
  filter?: "all" | "cards" | "non-cards";
  /** Quando false, retorna inativas também. Default true. */
  onlyActive?: boolean;
}

export function useBankAccountOptions({ filter = "all", onlyActive = true }: UseBankAccountOptionsParams = {}) {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const empresaId = empresa?.id;
  const targetUserId = empresa?.user_id ?? user?.id;

  const { data = [], isLoading } = useQuery({
    queryKey: ["bank-account-options", empresaId, targetUserId, onlyActive],
    enabled: !!targetUserId,
    staleTime: 60_000, // cache 1 min — cadastro de contas é raramente alterado
    gcTime: 5 * 60_000,
    queryFn: async (): Promise<BankAccountOption[]> => {
      let q = supabase
        .from("contas_bancarias")
        .select("*")
        .order("nome");
      if (onlyActive) q = q.eq("ativo", true);
      if (empresaId) q = q.eq("empresa_id", empresaId);
      else q = q.eq("user_id", targetUserId!);
      const { data: contas, error } = await q;
      if (error) throw error;
      const rows = contas ?? [];

      // Buscar connector_name das contas Pluggy em chunks (paginação por IN)
      const pluggyAccountIds = rows
        .map((r: any) => r.pluggy_account_id)
        .filter(Boolean) as string[];
      const connectorByAccount = new Map<string, string>();
      for (let i = 0; i < pluggyAccountIds.length; i += CHUNK) {
        const slice = pluggyAccountIds.slice(i, i + CHUNK);
        const { data: pba } = await supabase
          .from("pluggy_bank_accounts" as any)
          .select("pluggy_account_id, connection_id")
          .in("pluggy_account_id", slice);
        const connIds = Array.from(new Set((pba ?? []).map((x: any) => x.connection_id))) as string[];
        if (!connIds.length) continue;
        for (let j = 0; j < connIds.length; j += CHUNK) {
          const cslice = connIds.slice(j, j + CHUNK);
          const { data: conns } = await supabase
            .from("pluggy_connections" as any)
            .select("id, connector_name")
            .in("id", cslice);
          const nameById = new Map<string, string>(
            (conns ?? []).map((c: any) => [c.id, c.connector_name])
          );
          for (const a of pba ?? []) {
            const cn = nameById.get((a as any).connection_id);
            if (cn) connectorByAccount.set((a as any).pluggy_account_id, cn);
          }
        }
      }

      return rows.map((r: any): BankAccountOption => {
        const connector = r.pluggy_account_id ? connectorByAccount.get(r.pluggy_account_id) ?? null : null;
        const primaryLabel = connector || r.nome;
        // Linha secundária: se temos connector_name, mostramos o nome técnico do banco.
        // Caso contrário, mostramos o campo `banco` do cadastro manual.
        let secondaryLabel: string | null = null;
        if (connector && r.nome && r.nome !== connector) secondaryLabel = r.nome;
        else if (!connector && r.banco) secondaryLabel = r.banco;
        return {
          id: r.id,
          primaryLabel,
          secondaryLabel,
          tipo: r.tipo,
          isCard: isCard(r),
          origem: r.origem ?? null,
          raw: r,
        };
      });
    },
  });

  const filtered = useMemo(() => {
    if (filter === "cards") return data.filter((o) => o.isCard);
    if (filter === "non-cards") return data.filter((o) => !o.isCard);
    return data;
  }, [data, filter]);

  return { options: filtered, isLoading };
}
