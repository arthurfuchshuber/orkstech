-- Audit trigger for cliente.produto_segmento_id changes
CREATE OR REPLACE FUNCTION public.log_cliente_produto_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_nome text;
  v_new_nome text;
  v_descricao text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.produto_segmento_id IS DISTINCT FROM NEW.produto_segmento_id THEN
    SELECT nome INTO v_old_nome FROM public.cliente_produtos WHERE id = OLD.produto_segmento_id;
    SELECT nome INTO v_new_nome FROM public.cliente_produtos WHERE id = NEW.produto_segmento_id;

    v_descricao := 'Produto alterado: ' ||
      COALESCE(v_old_nome, '(nenhum)') || ' → ' || COALESCE(v_new_nome, '(nenhum)');

    -- System history
    INSERT INTO public.historico_sistema (user_id, empresa_id, evento, descricao, entidade_tipo, entidade_id, contexto)
    VALUES (
      NEW.user_id, NEW.empresa_id, 'cliente.produto_alterado', v_descricao, 'cliente', NEW.id,
      jsonb_build_object(
        'produto_anterior_id', OLD.produto_segmento_id,
        'produto_anterior_nome', v_old_nome,
        'produto_novo_id', NEW.produto_segmento_id,
        'produto_novo_nome', v_new_nome
      )
    );

    -- Client interactions timeline
    INSERT INTO public.cliente_interacoes (user_id, empresa_id, cliente_id, tipo, descricao, usuario_nome)
    VALUES (NEW.user_id, NEW.empresa_id, NEW.id, 'Sistema', v_descricao, 'Sistema');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_cliente_produto_change ON public.clientes;
CREATE TRIGGER trg_log_cliente_produto_change
  AFTER UPDATE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.log_cliente_produto_change();

-- Audit trigger for fornecedor.produto_segmento_id changes
CREATE OR REPLACE FUNCTION public.log_fornecedor_produto_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_old_nome text;
  v_new_nome text;
  v_descricao text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.produto_segmento_id IS DISTINCT FROM NEW.produto_segmento_id THEN
    SELECT nome INTO v_old_nome FROM public.cliente_produtos WHERE id = OLD.produto_segmento_id;
    SELECT nome INTO v_new_nome FROM public.cliente_produtos WHERE id = NEW.produto_segmento_id;

    v_descricao := 'Produto alterado: ' ||
      COALESCE(v_old_nome, '(nenhum)') || ' → ' || COALESCE(v_new_nome, '(nenhum)');

    INSERT INTO public.historico_sistema (user_id, empresa_id, evento, descricao, entidade_tipo, entidade_id, contexto)
    VALUES (
      NEW.user_id, NEW.empresa_id, 'fornecedor.produto_alterado', v_descricao, 'fornecedor', NEW.id,
      jsonb_build_object(
        'produto_anterior_id', OLD.produto_segmento_id,
        'produto_anterior_nome', v_old_nome,
        'produto_novo_id', NEW.produto_segmento_id,
        'produto_novo_nome', v_new_nome
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_fornecedor_produto_change ON public.fornecedores;
CREATE TRIGGER trg_log_fornecedor_produto_change
  AFTER UPDATE ON public.fornecedores
  FOR EACH ROW EXECUTE FUNCTION public.log_fornecedor_produto_change();