
-- 1) Coluna para identificar movimentos de caixinha
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS is_caixinha_movement boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_cash_tx_caixinha
  ON public.cash_transactions(bank_account_id) WHERE is_caixinha_movement = true;

-- 2) Função: obter ou criar categoria de movimentação de caixinha
CREATE OR REPLACE FUNCTION public.get_or_create_caixinha_categoria(
  p_user_id uuid, p_empresa_id uuid, p_tipo tipo_financeiro
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_nome text;
BEGIN
  v_nome := CASE WHEN p_tipo = 'receita'
                 THEN 'Resgate de Caixinha'
                 ELSE 'Aplicação em Caixinha' END;

  SELECT id INTO v_id
  FROM categorias_financeiras
  WHERE user_id = p_user_id
    AND (empresa_id IS NOT DISTINCT FROM p_empresa_id)
    AND nome = v_nome
    AND tipo = p_tipo
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO categorias_financeiras (user_id, empresa_id, nome, tipo, ativo, ordem)
    VALUES (p_user_id, p_empresa_id, v_nome, p_tipo, true, 9998)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- 3) Função: mover caixinha (aplicar ou resgatar)
-- p_direcao: 'aplicar' (conta -> caixinha) ou 'resgatar' (caixinha -> conta)
CREATE OR REPLACE FUNCTION public.mover_caixinha_conta(
  p_conta_id uuid,
  p_amount numeric,
  p_direcao text,
  p_descricao text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_user_id uuid;
  v_empresa_id uuid;
  v_categoria_id uuid;
  v_tx_type cash_transaction_type;
  v_tipo_cat tipo_financeiro;
  v_tx_id uuid;
  v_descricao text;
  v_saldo_invest numeric;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser maior que zero';
  END IF;

  IF p_direcao NOT IN ('aplicar', 'resgatar') THEN
    RAISE EXCEPTION 'Direção inválida (use aplicar ou resgatar)';
  END IF;

  SELECT user_id, empresa_id, COALESCE(saldo_investimento,0)
    INTO v_user_id, v_empresa_id, v_saldo_invest
  FROM contas_bancarias WHERE id = p_conta_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Conta bancária não encontrada';
  END IF;

  IF p_direcao = 'aplicar' THEN
    -- Sai da conta, entra na caixinha
    v_tx_type := 'expense';
    v_tipo_cat := 'despesa';
    v_descricao := COALESCE(p_descricao, 'Aplicação em caixinha');
  ELSE
    -- Sai da caixinha, entra na conta
    IF v_saldo_invest < p_amount THEN
      RAISE EXCEPTION 'Saldo de caixinha insuficiente (disponível: %, solicitado: %)',
        v_saldo_invest, p_amount;
    END IF;
    v_tx_type := 'income';
    v_tipo_cat := 'receita';
    v_descricao := COALESCE(p_descricao, 'Resgate de caixinha');
  END IF;

  v_categoria_id := get_or_create_caixinha_categoria(v_user_id, v_empresa_id, v_tipo_cat);

  -- Cria lançamento na conta (afeta saldo via calcular_saldo_esperado_conta)
  INSERT INTO cash_transactions (
    user_id, empresa_id, type, amount, transaction_date,
    description, bank_account_id, categoria_financeira_id,
    is_internal_transfer, is_caixinha_movement
  ) VALUES (
    v_user_id, v_empresa_id, v_tx_type, p_amount, CURRENT_DATE,
    v_descricao, p_conta_id, v_categoria_id,
    true, true
  )
  RETURNING id INTO v_tx_id;

  -- Atualiza saldo_investimento da conta
  UPDATE contas_bancarias
     SET saldo_investimento = CASE
           WHEN p_direcao = 'aplicar' THEN COALESCE(saldo_investimento,0) + p_amount
           ELSE COALESCE(saldo_investimento,0) - p_amount
         END,
         updated_at = now()
   WHERE id = p_conta_id;

  RETURN v_tx_id;
END;
$$;

-- 4) Função para retornar saldo atual + saldo de investimento de uma conta
CREATE OR REPLACE FUNCTION public.get_conta_saldos(p_conta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_saldo_atual numeric;
  v_invest numeric;
BEGIN
  v_saldo_atual := public.calcular_saldo_esperado_conta(p_conta_id);
  SELECT COALESCE(saldo_investimento,0) INTO v_invest
    FROM contas_bancarias WHERE id = p_conta_id;
  RETURN jsonb_build_object(
    'saldo_atual', v_saldo_atual,
    'saldo_investimento', COALESCE(v_invest,0),
    'saldo_total', v_saldo_atual + COALESCE(v_invest,0)
  );
END;
$$;
