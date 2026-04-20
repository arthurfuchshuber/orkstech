CREATE OR REPLACE FUNCTION public.avaliar_regra_dre(
  p_condicoes jsonb,
  p_logica text,
  p_description text,
  p_supplier_name text,
  p_amount numeric,
  p_cliente_id uuid,
  p_supplier_id uuid,
  p_payment_method_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path TO 'public'
AS $function$
DECLARE
  v_cond jsonb;
  v_match boolean;
  v_any boolean := false;
  v_all boolean := true;
  v_campo text;
  v_op text;
  v_val text;
  v_val2 text;
  v_field_value text;
  v_field_value_norm text;
  v_val_norm text;
  v_token text;
  v_text_total int;
  v_text_matched int;
  v_field_num numeric;
BEGIN
  IF jsonb_array_length(p_condicoes) = 0 THEN
    RETURN false;
  END IF;

  FOR v_cond IN SELECT * FROM jsonb_array_elements(p_condicoes) LOOP
    v_campo := v_cond->>'campo';
    v_op := v_cond->>'operador';
    v_val := v_cond->>'valor';
    v_val2 := v_cond->>'valor2';
    v_match := false;

    CASE v_campo
      WHEN 'description' THEN v_field_value := COALESCE(p_description, '');
      WHEN 'supplier_name' THEN v_field_value := COALESCE(p_supplier_name, '');
      WHEN 'cliente_id' THEN v_field_value := COALESCE(p_cliente_id::text, '');
      WHEN 'supplier_id' THEN v_field_value := COALESCE(p_supplier_id::text, '');
      WHEN 'payment_method_id' THEN v_field_value := COALESCE(p_payment_method_id::text, '');
      WHEN 'amount' THEN v_field_num := COALESCE(p_amount, 0);
      ELSE v_field_value := '';
    END CASE;

    IF v_campo = 'amount' THEN
      CASE v_op
        WHEN 'equals' THEN v_match := v_field_num = v_val::numeric;
        WHEN 'gte' THEN v_match := v_field_num >= v_val::numeric;
        WHEN 'lte' THEN v_match := v_field_num <= v_val::numeric;
        WHEN 'between' THEN v_match := v_field_num >= v_val::numeric AND v_field_num <= v_val2::numeric;
        ELSE v_match := false;
      END CASE;
    ELSE
      CASE v_op
        WHEN 'contains' THEN
          v_field_value_norm := public.normalizar_texto_regra(v_field_value);
          v_val_norm := public.normalizar_texto_regra(v_val);

          IF v_val_norm = '' THEN
            v_match := false;
          ELSIF position(v_val_norm in v_field_value_norm) > 0 THEN
            v_match := true;
          ELSE
            -- Fallback inteligente: considera apenas tokens TEXTUAIS (não puramente numéricos)
            -- com 3+ caracteres. Match exige >=50% desses tokens na descrição.
            -- Identificadores numéricos (CNPJ/CPF/contas) são ignorados pois normalmente
            -- não aparecem nas descrições de extrato bancário.
            v_text_total := 0;
            v_text_matched := 0;
            FOR v_token IN SELECT unnest(string_to_array(v_val_norm, ' ')) LOOP
              IF length(v_token) >= 3 AND v_token !~ '^[0-9]+$' THEN
                v_text_total := v_text_total + 1;
                IF position(v_token in v_field_value_norm) > 0 THEN
                  v_text_matched := v_text_matched + 1;
                END IF;
              END IF;
            END LOOP;
            IF v_text_total = 0 THEN
              v_match := false;
            ELSE
              v_match := (v_text_matched::numeric / v_text_total::numeric) >= 0.5;
            END IF;
          END IF;
        WHEN 'equals' THEN
          v_match := public.normalizar_texto_regra(v_field_value) = public.normalizar_texto_regra(v_val);
        WHEN 'starts_with' THEN
          v_match := public.normalizar_texto_regra(v_field_value) LIKE public.normalizar_texto_regra(v_val) || '%';
        ELSE v_match := false;
      END CASE;
    END IF;

    IF v_match THEN v_any := true; ELSE v_all := false; END IF;
  END LOOP;

  IF p_logica = 'OR' THEN RETURN v_any; ELSE RETURN v_all; END IF;
END;
$function$;