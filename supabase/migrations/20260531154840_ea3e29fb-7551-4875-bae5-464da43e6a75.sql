-- 1. Atualizar defaults para a lista do usuário (12 tipos)
CREATE OR REPLACE FUNCTION public.seed_tipos_gasto_padrao(_empresa_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  defaults text[][] := ARRAY[
    ARRAY['🍽️','Alimentação'],
    ARRAY['🔄','Assinaturas'],
    ARRAY['🛒','Consumos'],
    ARRAY['💆','Cuidados Pessoais'],
    ARRAY['🏦','Empréstimos'],
    ARRAY['📚','Educação'],
    ARRAY['🎬','Lazer'],
    ARRAY['🏠','Moradia'],
    ARRAY['🏥','Saúde'],
    ARRAY['🛡️','Seguros'],
    ARRAY['🚗','Transporte'],
    ARRAY['🛍️','Compras']
  ];
  i int;
BEGIN
  FOR i IN 1 .. array_length(defaults, 1) LOOP
    INSERT INTO public.tipos_gasto (empresa_id, user_id, nome, emoji, ordem)
    VALUES (_empresa_id, _user_id, defaults[i][2], defaults[i][1], i)
    ON CONFLICT (empresa_id, nome) DO NOTHING;
  END LOOP;
END;
$$;

-- 2. Limpar defaults antigos não utilizados (preserva os que o usuário já vinculou a transações)
DELETE FROM public.tipos_gasto tg
WHERE NOT EXISTS (SELECT 1 FROM public.accounts_payable WHERE tipo_gasto_id = tg.id)
  AND NOT EXISTS (SELECT 1 FROM public.pluggy_transactions WHERE tipo_gasto_id = tg.id)
  AND NOT EXISTS (SELECT 1 FROM public.manual_bank_transactions WHERE tipo_gasto_id = tg.id)
  AND NOT EXISTS (SELECT 1 FROM public.cash_transactions WHERE tipo_gasto_id = tg.id)
  AND tg.nome NOT IN ('Alimentação','Assinaturas','Consumos','Cuidados Pessoais','Empréstimos','Educação','Lazer','Moradia','Saúde','Seguros','Transporte','Compras');

-- 3. Re-seed dos novos defaults em todas as empresas
DO $$
DECLARE e record;
BEGIN
  FOR e IN SELECT id, user_id FROM public.empresas LOOP
    PERFORM public.seed_tipos_gasto_padrao(e.id, e.user_id);
  END LOOP;
END $$;