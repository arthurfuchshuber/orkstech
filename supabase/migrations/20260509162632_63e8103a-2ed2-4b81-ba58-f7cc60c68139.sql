-- 1. Novos tipos no enum
ALTER TYPE tipo_financeiro ADD VALUE IF NOT EXISTS 'despesa_comercial';
ALTER TYPE tipo_financeiro ADD VALUE IF NOT EXISTS 'resultado_financeiro';

-- 2. Novas colunas em categorias_financeiras
ALTER TABLE public.categorias_financeiras
  ADD COLUMN IF NOT EXISTS is_tronco_sistema boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tronco_slug text,
  ADD COLUMN IF NOT EXISTS nome_locked boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS uq_categorias_tronco_per_empresa
  ON public.categorias_financeiras(empresa_id, tronco_slug)
  WHERE is_tronco_sistema = true AND empresa_id IS NOT NULL;

-- 3. Função: cria/garante os 8 troncos para uma empresa
CREATE OR REPLACE FUNCTION public.seed_dre_troncos(_empresa_id uuid, _user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  troncos jsonb := '[
    {"slug":"receita_operacional",   "nome":"Receita Operacional",   "tipo":"receita",              "ordem":1},
    {"slug":"deducoes_receita",      "nome":"Deduções da Receita",   "tipo":"deducao",              "ordem":2},
    {"slug":"custos_diretos",        "nome":"Custos Diretos",        "tipo":"custo",                "ordem":3},
    {"slug":"despesas_operacionais", "nome":"Despesas Operacionais", "tipo":"despesa",              "ordem":4},
    {"slug":"despesas_comerciais",   "nome":"Despesas Comerciais",   "tipo":"despesa_comercial",    "ordem":5},
    {"slug":"resultado_financeiro",  "nome":"Resultado Financeiro",  "tipo":"resultado_financeiro", "ordem":6},
    {"slug":"impostos",              "nome":"Impostos",              "tipo":"imposto",              "ordem":7},
    {"slug":"distribuicao_lucros",   "nome":"Distribuição de Lucros","tipo":"distribuicao_lucros",  "ordem":8}
  ]'::jsonb;
  t jsonb;
  existing_id uuid;
BEGIN
  IF _empresa_id IS NULL OR _user_id IS NULL THEN RETURN; END IF;

  FOR t IN SELECT jsonb_array_elements(troncos) LOOP
    -- Já existe tronco com esse slug? OK.
    SELECT id INTO existing_id
    FROM categorias_financeiras
    WHERE empresa_id = _empresa_id AND tronco_slug = (t->>'slug')
    LIMIT 1;
    IF existing_id IS NOT NULL THEN CONTINUE; END IF;

    -- Tenta reaproveitar uma raiz existente do mesmo tipo
    SELECT id INTO existing_id
    FROM categorias_financeiras
    WHERE empresa_id = _empresa_id
      AND categoria_pai_id IS NULL
      AND is_tronco_sistema = false
      AND tipo::text = (t->>'tipo')
    LIMIT 1;

    IF existing_id IS NOT NULL THEN
      UPDATE categorias_financeiras
      SET nome = t->>'nome',
          tronco_slug = t->>'slug',
          is_tronco_sistema = true,
          ordem = (t->>'ordem')::int,
          ativo = true
      WHERE id = existing_id;
    ELSE
      INSERT INTO categorias_financeiras
        (empresa_id, user_id, nome, tipo, ordem, ativo, is_tronco_sistema, tronco_slug, categoria_pai_id)
      VALUES (
        _empresa_id, _user_id,
        t->>'nome',
        (t->>'tipo')::tipo_financeiro,
        (t->>'ordem')::int,
        true, true,
        t->>'slug',
        NULL
      );
    END IF;
  END LOOP;
END;
$$;

