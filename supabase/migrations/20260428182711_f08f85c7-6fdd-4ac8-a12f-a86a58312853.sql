-- ── 1. Campos de transferência interna em cash_transactions ──
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS is_internal_transfer boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS transfer_pair_id uuid;

CREATE INDEX IF NOT EXISTS idx_cash_tx_internal_transfer
  ON public.cash_transactions (user_id, is_internal_transfer);

CREATE INDEX IF NOT EXISTS idx_cash_tx_orphan
  ON public.cash_transactions (user_id) WHERE bank_account_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_payable_orphan
  ON public.accounts_payable (user_id) WHERE bank_account_id IS NULL AND status = 'paid';

CREATE INDEX IF NOT EXISTS idx_receivable_orphan
  ON public.accounts_receivable (user_id) WHERE bank_account_id IS NULL AND status = 'paid';

-- ── 2. Categoria especial "Transferência entre Contas" ──
CREATE OR REPLACE FUNCTION public.get_or_create_transferencia_categoria(
  p_user_id uuid,
  p_empresa_id uuid,
  p_tipo tipo_financeiro
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id uuid;
  v_nome text;
BEGIN
  v_nome := CASE WHEN p_tipo = 'receita'
                 THEN 'Transferência entre Contas (Entrada)'
                 ELSE 'Transferência entre Contas (Saída)' END;

  SELECT id INTO v_id
  FROM public.categorias_financeiras
  WHERE user_id = p_user_id
    AND (empresa_id IS NOT DISTINCT FROM p_empresa_id)
    AND nome = v_nome
    AND tipo = p_tipo
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.categorias_financeiras (user_id, empresa_id, nome, tipo, ativo, ordem)
    VALUES (p_user_id, p_empresa_id, v_nome, p_tipo, true, 9998)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- ── 3. Criar transferência entre contas ──
CREATE OR REPLACE FUNCTION public.criar_transferencia_entre_contas(
  p_conta_origem uuid,
  p_conta_destino uuid,
  p_valor numeric,
  p_data date DEFAULT CURRENT_DATE,
  p_descricao text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_empresa_id uuid;
  v_origem RECORD;
  v_destino RECORD;
  v_pair_id uuid;
  v_saida_id uuid;
  v_entrada_id uuid;
  v_cat_saida uuid;
  v_cat_entrada uuid;
  v_descricao text;
BEGIN
  IF p_conta_origem = p_conta_destino THEN
    RAISE EXCEPTION 'Conta origem e destino não podem ser iguais';
  END IF;
  IF p_valor <= 0 THEN
    RAISE EXCEPTION 'Valor deve ser positivo';
  END IF;

  SELECT * INTO v_origem FROM public.contas_bancarias WHERE id = p_conta_origem;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta origem não encontrada'; END IF;
  SELECT * INTO v_destino FROM public.contas_bancarias WHERE id = p_conta_destino;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta destino não encontrada'; END IF;

  IF v_origem.user_id <> auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  v_user_id := v_origem.user_id;
  v_empresa_id := v_origem.empresa_id;
  v_pair_id := gen_random_uuid();

  v_cat_saida := public.get_or_create_transferencia_categoria(v_user_id, v_empresa_id, 'despesa');
  v_cat_entrada := public.get_or_create_transferencia_categoria(v_user_id, v_empresa_id, 'receita');

  v_descricao := COALESCE(p_descricao, 'Transferência: ' || v_origem.nome || ' → ' || v_destino.nome);

  INSERT INTO public.cash_transactions (
    user_id, empresa_id, bank_account_id, type, amount,
    transaction_date, description, categoria_financeira_id,
    is_internal_transfer, transfer_pair_id
  ) VALUES (
    v_user_id, v_empresa_id, p_conta_origem, 'expense', p_valor,
    p_data, v_descricao, v_cat_saida, true, v_pair_id
  ) RETURNING id INTO v_saida_id;

  INSERT INTO public.cash_transactions (
    user_id, empresa_id, bank_account_id, type, amount,
    transaction_date, description, categoria_financeira_id,
    is_internal_transfer, transfer_pair_id
  ) VALUES (
    v_user_id, v_empresa_id, p_conta_destino, 'income', p_valor,
    p_data, v_descricao, v_cat_entrada, true, v_pair_id
  ) RETURNING id INTO v_entrada_id;

  RETURN jsonb_build_object(
    'ok', true,
    'pair_id', v_pair_id,
    'saida_id', v_saida_id,
    'entrada_id', v_entrada_id,
    'valor', p_valor
  );
END;
$$;

-- ── 4. Realocar lançamentos órfãos ──
-- p_alocacoes: jsonb array no formato:
--   [{ "bank_account_id": "uuid", "valor": 5000.00 }, ...]
-- A soma dos valores deve corresponder ao total de saldo órfão.
-- Cria 1 lançamento de "Realocação inicial" (income) em cada conta destino,
-- e 1 lançamento de "Realocação inicial" (expense) genérico equivalente para zerar o órfão.
CREATE OR REPLACE FUNCTION public.realocar_lancamentos_orfaos(
  p_alocacoes jsonb,
  p_motivo text DEFAULT NULL
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
  v_conta RECORD;
  v_total_alocado numeric := 0;
  v_total_orfao numeric := 0;
  v_cat_entrada uuid;
  v_cat_saida uuid;
  v_pair_id uuid := gen_random_uuid();
  v_count int := 0;
  v_descricao text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Calcula total órfão (soma de cash_transactions sem bank_account_id)
  SELECT COALESCE(SUM(CASE WHEN type = 'income' THEN amount ELSE -amount END), 0),
         MAX(empresa_id)
    INTO v_total_orfao, v_empresa_id
  FROM public.cash_transactions
  WHERE user_id = v_user_id
    AND bank_account_id IS NULL;

  IF v_total_orfao = 0 THEN
    RAISE EXCEPTION 'Nenhum valor órfão encontrado';
  END IF;

  -- Valida soma
  FOR v_alocacao IN SELECT * FROM jsonb_array_elements(p_alocacoes) LOOP
    v_total_alocado := v_total_alocado + COALESCE((v_alocacao->>'valor')::numeric, 0);
  END LOOP;

  IF ABS(v_total_alocado - v_total_orfao) > 0.01 THEN
    RAISE EXCEPTION 'Soma das alocações (%) difere do total órfão (%)', v_total_alocado, v_total_orfao;
  END IF;

  v_cat_entrada := public.get_or_create_transferencia_categoria(v_user_id, v_empresa_id, 'receita');
  v_cat_saida := public.get_or_create_transferencia_categoria(v_user_id, v_empresa_id, 'despesa');

  -- Cria entrada em cada conta destino
  FOR v_alocacao IN SELECT * FROM jsonb_array_elements(p_alocacoes) LOOP
    SELECT * INTO v_conta FROM public.contas_bancarias
    WHERE id = (v_alocacao->>'bank_account_id')::uuid AND user_id = v_user_id;
    IF NOT FOUND THEN RAISE EXCEPTION 'Conta % não encontrada', v_alocacao->>'bank_account_id'; END IF;

    v_descricao := 'Realocação de saldo órfão' ||
      CASE WHEN p_motivo IS NOT NULL THEN ' — ' || p_motivo ELSE '' END;

    INSERT INTO public.cash_transactions (
      user_id, empresa_id, bank_account_id, type, amount,
      transaction_date, description, categoria_financeira_id,
      is_internal_transfer, transfer_pair_id
    ) VALUES (
      v_user_id, v_empresa_id, v_conta.id, 'income',
      (v_alocacao->>'valor')::numeric,
      CURRENT_DATE, v_descricao, v_cat_entrada, true, v_pair_id
    );
    v_count := v_count + 1;
  END LOOP;

  -- Marca os órfãos antigos como neutralizados (transferência interna),
  -- mantendo histórico mas sem afetar saldos por conta.
  UPDATE public.cash_transactions
    SET is_internal_transfer = true,
        transfer_pair_id = v_pair_id,
        description = COALESCE(description, '') || ' [realocado em ' || to_char(now(), 'DD/MM/YYYY') || ']'
    WHERE user_id = v_user_id
      AND bank_account_id IS NULL;

  -- Log
  INSERT INTO public.ajustes_manuais_log (
    user_id, empresa_id, entidade_tipo, entidade_id,
    campo, valor_anterior, valor_novo, motivo
  ) VALUES (
    v_user_id, v_empresa_id, 'realocacao_orfaos', v_pair_id,
    'realocacao', v_total_orfao, v_total_alocado,
    COALESCE(p_motivo, 'Realocação de valores órfãos')
  );

  RETURN jsonb_build_object(
    'ok', true,
    'pair_id', v_pair_id,
    'contas_destino', v_count,
    'total_realocado', v_total_alocado
  );
END;
$$;