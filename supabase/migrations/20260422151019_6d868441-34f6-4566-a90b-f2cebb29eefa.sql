
-- 1) Tabela de permissões granulares
CREATE TABLE IF NOT EXISTS public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  action_key text NOT NULL,
  can_view boolean NOT NULL DEFAULT false,
  can_edit boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id, action_key)
);

CREATE INDEX IF NOT EXISTS idx_user_permissions_user_empresa
  ON public.user_permissions (user_id, empresa_id);

-- 2) Helper: identifica o dono (criador) da empresa
CREATE OR REPLACE FUNCTION public.is_empresa_owner(p_user_id uuid, p_empresa_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.empresas
    WHERE id = p_empresa_id AND user_id = p_user_id
  );
$$;

-- 3) Helper: verifica permissão (owner e super_admin sempre liberados)
CREATE OR REPLACE FUNCTION public.has_permission(
  p_user_id uuid,
  p_empresa_id uuid,
  p_action_key text,
  p_level text DEFAULT 'view' -- 'view' ou 'edit'
)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_can_view boolean;
  v_can_edit boolean;
BEGIN
  -- Super admin do SaaS
  IF public.is_super_admin() THEN RETURN true; END IF;

  -- Dono da empresa: full access
  IF public.is_empresa_owner(p_user_id, p_empresa_id) THEN RETURN true; END IF;

  -- Dashboard principal sempre liberado para visualização
  IF p_action_key = 'menu:dashboard-principal' AND p_level = 'view' THEN
    RETURN true;
  END IF;

  SELECT can_view, can_edit INTO v_can_view, v_can_edit
  FROM public.user_permissions
  WHERE user_id = p_user_id
    AND empresa_id = p_empresa_id
    AND action_key = p_action_key;

  IF NOT FOUND THEN RETURN false; END IF;

  IF p_level = 'edit' THEN RETURN COALESCE(v_can_edit, false); END IF;
  RETURN COALESCE(v_can_view, false);
END;
$$;

-- 4) RLS
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners and super admins manage permissions"
  ON public.user_permissions FOR ALL
  TO authenticated
  USING (
    public.is_empresa_owner(auth.uid(), empresa_id)
    OR public.is_super_admin()
  )
  WITH CHECK (
    public.is_empresa_owner(auth.uid(), empresa_id)
    OR public.is_super_admin()
  );

CREATE POLICY "Users view own permissions"
  ON public.user_permissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5) Trigger updated_at
CREATE TRIGGER trg_user_permissions_updated_at
  BEFORE UPDATE ON public.user_permissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6) Atualiza seed_default_menus para incluir Dashboard Principal como primeiro item raiz
CREATE OR REPLACE FUNCTION public.seed_default_menus(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_financeiro uuid;
  v_cadastros uuid;
  v_config uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.menus WHERE user_id = p_user_id LIMIT 1) THEN
    RETURN;
  END IF;

  -- Dashboard Principal (raiz, ordem 0) - visível a todos
  INSERT INTO public.menus (user_id, name, slug, icon, route, order_index, module)
  VALUES (p_user_id, 'Início', 'dashboard-principal', 'Home', '/app/principal', 0, 'sistema');

  -- Grupo Financeiro (raiz, ordem 1)
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Financeiro', 'financeiro', 'DollarSign', 1, 'financeiro')
  RETURNING id INTO v_financeiro;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Dashboard', 'dashboard', 'LayoutDashboard', '/app/dashboard', v_financeiro, 0, 'financeiro'),
    (p_user_id, 'Contas a Pagar', 'contas-pagar', 'Receipt', '/app/financas/pagar', v_financeiro, 1, 'financeiro'),
    (p_user_id, 'Contas a Receber', 'contas-receber', 'TrendingUp', '/app/financas/receber', v_financeiro, 2, 'financeiro'),
    (p_user_id, 'Fluxo de Caixa', 'fluxo-caixa', 'PiggyBank', '/app/financas/fluxo', v_financeiro, 3, 'financeiro'),
    (p_user_id, 'Extrato Bancário', 'extrato-bancario', 'FileText', '/app/extrato-bancario', v_financeiro, 4, 'financeiro'),
    (p_user_id, 'DRE & Analytics', 'dre', 'FileText', '/app/financas/dre', v_financeiro, 5, 'financeiro');

  -- Grupo Cadastros (raiz, ordem 2)
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Cadastros', 'cadastros', 'Users', 2, 'cadastros')
  RETURNING id INTO v_cadastros;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Clientes', 'clientes', 'Users', '/app/clientes', v_cadastros, 0, 'cadastros'),
    (p_user_id, 'Fornecedores', 'fornecedores', 'Truck', '/app/fornecedores', v_cadastros, 1, 'cadastros'),
    (p_user_id, 'Inventário', 'inventario', 'Package', '/app/inventario', v_cadastros, 2, 'cadastros');

  -- Grupo Configurações (raiz, ordem 3)
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Configurações', 'sistema', 'Settings', 3, 'sistema')
  RETURNING id INTO v_config;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Empresa', 'empresa', 'Building2', '/app/config/conta', v_config, 0, 'sistema'),
    (p_user_id, 'Assinatura', 'assinatura', 'Sparkles', '/app/config/assinatura', v_config, 1, 'sistema'),
    (p_user_id, 'Financeiro', 'cadastros-financeiros', 'Settings2', '/app/financas/cadastros', v_config, 2, 'sistema'),
    (p_user_id, 'Integrações', 'integracoes', 'Webhook', '/app/config/integracoes', v_config, 3, 'sistema'),
    (p_user_id, 'Gerenciar Menu', 'gerenciar-menu', 'Menu', '/app/config/menus', v_config, 4, 'sistema');

  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'admin', true FROM public.menus WHERE user_id = p_user_id;

  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'user', true FROM public.menus WHERE user_id = p_user_id;
END;
$function$;

-- 7) Adiciona Dashboard Principal aos menus dos usuários existentes que ainda não têm
INSERT INTO public.menus (user_id, name, slug, icon, route, order_index, module)
SELECT DISTINCT m.user_id, 'Início', 'dashboard-principal', 'Home', '/app/principal', -1, 'sistema'
FROM public.menus m
WHERE NOT EXISTS (
  SELECT 1 FROM public.menus m2
  WHERE m2.user_id = m.user_id AND m2.slug = 'dashboard-principal'
);

INSERT INTO public.menu_permissions (menu_id, role, can_view)
SELECT id, 'admin', true FROM public.menus
WHERE slug = 'dashboard-principal'
  AND id NOT IN (SELECT menu_id FROM public.menu_permissions WHERE role = 'admin');

INSERT INTO public.menu_permissions (menu_id, role, can_view)
SELECT id, 'user', true FROM public.menus
WHERE slug = 'dashboard-principal'
  AND id NOT IN (SELECT menu_id FROM public.menu_permissions WHERE role = 'user');
