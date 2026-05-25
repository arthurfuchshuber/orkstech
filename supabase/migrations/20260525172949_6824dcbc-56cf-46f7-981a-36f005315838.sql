DROP POLICY IF EXISTS "Members can view their linked empresa" ON public.empresas;

CREATE POLICY "Members can view their linked empresa"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.empresa_membros em
    WHERE em.empresa_id = empresas.id
      AND em.user_id = auth.uid()
      AND em.ativo = true
  )
);