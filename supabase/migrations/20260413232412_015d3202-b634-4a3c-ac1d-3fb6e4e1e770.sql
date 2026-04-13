-- Create categorias_cadastro table
CREATE TABLE public.categorias_cadastro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  categoria_pai_id UUID REFERENCES public.categorias_cadastro(id) ON DELETE CASCADE,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.categorias_cadastro ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own categorias_cadastro"
  ON public.categorias_cadastro FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own categorias_cadastro"
  ON public.categorias_cadastro FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own categorias_cadastro"
  ON public.categorias_cadastro FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own categorias_cadastro"
  ON public.categorias_cadastro FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_categorias_cadastro_updated_at
  BEFORE UPDATE ON public.categorias_cadastro
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Uppercase trigger
CREATE TRIGGER enforce_uppercase_categorias_cadastro
  BEFORE INSERT OR UPDATE ON public.categorias_cadastro
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_uppercase_names();

-- Add categoria_id to fornecedores
ALTER TABLE public.fornecedores
  ADD COLUMN categoria_id UUID REFERENCES public.categorias_cadastro(id) ON DELETE SET NULL;