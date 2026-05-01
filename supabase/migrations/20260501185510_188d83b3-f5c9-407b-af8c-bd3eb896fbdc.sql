-- Tabela de junção: um usuário pode ser membro de N empresas
CREATE TABLE IF NOT EXISTS public.empresa_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  empresa_id UUID NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nivel_permissao_id UUID REFERENCES public.niveis_permissao(id),
  invited_by UUID,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (empresa_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_empresa_membros_user ON public.empresa_membros(user_id);
CREATE INDEX IF NOT EXISTS idx_empresa_membros_empresa ON public.empresa_membros(empresa_id);

ALTER TABLE public.empresa_membros ENABLE ROW LEVEL SECURITY;

-- Helper: usuário é dono da empresa? (nome novo para evitar conflitos)
CREATE OR REPLACE FUNCTION public.user_owns_empresa(_uid UUID, _empresa_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas
    WHERE id = _empresa_id AND user_id = _uid
  );
$$;

-- Helper: usuário é Super Admin? (nome novo para evitar conflito com função existente)
CREATE OR REPLACE FUNCTION public.user_is_super_admin(_uid UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.niveis_permissao np ON np.id = p.nivel_permissao_id
    WHERE p.user_id = _uid AND np.nome = 'Super Admin'
  );
$$;

CREATE POLICY "Membros: leitura própria, dono e super admin"
ON public.empresa_membros FOR SELECT
USING (
  user_id = auth.uid()
  OR public.user_owns_empresa(auth.uid(), empresa_id)
  OR public.user_is_super_admin(auth.uid())
);

CREATE POLICY "Membros: insert dono e super admin"
ON public.empresa_membros FOR INSERT
WITH CHECK (
  public.user_owns_empresa(auth.uid(), empresa_id)
  OR public.user_is_super_admin(auth.uid())
);

CREATE POLICY "Membros: update dono e super admin"
ON public.empresa_membros FOR UPDATE
USING (
  public.user_owns_empresa(auth.uid(), empresa_id)
  OR public.user_is_super_admin(auth.uid())
);

CREATE POLICY "Membros: delete dono e super admin"
ON public.empresa_membros FOR DELETE
USING (
  public.user_owns_empresa(auth.uid(), empresa_id)
  OR public.user_is_super_admin(auth.uid())
);

CREATE TRIGGER update_empresa_membros_updated_at
BEFORE UPDATE ON public.empresa_membros
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Migra vínculos atuais de profiles.empresa_id
INSERT INTO public.empresa_membros (empresa_id, user_id, nivel_permissao_id, ativo)
SELECT p.empresa_id, p.user_id, p.nivel_permissao_id, COALESCE(p.ativo, true)
FROM public.profiles p
WHERE p.empresa_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.empresa_membros em
    WHERE em.empresa_id = p.empresa_id AND em.user_id = p.user_id
  );