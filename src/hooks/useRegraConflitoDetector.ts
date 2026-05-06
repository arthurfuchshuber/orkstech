import { useCallback, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useEmpresa } from "@/hooks/useEmpresa";

interface RegistroAlteracao {
  description: string;
  categoriaNovaId: string | null;
  ts: number;
}

export interface RegraConflito {
  id: string;
  nome: string;
  termo: string;
  categoriaAtualId: string | null;
  categoriaNovaId: string | null;
  ativo: boolean;
}

const JANELA_MS = 5 * 60 * 1000;

/**
 * Registra alterações de categoria e dispara verificação:
 * quando >=2 alterações ocorrem em <5min compartilhando o mesmo termo
 * (palavra-chave da descrição), busca regra ativa que case com esse termo.
 * Se houver e a categoria de destino não for a nova aplicada, abre modal.
 */
export function useRegraConflitoDetector() {
  const { user } = useAuth();
  const { empresa } = useEmpresa();
  const targetUserId = empresa?.user_id ?? user?.id;

  const historicoRef = useRef<RegistroAlteracao[]>([]);
  const [conflito, setConflito] = useState<RegraConflito | null>(null);

  const extrairTermo = (desc: string): string => {
    const limpo = (desc || "").trim().toUpperCase();
    if (!limpo) return "";
    // pega o primeiro token alfanumérico significativo (>=3 chars)
    const tokens = limpo.split(/[\s\-_/.,;:|*]+/).filter((t) => t.length >= 3);
    return tokens[0] || limpo.slice(0, 20);
  };

  const registrar = useCallback(
    async (description: string, categoriaNovaId: string | null) => {
      if (!targetUserId) return;
      const termo = extrairTermo(description);
      if (!termo) return;
      const agora = Date.now();
      // Limpa janela
      historicoRef.current = historicoRef.current.filter((r) => agora - r.ts < JANELA_MS);
      historicoRef.current.push({ description, categoriaNovaId, ts: agora });

      // Conta quantos compartilham o mesmo termo
      const compartilham = historicoRef.current.filter(
        (r) => extrairTermo(r.description) === termo,
      );
      if (compartilham.length < 2) return;

      // Busca regras ativas que casem com esse termo
      try {
        const { data } = await supabase
          .from("dre_regras" as any)
          .select("id, nome, condicoes, categoria_destino_id, ativo")
          .eq("user_id", targetUserId)
          .eq("ativo", true);
        const t = termo.toLowerCase();
        const match = (data as any[] | null)?.find((r) => {
          const conds = Array.isArray(r.condicoes) ? r.condicoes : [];
          return conds.some(
            (c: any) =>
              c.campo === "description" &&
              (c.operador === "contains" || c.operador === "equals") &&
              String(c.valor || "").trim().toLowerCase() === t,
          );
        });
        if (!match) return;
        // Só dispara se a regra apontava para outra categoria
        if (match.categoria_destino_id === categoriaNovaId) return;
        setConflito({
          id: match.id,
          nome: match.nome,
          termo,
          categoriaAtualId: match.categoria_destino_id,
          categoriaNovaId,
          ativo: match.ativo,
        });
        // Limpa histórico para não repetir o alerta seguidas vezes
        historicoRef.current = [];
      } catch (e) {
        console.warn("[regra-conflito] falha ao verificar:", e);
      }
    },
    [targetUserId],
  );

  return { conflito, setConflito, registrar };
}
