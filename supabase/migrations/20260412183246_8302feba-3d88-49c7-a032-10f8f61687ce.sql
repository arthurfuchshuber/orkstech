-- Rename "Plano de Contas" to "Cadastros Financeiros" and update route
UPDATE public.menus
SET name = 'Cadastros Financeiros',
    slug = 'cadastros-financeiros',
    route = '/app/financas/cadastros',
    icon = 'Settings2'
WHERE id = 'f01c3f7c-cdd4-4270-9c57-2c6292352dbb';

-- Hide the other two menu items
UPDATE public.menus
SET is_visible = false, is_active = false
WHERE id IN ('3d3a2d99-f3f9-4f78-b02e-7bea130f0a7f', 'd1da524a-903f-43de-8eec-b7da6cc8abe8');
