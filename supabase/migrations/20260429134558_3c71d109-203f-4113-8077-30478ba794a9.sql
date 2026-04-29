-- =============================================================================
-- 1) Função: sugerir_categorias_por_historico
-- Dado um texto, valor e tipo, busca histórico de lançamentos similares
-- que já tenham categoria_financeira_id e retorna sugestões agregadas.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.sugerir_categorias_por_historico(
  p_user_id uuid,
  p_empresa_id uuid,
  p_description text,
  p_amount numeric DEFAULT NULL,
  p_tipo text DEFAULT NULL  -- 'pagar' | 'receber' | NULL
)
RETURNS TABLE(
  categoria_financeira_id uuid,
  categoria_nome text,
  match_count integer,
  exact_count integer,
  similar_count integer,
  sample_descriptions text[],
  common_term text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_norm text;
BEGIN
  IF p_description IS NULL OR length(trim(p_description)) < 2 THEN
    RETURN;
  END IF;

  -- normaliza a descrição (lower + trim + collapse spaces)
  v_norm := lower(regexp_replace(trim(p_description), '\s+', ' ', 'g'));

  RETURN QUERY
  WITH base AS (
    -- accounts_payable
    SELECT
      ap.categoria_financeira_id AS cat_id,
      ap.description AS descr,
      ap.amount AS amt,
      'pagar'::text AS tipo
    FROM public.accounts_payable ap
    WHERE ap.user_id = p_user_id
      AND (p_empresa_id IS NULL OR ap.empresa_id = p_empresa_id)
      AND ap.categoria_financeira_id IS NOT NULL
      AND (p_tipo IS NULL OR p_tipo = 'pagar')
    UNION ALL
    -- accounts_receivable
    SELECT
      ar.categoria_financeira_id,
      ar.description,
      ar.amount,
      'receber'::text
    FROM public.accounts_receivable ar
    WHERE ar.user_id = p_user_id
      AND (p_empresa_id IS NULL OR ar.empresa_id = p_empresa_id)
      AND ar.categoria_financeira_id IS NOT NULL
      AND (p_tipo IS NULL OR p_tipo = 'receber')
    UNION ALL
    -- pluggy_transactions (extrato)
    SELECT
      pt.categoria_financeira_id,
      pt.description,
      ABS(pt.amount),
      CASE WHEN pt.amount < 0 OR pt.type = 'DEBIT' THEN 'pagar' ELSE 'receber' END
    FROM public.pluggy_transactions pt
    WHERE pt.user_id = p_user_id
      AND pt.categoria_financeira_id IS NOT NULL
      AND (
        p_tipo IS NULL
        OR (p_tipo = 'pagar' AND (pt.amount < 0 OR pt.type = 'DEBIT'))
        OR (p_tipo = 'receber' AND (pt.amount > 0 AND pt.type <> 'DEBIT'))
      )
  ),
  scored AS (
    SELECT
      b.cat_id,
      b.descr,
      b.amt,
      lower(regexp_replace(trim(coalesce(b.descr, '')), '\s+', ' ', 'g')) AS descr_norm,
      -- exact = string normalizada idêntica
      (lower(regexp_replace(trim(coalesce(b.descr, '')), '\s+', ' ', 'g')) = v_norm) AS is_exact,
      -- similar = uma contém a outra OU similaridade pg_trgm > 0.3
      (
        position(v_norm in lower(regexp_replace(trim(coalesce(b.descr, '')), '\s+', ' ', 'g'))) > 0
        OR position(lower(regexp_replace(trim(coalesce(b.descr, '')), '\s+', ' ', 'g')) in v_norm) > 0
        OR similarity(lower(coalesce(b.descr, '')), v_norm) > 0.3
      ) AS is_similar
    FROM base b
  ),
  matched AS (
    SELECT * FROM scored WHERE is_exact OR is_similar
  ),
  agg AS (
    SELECT
      m.cat_id,
      COUNT(*)::int AS match_count,
      COUNT(*) FILTER (WHERE m.is_exact)::int AS exact_count,
      COUNT(*) FILTER (WHERE NOT m.is_exact AND m.is_similar)::int AS similar_count,
      (ARRAY_AGG(DISTINCT m.descr ORDER BY m.descr))[1:5] AS samples
    FROM matched m
    GROUP BY m.cat_id
  )
  SELECT
    a.cat_id,
    cf.nome,
    a.match_count,
    a.exact_count,
    a.similar_count,
    a.samples,
    -- common_term: a maior palavra >= 4 chars presente em todas as samples + na descrição-alvo
    (
      SELECT word FROM (
        SELECT regexp_split_to_table(lower(s), '\s+') AS word
        FROM unnest(a.samples) s
        WHERE s IS NOT NULL
      ) words
      WHERE length(word) >= 4
        AND position(word in v_norm) > 0
      GROUP BY word
      ORDER BY COUNT(*) DESC, length(word) DESC
      LIMIT 1
    ) AS common_term
  FROM agg a
  JOIN public.categorias_financeiras cf ON cf.id = a.cat_id
  WHERE a.match_count > 0
  ORDER BY a.exact_count DESC, a.match_count DESC
  LIMIT 5;
END;
$$;

-- =============================================================================
-- 2) Função: preview_regra_dre
-- Simula uma regra (sem salvar) e retorna quantos registros ela afetaria.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.preview_regra_dre(
  p_user_id uuid,
  p_empresa_id uuid,
  p_condicoes jsonb,
  p_condicao_logica text,
  p_categoria_destino_id uuid,
  p_aplicar_em text  -- 'pagar' | 'receber' | 'ambos'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pagar int := 0;
  v_receber int := 0;
  v_extrato int := 0;
  v_pagar_total int := 0;
  v_receber_total int := 0;
  v_extrato_total int := 0;
BEGIN
  IF p_condicoes IS NULL OR jsonb_array_length(p_condicoes) = 0 OR p_categoria_destino_id IS NULL THEN
    RETURN jsonb_build_object(
      'pagar', 0, 'receber', 0, 'extrato', 0, 'total', 0,
      'pagar_total', 0, 'receber_total', 0, 'extrato_total', 0
    );
  END IF;

  IF p_aplicar_em IN ('pagar', 'ambos') THEN
    SELECT COUNT(*) INTO v_pagar_total
    FROM public.accounts_payable ap
    WHERE ap.user_id = p_user_id
      AND (p_empresa_id IS NULL OR ap.empresa_id = p_empresa_id);

    SELECT COUNT(*) INTO v_pagar
    FROM public.accounts_payable ap
    WHERE ap.user_id = p_user_id
      AND (p_empresa_id IS NULL OR ap.empresa_id = p_empresa_id)
      AND public.avaliar_regra_dre(
        p_condicoes, p_condicao_logica,
        ap.description, ap.supplier_name, ap.amount,
        ap.cliente_id, ap.supplier_id, ap.payment_method_id
      )
      AND (ap.categoria_financeira_id IS DISTINCT FROM p_categoria_destino_id);
  END IF;

  IF p_aplicar_em IN ('receber', 'ambos') THEN
    SELECT COUNT(*) INTO v_receber_total
    FROM public.accounts_receivable ar
    WHERE ar.user_id = p_user_id
      AND (p_empresa_id IS NULL OR ar.empresa_id = p_empresa_id);

    SELECT COUNT(*) INTO v_receber
    FROM public.accounts_receivable ar
    WHERE ar.user_id = p_user_id
      AND (p_empresa_id IS NULL OR ar.empresa_id = p_empresa_id)
      AND public.avaliar_regra_dre(
        p_condicoes, p_condicao_logica,
        ar.description, ar.supplier_name, ar.amount,
        ar.cliente_id, NULL, ar.payment_method_id
      )
      AND (ar.categoria_financeira_id IS DISTINCT FROM p_categoria_destino_id);
  END IF;

  -- Extrato
  SELECT COUNT(*) INTO v_extrato_total
  FROM public.pluggy_transactions pt
  WHERE pt.user_id = p_user_id;

  SELECT COUNT(*) INTO v_extrato
  FROM public.pluggy_transactions pt
  WHERE pt.user_id = p_user_id
    AND public.avaliar_regra_dre(
      p_condicoes, p_condicao_logica,
      pt.description, NULL, ABS(pt.amount),
      NULL, NULL, NULL
    )
    AND (pt.categoria_financeira_id IS DISTINCT FROM p_categoria_destino_id)
    AND (
      p_aplicar_em = 'ambos'
      OR (p_aplicar_em = 'pagar'   AND (pt.type = 'DEBIT'  OR pt.amount < 0))
      OR (p_aplicar_em = 'receber' AND (pt.type = 'CREDIT' OR pt.amount > 0))
    );

  RETURN jsonb_build_object(
    'pagar', v_pagar,
    'receber', v_receber,
    'extrato', v_extrato,
    'total', v_pagar + v_receber + v_extrato,
    'pagar_total', v_pagar_total,
    'receber_total', v_receber_total,
    'extrato_total', v_extrato_total
  );
END;
$$;

-- Garantir extensão pg_trgm (já costuma estar, mas idempotente)
CREATE EXTENSION IF NOT EXISTS pg_trgm;