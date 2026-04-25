CREATE POLICY "Members can view linked company owner menus"
ON public.menus
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.empresas e ON e.id = p.empresa_id
    WHERE p.user_id = auth.uid()
      AND p.empresa_id IS NOT NULL
      AND e.user_id = menus.user_id
  )
);