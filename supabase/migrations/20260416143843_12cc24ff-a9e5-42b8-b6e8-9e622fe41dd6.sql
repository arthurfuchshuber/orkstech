DROP POLICY IF EXISTS "Owners and super admins can delete accounts_payable" ON public.accounts_payable;
CREATE POLICY "Owners and super admins can delete accounts_payable"
ON public.accounts_payable
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  OR public.is_super_admin()
);