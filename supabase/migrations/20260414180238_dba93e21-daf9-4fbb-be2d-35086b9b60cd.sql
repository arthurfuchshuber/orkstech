DROP POLICY IF EXISTS "Super admins can update all menus" ON public.menus;
CREATE POLICY "Super admins can update all menus"
ON public.menus
FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (true);