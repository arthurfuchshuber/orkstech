
-- Função: usuário é membro de alguma empresa cujo dono é _owner_user_id
CREATE OR REPLACE FUNCTION public.is_member_of_owner(_owner_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.empresas e
    JOIN public.empresa_membros em ON em.empresa_id = e.id
    WHERE e.user_id = _owner_user_id
      AND em.user_id = auth.uid()
      AND em.ativo = true
  );
$$;

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'pluggy_bank_accounts','pluggy_connections','pluggy_investments',
    'pluggy_transactions','pluggy_notifications'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Members of owner can view %I" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "Members of owner can view %I" ON public.%I FOR SELECT USING (public.is_member_of_owner(user_id));', t, t);

    EXECUTE format('DROP POLICY IF EXISTS "Members of owner can update %I" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "Members of owner can update %I" ON public.%I FOR UPDATE USING (public.is_member_of_owner(user_id));', t, t);
  END LOOP;
END $$;
