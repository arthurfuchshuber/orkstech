CREATE OR REPLACE FUNCTION public.aplicar_regras_retroativo(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_regra RECORD;
  v_total_pagar int := 0;
  v_total_receber int := 0;
  v_total_extrato int := 0;
  v_count int;
BEGIN
  FOR v_regra IN
    SELECT * FROM public.dre_regras
    WHERE user_id = p_user_id AND ativo = true AND escopo = 'persistir'
    ORDER BY ordem ASC
  LOOP
    IF v_regra.aplicar_em IN ('pagar', 'ambos') THEN
      WITH affected AS (
        UPDATE public.accounts_payable ap
        SET categoria_financeira_id = v_regra.categoria_destino_id
        WHERE (ap.empresa_id = v_regra.empresa_id OR (v_regra.empresa_id IS NULL AND ap.user_id = p_user_id))
          AND public.avaliar_regra_dre(
            v_regra.condicoes, v_regra.condicao_logica,
            ap.description, ap.supplier_name, ap.amount,
            ap.cliente_id, ap.supplier_id, ap.payment_method_id
          )
          AND (ap.categoria_financeira_id IS DISTINCT FROM v_regra.categoria_destino_id)
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_count FROM affected;
      v_total_pagar := v_total_pagar + v_count;
    END IF;

    IF v_regra.aplicar_em IN ('receber', 'ambos') THEN
      WITH affected AS (
        UPDATE public.accounts_receivable ar
        SET categoria_financeira_id = v_regra.categoria_destino_id
        WHERE (ar.empresa_id = v_regra.empresa_id OR (v_regra.empresa_id IS NULL AND ar.user_id = p_user_id))
          AND public.avaliar_regra_dre(
            v_regra.condicoes, v_regra.condicao_logica,
            ar.description, ar.supplier_name, ar.amount,
            ar.cliente_id, NULL, ar.payment_method_id
          )
          AND (ar.categoria_financeira_id IS DISTINCT FROM v_regra.categoria_destino_id)
        RETURNING 1
      )
      SELECT COUNT(*) INTO v_count FROM affected;
      v_total_receber := v_total_receber + v_count;
    END IF;

    -- Extrato bancário (Pluggy): aplica ao tipo de transação correspondente.
    -- DEBIT/saída => regras de "pagar"; CREDIT/entrada => regras de "receber".
    WITH affected AS (
      UPDATE public.pluggy_transactions pt
      SET categoria_financeira_id = v_regra.categoria_destino_id
      WHERE pt.user_id = p_user_id
        AND public.avaliar_regra_dre(
          v_regra.condicoes, v_regra.condicao_logica,
          pt.description, NULL, ABS(pt.amount),
          NULL, NULL, NULL
        )
        AND (pt.categoria_financeira_id IS DISTINCT FROM v_regra.categoria_destino_id)
        AND (
          v_regra.aplicar_em = 'ambos'
          OR (v_regra.aplicar_em = 'pagar'   AND (pt.type = 'DEBIT'  OR pt.amount < 0))
          OR (v_regra.aplicar_em = 'receber' AND (pt.type = 'CREDIT' OR pt.amount > 0))
        )
      RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM affected;
    v_total_extrato := v_total_extrato + v_count;

    UPDATE public.dre_regras
      SET executado_count = executado_count + (v_total_pagar + v_total_receber + v_total_extrato),
          ultima_execucao = now()
      WHERE id = v_regra.id;
  END LOOP;

  RETURN jsonb_build_object(
    'pagar', v_total_pagar,
    'receber', v_total_receber,
    'extrato', v_total_extrato,
    'total', v_total_pagar + v_total_receber + v_total_extrato
  );
END;
$function$;