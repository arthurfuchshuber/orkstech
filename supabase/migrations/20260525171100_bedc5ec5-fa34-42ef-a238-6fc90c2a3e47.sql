
-- 1) Profiles: add WITH CHECK preventing self-escalation of nivel_permissao_id
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
ON public.profiles
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (
  auth.uid() = user_id
  AND (
    nivel_permissao_id IS NOT DISTINCT FROM (
      SELECT p.nivel_permissao_id FROM public.profiles p WHERE p.user_id = auth.uid()
    )
    OR public.is_super_admin()
  )
);

-- 2) Storage: rewrite client-documents policies to scope by empresa_id (first folder segment)
DROP POLICY IF EXISTS "Users can view own client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload client documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete client documents" ON storage.objects;

CREATE POLICY "Empresa members can view client-documents"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'client-documents'
  AND public.is_empresa_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Empresa members can upload client-documents"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'client-documents'
  AND public.is_empresa_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Empresa members can update client-documents"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'client-documents'
  AND public.is_empresa_member(((storage.foldername(name))[1])::uuid)
)
WITH CHECK (
  bucket_id = 'client-documents'
  AND public.is_empresa_member(((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Empresa members can delete client-documents"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'client-documents'
  AND public.is_empresa_member(((storage.foldername(name))[1])::uuid)
);
