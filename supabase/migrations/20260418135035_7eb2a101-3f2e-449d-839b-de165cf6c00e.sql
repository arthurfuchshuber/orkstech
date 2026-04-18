-- ============= Tabela de Regras do DRE =============
CREATE TABLE public.dre_regras (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  ativo boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  escopo text NOT NULL DEFAULT 'visualizacao', -- 'visualizacao' | 'persistir'
  condicoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- formato: [{ campo: 'description'|'supplier_name'|'amount'|'cliente_id'|'supplier_id'|'payment_method_id', operador: 'contains'|'equals'|'starts_with'|'gte'|'lte'|'between', valor: any, valor2?: any }]
  condicao_logica text NOT NULL DEFAULT 'AND', -- 'AND' | 'OR'
  categoria_destino_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE CASCADE NOT NULL,
  aplicar_em text NOT NULL DEFAULT 'ambos', -- 'pagar' | 'receber' | 'ambos'
  executado_count integer NOT NULL DEFAULT 0,
  ultima_execucao timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.dre_regras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own dre_regras" ON public.dre_regras
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Super admins can view all dre_regras" ON public.dre_regras
  FOR SELECT TO authenticated USING (is_super_admin());
CREATE POLICY "Users can create own dre_regras" ON public.dre_regras
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dre_regras" ON public.dre_regras
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own dre_regras" ON public.dre_regras
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_dre_regras_updated_at
  BEFORE UPDATE ON public.dre_regras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_dre_regras_user_ativo ON public.dre_regras(user_id, ativo, ordem);

-- ============= Função: avalia condições e aplica regra =============
CREATE OR REPLACE FUNCTION public.avaliar_regra_dre(
  p_condicoes jsonb,
  p_logica text,
  p_description text,
  p_supplier_name text,
  p_amount numeric,
  p_cliente_id uuid,
  p_supplier_id uuid,
  p_payment_method_id uuid
) RETURNS boolean
LANGUAGE plpgsql IMMUTABLE
SET search_path = public
AS $$
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

    -- Resolver valor do campo
    CASE v_campo
      WHEN 'description' THEN v_field_value := lower(COALESCE(p_description, ''));
      WHEN 'supplier_name' THEN v_field_value := lower(COALESCE(p_supplier_name, ''));
      WHEN 'cliente_id' THEN v_field_value := COALESCE(p_cliente_id::text, '');
      WHEN 'supplier_id' THEN v_field_value := COALESCE(p_supplier_id::text, '');
      WHEN 'payment_method_id' THEN v_field_value := COALESCE(p_payment_method_id::text, '');
      WHEN 'amount' THEN v_field_num := COALESCE(p_amount, 0);
      ELSE v_field_value := '';
    END CASE;

    -- Avaliar operador
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
        WHEN 'contains' THEN v_match := v_field_value LIKE '%' || lower(v_val) || '%';
        WHEN 'equals' THEN v_match := v_field_value = lower(v_val);
        WHEN 'starts_with' THEN v_match := v_field_value LIKE lower(v_val) || '%';
        ELSE v_match := false;
      END CASE;
    END IF;

    IF v_match THEN v_any := true; ELSE v_all := false; END IF;
  END LOOP;

  IF p_logica = 'OR' THEN RETURN v_any; ELSE RETURN v_all; END IF;
END;
$$;

-- ============= Função: aplica regras em um lançamento (trigger) =============
CREATE OR REPLACE FUNCTION public.aplicar_regras_dre()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_regra RECORD;
  v_aplicar_em_valor text;
  v_match boolean;
BEGIN
  -- Determina o tipo (pagar/receber) baseado na tabela
  IF TG_TABLE_NAME = 'accounts_payable' THEN
    v_aplicar_em_valor := 'pagar';
  ELSE
    v_aplicar_em_valor := 'receber';
  END IF;

  FOR v_regra IN
    SELECT * FROM public.dre_regras
    WHERE user_id = NEW.user_id
      AND ativo = true
      AND escopo = 'persistir'
      AND aplicar_em IN (v_aplicar_em_valor, 'ambos')
    ORDER BY ordem ASC, created_at ASC
  LOOP
    v_match := public.avaliar_regra_dre(
      v_regra.condicoes,
      v_regra.condicao_logica,
      NEW.description,
      CASE WHEN TG_TABLE_NAME = 'accounts_payable' THEN NEW.supplier_name ELSE NEW.supplier_name END,
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
      EXIT; -- aplica apenas a primeira regra que casar (por ordem de prioridade)
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_aplicar_regras_dre_payable
  BEFORE INSERT OR UPDATE OF description, supplier_name, amount, cliente_id, supplier_id, payment_method_id
  ON public.accounts_payable
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_regras_dre();

CREATE TRIGGER trg_aplicar_regras_dre_receivable
  BEFORE INSERT OR UPDATE OF description, supplier_name, amount, cliente_id, payment_method_id
  ON public.accounts_receivable
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_regras_dre();

-- ============= Função: aplica regras retroativamente =============
CREATE OR REPLACE FUNCTION public.aplicar_regras_retroativo(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
        WHERE ap.user_id = p_user_id
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
        WHERE ar.user_id = p_user_id
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
$$;