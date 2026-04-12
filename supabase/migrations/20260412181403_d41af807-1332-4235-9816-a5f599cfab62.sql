
CREATE OR REPLACE FUNCTION public.processar_automacoes(
  p_user_id UUID,
  p_evento TEXT,
  p_entidade_tipo TEXT DEFAULT NULL,
  p_entidade_id UUID DEFAULT NULL,
  p_contexto JSONB DEFAULT '{}'::jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_automacao RECORD;
  v_acao RECORD;
  v_titulo TEXT;
  v_descricao TEXT;
BEGIN
  FOR v_automacao IN
    SELECT id, nome, descricao, acoes
    FROM public.automacoes
    WHERE user_id = p_user_id
      AND ativo = true
      AND evento_gatilho = p_evento
  LOOP
    FOR v_acao IN
      SELECT * FROM jsonb_array_elements(v_automacao.acoes) AS a
    LOOP
      v_titulo := COALESCE(v_acao.a->'config'->>'titulo', v_automacao.nome);
      v_descricao := COALESCE(v_acao.a->'config'->>'descricao', v_automacao.descricao);

      CASE v_acao.a->>'tipo'
        WHEN 'criar_notificacao' THEN
          INSERT INTO public.notificacoes_sistema (user_id, automacao_id, titulo, descricao, tipo, entidade_tipo, entidade_id)
          VALUES (p_user_id, v_automacao.id, v_titulo, v_descricao, 'info', p_entidade_tipo, p_entidade_id);

        WHEN 'criar_historico' THEN
          INSERT INTO public.historico_sistema (user_id, automacao_id, evento, descricao, entidade_tipo, entidade_id, contexto)
          VALUES (p_user_id, v_automacao.id, p_evento, v_descricao, p_entidade_tipo, p_entidade_id, p_contexto);

        WHEN 'criar_atividade' THEN
          INSERT INTO public.historico_sistema (user_id, automacao_id, evento, descricao, entidade_tipo, entidade_id, contexto)
          VALUES (p_user_id, v_automacao.id, 'atividade.automatica', v_descricao, p_entidade_tipo, p_entidade_id, p_contexto);

        WHEN 'criar_financeiro' THEN
          INSERT INTO public.notificacoes_sistema (user_id, automacao_id, titulo, descricao, tipo, entidade_tipo, entidade_id)
          VALUES (p_user_id, v_automacao.id, 'Ação financeira pendente', v_descricao, 'alerta', p_entidade_tipo, p_entidade_id);

        WHEN 'atualizar_status' THEN
          INSERT INTO public.historico_sistema (user_id, automacao_id, evento, descricao, entidade_tipo, entidade_id, contexto)
          VALUES (p_user_id, v_automacao.id, 'status.atualizado', v_descricao, p_entidade_tipo, p_entidade_id, p_contexto);

        ELSE
          INSERT INTO public.historico_sistema (user_id, automacao_id, evento, descricao, entidade_tipo, entidade_id, contexto)
          VALUES (p_user_id, v_automacao.id, 'acao.desconhecida', v_acao.a->>'tipo', p_entidade_tipo, p_entidade_id, p_contexto);
      END CASE;
    END LOOP;

    UPDATE public.automacoes SET executado_count = executado_count + 1 WHERE id = v_automacao.id;
  END LOOP;
END;
$$;
