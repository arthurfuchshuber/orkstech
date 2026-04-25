
-- Remove o "Dashboard" raiz duplicado (slug 'dashboard' sem parent)
DELETE FROM public.menus
WHERE slug = 'dashboard' AND parent_id IS NULL;

-- Para usuários cujo único "Dashboard" estava aninhado em Financeiro com slug 'dashboard',
-- normalizar para o slug padrão 'dashboard-financeiro' apontando para a rota correta
UPDATE public.menus
SET slug = 'dashboard-financeiro',
    route = '/app/financas/dashboard'
WHERE slug = 'dashboard'
  AND parent_id IS NOT NULL
  AND parent_id IN (SELECT id FROM public.menus WHERE slug = 'financeiro');
