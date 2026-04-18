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
BEGIN
  IF EXISTS (SELECT 1 FROM public.menus WHERE user_id = p_user_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO public.menus (user_id, name, slug, icon, route, order_index, module)
  VALUES (p_user_id, 'Dashboard', 'dashboard', 'LayoutDashboard', '/app/dashboard', 0, 'sistema')
  RETURNING id INTO v_dashboard;

  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Financeiro', 'financeiro', 'DollarSign', 1, 'financeiro')
  RETURNING id INTO v_financeiro;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Contas a Pagar', 'contas-pagar', 'Receipt', '/app/financas/pagar', v_financeiro, 0, 'financeiro'),
    (p_user_id, 'Contas a Receber', 'contas-receber', 'TrendingUp', '/app/financas/receber', v_financeiro, 1, 'financeiro'),
    (p_user_id, 'Fluxo de Caixa', 'fluxo-caixa', 'PiggyBank', '/app/financas/fluxo', v_financeiro, 2, 'financeiro'),
    (p_user_id, 'DRE', 'dre', 'FileText', '/app/financas/dre', v_financeiro, 3, 'financeiro'),
    (p_user_id, 'Extrato Bancário', 'extrato-bancario', 'FileText', '/app/extrato-bancario', v_financeiro, 4, 'financeiro');

  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Cadastros', 'cadastros', 'Users', 2, 'cadastros')
  RETURNING id INTO v_cadastros;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Clientes', 'clientes', 'Users', '/app/clientes', v_cadastros, 0, 'cadastros'),
    (p_user_id, 'Fornecedores', 'fornecedores', 'Truck', '/app/fornecedores', v_cadastros, 1, 'cadastros'),
    (p_user_id, 'Inventário', 'inventario', 'Package', '/app/inventario', v_cadastros, 2, 'cadastros');

  INSERT INTO public.menus (user_id, name, slug, icon, order_index, module)
  VALUES (p_user_id, 'Configurações', 'sistema', 'Settings', 3, 'sistema')
  RETURNING id INTO v_config;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Empresa', 'empresa', 'Building2', '/app/config/conta', v_config, 0, 'sistema'),
    (p_user_id, 'Assinatura', 'assinatura', 'Sparkles', '/app/config/assinatura', v_config, 1, 'sistema'),
    (p_user_id, 'Gerenciar Menu', 'gerenciar-menu', 'Menu', '/app/config/menus', v_config, 2, 'sistema'),
    (p_user_id, 'Financeiro', 'cadastros-financeiros', 'Settings2', '/app/financas/cadastros', v_config, 3, 'sistema'),
    (p_user_id, 'Integrações', 'integracoes', 'Webhook', '/app/config/integracoes', v_config, 4, 'sistema');

  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'admin', true FROM public.menus WHERE user_id = p_user_id;

  INSERT INTO public.menu_permissions (menu_id, role, can_view)
  SELECT id, 'user', true FROM public.menus WHERE user_id = p_user_id;
END;
$function$;