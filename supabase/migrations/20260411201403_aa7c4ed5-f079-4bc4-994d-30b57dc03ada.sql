
-- Enum for financial category types
CREATE TYPE public.tipo_financeiro AS ENUM ('receita', 'despesa', 'custo', 'ajuste');

-- Enum for bank account types
CREATE TYPE public.tipo_conta_bancaria AS ENUM ('corrente', 'poupanca', 'caixa', 'carteira_digital');

-- Enum for payment method types
CREATE TYPE public.tipo_forma_pagamento AS ENUM ('pix', 'boleto', 'cartao', 'transferencia', 'dinheiro');

-- ============================================
-- CATEGORIAS FINANCEIRAS (hierarchical)
-- ============================================
CREATE TABLE public.categorias_financeiras (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  categoria_pai_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  tipo public.tipo_financeiro NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.categorias_financeiras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own categorias_financeiras" ON public.categorias_financeiras FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own categorias_financeiras" ON public.categorias_financeiras FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own categorias_financeiras" ON public.categorias_financeiras FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own categorias_financeiras" ON public.categorias_financeiras FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_categorias_financeiras_updated_at
  BEFORE UPDATE ON public.categorias_financeiras
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- CENTROS DE CUSTO
-- ============================================
CREATE TABLE public.centros_custo (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.centros_custo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own centros_custo" ON public.centros_custo FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own centros_custo" ON public.centros_custo FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own centros_custo" ON public.centros_custo FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own centros_custo" ON public.centros_custo FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_centros_custo_updated_at
  BEFORE UPDATE ON public.centros_custo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- CONTAS BANCÁRIAS
-- ============================================
CREATE TABLE public.contas_bancarias (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  banco TEXT,
  tipo public.tipo_conta_bancaria NOT NULL DEFAULT 'corrente',
  saldo_inicial NUMERIC NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.contas_bancarias ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own contas_bancarias" ON public.contas_bancarias FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own contas_bancarias" ON public.contas_bancarias FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own contas_bancarias" ON public.contas_bancarias FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own contas_bancarias" ON public.contas_bancarias FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_contas_bancarias_updated_at
  BEFORE UPDATE ON public.contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- FORMAS DE PAGAMENTO
-- ============================================
CREATE TABLE public.formas_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  tipo public.tipo_forma_pagamento NOT NULL DEFAULT 'pix',
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.formas_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own formas_pagamento" ON public.formas_pagamento FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own formas_pagamento" ON public.formas_pagamento FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own formas_pagamento" ON public.formas_pagamento FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own formas_pagamento" ON public.formas_pagamento FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_formas_pagamento_updated_at
  BEFORE UPDATE ON public.formas_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
