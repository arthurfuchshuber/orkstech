-- Renomeia o item de menu "Sincronização" para "Reconciliação"
UPDATE public.menus
SET name = 'Reconciliação', slug = 'reconciliacao'
WHERE route = '/app/financas/sincronizacao';

-- Atualiza a função seed para futuros usuários
CREATE OR REPLACE FUNCTION public.seed_default_menus(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inicio uuid;
  v_financeiro uuid;
  v_rh uuid;
  v_cadastros uuid;
  v_config uuid;
BEGIN
  -- Pula se já existe seed
  IF EXISTS (SELECT 1 FROM public.menus WHERE user_id = p_user_id) THEN
    RETURN;
  END IF;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module)
  VALUES (p_user_id, 'Início', 'inicio', 'Circle', '/app/principal', NULL, 0, 'sistema')
  RETURNING id INTO v_inicio;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module)
  VALUES (p_user_id, 'Financeiro', 'financeiro', 'DollarSign', NULL, NULL, 1, 'financeiro')
  RETURNING id INTO v_financeiro;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Dashboard', 'dashboard', 'LayoutGrid', '/app/financas/dashboard', v_financeiro, 0, 'financeiro'),
    (p_user_id, 'Contas a Pagar', 'pagar', 'FileText', '/app/financas/pagar', v_financeiro, 1, 'financeiro'),
    (p_user_id, 'Contas a Receber', 'receber', 'TrendingUp', '/app/financas/receber', v_financeiro, 2, 'financeiro'),
    (p_user_id, 'Fluxo de Caixa', 'fluxo', 'PiggyBank', '/app/financas/fluxo', v_financeiro, 3, 'financeiro'),
    (p_user_id, 'DRE & Analytics', 'dre', 'FileText', '/app/financas/dre', v_financeiro, 4, 'financeiro'),
    (p_user_id, 'Extrato Bancário', 'extrato', 'FileText', '/app/extrato-bancario', v_financeiro, 5, 'financeiro'),
    (p_user_id, 'Reconciliação', 'reconciliacao', 'RefreshCw', '/app/financas/sincronizacao', v_financeiro, 6, 'financeiro');

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module)
  VALUES (p_user_id, 'Recursos Humanos', 'rh', 'Circle', NULL, NULL, 2, 'rh')
  RETURNING id INTO v_rh;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Colaboradores', 'colaboradores', 'Users', '/app/rh/colaboradores', v_rh, 0, 'rh'),
    (p_user_id, 'Folha de Pagamento', 'folha', 'DollarSign', '/app/rh/folha', v_rh, 1, 'rh'),
    (p_user_id, 'Ausências', 'ausencias', 'CalendarDays', '/app/rh/ausencias', v_rh, 2, 'rh'),
    (p_user_id, 'Equipamentos', 'equipamentos', 'Box', '/app/rh/equipamentos', v_rh, 3, 'rh'),
    (p_user_id, 'Cadastros', 'rh-cadastros', 'List', '/app/rh/cadastros', v_rh, 4, 'rh');

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module)
  VALUES (p_user_id, 'Cadastros', 'cadastros', 'Users', NULL, NULL, 3, 'cadastros')
  RETURNING id INTO v_cadastros;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Clientes', 'clientes', 'UserCheck', '/app/clientes', v_cadastros, 0, 'cadastros'),
    (p_user_id, 'Fornecedores', 'fornecedores', 'Truck', '/app/fornecedores', v_cadastros, 1, 'cadastros'),
    (p_user_id, 'Cadastros Financeiros', 'cad-financeiros', 'BookOpen', '/app/financas/cadastros', v_cadastros, 2, 'cadastros');

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module)
  VALUES (p_user_id, 'Configurações', 'configuracoes', 'Settings', NULL, NULL, 4, 'sistema')
  RETURNING id INTO v_config;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Empresa', 'empresa', 'Building2', '/app/config/conta', v_config, 0, 'sistema'),
    (p_user_id, 'Assinatura', 'assinatura', 'CreditCard', '/app/config/assinatura', v_config, 1, 'sistema'),
    (p_user_id, 'Integrações', 'integracoes', 'Plug', '/app/config/integracoes', v_config, 2, 'sistema'),
    (p_user_id, 'Automações', 'automacoes', 'Zap', '/app/automacoes/config', v_config, 3, 'sistema');
END;
$$;