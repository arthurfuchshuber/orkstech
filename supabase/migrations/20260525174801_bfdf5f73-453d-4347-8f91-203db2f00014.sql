
-- 1) Append-only audit logs
DROP POLICY IF EXISTS "Members can update ajustes_manuais_log" ON public.ajustes_manuais_log;
DROP POLICY IF EXISTS "Members can delete ajustes_manuais_log" ON public.ajustes_manuais_log;

DROP POLICY IF EXISTS "Members can update historico_sistema" ON public.historico_sistema;
DROP POLICY IF EXISTS "Members can delete historico_sistema" ON public.historico_sistema;

-- 2) Menus: resolve membership via empresa_membros, not profiles.empresa_id
DROP POLICY IF EXISTS "Members can view linked company owner menus" ON public.menus;

CREATE POLICY "Members can view linked company owner menus"
ON public.menus
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.empresa_membros em
    JOIN public.empresas e ON e.id = em.empresa_id
    WHERE em.user_id = auth.uid()
      AND em.ativo = true
      AND e.user_id = menus.user_id
  )
);

-- 3) DB-level guard: block nivel_permissao_id changes for non-super-admins
CREATE OR REPLACE FUNCTION public.prevent_privilege_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.nivel_permissao_id IS DISTINCT FROM OLD.nivel_permissao_id THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Only Super Admins can change permission level'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.empresa_id IS DISTINCT FROM OLD.empresa_id THEN
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'Only Super Admins can change empresa assignment'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_privilege_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_privilege_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_privilege_escalation();
