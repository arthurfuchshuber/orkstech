CREATE TABLE public.automacoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  descricao TEXT DEFAULT '',
  ativo BOOLEAN NOT NULL DEFAULT true,
  evento_gatilho TEXT NOT NULL,
  acoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  condicoes JSONB NOT NULL DEFAULT '[]'::jsonb,
  executado_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.automacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own automacoes"
ON public.automacoes FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own automacoes"
ON public.automacoes FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own automacoes"
ON public.automacoes FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own automacoes"
ON public.automacoes FOR DELETE
USING (auth.uid() = user_id);

CREATE TRIGGER update_automacoes_updated_at
BEFORE UPDATE ON public.automacoes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();