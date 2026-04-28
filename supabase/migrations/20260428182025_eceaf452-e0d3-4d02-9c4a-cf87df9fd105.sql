-- Limite total contratado do cartão (fonte de verdade do banco)
ALTER TABLE public.contas_bancarias
  ADD COLUMN IF NOT EXISTS limite_credito_total numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS limite_credito_total_sincronizado numeric NOT NULL DEFAULT 0;

-- Função: cria lançamento de ajuste de fatura no extrato do cartão
CREATE OR REPLACE FUNCTION public.criar_lancamento_ajuste_fatura(
  p_conta_id uuid,
  p_delta numeric,
  p_motivo text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conta RECORD;
  v_categoria_id uuid;
  v_tipo text;
BEGIN
  SELECT * INTO v_conta FROM public.contas_bancarias WHERE id = p_conta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
  IF v_conta.user_id <> auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;
  IF abs(coalesce(p_delta, 0)) < 0.005 THEN
    RETURN jsonb_build_object('ok', true, 'skipped', true);
  END IF;

  -- delta > 0 = fatura aumentou = despesa adicional
  v_tipo := CASE WHEN p_delta > 0 THEN 'expense' ELSE 'income' END;

  -- Reusa a categoria de Ajuste de Saldo já existente
  v_categoria_id := public.get_or_create_ajuste_saldo_categoria(v_conta.empresa_id, v_conta.user_id, v_tipo);

  INSERT INTO public.cash_transactions (
    user_id, empresa_id, bank_account_id, type, amount,
    transaction_date, description, categoria_financeira_id
  ) VALUES (
    v_conta.user_id, v_conta.empresa_id, p_conta_id, v_tipo::cash_tx_type, abs(p_delta),
    CURRENT_DATE,
    'Ajuste de Fatura' || CASE WHEN p_motivo IS NOT NULL THEN ' — ' || p_motivo ELSE '' END,
    v_categoria_id
  );

  RETURN jsonb_build_object('ok', true, 'delta', p_delta, 'categoria_id', v_categoria_id);
END;
$function$;

-- Reescreve a função de ajuste para integrar limite_credito ↔ fatura
CREATE OR REPLACE FUNCTION public.aplicar_ajuste_conta_bancaria(
  p_conta_id uuid,
  p_campo text,
  p_novo_valor numeric,
  p_motivo text DEFAULT NULL,
  p_limite_total numeric DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_conta RECORD;
  v_valor_antigo numeric;
  v_delta numeric;
  v_limite_total numeric;
  v_disponivel_atual numeric;
  v_fatura_atual numeric;
  v_nova_fatura numeric;
  v_novo_disponivel numeric;
  v_delta_fatura numeric;
  v_delta_disponivel numeric;
BEGIN
  SELECT * INTO v_conta FROM public.contas_bancarias WHERE id = p_conta_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Conta não encontrada'; END IF;
  IF v_conta.user_id <> auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  IF p_campo = 'saldo' THEN
    v_valor_antigo := v_conta.saldo_inicial + v_conta.saldo_sincronizado + v_conta.saldo_ajuste_manual;
    v_delta := p_novo_valor - (v_conta.saldo_inicial + v_conta.saldo_sincronizado);
    UPDATE public.contas_bancarias
      SET saldo_ajuste_manual = v_delta, ajuste_motivo = p_motivo, ajuste_atualizado_em = now()
      WHERE id = p_conta_id;

  ELSIF p_campo = 'investimento' THEN
    v_valor_antigo := v_conta.investimento_sincronizado + v_conta.investimento_ajuste_manual + v_conta.saldo_investimento;
    v_delta := p_novo_valor - (v_conta.investimento_sincronizado + v_conta.saldo_investimento);
    UPDATE public.contas_bancarias
      SET investimento_ajuste_manual = v_delta, ajuste_motivo = p_motivo, ajuste_atualizado_em = now()
      WHERE id = p_conta_id;

  ELSIF p_campo = 'limite_cheque_especial' THEN
    v_valor_antigo := v_conta.limite_cheque_especial;
    UPDATE public.contas_bancarias
      SET limite_cheque_especial = p_novo_valor, ajuste_motivo = p_motivo, ajuste_atualizado_em = now()
      WHERE id = p_conta_id;

  ELSIF p_campo = 'limite_credito' THEN
    -- Ajusta o DISPONÍVEL mantendo limite total fixo → recalcula fatura
    v_disponivel_atual := v_conta.limite_credito_disponivel_sincronizado + v_conta.limite_credito_disponivel_ajuste_manual;
    v_fatura_atual := v_conta.fatura_aberto_sincronizada + v_conta.fatura_aberto_ajuste_manual;
    v_limite_total := COALESCE(NULLIF(p_limite_total, 0), NULLIF(v_conta.limite_credito_total, 0), v_disponivel_atual + v_fatura_atual);

    IF p_novo_valor > v_limite_total THEN
      RAISE EXCEPTION 'Disponível (%) não pode ser maior que o limite total (%)', p_novo_valor, v_limite_total;
    END IF;

    v_nova_fatura := v_limite_total - p_novo_valor;
    v_delta_disponivel := p_novo_valor - v_conta.limite_credito_disponivel_sincronizado;
    v_delta_fatura := v_nova_fatura - v_fatura_atual;

    UPDATE public.contas_bancarias
      SET limite_credito_disponivel_ajuste_manual = v_delta_disponivel,
          fatura_aberto_ajuste_manual = v_nova_fatura - v_conta.fatura_aberto_sincronizada,
          limite_credito_total = v_limite_total,
          ajuste_motivo = p_motivo,
          ajuste_atualizado_em = now()
      WHERE id = p_conta_id;

    -- Lança ajuste contábil no extrato do cartão (delta da fatura)
    IF abs(v_delta_fatura) >= 0.005 THEN
      PERFORM public.criar_lancamento_ajuste_fatura(p_conta_id, v_delta_fatura, p_motivo);
    END IF;

    v_valor_antigo := v_disponivel_atual;

  ELSIF p_campo = 'fatura' THEN
    -- Ajusta a FATURA mantendo limite total fixo → recalcula disponível + cria lançamento contábil
    v_disponivel_atual := v_conta.limite_credito_disponivel_sincronizado + v_conta.limite_credito_disponivel_ajuste_manual;
    v_fatura_atual := v_conta.fatura_aberto_sincronizada + v_conta.fatura_aberto_ajuste_manual;
    v_limite_total := COALESCE(NULLIF(p_limite_total, 0), NULLIF(v_conta.limite_credito_total, 0), v_disponivel_atual + v_fatura_atual);

    IF p_novo_valor > v_limite_total THEN
      RAISE EXCEPTION 'Fatura (%) não pode ser maior que o limite total (%)', p_novo_valor, v_limite_total;
    END IF;

    v_novo_disponivel := v_limite_total - p_novo_valor;
    v_delta_fatura := p_novo_valor - v_fatura_atual;
    v_delta_disponivel := v_novo_disponivel - v_disponivel_atual;

    UPDATE public.contas_bancarias
      SET fatura_aberto_ajuste_manual = p_novo_valor - v_conta.fatura_aberto_sincronizada,
          limite_credito_disponivel_ajuste_manual = v_novo_disponivel - v_conta.limite_credito_disponivel_sincronizado,
          limite_credito_total = v_limite_total,
          ajuste_motivo = p_motivo,
          ajuste_atualizado_em = now()
      WHERE id = p_conta_id;

    -- Lança ajuste contábil no extrato (delta da fatura)
    IF abs(v_delta_fatura) >= 0.005 THEN
      PERFORM public.criar_lancamento_ajuste_fatura(p_conta_id, v_delta_fatura, p_motivo);
    END IF;

    v_valor_antigo := v_fatura_atual;

  ELSE
    RAISE EXCEPTION 'Campo inválido: %', p_campo;
  END IF;

  INSERT INTO public.ajustes_manuais_log (
    user_id, empresa_id, entidade_tipo, entidade_id, campo, valor_anterior, valor_novo, motivo
  ) VALUES (
    auth.uid(), v_conta.empresa_id, 'conta_bancaria', p_conta_id, p_campo, v_valor_antigo, p_novo_valor, p_motivo
  );

  RETURN jsonb_build_object('ok', true, 'campo', p_campo, 'valor_novo', p_novo_valor);
END;
$function$;