
-- 1) historico_sistema: block UPDATE/DELETE (restrictive)
CREATE POLICY "Block updates to historico_sistema" ON public.historico_sistema
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);
CREATE POLICY "Block deletes from historico_sistema" ON public.historico_sistema
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- 2) ajustes_manuais_log: block UPDATE/DELETE (restrictive)
CREATE POLICY "Block updates to ajustes_manuais_log" ON public.ajustes_manuais_log
  AS RESTRICTIVE FOR UPDATE TO authenticated, anon USING (false);
CREATE POLICY "Block deletes from ajustes_manuais_log" ON public.ajustes_manuais_log
  AS RESTRICTIVE FOR DELETE TO authenticated, anon USING (false);

-- 3) empresa_socios: restrict writes to owners / super admins
DROP POLICY IF EXISTS "Members can insert empresa_socios" ON public.empresa_socios;
DROP POLICY IF EXISTS "Members can update empresa_socios" ON public.empresa_socios;
DROP POLICY IF EXISTS "Members can delete empresa_socios" ON public.empresa_socios;

CREATE POLICY "Owners can insert empresa_socios" ON public.empresa_socios
  FOR INSERT TO authenticated
  WITH CHECK (public.is_empresa_owner(auth.uid(), empresa_id) OR public.is_super_admin());

CREATE POLICY "Owners can update empresa_socios" ON public.empresa_socios
  FOR UPDATE TO authenticated
  USING (public.is_empresa_owner(auth.uid(), empresa_id) OR public.is_super_admin())
  WITH CHECK (public.is_empresa_owner(auth.uid(), empresa_id) OR public.is_super_admin());

CREATE POLICY "Owners can delete empresa_socios" ON public.empresa_socios
  FOR DELETE TO authenticated
  USING (public.is_empresa_owner(auth.uid(), empresa_id) OR public.is_super_admin());

-- 4) profiles INSERT: prevent self-elevation to a privileged level
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND (
      nivel_permissao_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.niveis_permissao np
        WHERE np.id = nivel_permissao_id
          AND np.nome IN ('Super Admin', 'Admin')
      )
    )
  );

-- Also harden UPDATE so users can't elevate themselves later
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND (
      nivel_permissao_id IS NULL
      OR NOT EXISTS (
        SELECT 1 FROM public.niveis_permissao np
        WHERE np.id = nivel_permissao_id
          AND np.nome IN ('Super Admin', 'Admin')
      )
    )
  );

-- 5) Realtime messages: stricter topic pattern
DROP POLICY IF EXISTS "Users can subscribe to their own notifications" ON realtime.messages;
DROP POLICY IF EXISTS "Users can receive their notifications" ON realtime.messages;
CREATE POLICY "Users can subscribe to their own notifications" ON realtime.messages
  FOR SELECT TO authenticated
  USING (realtime.topic() = ('notif:' || auth.uid()::text)
         OR realtime.topic() LIKE (auth.uid()::text || ':%'));
