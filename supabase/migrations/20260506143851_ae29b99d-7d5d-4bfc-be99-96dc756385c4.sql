-- Função que garante a categoria raiz "Distribuição de Lucros" para uma empresa
CREATE OR REPLACE FUNCTION public.ensure_distribuicao_lucros_categoria(p_user_id uuid, p_empresa_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
BEGIN
  SELECT id INTO v_id
  FROM public.categorias_financeiras
  WHERE user_id = p_user_id
    AND (empresa_id IS NOT DISTINCT FROM p_empresa_id)
    AND tipo = 'distribuicao_lucros'
    AND categoria_pai_id IS NULL
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.categorias_financeiras (user_id, empresa_id, nome, tipo, ativo, ordem)
    VALUES (p_user_id, p_empresa_id, 'Distribuição de Lucros', 'distribuicao_lucros', true, 9000)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

-- Backfill: cria a categoria para todas as empresas existentes
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id, empresa_id FROM public.categorias_financeiras WHERE empresa_id IS NOT NULL
  LOOP
    PERFORM public.ensure_distribuicao_lucros_categoria(r.user_id, r.empresa_id);
  END LOOP;
END $$;

-- Trigger: ao criar uma empresa, garantir a categoria raiz
CREATE OR REPLACE FUNCTION public.on_empresa_created_seed_distribuicao_lucros()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  PERFORM public.ensure_distribuicao_lucros_categoria(NEW.user_id, NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_empresa_seed_distribuicao_lucros ON public.empresas;
CREATE TRIGGER trg_empresa_seed_distribuicao_lucros
AFTER INSERT ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.on_empresa_created_seed_distribuicao_lucros();