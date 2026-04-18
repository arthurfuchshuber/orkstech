-- Permitir Super Admin gerenciar dre_regras em nome de qualquer usuário (mesmo padrão do restante do sistema)
CREATE POLICY "Super admins can insert any dre_regras" ON public.dre_regras
  FOR INSERT TO authenticated
  WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins can update any dre_regras" ON public.dre_regras
  FOR UPDATE TO authenticated
  USING (public.is_super_admin());

CREATE POLICY "Super admins can delete any dre_regras" ON public.dre_regras
  FOR DELETE TO authenticated
  USING (public.is_super_admin());