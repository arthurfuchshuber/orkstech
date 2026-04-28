
CREATE OR REPLACE FUNCTION public.get_or_create_ajuste_saldo_categoria(
  p_user_id uuid,
  p_empresa_id uuid,
  p_tipo tipo_financeiro
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_nome text;
BEGIN
  v_nome := CASE WHEN p_tipo = 'receita' THEN 'Ajuste de Saldo (Entrada)' ELSE 'Ajuste de Saldo (Saída)' END;

  SELECT id INTO v_id
  FROM categorias_financeiras
  WHERE user_id = p_user_id
    AND (empresa_id IS NOT DISTINCT FROM p_empresa_id)
    AND nome = v_nome
    AND tipo = p_tipo
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO categorias_financeiras (user_id, empresa_id, nome, tipo, ativo, ordem)
    VALUES (p_user_id, p_empresa_id, v_nome, p_tipo, true, 9999)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.criar_lancamento_ajuste_saldo(
  p_conta_id uuid,
  p_delta numeric,
  p_motivo text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_empresa_id uuid;
  v_categoria_id uuid;
  v_tipo cash_transaction_type;
  v_tipo_cat tipo_financeiro;
  v_transaction_id uuid;
  v_descricao text;
BEGIN
  SELECT user_id, empresa_id INTO v_user_id, v_empresa_id
  FROM contas_bancarias WHERE id = p_conta_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Conta bancária não encontrada';
  END IF;

  IF p_delta = 0 THEN
    RAISE EXCEPTION 'Delta zero — nenhum ajuste necessário';
  END IF;

  IF p_delta > 0 THEN
    v_tipo := 'income';
    v_tipo_cat := 'receita';
  ELSE
    v_tipo := 'expense';
    v_tipo_cat := 'despesa';
  END IF;

  v_categoria_id := get_or_create_ajuste_saldo_categoria(v_user_id, v_empresa_id, v_tipo_cat);

  v_descricao := 'Ajuste manual de saldo: ' ||
    CASE WHEN p_delta > 0 THEN '+' ELSE '' END ||
    'R$ ' || to_char(p_delta, 'FM999G999G990D00') ||
    CASE WHEN p_motivo IS NOT NULL AND length(trim(p_motivo)) > 0
         THEN ' (' || p_motivo || ')'
         ELSE '' END;

  INSERT INTO cash_transactions (
    user_id, empresa_id, type, amount, transaction_date,
    description, bank_account_id, categoria_financeira_id
  ) VALUES (
    v_user_id, v_empresa_id, v_tipo, ABS(p_delta), CURRENT_DATE,
    v_descricao, p_conta_id, v_categoria_id
  )
  RETURNING id INTO v_transaction_id;

  INSERT INTO ajustes_manuais_log (
    user_id, empresa_id, entidade_tipo, entidade_id,
    campo, valor_anterior, valor_novo, motivo
  ) VALUES (
    v_user_id, v_empresa_id, 'cash_transaction', v_transaction_id,
    'saldo_reconciliado', 0, p_delta,
    COALESCE(p_motivo, 'Reconciliação automática')
  );

  RETURN v_transaction_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.calcular_saldo_esperado_conta(p_conta_id uuid)
RETURNS numeric
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_saldo_inicial numeric;
  v_saldo_sincronizado numeric;
  v_origem origem_dado;
  v_cash_in numeric;
  v_cash_out numeric;
BEGIN
  SELECT COALESCE(saldo_inicial, 0), COALESCE(saldo_sincronizado, 0), origem
  INTO v_saldo_inicial, v_saldo_sincronizado, v_origem
  FROM contas_bancarias WHERE id = p_conta_id;

  IF v_saldo_inicial IS NULL THEN RETURN 0; END IF;

  SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END), 0)
  INTO v_cash_in, v_cash_out
  FROM cash_transactions WHERE bank_account_id = p_conta_id;

  IF v_origem IN ('pluggy', 'hibrido') THEN
    RETURN v_saldo_sincronizado + v_cash_in - v_cash_out;
  END IF;

  RETURN v_saldo_inicial + v_cash_in - v_cash_out;
END;
$$;
