
-- =====================================================================
-- 1) PROFILES: Prevent privilege escalation via nivel_permissao_id
-- =====================================================================
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nivel_permissao_id IS DISTINCT FROM OLD.nivel_permissao_id THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Only super admins can change permission level';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_profile_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_profile_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_privilege_escalation();

-- =====================================================================
-- 2) USER_PERMISSIONS: Remove broad member write access
-- =====================================================================
DROP POLICY IF EXISTS "Members can insert user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Members can update user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Members can delete user_permissions" ON public.user_permissions;
DROP POLICY IF EXISTS "Members can view user_permissions" ON public.user_permissions;

-- Keep: "Owners and super admins manage permissions" (ALL)
-- Keep: "Users view own permissions" (SELECT)
-- Add read access for owners/super admins (already covered by ALL), but ensure members can read permissions in their company for UI listing
CREATE POLICY "Owners and super admins view all permissions in company"
ON public.user_permissions
FOR SELECT
USING (public.is_empresa_owner(auth.uid(), empresa_id) OR public.is_super_admin());

-- =====================================================================
-- 3) INTEGRACOES_CREDENCIAIS: Restrict to owner / company owner / super admin
-- =====================================================================
DROP POLICY IF EXISTS "Members can view integracoes_credenciais" ON public.integracoes_credenciais;
DROP POLICY IF EXISTS "Members can insert integracoes_credenciais" ON public.integracoes_credenciais;
DROP POLICY IF EXISTS "Members can update integracoes_credenciais" ON public.integracoes_credenciais;
DROP POLICY IF EXISTS "Members can delete integracoes_credenciais" ON public.integracoes_credenciais;

CREATE POLICY "Empresa owners can view integracoes_credenciais"
ON public.integracoes_credenciais
FOR SELECT
USING (public.is_empresa_owner(auth.uid(), empresa_id));

CREATE POLICY "Empresa owners can insert integracoes_credenciais"
ON public.integracoes_credenciais
FOR INSERT
WITH CHECK (public.is_empresa_owner(auth.uid(), empresa_id));

CREATE POLICY "Empresa owners can update integracoes_credenciais"
ON public.integracoes_credenciais
FOR UPDATE
USING (public.is_empresa_owner(auth.uid(), empresa_id));

CREATE POLICY "Empresa owners can delete integracoes_credenciais"
ON public.integracoes_credenciais
FOR DELETE
USING (public.is_empresa_owner(auth.uid(), empresa_id));

-- =====================================================================
-- 4) STORAGE rh-documentos: Scope to company membership via path prefix
-- =====================================================================
DROP POLICY IF EXISTS "RH docs read auth" ON storage.objects;
DROP POLICY IF EXISTS "RH docs insert auth" ON storage.objects;
DROP POLICY IF EXISTS "RH docs update auth" ON storage.objects;
DROP POLICY IF EXISTS "RH docs delete auth" ON storage.objects;

CREATE POLICY "RH docs read by company members"
ON storage.objects
FOR SELECT
USING (
  bucket_id = 'rh-documentos'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_super_admin()
    OR public.is_empresa_member(((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "RH docs insert by company members"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'rh-documentos'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_super_admin()
    OR public.is_empresa_member(((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "RH docs update by company members"
ON storage.objects
FOR UPDATE
USING (
  bucket_id = 'rh-documentos'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_super_admin()
    OR public.is_empresa_member(((storage.foldername(name))[1])::uuid)
  )
);

CREATE POLICY "RH docs delete by company members"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'rh-documentos'
  AND auth.uid() IS NOT NULL
  AND (
    public.is_super_admin()
    OR public.is_empresa_member(((storage.foldername(name))[1])::uuid)
  )
);

-- =====================================================================
-- 5) REALTIME: Restrict channel subscriptions by user-scoped topic
-- =====================================================================
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can subscribe to own topics" ON realtime.messages;
CREATE POLICY "Authenticated users can subscribe to own topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() LIKE ('%' || auth.uid()::text || '%')
);

DROP POLICY IF EXISTS "Authenticated users can broadcast to own topics" ON realtime.messages;
CREATE POLICY "Authenticated users can broadcast to own topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE ('%' || auth.uid()::text || '%')
);
