
-- =============================================
-- 1. Tabela de notificações do sistema
-- =============================================
CREATE TABLE public.notificacoes_sistema (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  automacao_id UUID REFERENCES public.automacoes(id) ON DELETE SET NULL,
  titulo TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  tipo TEXT NOT NULL DEFAULT 'info',
  lida BOOLEAN NOT NULL DEFAULT false,
  entidade_tipo TEXT,
  entidade_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notificacoes_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own notificacoes_sistema"
  ON public.notificacoes_sistema FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own notificacoes_sistema"
  ON public.notificacoes_sistema FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own notificacoes_sistema"
  ON public.notificacoes_sistema FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "System can insert notificacoes_sistema"
  ON public.notificacoes_sistema FOR INSERT WITH CHECK (true);

CREATE INDEX idx_notificacoes_sistema_user ON public.notificacoes_sistema(user_id, lida, created_at DESC);

-- =============================================
-- 2. Tabela de histórico do sistema
-- =============================================
CREATE TABLE public.historico_sistema (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  automacao_id UUID REFERENCES public.automacoes(id) ON DELETE SET NULL,
  evento TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  entidade_tipo TEXT,
  entidade_id UUID,
  contexto JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.historico_sistema ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own historico_sistema"
  ON public.historico_sistema FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert historico_sistema"
  ON public.historico_sistema FOR INSERT WITH CHECK (true);

CREATE INDEX idx_historico_sistema_user ON public.historico_sistema(user_id, created_at DESC);

-- =============================================
-- 3. Função principal do motor de automações
-- =============================================
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
  -- Busca todas as automações ativas que correspondem ao evento
  FOR v_automacao IN
    SELECT id, nome, descricao, acoes
    FROM public.automacoes
    WHERE user_id = p_user_id
      AND ativo = true
      AND evento_gatilho = p_evento
  LOOP
    -- Para cada ação configurada na automação
    FOR v_acao IN
      SELECT * FROM jsonb_array_elements(v_automacao.acoes) AS a
    LOOP
      -- Extrair título e descrição da config da ação
      v_titulo := COALESCE(v_acao.a->>'config'->>'titulo', v_automacao.nome);
      v_descricao := COALESCE(v_acao.a->'config'->>'descricao', v_automacao.descricao);

      CASE v_acao.a->>'tipo'
        WHEN 'criar_notificacao' THEN
          INSERT INTO public.notificacoes_sistema (user_id, automacao_id, titulo, descricao, tipo, entidade_tipo, entidade_id)
          VALUES (p_user_id, v_automacao.id, v_titulo, v_descricao, 'info', p_entidade_tipo, p_entidade_id);

        WHEN 'criar_historico' THEN
          INSERT INTO public.historico_sistema (user_id, automacao_id, evento, descricao, entidade_tipo, entidade_id, contexto)
          VALUES (p_user_id, v_automacao.id, p_evento, v_descricao, p_entidade_tipo, p_entidade_id, p_contexto);

        WHEN 'criar_atividade' THEN
          -- Registra como histórico com tipo atividade
          INSERT INTO public.historico_sistema (user_id, automacao_id, evento, descricao, entidade_tipo, entidade_id, contexto)
          VALUES (p_user_id, v_automacao.id, 'atividade.automatica', v_descricao, p_entidade_tipo, p_entidade_id, p_contexto);

        WHEN 'criar_financeiro' THEN
          -- Registra notificação informando que financeiro deve ser criado
          INSERT INTO public.notificacoes_sistema (user_id, automacao_id, titulo, descricao, tipo, entidade_tipo, entidade_id)
          VALUES (p_user_id, v_automacao.id, 'Ação financeira pendente', v_descricao, 'alerta', p_entidade_tipo, p_entidade_id);

        WHEN 'atualizar_status' THEN
          INSERT INTO public.historico_sistema (user_id, automacao_id, evento, descricao, entidade_tipo, entidade_id, contexto)
          VALUES (p_user_id, v_automacao.id, 'status.atualizado', v_descricao, p_entidade_tipo, p_entidade_id, p_contexto);

        ELSE
          -- Ação desconhecida: registra no histórico
          INSERT INTO public.historico_sistema (user_id, automacao_id, evento, descricao, entidade_tipo, entidade_id, contexto)
          VALUES (p_user_id, v_automacao.id, 'acao.desconhecida', v_acao.a->>'tipo', p_entidade_tipo, p_entidade_id, p_contexto);
      END CASE;
    END LOOP;

    -- Incrementa contador de execuções
    UPDATE public.automacoes SET executado_count = executado_count + 1 WHERE id = v_automacao.id;
  END LOOP;
END;
$$;

-- =============================================
-- 4. Trigger functions para cada tabela
-- =============================================

-- Clientes
CREATE OR REPLACE FUNCTION public.trigger_automacao_clientes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
BEGIN
  v_nome := COALESCE(NEW.nome_completo, NEW.nome_fantasia, NEW.razao_social, 'Sem nome');
  
  IF TG_OP = 'INSERT' THEN
    PERFORM public.processar_automacoes(
      NEW.user_id,
      'cliente.criado',
      'cliente',
      NEW.id,
      jsonb_build_object('nome', v_nome)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    PERFORM public.processar_automacoes(
      NEW.user_id,
      'cliente.atualizado',
      'cliente',
      NEW.id,
      jsonb_build_object('nome', v_nome)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER automacao_clientes_trigger
  AFTER INSERT OR UPDATE ON public.clientes
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_automacao_clientes();

-- Fornecedores
CREATE OR REPLACE FUNCTION public.trigger_automacao_fornecedores()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome TEXT;
BEGIN
  v_nome := COALESCE(NEW.nome_completo, NEW.nome_fantasia, NEW.razao_social, 'Sem nome');
  
  PERFORM public.processar_automacoes(
    NEW.user_id,
    'fornecedor.criado',
    'fornecedor',
    NEW.id,
    jsonb_build_object('nome', v_nome)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER automacao_fornecedores_trigger
  AFTER INSERT ON public.fornecedores
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_automacao_fornecedores();

-- Contas a Pagar (financeiro)
CREATE OR REPLACE FUNCTION public.trigger_automacao_financeiro()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM public.processar_automacoes(
      NEW.user_id,
      'financeiro.cobranca_criada',
      'conta_pagar',
      NEW.id,
      jsonb_build_object('descricao', NEW.description, 'valor', NEW.amount)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    -- Pagamento recebido
    IF OLD.status != 'paid' AND NEW.status = 'paid' THEN
      PERFORM public.processar_automacoes(
        NEW.user_id,
        'financeiro.pagamento_recebido',
        'conta_pagar',
        NEW.id,
        jsonb_build_object('descricao', NEW.description, 'valor', NEW.amount)
      );
    END IF;
    -- Cobrança vencida
    IF OLD.status != 'overdue' AND NEW.status = 'overdue' THEN
      PERFORM public.processar_automacoes(
        NEW.user_id,
        'financeiro.cobranca_vencida',
        'conta_pagar',
        NEW.id,
        jsonb_build_object('descricao', NEW.description, 'valor', NEW.amount)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER automacao_financeiro_trigger
  AFTER INSERT OR UPDATE ON public.accounts_payable
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_automacao_financeiro();

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notificacoes_sistema;
