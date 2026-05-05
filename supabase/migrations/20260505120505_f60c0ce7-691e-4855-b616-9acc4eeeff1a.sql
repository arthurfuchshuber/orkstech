CREATE OR REPLACE FUNCTION public.backfill_permissions_empresa(
  p_empresa_id uuid,
  p_action_keys text[],
  p_default_view boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_inserted int := 0;
  v_members_count int := 0;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  -- Authorization: super admin, owner, or admin member
  IF NOT (
    public.is_super_admin()
    OR public.is_empresa_owner(v_caller, p_empresa_id)
    OR EXISTS (
      SELECT 1 FROM public.empresa_membros em
      JOIN public.niveis_permissao np ON np.id = em.nivel_permissao_id
      WHERE em.empresa_id = p_empresa_id
        AND em.user_id = v_caller
        AND em.ativo = true
        AND np.nome = 'Admin'
    )
  ) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  WITH targets AS (
    -- Owner of the empresa
    SELECT user_id FROM public.empresas WHERE id = p_empresa_id
    UNION
    -- Active members
    SELECT user_id FROM public.empresa_membros
    WHERE empresa_id = p_empresa_id AND ativo = true
  ),
  keys AS (
    SELECT unnest(p_action_keys) AS action_key
  ),
  inserts AS (
    INSERT INTO public.user_permissions (user_id, empresa_id, action_key, can_view, can_edit)
    SELECT t.user_id, p_empresa_id, k.action_key, p_default_view, false
    FROM targets t CROSS JOIN keys k
    WHERE t.user_id IS NOT NULL
    ON CONFLICT (user_id, empresa_id, action_key) DO NOTHING
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_inserted FROM inserts;

  SELECT COUNT(*) INTO v_members_count FROM (
    SELECT user_id FROM public.empresas WHERE id = p_empresa_id
    UNION
    SELECT user_id FROM public.empresa_membros WHERE empresa_id = p_empresa_id AND ativo = true
  ) m;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'members', v_members_count,
    'keys', array_length(p_action_keys, 1)
  );
END;
$$;