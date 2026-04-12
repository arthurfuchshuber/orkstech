
CREATE TABLE public.cliente_interacao_tipos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, nome)
);

ALTER TABLE public.cliente_interacao_tipos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cliente_interacao_tipos"
  ON public.cliente_interacao_tipos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own cliente_interacao_tipos"
  ON public.cliente_interacao_tipos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own cliente_interacao_tipos"
  ON public.cliente_interacao_tipos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own cliente_interacao_tipos"
  ON public.cliente_interacao_tipos FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_cliente_interacao_tipos_updated_at
  BEFORE UPDATE ON public.cliente_interacao_tipos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
