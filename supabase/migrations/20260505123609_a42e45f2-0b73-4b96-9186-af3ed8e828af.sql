INSERT INTO public.profiles (user_id, nome, nivel_permissao_id, ativo)
VALUES ('5ceefc58-a43a-4010-8ae0-7cc611208b2a', 'Arthur Tenório Fuchshuber',
        '6b7ecd2e-795d-4f71-a6f6-e49a5ba4f9f1', true)
ON CONFLICT (user_id) DO UPDATE
  SET nivel_permissao_id = EXCLUDED.nivel_permissao_id,
      ativo = true;