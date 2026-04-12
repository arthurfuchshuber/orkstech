
-- Add new columns to clientes
ALTER TABLE public.clientes
  ADD COLUMN IF NOT EXISTS numero text,
  ADD COLUMN IF NOT EXISTS complemento text,
  ADD COLUMN IF NOT EXISTS whatsapp text,
  ADD COLUMN IF NOT EXISTS responsavel_interno text,
  ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

-- Create cliente_documentos table
CREATE TABLE public.cliente_documentos (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  nome text NOT NULL,
  tipo text,
  url text NOT NULL,
  tamanho bigint,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cliente_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cliente_documentos" ON public.cliente_documentos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cliente_documentos" ON public.cliente_documentos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cliente_documentos" ON public.cliente_documentos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cliente_documentos" ON public.cliente_documentos FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_cliente_documentos_updated_at BEFORE UPDATE ON public.cliente_documentos FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create cliente_interacoes table
CREATE TABLE public.cliente_interacoes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  cliente_id uuid NOT NULL REFERENCES public.clientes(id) ON DELETE CASCADE,
  tipo text NOT NULL DEFAULT 'observacao',
  descricao text NOT NULL,
  usuario_nome text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.cliente_interacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cliente_interacoes" ON public.cliente_interacoes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cliente_interacoes" ON public.cliente_interacoes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cliente_interacoes" ON public.cliente_interacoes FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cliente_interacoes" ON public.cliente_interacoes FOR DELETE USING (auth.uid() = user_id);

-- Create storage bucket for client documents
INSERT INTO storage.buckets (id, name, public) VALUES ('client-documents', 'client-documents', true) ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users can upload client documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'client-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can view client documents" ON storage.objects FOR SELECT USING (bucket_id = 'client-documents');
CREATE POLICY "Users can delete client documents" ON storage.objects FOR DELETE USING (bucket_id = 'client-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
