CREATE TABLE public.cliente_produtos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa_id UUID,
  nome TEXT NOT NULL,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cliente_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cliente_produtos" ON public.cliente_produtos
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all cliente_produtos" ON public.cliente_produtos
  FOR SELECT TO authenticated USING (is_super_admin());

CREATE POLICY "Users can create own cliente_produtos" ON public.cliente_produtos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cliente_produtos" ON public.cliente_produtos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cliente_produtos" ON public.cliente_produtos
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_cliente_produtos_updated_at
  BEFORE UPDATE ON public.cliente_produtos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.clientes ADD COLUMN produto_segmento_id UUID;
ALTER TABLE public.fornecedores ADD COLUMN produto_segmento_id UUID;