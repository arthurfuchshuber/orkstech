
ALTER TABLE public.cliente_documentos
ADD COLUMN interacao_id uuid REFERENCES public.cliente_interacoes(id) ON DELETE SET NULL;

CREATE INDEX idx_cliente_documentos_interacao_id ON public.cliente_documentos(interacao_id);
