-- Guarda a regra de vínculo padrão por card financeiro.
CREATE TABLE IF NOT EXISTS public.financeiro_card_vinculos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  card_tipo text NOT NULL,
  bank_account_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  valor_alocado numeric,
  percentual numeric,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, card_tipo, bank_account_id)
);

ALTER TABLE public.financeiro_card_vinculos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their company card links" ON public.financeiro_card_vinculos;
CREATE POLICY "Users can view their company card links"
ON public.financeiro_card_vinculos
FOR SELECT
TO authenticated
USING (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR public.is_empresa_owner(auth.uid(), empresa_id)
  OR public.has_permission(auth.uid(), empresa_id, 'menu:dashboard', 'view')
);

DROP POLICY IF EXISTS "Users can create their company card links" ON public.financeiro_card_vinculos;
CREATE POLICY "Users can create their company card links"
ON public.financeiro_card_vinculos
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR public.is_empresa_owner(auth.uid(), empresa_id)
  OR public.has_permission(auth.uid(), empresa_id, 'menu:dashboard', 'edit')
);

DROP POLICY IF EXISTS "Users can update their company card links" ON public.financeiro_card_vinculos;
CREATE POLICY "Users can update their company card links"
ON public.financeiro_card_vinculos
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR public.is_empresa_owner(auth.uid(), empresa_id)
  OR public.has_permission(auth.uid(), empresa_id, 'menu:dashboard', 'edit')
)
WITH CHECK (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR public.is_empresa_owner(auth.uid(), empresa_id)
  OR public.has_permission(auth.uid(), empresa_id, 'menu:dashboard', 'edit')
);

DROP POLICY IF EXISTS "Users can delete their company card links" ON public.financeiro_card_vinculos;
CREATE POLICY "Users can delete their company card links"
ON public.financeiro_card_vinculos
FOR DELETE
TO authenticated
USING (
  public.is_super_admin()
  OR user_id = auth.uid()
  OR public.is_empresa_owner(auth.uid(), empresa_id)
  OR public.has_permission(auth.uid(), empresa_id, 'menu:dashboard', 'edit')
);

DROP TRIGGER IF EXISTS update_financeiro_card_vinculos_updated_at ON public.financeiro_card_vinculos;
CREATE TRIGGER update_financeiro_card_vinculos_updated_at
BEFORE UPDATE ON public.financeiro_card_vinculos
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_financeiro_card_vinculos_empresa_card
  ON public.financeiro_card_vinculos (empresa_id, card_tipo)
  WHERE ativo = true;

