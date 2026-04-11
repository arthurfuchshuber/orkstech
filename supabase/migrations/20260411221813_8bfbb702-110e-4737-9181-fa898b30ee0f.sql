
-- Create menus table
CREATE TABLE public.menus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  slug text NOT NULL,
  icon text DEFAULT 'Circle',
  route text,
  parent_id uuid REFERENCES public.menus(id) ON DELETE CASCADE,
  order_index integer NOT NULL DEFAULT 0,
  module text NOT NULL DEFAULT 'sistema',
  is_visible boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create menu_permissions table
CREATE TABLE public.menu_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id uuid NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  can_view boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(menu_id, role)
);

-- Enable RLS
ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_permissions ENABLE ROW LEVEL SECURITY;

-- RLS for menus
CREATE POLICY "Users can view own menus" ON public.menus FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own menus" ON public.menus FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own menus" ON public.menus FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own menus" ON public.menus FOR DELETE USING (auth.uid() = user_id);

-- RLS for menu_permissions (via menu ownership)
CREATE POLICY "Users can view own menu_permissions" ON public.menu_permissions FOR SELECT USING (EXISTS (SELECT 1 FROM public.menus WHERE menus.id = menu_permissions.menu_id AND menus.user_id = auth.uid()));
CREATE POLICY "Users can create own menu_permissions" ON public.menu_permissions FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.menus WHERE menus.id = menu_permissions.menu_id AND menus.user_id = auth.uid()));
CREATE POLICY "Users can update own menu_permissions" ON public.menu_permissions FOR UPDATE USING (EXISTS (SELECT 1 FROM public.menus WHERE menus.id = menu_permissions.menu_id AND menus.user_id = auth.uid()));
CREATE POLICY "Users can delete own menu_permissions" ON public.menu_permissions FOR DELETE USING (EXISTS (SELECT 1 FROM public.menus WHERE menus.id = menu_permissions.menu_id AND menus.user_id = auth.uid()));

-- Trigger for updated_at
CREATE TRIGGER update_menus_updated_at BEFORE UPDATE ON public.menus FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to seed default menus for a user
CREATE OR REPLACE FUNCTION public.seed_default_menus(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_dashboard uuid;
  v_financeiro uuid;
  v_fin_config uuid;
  v_cadastros uuid;
  v_automacoes uuid;
  v_sistema uuid;
BEGIN
  -- Skip if user already has menus
  IF EXISTS (SELECT 1 FROM public.menus WHERE user_id = p_user_id LIMIT 1) THEN
    RETURN;
  END IF;

  -- Dashboard
  INSERT INTO public.menus (user_id, name, slug, icon, route, order_index, module)
  VALUES (p_user_id, 'Dashboard', 'dashboard', 'LayoutDashboard', '/app/dashboard', 0, 'sistema')
  RETURNING id INTO v_dashboard;

  -- Financeiro
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Financeiro', 'financeiro', 'DollarSign', 1, 'financeiro')
  RETURNING id INTO v_financeiro;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Contas a Pagar', 'contas-pagar', 'Receipt', '/app/financas/pagar', v_financeiro, 0, 'financeiro'),
    (p_user_id, 'Contas a Receber', 'contas-receber', 'TrendingUp', '/app/financas/receber', v_financeiro, 1, 'financeiro'),
    (p_user_id, 'Fluxo de Caixa', 'fluxo-caixa', 'PiggyBank', '/app/financas/fluxo', v_financeiro, 2, 'financeiro'),
    (p_user_id, 'DRE', 'dre', 'FileText', '/app/financas/dre', v_financeiro, 3, 'financeiro');

  -- Financeiro > Configurações
  INSERT INTO public.menus (user_id, name, slug, icon, parent_id, order_index, module)
  VALUES (p_user_id, 'Configurações', 'fin-config', 'Settings', v_financeiro, 4, 'financeiro')
  RETURNING id INTO v_fin_config;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Plano de Contas', 'plano-contas', 'FolderTree', '/app/financas/plano-de-contas', v_fin_config, 0, 'financeiro'),
    (p_user_id, 'Centros de Custo', 'centros-custo', 'Target', '/app/financas/centros-de-custo', v_fin_config, 1, 'financeiro'),
    (p_user_id, 'Contas Bancárias', 'contas-bancarias', 'Landmark', '/app/financas/contas-bancarias', v_fin_config, 2, 'financeiro'),
    (p_user_id, 'Formas de Pagamento', 'formas-pagamento', 'CreditCard', '/app/financas/formas-de-pagamento', v_fin_config, 3, 'financeiro');

  -- Cadastros
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Cadastros', 'cadastros', 'Users', 2, 'cadastros')
  RETURNING id INTO v_cadastros;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Clientes', 'clientes', 'Users', '/app/clientes', v_cadastros, 0, 'cadastros'),
    (p_user_id, 'Fornecedores', 'fornecedores', 'Truck', '/app/fornecedores', v_cadastros, 1, 'cadastros'),
    (p_user_id, 'Inventário', 'inventario', 'Package', '/app/inventario', v_cadastros, 2, 'cadastros');

  -- Automações
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Automações', 'automacoes', 'Zap', 3, 'automacoes')
  RETURNING id INTO v_automacoes;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Regras', 'regras', 'Workflow', '/app/automacoes/workflows', v_automacoes, 0, 'automacoes'),
    (p_user_id, 'Integrações', 'integracoes', 'Webhook', '/app/automacoes/integracoes', v_automacoes, 1, 'automacoes');

  -- Sistema
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Sistema', 'sistema', 'Settings', 4, 'sistema')
  RETURNING id INTO v_sistema;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Empresa', 'empresa', 'Building2', '/app/config', v_sistema, 0, 'sistema'),
    (p_user_id, 'Usuários', 'usuarios', 'UserCog', '/app/config/usuarios', v_sistema, 1, 'sistema'),
    (p_user_id, 'Permissões', 'permissoes', 'Shield', '/app/config/permissoes', v_sistema, 2, 'sistema'),
    (p_user_id, 'Gerenciar Menu', 'gerenciar-menu', 'Menu', '/app/config/menus', v_sistema, 3, 'sistema');

  -- Create default permissions (admin can view all)
  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'admin', true FROM public.menus WHERE user_id = p_user_id;

  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'user', true FROM public.menus WHERE user_id = p_user_id;
END;
$$;

-- Trigger: auto-seed menus when empresa is created
CREATE OR REPLACE FUNCTION public.on_empresa_created_seed_menus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_default_menus(NEW.user_id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER seed_menus_on_empresa
AFTER INSERT ON public.empresas
FOR EACH ROW
EXECUTE FUNCTION public.on_empresa_created_seed_menus();
