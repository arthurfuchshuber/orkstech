CREATE OR REPLACE FUNCTION public.get_onboarding_status(_empresa_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _row public.user_onboarding;
  _has_empresa boolean;
  _has_conta boolean;
  _has_saldo boolean;
  _has_centro boolean;
  _has_categoria boolean;
  _has_forma boolean;
  _has_cliente boolean;
  _has_fornecedor boolean;
  _has_lancamento boolean;
  _result jsonb;
BEGIN
  IF _user_id IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT * INTO _row FROM public.user_onboarding
  WHERE user_id = _user_id AND empresa_id = _empresa_id;

  SELECT EXISTS(SELECT 1 FROM public.empresas WHERE id = _empresa_id) INTO _has_empresa;
  SELECT EXISTS(SELECT 1 FROM public.contas_bancarias WHERE empresa_id = _empresa_id AND ativo = true) INTO _has_conta;
  SELECT EXISTS(SELECT 1 FROM public.contas_bancarias WHERE empresa_id = _empresa_id AND ativo = true AND (saldo_inicial <> 0 OR saldo_sincronizado <> 0)) INTO _has_saldo;
  SELECT EXISTS(SELECT 1 FROM public.centros_custo WHERE empresa_id = _empresa_id AND ativo = true) INTO _has_centro;
  SELECT EXISTS(SELECT 1 FROM public.categorias_financeiras WHERE empresa_id = _empresa_id AND ativo = true) INTO _has_categoria;
  SELECT EXISTS(SELECT 1 FROM public.formas_pagamento WHERE empresa_id = _empresa_id AND ativo = true) INTO _has_forma;
  SELECT EXISTS(SELECT 1 FROM public.clientes WHERE empresa_id = _empresa_id) INTO _has_cliente;
  SELECT EXISTS(SELECT 1 FROM public.fornecedores WHERE empresa_id = _empresa_id) INTO _has_fornecedor;
  SELECT EXISTS(SELECT 1 FROM public.cash_transactions WHERE empresa_id = _empresa_id LIMIT 1) INTO _has_lancamento;

  _result := jsonb_build_object(
    'wizard_completed_at', _row.wizard_completed_at,
    'checklist_dismissed', COALESCE(_row.checklist_dismissed, false),
    'steps', jsonb_build_object(
      'empresa', _has_empresa,
      'conta', _has_conta,
      'saldo', _has_saldo,
      'centro_custo', _has_centro,
      'categoria', _has_categoria,
      'forma_pagamento', _has_forma,
      'cliente', _has_cliente,
      'fornecedor', _has_fornecedor,
      'lancamento', _has_lancamento
    )
  );

  RETURN _result;
END;
$$;