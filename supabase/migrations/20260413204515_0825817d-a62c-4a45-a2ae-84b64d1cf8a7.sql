
-- 1) Move "Cadastros Financeiros" and "Contas Bancárias" from Financeiro>Configurações to Sistema for ALL existing users
-- First, move the items to be children of "Sistema" (slug = 'sistema')
UPDATE public.menus AS child
SET parent_id = sistema.id, order_index = 4
FROM public.menus AS sistema
WHERE child.slug = 'cadastros-financeiros'
  AND child.user_id = sistema.user_id
  AND sistema.slug = 'sistema'
  AND sistema.parent_id IS NULL;

UPDATE public.menus AS child
SET parent_id = sistema.id, order_index = 5
FROM public.menus AS sistema
WHERE child.slug = 'contas-bancarias'
  AND child.user_id = sistema.user_id
  AND sistema.slug = 'sistema'
  AND sistema.parent_id IS NULL;

-- 2) Rename "Sistema" to "Configurações" for all users
UPDATE public.menus
SET name = 'Configurações'
WHERE slug = 'sistema'
  AND parent_id IS NULL
  AND name = 'Sistema';

-- 3) Delete the now-empty "Configurações" sub-group under Financeiro (slug = 'fin-config')
DELETE FROM public.menus WHERE slug = 'fin-config';

-- 4) Update the seed function for new users
CREATE OR REPLACE FUNCTION public.seed_default_menus(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dashboard uuid;
  v_financeiro uuid;
  v_cadastros uuid;
  v_config uuid;
  v_automacoes uuid;
BEGIN
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

  -- Cadastros
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Cadastros', 'cadastros', 'Users', 2, 'cadastros')
  RETURNING id INTO v_cadastros;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Clientes', 'clientes', 'Users', '/app/clientes', v_cadastros, 0, 'cadastros'),
    (p_user_id, 'Fornecedores', 'fornecedores', 'Truck', '/app/fornecedores', v_cadastros, 1, 'cadastros'),
    (p_user_id, 'Inventário', 'inventario', 'Package', '/app/inventario', v_cadastros, 2, 'cadastros');

  -- Configurações (antigo Sistema)
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Configurações', 'sistema', 'Settings', 3, 'sistema')
  RETURNING id INTO v_config;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Empresa', 'empresa', 'Building2', '/app/config', v_config, 0, 'sistema'),
    (p_user_id, 'Usuários', 'usuarios', 'UserCog', '/app/config/usuarios', v_config, 1, 'sistema'),
    (p_user_id, 'Permissões', 'permissoes', 'Shield', '/app/config/permissoes', v_config, 2, 'sistema'),
    (p_user_id, 'Gerenciar Menu', 'gerenciar-menu', 'Menu', '/app/config/menus', v_config, 3, 'sistema'),
    (p_user_id, 'Cadastros Financeiros', 'cadastros-financeiros', 'Settings2', '/app/financas/cadastros', v_config, 4, 'sistema'),
    (p_user_id, 'Contas Bancárias', 'contas-bancarias', 'Landmark', '/app/financas/contas-bancarias', v_config, 5, 'sistema');

  -- Automações (sub de Configurações)
  INSERT INTO public.menus (user_id, name, slug, icon, parent_id, order_index, module)
  VALUES (p_user_id, 'Automações', 'automacoes', 'Zap', v_config, 6, 'sistema')
  RETURNING id INTO v_automacoes;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Gatilhos e Ações', 'gatilhos-acoes', 'Zap', '/app/automacoes/config', v_automacoes, 0, 'sistema'),
    (p_user_id, 'Integrações', 'integracoes', 'Webhook', '/app/automacoes/integracoes', v_automacoes, 1, 'sistema');

  -- Create default permissions
  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'admin', true FROM public.menus WHERE user_id = p_user_id;

  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'user', true FROM public.menus WHERE user_id = p_user_id;
END;
$function$;
