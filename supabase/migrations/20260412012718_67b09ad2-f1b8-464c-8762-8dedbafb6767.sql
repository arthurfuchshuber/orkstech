
-- Add Extrato Bancário and Conciliação menu items for existing users
INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module)
SELECT 
  m.user_id,
  'Extrato Bancário',
  'extrato-bancario',
  'FileText',
  '/app/financas/extrato',
  m.id,
  4,
  'financeiro'
FROM public.menus m
WHERE m.slug = 'fin-config'
AND NOT EXISTS (
  SELECT 1 FROM public.menus m2 WHERE m2.slug = 'extrato-bancario' AND m2.user_id = m.user_id
);

INSERT INTO public.menus (user_id, name, slug, icon, route, parent_id, order_index, module)
SELECT 
  m.user_id,
  'Conciliação',
  'conciliacao',
  'ArrowRightLeft',
  '/app/financas/conciliacao',
  m.id,
  5,
  'financeiro'
FROM public.menus m
WHERE m.slug = 'fin-config'
AND NOT EXISTS (
  SELECT 1 FROM public.menus m2 WHERE m2.slug = 'conciliacao' AND m2.user_id = m.user_id
);

-- Add permissions for new menus
INSERT INTO public.menu_permissions (menu_id, role, can_view)
SELECT id, 'admin', true FROM public.menus WHERE slug IN ('extrato-bancario', 'conciliacao')
AND id NOT IN (SELECT menu_id FROM public.menu_permissions WHERE role = 'admin');

INSERT INTO public.menu_permissions (menu_id, role, can_view)
SELECT id, 'user', true FROM public.menus WHERE slug IN ('extrato-bancario', 'conciliacao')
AND id NOT IN (SELECT menu_id FROM public.menu_permissions WHERE role = 'user');
