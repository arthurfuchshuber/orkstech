INSERT INTO public.niveis_permissao (nome, descricao, is_system, ordem)
VALUES ('Super Admin', 'Administrador do SaaS com acesso ao painel administrativo cross-tenant', true, -1)
ON CONFLICT DO NOTHING;