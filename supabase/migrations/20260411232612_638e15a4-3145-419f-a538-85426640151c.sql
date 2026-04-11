
-- 1. Create tipos_forma_pagamento table
CREATE TABLE public.tipos_forma_pagamento (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome TEXT NOT NULL,
  user_id UUID NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tipos_forma_pagamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tipos_forma_pagamento" ON public.tipos_forma_pagamento FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tipos_forma_pagamento" ON public.tipos_forma_pagamento FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tipos_forma_pagamento" ON public.tipos_forma_pagamento FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tipos_forma_pagamento" ON public.tipos_forma_pagamento FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_tipos_forma_pagamento_updated_at
  BEFORE UPDATE ON public.tipos_forma_pagamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Create bancos table
CREATE TABLE public.bancos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  codigo TEXT NOT NULL DEFAULT '',
  nome TEXT NOT NULL,
  user_id UUID NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bancos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bancos" ON public.bancos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own bancos" ON public.bancos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own bancos" ON public.bancos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own bancos" ON public.bancos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_bancos_updated_at
  BEFORE UPDATE ON public.bancos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Add columns to formas_pagamento
ALTER TABLE public.formas_pagamento ADD COLUMN numero_cartao TEXT;
ALTER TABLE public.formas_pagamento ADD COLUMN tipo_id UUID REFERENCES public.tipos_forma_pagamento(id) ON DELETE SET NULL;

-- 4. Add pessoa_tipo to contas_bancarias and accounts_payable
ALTER TABLE public.contas_bancarias ADD COLUMN pessoa_tipo pessoa_tipo NOT NULL DEFAULT 'pj';
ALTER TABLE public.contas_bancarias ADD COLUMN banco_id UUID REFERENCES public.bancos(id) ON DELETE SET NULL;

ALTER TABLE public.accounts_payable ADD COLUMN pessoa_tipo pessoa_tipo NOT NULL DEFAULT 'pj';

-- 5. Seed function for default banks
CREATE OR REPLACE FUNCTION public.seed_default_bancos(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.bancos WHERE user_id = p_user_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO public.bancos (user_id, codigo, nome, ordem) VALUES
    (p_user_id, '001', 'Banco do Brasil', 0),
    (p_user_id, '033', 'Santander', 1),
    (p_user_id, '104', 'Caixa Econômica Federal', 2),
    (p_user_id, '237', 'Bradesco', 3),
    (p_user_id, '341', 'Itaú Unibanco', 4),
    (p_user_id, '260', 'Nubank', 5),
    (p_user_id, '077', 'Inter', 6),
    (p_user_id, '336', 'C6 Bank', 7),
    (p_user_id, '290', 'PagBank', 8),
    (p_user_id, '380', 'PicPay', 9),
    (p_user_id, '756', 'Sicoob', 10),
    (p_user_id, '748', 'Sicredi', 11),
    (p_user_id, '422', 'Safra', 12),
    (p_user_id, '070', 'BRB', 13),
    (p_user_id, '212', 'Original', 14),
    (p_user_id, '655', 'Neon', 15),
    (p_user_id, '037', 'Banpará', 16),
    (p_user_id, '041', 'Banrisul', 17),
    (p_user_id, '085', 'Ailos', 18),
    (p_user_id, '121', 'Agibank', 19),
    (p_user_id, '208', 'BTG Pactual', 20),
    (p_user_id, '246', 'ABC Brasil', 21),
    (p_user_id, '318', 'BMG', 22),
    (p_user_id, '389', 'Mercantil do Brasil', 23),
    (p_user_id, '623', 'Pan', 24),
    (p_user_id, '633', 'Rendimento', 25),
    (p_user_id, '745', 'Citibank', 26),
    (p_user_id, '399', 'HSBC', 27),
    (p_user_id, '136', 'Unicred', 28),
    (p_user_id, '274', 'Money Plus', 29);
END;
$$;

-- 6. Seed function for default tipos_forma_pagamento
CREATE OR REPLACE FUNCTION public.seed_default_tipos_pagamento(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.tipos_forma_pagamento WHERE user_id = p_user_id LIMIT 1) THEN
    RETURN;
  END IF;

  INSERT INTO public.tipos_forma_pagamento (user_id, nome, ordem) VALUES
    (p_user_id, 'PIX', 0),
    (p_user_id, 'Boleto', 1),
    (p_user_id, 'Cartão de Crédito', 2),
    (p_user_id, 'Cartão de Débito', 3),
    (p_user_id, 'Transferência', 4),
    (p_user_id, 'Dinheiro', 5);
END;
$$;