CREATE OR REPLACE FUNCTION public.aplicar_vinculo_card_financeiro(
  p_card_tipo text,
  p_alocacoes jsonb,
  p_motivo text DEFAULT NULL,
  p_empresa_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_empresa_id uuid;
  v_alocacao jsonb;
  v_conta record;
  v_total_alocado numeric := 0;
  v_total_base numeric := 0;
  v_percent_total numeric := 0;
  v_count_payable int := 0;
  v_count_receivable int := 0;
  v_count_cash int := 0;
  v_count_links int := 0;
  v_primary_account uuid;
  v_allowed_card text[] := ARRAY['saldo','investimento','limite_credito','fatura','limite_cheque_especial','contas_pagar','contas_receber'];
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  IF p_card_tipo IS NULL OR NOT (p_card_tipo = ANY(v_allowed_card)) THEN
    RAISE EXCEPTION 'Tipo de card inválido: %', p_card_tipo;
  END IF;

  IF jsonb_typeof(p_alocacoes) <> 'array' OR jsonb_array_length(p_alocacoes) = 0 THEN
    RAISE EXCEPTION 'Informe ao menos uma conta/cartão para vínculo';
  END IF;

  v_empresa_id := p_empresa_id;
  IF v_empresa_id IS NULL THEN
    SELECT id INTO v_empresa_id
    FROM public.empresas
    WHERE user_id = v_user_id
    ORDER BY created_at ASC
    LIMIT 1;
  END IF;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada';
  END IF;

  IF NOT (
    public.is_super_admin()
    OR public.is_empresa_owner(v_user_id, v_empresa_id)
    OR public.has_permission(v_user_id, v_empresa_id, 'menu:dashboard', 'edit')
  ) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  FOR v_alocacao IN SELECT * FROM jsonb_array_elements(p_alocacoes) LOOP
    IF (v_alocacao->>'bank_account_id') IS NULL THEN
      RAISE EXCEPTION 'Conta/cartão obrigatório';
    END IF;

    SELECT * INTO v_conta
    FROM public.contas_bancarias
    WHERE id = (v_alocacao->>'bank_account_id')::uuid
      AND ativo = true
      AND empresa_id = v_empresa_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Conta/cartão % não encontrado para esta empresa', v_alocacao->>'bank_account_id';
    END IF;

    IF p_card_tipo IN ('limite_credito','fatura') AND v_conta.tipo <> 'cartao_credito' THEN
      RAISE EXCEPTION 'O card % deve ser vinculado a cartão de crédito', p_card_tipo;
    END IF;

    IF p_card_tipo NOT IN ('limite_credito','fatura') AND v_conta.tipo = 'cartao_credito' THEN
      RAISE EXCEPTION 'O card % deve ser vinculado a conta, não cartão de crédito', p_card_tipo;
    END IF;

    v_total_alocado := v_total_alocado + COALESCE((v_alocacao->>'valor')::numeric, 0);
    v_percent_total := v_percent_total + COALESCE((v_alocacao->>'percentual')::numeric, 0);
    IF v_primary_account IS NULL THEN v_primary_account := v_conta.id; END IF;
  END LOOP;

  IF v_percent_total = 0 AND v_total_alocado = 0 THEN
    RAISE EXCEPTION 'Informe valor ou percentual para o vínculo';
  END IF;

  SELECT COALESCE(SUM(CASE WHEN type IN ('income','entrada') THEN amount ELSE -amount END), 0)
  INTO v_total_base
  FROM public.cash_transactions
  WHERE empresa_id = v_empresa_id
    AND bank_account_id IS NULL
    AND COALESCE(is_internal_transfer, false) = false;

  DELETE FROM public.financeiro_card_vinculos
  WHERE empresa_id = v_empresa_id
    AND card_tipo = p_card_tipo;

  FOR v_alocacao IN SELECT * FROM jsonb_array_elements(p_alocacoes) LOOP
    INSERT INTO public.financeiro_card_vinculos (
      user_id, empresa_id, card_tipo, bank_account_id, valor_alocado, percentual, ativo
    ) VALUES (
      v_user_id,
      v_empresa_id,
      p_card_tipo,
      (v_alocacao->>'bank_account_id')::uuid,
      NULLIF((v_alocacao->>'valor')::numeric, 0),
      CASE
        WHEN (v_alocacao ? 'percentual') THEN NULLIF((v_alocacao->>'percentual')::numeric, 0)
        WHEN v_total_alocado <> 0 THEN ROUND(((v_alocacao->>'valor')::numeric / v_total_alocado) * 100, 6)
        ELSE NULL
      END,
      true
    );
    v_count_links := v_count_links + 1;
  END LOOP;

  IF jsonb_array_length(p_alocacoes) = 1 THEN
    IF p_card_tipo IN ('saldo','investimento','limite_cheque_especial') THEN
      UPDATE public.cash_transactions
      SET bank_account_id = v_primary_account,
          description = COALESCE(description, '') || ' [vinculado ao card ' || p_card_tipo || ' em ' || to_char(now(), 'DD/MM/YYYY') || ']'
      WHERE empresa_id = v_empresa_id
        AND bank_account_id IS NULL
        AND COALESCE(is_internal_transfer, false) = false;
      GET DIAGNOSTICS v_count_cash = ROW_COUNT;
    END IF;

    IF p_card_tipo IN ('contas_pagar','fatura') THEN
      UPDATE public.accounts_payable
      SET bank_account_id = v_primary_account
      WHERE empresa_id = v_empresa_id
        AND bank_account_id IS NULL
        AND status IN ('paid','pending','overdue');
      GET DIAGNOSTICS v_count_payable = ROW_COUNT;
    END IF;

    IF p_card_tipo = 'contas_receber' THEN
      UPDATE public.accounts_receivable
      SET bank_account_id = v_primary_account
      WHERE empresa_id = v_empresa_id
        AND bank_account_id IS NULL
        AND status IN ('paid','pending','overdue');
      GET DIAGNOSTICS v_count_receivable = ROW_COUNT;
    END IF;
  END IF;

  INSERT INTO public.ajustes_manuais_log (
    user_id, empresa_id, entidade_tipo, entidade_id, campo, valor_anterior, valor_novo, motivo
  ) VALUES (
    v_user_id, v_empresa_id, 'financeiro_card_vinculo', gen_random_uuid(), p_card_tipo,
    v_total_base, v_total_alocado, COALESCE(p_motivo, 'Vínculo em massa do card financeiro')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'card_tipo', p_card_tipo,
    'vinculos', v_count_links,
    'cash_transactions_atualizados', v_count_cash,
    'accounts_payable_atualizados', v_count_payable,
    'accounts_receivable_atualizados', v_count_receivable
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.aplicar_vinculo_card_financeiro_futuro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_id uuid;
  v_card_tipo text;
BEGIN
  IF NEW.bank_account_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'accounts_payable' THEN
    v_card_tipo := 'contas_pagar';
  ELSIF TG_TABLE_NAME = 'accounts_receivable' THEN
    v_card_tipo := 'contas_receber';
  ELSE
    v_card_tipo := 'saldo';
  END IF;

  SELECT fcv.bank_account_id INTO v_account_id
  FROM public.financeiro_card_vinculos fcv
  WHERE fcv.empresa_id = NEW.empresa_id
    AND fcv.card_tipo = v_card_tipo
    AND fcv.ativo = true
  ORDER BY fcv.percentual DESC NULLS LAST, fcv.created_at ASC
  LIMIT 1;

  IF v_account_id IS NOT NULL THEN
    NEW.bank_account_id := v_account_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vinculo_card_future_cash ON public.cash_transactions;
CREATE TRIGGER trg_vinculo_card_future_cash
BEFORE INSERT ON public.cash_transactions
FOR EACH ROW
EXECUTE FUNCTION public.aplicar_vinculo_card_financeiro_futuro();

DROP TRIGGER IF EXISTS trg_vinculo_card_future_payable ON public.accounts_payable;
CREATE TRIGGER trg_vinculo_card_future_payable
BEFORE INSERT ON public.accounts_payable
FOR EACH ROW
EXECUTE FUNCTION public.aplicar_vinculo_card_financeiro_futuro();

DROP TRIGGER IF EXISTS trg_vinculo_card_future_receivable ON public.accounts_receivable;
CREATE TRIGGER trg_vinculo_card_future_receivable
BEFORE INSERT ON public.accounts_receivable
FOR EACH ROW
EXECUTE FUNCTION public.aplicar_vinculo_card_financeiro_futuro();