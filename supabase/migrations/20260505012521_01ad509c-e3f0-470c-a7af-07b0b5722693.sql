
CREATE TABLE IF NOT EXISTS public.user_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid NOT NULL,
  wizard_completed_at timestamptz,
  checklist_dismissed boolean NOT NULL DEFAULT false,
  completed_steps jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, empresa_id)
);

ALTER TABLE public.user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own onboarding select" ON public.user_onboarding FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own onboarding insert" ON public.user_onboarding FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own onboarding update" ON public.user_onboarding FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER trg_user_onboarding_updated_at
BEFORE UPDATE ON public.user_onboarding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

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
      'cliente', _has_cliente,
      'fornecedor', _has_fornecedor,
      'lancamento', _has_lancamento
    )
  );

  RETURN _result;
END;
$$;

CREATE OR REPLACE FUNCTION public.marcar_wizard_concluido(_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_onboarding (user_id, empresa_id, wizard_completed_at)
  VALUES (auth.uid(), _empresa_id, now())
  ON CONFLICT (user_id, empresa_id)
  DO UPDATE SET wizard_completed_at = COALESCE(public.user_onboarding.wizard_completed_at, now()), updated_at = now();
END;
$$;

CREATE OR REPLACE FUNCTION public.dispensar_checklist_onboarding(_empresa_id uuid, _dismiss boolean DEFAULT true)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_onboarding (user_id, empresa_id, checklist_dismissed)
  VALUES (auth.uid(), _empresa_id, _dismiss)
  ON CONFLICT (user_id, empresa_id)
  DO UPDATE SET checklist_dismissed = _dismiss, updated_at = now();
END;
$$;
