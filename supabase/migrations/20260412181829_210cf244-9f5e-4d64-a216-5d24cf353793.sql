
-- =============================================
-- 1. Tabela de gatilhos personalizáveis
-- =============================================
CREATE TABLE public.automacao_gatilhos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  label TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, nome)
);

ALTER TABLE public.automacao_gatilhos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automacao_gatilhos"
  ON public.automacao_gatilhos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own automacao_gatilhos"
  ON public.automacao_gatilhos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own automacao_gatilhos"
  ON public.automacao_gatilhos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own automacao_gatilhos"
  ON public.automacao_gatilhos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_automacao_gatilhos_updated_at
  BEFORE UPDATE ON public.automacao_gatilhos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 2. Tabela de tipos de ação personalizáveis
-- =============================================
CREATE TABLE public.automacao_acoes_tipo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  label TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, nome)
);

ALTER TABLE public.automacao_acoes_tipo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automacao_acoes_tipo"
  ON public.automacao_acoes_tipo FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own automacao_acoes_tipo"
  ON public.automacao_acoes_tipo FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own automacao_acoes_tipo"
  ON public.automacao_acoes_tipo FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own automacao_acoes_tipo"
  ON public.automacao_acoes_tipo FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_automacao_acoes_tipo_updated_at
  BEFORE UPDATE ON public.automacao_acoes_tipo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- 3. Função para seed de gatilhos e ações padrão
-- =============================================
CREATE OR REPLACE FUNCTION public.seed_default_automacao_config(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Seed gatilhos padrão
  INSERT INTO public.automacao_gatilhos (user_id, nome, label, descricao, ordem) VALUES
    (p_user_id, 'cliente.criado', 'Cliente criado', 'Disparado quando um novo cliente é cadastrado', 1),
    (p_user_id, 'cliente.atualizado', 'Cliente atualizado', 'Disparado quando um cliente é editado', 2),
    (p_user_id, 'contrato.criado', 'Contrato criado', 'Disparado quando um novo contrato é gerado', 3),
    (p_user_id, 'contrato.renovado', 'Contrato renovado', 'Disparado quando um contrato é renovado', 4),
    (p_user_id, 'contrato.vencendo', 'Contrato próximo do vencimento', 'Disparado quando um contrato está perto de vencer', 5),
    (p_user_id, 'financeiro.cobranca_criada', 'Cobrança criada', 'Disparado quando uma nova cobrança é registrada', 6),
    (p_user_id, 'financeiro.pagamento_recebido', 'Pagamento recebido', 'Disparado quando um pagamento é confirmado', 7),
    (p_user_id, 'financeiro.cobranca_vencida', 'Cobrança vencida', 'Disparado quando uma cobrança vence sem pagamento', 8),
    (p_user_id, 'documento.anexado', 'Documento anexado', 'Disparado quando um documento é vinculado a um registro', 9),
    (p_user_id, 'atividade.criada', 'Atividade registrada', 'Disparado quando uma atividade é criada', 10),
    (p_user_id, 'fornecedor.criado', 'Fornecedor criado', 'Disparado quando um novo fornecedor é cadastrado', 11)
  ON CONFLICT (user_id, nome) DO NOTHING;

  -- Seed ações padrão
  INSERT INTO public.automacao_acoes_tipo (user_id, nome, label, descricao, ordem) VALUES
    (p_user_id, 'criar_notificacao', 'Enviar notificação', 'Cria uma notificação no sistema para o usuário', 1),
    (p_user_id, 'criar_historico', 'Registrar no histórico', 'Registra a ação no histórico do sistema', 2),
    (p_user_id, 'criar_atividade', 'Criar atividade', 'Cria uma atividade automática vinculada ao registro', 3),
    (p_user_id, 'criar_financeiro', 'Gerar financeiro', 'Gera uma notificação de ação financeira pendente', 4),
    (p_user_id, 'atualizar_status', 'Atualizar status', 'Registra uma atualização de status no histórico', 5)
  ON CONFLICT (user_id, nome) DO NOTHING;
END;
$$;