-- 4. Trigger: seed automático em novas empresas
CREATE OR REPLACE FUNCTION public.trg_seed_troncos_on_empresa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_dre_troncos(NEW.id, NEW.user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS empresa_seed_troncos ON public.empresas;
CREATE TRIGGER empresa_seed_troncos
AFTER INSERT ON public.empresas
FOR EACH ROW EXECUTE FUNCTION public.trg_seed_troncos_on_empresa();

-- 5. Sync sócios → subs de Distribuição de Lucros
CREATE OR REPLACE FUNCTION public.sync_socios_to_distribuicao(_empresa_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tronco_id uuid;
  emp_user uuid;
BEGIN
  IF _empresa_id IS NULL THEN RETURN; END IF;
  SELECT user_id INTO emp_user FROM empresas WHERE id = _empresa_id;
  IF emp_user IS NULL THEN RETURN; END IF;

  PERFORM public.seed_dre_troncos(_empresa_id, emp_user);

  SELECT id INTO tronco_id FROM categorias_financeiras
   WHERE empresa_id = _empresa_id AND tronco_slug = 'distribuicao_lucros'
   LIMIT 1;
  IF tronco_id IS NULL THEN RETURN; END IF;

  -- Cria subs faltantes
  INSERT INTO categorias_financeiras
    (empresa_id, user_id, nome, tipo, categoria_pai_id, ordem, ativo, is_tronco_sistema, nome_locked, origem_socio_id)
  SELECT _empresa_id, emp_user, s.nome_completo,
         'distribuicao_lucros'::tipo_financeiro, tronco_id,
         row_number() OVER (ORDER BY s.nome_completo),
         true, false, true, s.id
  FROM empresa_socios s
  WHERE s.empresa_id = _empresa_id AND s.ativo = true
    AND NOT EXISTS (
      SELECT 1 FROM categorias_financeiras c WHERE c.origem_socio_id = s.id
    );

  -- Atualiza nome/status quando sócio mudar
  UPDATE categorias_financeiras c
  SET nome = s.nome_completo,
      ativo = s.ativo,
      nome_locked = true
  FROM empresa_socios s
  WHERE c.origem_socio_id = s.id AND c.empresa_id = _empresa_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_sync_socio_to_distribuicao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.sync_socios_to_distribuicao(COALESCE(NEW.empresa_id, OLD.empresa_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS socio_sync_distribuicao ON public.empresa_socios;
CREATE TRIGGER socio_sync_distribuicao
AFTER INSERT OR UPDATE OR DELETE ON public.empresa_socios
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_socio_to_distribuicao();

-- 6. Trigger de proteção dos troncos e sócios travados
CREATE OR REPLACE FUNCTION public.protect_dre_troncos()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_tronco_sistema = true THEN
      RAISE EXCEPTION 'Categoria-tronco do DRE não pode ser excluída';
    END IF;
    IF OLD.nome_locked = true AND COALESCE(current_setting('app.allow_locked_delete', true), 'off') <> 'on' THEN
      RAISE EXCEPTION 'Esta subcategoria é gerenciada pelo Quadro Societário';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.is_tronco_sistema = true THEN
      IF NEW.nome IS DISTINCT FROM OLD.nome
         OR NEW.tipo IS DISTINCT FROM OLD.tipo
         OR NEW.tronco_slug IS DISTINCT FROM OLD.tronco_slug
         OR NEW.categoria_pai_id IS DISTINCT FROM OLD.categoria_pai_id
         OR NEW.ativo IS DISTINCT FROM OLD.ativo THEN
        RAISE EXCEPTION 'Categoria-tronco do DRE não pode ser editada';
      END IF;
    END IF;
    IF OLD.nome_locked = true AND NEW.nome IS DISTINCT FROM OLD.nome
       AND COALESCE(current_setting('app.allow_locked_delete', true), 'off') <> 'on' THEN
      RAISE EXCEPTION 'Nome desta categoria é gerenciado pelo Quadro Societário';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.categoria_pai_id IS NULL AND COALESCE(NEW.is_tronco_sistema, false) = false THEN
      RAISE EXCEPTION 'Não é permitido criar categorias raiz. Use os troncos do DRE.';
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS protect_dre_troncos_trg ON public.categorias_financeiras;
CREATE TRIGGER protect_dre_troncos_trg
BEFORE INSERT OR UPDATE OR DELETE ON public.categorias_financeiras
FOR EACH ROW EXECUTE FUNCTION public.protect_dre_troncos();