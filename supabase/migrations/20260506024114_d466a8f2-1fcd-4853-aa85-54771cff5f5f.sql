
-- 1. Mover/renomear "Cadastros Financeiros" do menu Cadastros para Configurações como "Financeiro"
--    e reordenar Configurações: Financeiro = penúltimo, Recursos Humanos = último.

DO $$
DECLARE
  r RECORD;
  v_config_id uuid;
  v_fin_id uuid;
  v_rh_id uuid;
  v_max int;
  v_idx int;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.menus LOOP
    -- localizar "Configurações" (qualquer slug variação)
    SELECT id INTO v_config_id
    FROM public.menus
    WHERE user_id = r.user_id
      AND parent_id IS NULL
      AND (slug IN ('sistema','configuracoes') OR name = 'Configurações')
    LIMIT 1;

    IF v_config_id IS NULL THEN CONTINUE; END IF;

    -- mover "Cadastros Financeiros" / "Financeiro (cadastros-financeiros)" para Configurações
    UPDATE public.menus
       SET parent_id = v_config_id,
           name = 'Financeiro',
           module = 'sistema'
     WHERE user_id = r.user_id
       AND slug IN ('cad-financeiros','cadastros-financeiros')
       AND route = '/app/financas/cadastros';

    -- Pegar IDs Financeiro e RH dentro de Configurações
    SELECT id INTO v_fin_id FROM public.menus
     WHERE user_id = r.user_id AND parent_id = v_config_id
       AND slug IN ('cad-financeiros','cadastros-financeiros') LIMIT 1;
    SELECT id INTO v_rh_id FROM public.menus
     WHERE user_id = r.user_id AND parent_id = v_config_id
       AND slug = 'rh-cadastros' LIMIT 1;

    -- Reordenar: outros itens primeiro mantendo ordem; Financeiro penúltimo, RH último
    v_idx := 0;
    FOR r IN
      SELECT id FROM public.menus
       WHERE user_id = (SELECT user_id FROM public.menus WHERE id = v_config_id)
         AND parent_id = v_config_id
         AND id NOT IN (COALESCE(v_fin_id,'00000000-0000-0000-0000-000000000000'::uuid),
                        COALESCE(v_rh_id,'00000000-0000-0000-0000-000000000000'::uuid))
       ORDER BY order_index, name
    LOOP
      UPDATE public.menus SET order_index = v_idx WHERE id = r.id;
      v_idx := v_idx + 1;
    END LOOP;

    IF v_fin_id IS NOT NULL THEN
      UPDATE public.menus SET order_index = v_idx WHERE id = v_fin_id;
      v_idx := v_idx + 1;
    END IF;
    IF v_rh_id IS NOT NULL THEN
      UPDATE public.menus SET order_index = v_idx WHERE id = v_rh_id;
    END IF;
  END LOOP;
END $$;

-- 2. Atualizar seeder para refletir nova organização padrão
CREATE OR REPLACE FUNCTION public.seed_default_menus(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_inicio uuid;
  v_financeiro uuid;
  v_rh uuid;
  v_cadastros uuid;
  v_config uuid;
BEGIN
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
    (p_user_id, 'Equipamentos', 'equipamentos', 'Box', '/app/rh/equipamentos', v_rh, 3, 'rh');

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module)
  VALUES (p_user_id, 'Cadastros', 'cadastros', 'Users', NULL, NULL, 3, 'cadastros')
  RETURNING id INTO v_cadastros;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Clientes', 'clientes', 'UserCheck', '/app/clientes', v_cadastros, 0, 'cadastros'),
    (p_user_id, 'Fornecedores', 'fornecedores', 'Truck', '/app/fornecedores', v_cadastros, 1, 'cadastros');

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module)
  VALUES (p_user_id, 'Configurações', 'configuracoes', 'Settings', NULL, NULL, 4, 'sistema')
  RETURNING id INTO v_config;

  INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module) VALUES
    (p_user_id, 'Empresa', 'empresa', 'Building2', '/app/config/conta', v_config, 0, 'sistema'),
    (p_user_id, 'Assinatura', 'assinatura', 'CreditCard', '/app/config/assinatura', v_config, 1, 'sistema'),
    (p_user_id, 'Integrações', 'integracoes', 'Plug', '/app/config/integracoes', v_config, 2, 'sistema'),
    (p_user_id, 'Automações', 'automacoes', 'Zap', '/app/automacoes/config', v_config, 3, 'sistema'),
    (p_user_id, 'Financeiro', 'cad-financeiros', 'BookOpen', '/app/financas/cadastros', v_config, 4, 'sistema'),
    (p_user_id, 'Recursos Humanos', 'rh-cadastros', 'Settings2', '/app/rh/cadastros', v_config, 5, 'sistema');
END;
$function$;
