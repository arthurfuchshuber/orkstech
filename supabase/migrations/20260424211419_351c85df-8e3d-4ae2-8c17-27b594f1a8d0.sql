-- Permite que usuários convidados (membros) leiam a empresa à qual estão vinculados via profiles.empresa_id
CREATE POLICY "Members can view their linked empresa"
ON public.empresas
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT empresa_id FROM public.profiles
    WHERE user_id = auth.uid() AND empresa_id IS NOT NULL
  )
);