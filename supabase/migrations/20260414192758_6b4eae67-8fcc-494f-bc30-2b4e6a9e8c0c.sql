
-- Super admin INSERT policies
CREATE POLICY "Super admins can create categorias_financeiras"
ON public.categorias_financeiras FOR INSERT
TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update categorias_financeiras"
ON public.categorias_financeiras FOR UPDATE
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can delete categorias_financeiras"
ON public.categorias_financeiras FOR DELETE
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can create centros_custo"
ON public.centros_custo FOR INSERT
TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update centros_custo"
ON public.centros_custo FOR UPDATE
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can delete centros_custo"
ON public.centros_custo FOR DELETE
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can create formas_pagamento"
ON public.formas_pagamento FOR INSERT
TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update formas_pagamento"
ON public.formas_pagamento FOR UPDATE
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can delete formas_pagamento"
ON public.formas_pagamento FOR DELETE
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can create categorias_cadastro"
ON public.categorias_cadastro FOR INSERT
TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update categorias_cadastro"
ON public.categorias_cadastro FOR UPDATE
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can delete categorias_cadastro"
ON public.categorias_cadastro FOR DELETE
TO authenticated
USING (is_super_admin());
