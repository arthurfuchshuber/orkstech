-- Atualiza aplicar_regras_retroativo para filtrar por empresa_id (multi-tenant correto)
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

    UPDATE public.dre_regras
      SET executado_count = executado_count + (v_total_pagar + v_total_receber),
          ultima_execucao = now()
      WHERE id = v_regra.id;
  END LOOP;

  RETURN jsonb_build_object(
    'pagar', v_total_pagar,
    'receber', v_total_receber,
    'total', v_total_pagar + v_total_receber
  );
END;
$function$;

-- Atualiza aplicar_regras_dre (trigger BEFORE INSERT/UPDATE) para escopar por empresa
CREATE OR REPLACE FUNCTION public.aplicar_regras_dre()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_regra RECORD;
  v_aplicar_em_valor text;
  v_match boolean;
BEGIN
  IF TG_TABLE_NAME = 'accounts_payable' THEN
    v_aplicar_em_valor := 'pagar';
  ELSE
    v_aplicar_em_valor := 'receber';
  END IF;

  FOR v_regra IN
    SELECT * FROM public.dre_regras
    WHERE (empresa_id = NEW.empresa_id OR (empresa_id IS NULL AND user_id = NEW.user_id))
      AND ativo = true
      AND escopo = 'persistir'
      AND aplicar_em IN (v_aplicar_em_valor, 'ambos')
    ORDER BY ordem ASC, created_at ASC
  LOOP
    v_match := public.avaliar_regra_dre(
      v_regra.condicoes,
      v_regra.condicao_logica,
      NEW.description,
      NEW.supplier_name,
      NEW.amount,
      NEW.cliente_id,
      CASE WHEN TG_TABLE_NAME = 'accounts_payable' THEN NEW.supplier_id ELSE NULL END,
      NEW.payment_method_id
    );

    IF v_match THEN
      NEW.categoria_financeira_id := v_regra.categoria_destino_id;
      UPDATE public.dre_regras
        SET executado_count = executado_count + 1, ultima_execucao = now()
        WHERE id = v_regra.id;
      EXIT;
    END IF;
  END LOOP;

  RETURN NEW;
END;
$function$;