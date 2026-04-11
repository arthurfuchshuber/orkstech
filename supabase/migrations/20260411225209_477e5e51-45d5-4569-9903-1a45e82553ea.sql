
CREATE OR REPLACE FUNCTION public.seed_default_menus(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_dashboard uuid;
  v_financeiro uuid;
  v_fin_config uuid;
  v_cadastros uuid;
  v_sistema uuid;
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

  -- Sistema
  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Sistema', 'sistema', 'Settings', 3, 'sistema')
  RETURNING id INTO v_sistema;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Empresa', 'empresa', 'Building2', '/app/config', v_sistema, 0, 'sistema'),
    (p_user_id, 'Usuários', 'usuarios', 'UserCog', '/app/config/usuarios', v_sistema, 1, 'sistema'),
    (p_user_id, 'Permissões', 'permissoes', 'Shield', '/app/config/permissoes', v_sistema, 2, 'sistema'),
    (p_user_id, 'Gerenciar Menu', 'gerenciar-menu', 'Menu', '/app/config/menus', v_sistema, 3, 'sistema');

  -- Automações (dentro de Sistema)
  INSERT INTO public.menus (user_id, name, slug, icon, parent_id, order_index, module)
  VALUES (p_user_id, 'Automações', 'automacoes', 'Zap', v_sistema, 4, 'sistema')
  RETURNING id INTO v_automacoes;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Regras', 'regras', 'Workflow', '/app/automacoes/workflows', v_automacoes, 0, 'sistema'),
    (p_user_id, 'Integrações', 'integracoes', 'Webhook', '/app/automacoes/integracoes', v_automacoes, 1, 'sistema');

  -- Create default permissions
  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'admin', true FROM public.menus WHERE user_id = p_user_id;

  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'user', true FROM public.menus WHERE user_id = p_user_id;
END;
$function$;
