DROP POLICY IF EXISTS "Super admins can update all pluggy_transactions" ON public.pluggy_transactions;

CREATE POLICY "Super admins can update all pluggy_transactions"
ON public.pluggy_transactions
FOR UPDATE
TO authenticated
USING (public.is_super_admin())
WITH CHECK (public.is_super_admin());