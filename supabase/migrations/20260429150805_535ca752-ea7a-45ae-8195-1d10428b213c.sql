-- Função para contar transações Pluggy sem categoria por user
CREATE OR REPLACE FUNCTION public.contar_transacoes_sem_categoria(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::int
  FROM public.pluggy_transactions
  WHERE user_id = p_user_id
    AND categoria_financeira_id IS NULL
    AND COALESCE(is_internal_transfer, false) = false;
$$;

-- Função que cria notificação no sino quando há transações sem categoria
-- Deduplicada: só insere se não houver notificação 'transacoes_sem_categoria' não-lida
CREATE OR REPLACE FUNCTION public.notificar_transacoes_sem_categoria(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count integer;
  v_existente uuid;
BEGIN
  v_count := public.contar_transacoes_sem_categoria(p_user_id);
  
  IF v_count = 0 THEN
    RETURN;
  END IF;
  
  -- Verifica se já existe notificação não-lida desse tipo
  SELECT id INTO v_existente
  FROM public.notificacoes_sistema
  WHERE user_id = p_user_id
    AND entidade_tipo = 'transacoes_sem_categoria'
    AND lida = false
  LIMIT 1;
  
  IF v_existente IS NOT NULL THEN
    -- Atualiza contagem na descrição
    UPDATE public.notificacoes_sistema
    SET descricao = v_count || ' transação(ões) bancária(s) ainda sem subcategoria DRE. Categorize para manter seu DRE preciso.',
        created_at = now()
    WHERE id = v_existente;
    RETURN;
  END IF;
  
  INSERT INTO public.notificacoes_sistema (user_id, titulo, descricao, tipo, entidade_tipo, lida)
  VALUES (
    p_user_id,
    'Transações sem categorização',
    v_count || ' transação(ões) bancária(s) ainda sem subcategoria DRE. Categorize para manter seu DRE preciso.',
    'aviso',
    'transacoes_sem_categoria',
    false
  );
END;
$$;