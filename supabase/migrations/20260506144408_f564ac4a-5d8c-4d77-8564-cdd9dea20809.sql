-- Função: sincroniza um único sócio como subcategoria
CREATE OR REPLACE FUNCTION public.sync_socio_to_distribuicao_lucros()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_root_id uuid;
  v_existing_id uuid;
  v_socio_id_text text;
  v_target_user_id uuid;
  v_target_empresa_id uuid;
  v_nome text;
  v_ativo boolean;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_socio_id_text := OLD.id::text;
    v_target_user_id := OLD.user_id;
    v_target_empresa_id := OLD.empresa_id;
  ELSE
    v_socio_id_text := NEW.id::text;
    v_target_user_id := NEW.user_id;
    v_target_empresa_id := NEW.empresa_id;
    v_nome := NEW.nome_completo;
    v_ativo := NEW.ativo AND NEW.status_socio = 'ativo' AND COALESCE(NEW.tipo_pessoa, 'PF') = 'PF';
  END IF;

  -- Garante a categoria raiz
  v_root_id := public.ensure_distribuicao_lucros_categoria(v_target_user_id, v_target_empresa_id);

  -- Procura subcategoria existente vinculada a este sócio (via nota no nome: "<Nome> [#<id_curto>]")
  -- Estratégia: usa o id do sócio em uma coluna virtual? Não temos. Vamos rastrear por convenção: 
  -- gravamos a subcategoria com o nome exato do sócio + sufixo invisível usando o próprio id.
  -- Para evitar colisão, usamos sufixo " ⟦socio:<uuid>⟧" no nome, escondido depois no display? 
  -- Simplificação: matchear por (empresa_id, categoria_pai_id=root, nome ILIKE OLD.nome_completo) e fallback por id armazenado.
  
  -- Buscar pela convenção: armazenar id do sócio via comentário em tabela auxiliar não existe. 
  -- Solução robusta: criar coluna de origem na categoria.
  SELECT id INTO v_existing_id
  FROM public.categorias_financeiras
  WHERE categoria_pai_id = v_root_id
    AND user_id = v_target_user_id
    AND (empresa_id IS NOT DISTINCT FROM v_target_empresa_id)
    AND origem_socio_id = v_socio_id_text::uuid
  LIMIT 1;

  IF TG_OP = 'DELETE' THEN
    IF v_existing_id IS NOT NULL THEN
      UPDATE public.categorias_financeiras SET ativo = false WHERE id = v_existing_id;
    END IF;
    RETURN OLD;
  END IF;

  IF v_existing_id IS NULL THEN
    -- Só cria se for sócio PF ativo
    IF v_ativo THEN
      INSERT INTO public.categorias_financeiras (user_id, empresa_id, nome, tipo, ativo, ordem, categoria_pai_id, origem_socio_id)
      VALUES (v_target_user_id, v_target_empresa_id, v_nome, 'distribuicao_lucros', true, 0, v_root_id, NEW.id);
    END IF;
  ELSE
    UPDATE public.categorias_financeiras
    SET nome = v_nome, ativo = v_ativo, updated_at = now()
    WHERE id = v_existing_id;
  END IF;

  RETURN NEW;
END;
$$;

-- Adiciona coluna para rastrear vínculo (idempotente)
ALTER TABLE public.categorias_financeiras
  ADD COLUMN IF NOT EXISTS origem_socio_id uuid REFERENCES public.empresa_socios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_categorias_financeiras_origem_socio
  ON public.categorias_financeiras(origem_socio_id) WHERE origem_socio_id IS NOT NULL;

-- Triggers
DROP TRIGGER IF EXISTS trg_sync_socio_distribuicao ON public.empresa_socios;
CREATE TRIGGER trg_sync_socio_distribuicao
AFTER INSERT OR UPDATE OR DELETE ON public.empresa_socios
FOR EACH ROW EXECUTE FUNCTION public.sync_socio_to_distribuicao_lucros();

-- Backfill: cria subcategorias para sócios PF ativos existentes
DO $$
DECLARE
  s RECORD;
  v_root_id uuid;
  v_existing_id uuid;
BEGIN
  FOR s IN
    SELECT * FROM public.empresa_socios
    WHERE ativo = true AND status_socio = 'ativo' AND COALESCE(tipo_pessoa, 'PF') = 'PF'
  LOOP
    v_root_id := public.ensure_distribuicao_lucros_categoria(s.user_id, s.empresa_id);
    SELECT id INTO v_existing_id
    FROM public.categorias_financeiras
    WHERE origem_socio_id = s.id LIMIT 1;
    IF v_existing_id IS NULL THEN
      INSERT INTO public.categorias_financeiras (user_id, empresa_id, nome, tipo, ativo, ordem, categoria_pai_id, origem_socio_id)
      VALUES (s.user_id, s.empresa_id, s.nome_completo, 'distribuicao_lucros', true, 0, v_root_id, s.id);
    END IF;
  END LOOP;
END $$;