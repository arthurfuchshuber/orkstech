
-- Helper: usuário é membro ativo (ou owner) da empresa
CREATE OR REPLACE FUNCTION public.is_empresa_member(_empresa_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresa_membros em
    WHERE em.empresa_id = _empresa_id
      AND em.user_id = auth.uid()
      AND em.ativo = true
  ) OR EXISTS (
    SELECT 1 FROM public.empresas e
    WHERE e.id = _empresa_id
      AND e.user_id = auth.uid()
  );
$$;

-- Aplica policies de membro em todas as tabelas com empresa_id
DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'accounts_payable','accounts_receivable','ajustes_manuais_log','asaas_cobrancas',
    'automacoes','bancos','cash_transactions','cashflow_forecasts','cashflow_imports',
    'categorias_cadastro','categorias_financeiras','centros_custo','clicksign_documentos',
    'cliente_documentos','cliente_interacoes','cliente_produtos','clientes','colaboradores',
    'contas_bancarias','dre_regras','empresa_socios','financeiro_card_vinculos',
    'formas_pagamento','fornecedores','historico_sistema','integracoes_credenciais',
    'integration_notification_prefs','manual_bank_transactions','notificacoes_sistema',
    'produtos','user_permissions'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Members can view %I" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "Members can view %I" ON public.%I FOR SELECT USING (public.is_empresa_member(empresa_id));', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "Members can insert %I" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "Members can insert %I" ON public.%I FOR INSERT WITH CHECK (public.is_empresa_member(empresa_id));', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "Members can update %I" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "Members can update %I" ON public.%I FOR UPDATE USING (public.is_empresa_member(empresa_id));', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "Members can delete %I" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "Members can delete %I" ON public.%I FOR DELETE USING (public.is_empresa_member(empresa_id));', t, t);
  END LOOP;
END $$;

-- pluggy_investments não tem empresa_id direto — herda via bank_account → mas vamos liberar via owner mapping
-- (o sistema já trata via ownerUserId); manter como está.
