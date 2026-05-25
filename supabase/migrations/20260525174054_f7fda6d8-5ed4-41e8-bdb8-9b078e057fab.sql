DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    is_super_admin()
    OR (
      (nivel_permissao_id IS NOT DISTINCT FROM (SELECT p.nivel_permissao_id FROM public.profiles p WHERE p.user_id = auth.uid()))
      AND (empresa_id IS NOT DISTINCT FROM (SELECT p.empresa_id FROM public.profiles p WHERE p.user_id = auth.uid()))
    )
  )
);