
-- Create a security definer function to check if current user is Super Admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.niveis_permissao np ON np.id = p.nivel_permissao_id
    WHERE p.user_id = auth.uid()
      AND np.nome = 'Super Admin'
  )
$$;

-- Add Super Admin SELECT policies to all data tables
CREATE POLICY "Super admins can view all accounts_payable"
ON public.accounts_payable FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all contas_bancarias"
ON public.contas_bancarias FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all clientes"
ON public.clientes FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all fornecedores"
ON public.fornecedores FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all categorias_financeiras"
ON public.categorias_financeiras FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all categorias_cadastro"
ON public.categorias_cadastro FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all centros_custo"
ON public.centros_custo FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all formas_pagamento"
ON public.formas_pagamento FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all tipos_forma_pagamento"
ON public.tipos_forma_pagamento FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all bancos"
ON public.bancos FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all cash_transactions"
ON public.cash_transactions FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all colaboradores"
ON public.colaboradores FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all cliente_documentos"
ON public.cliente_documentos FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all cliente_interacoes"
ON public.cliente_interacoes FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all cliente_interacao_tipos"
ON public.cliente_interacao_tipos FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all historico_sistema"
ON public.historico_sistema FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all notificacoes_sistema"
ON public.notificacoes_sistema FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all automacoes"
ON public.automacoes FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all automacao_gatilhos"
ON public.automacao_gatilhos FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all automacao_acoes_tipo"
ON public.automacao_acoes_tipo FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all menus"
ON public.menus FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all pluggy_connections"
ON public.pluggy_connections FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all pluggy_bank_accounts"
ON public.pluggy_bank_accounts FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all pluggy_transactions"
ON public.pluggy_transactions FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all pluggy_notifications"
ON public.pluggy_notifications FOR SELECT TO authenticated
USING (public.is_super_admin());

CREATE POLICY "Super admins can view all produtos"
ON public.produtos FOR SELECT TO authenticated
USING (public.is_super_admin());
