-- Add 'ativo' column to empresas to support admin deactivation that cascades to all members
ALTER TABLE public.empresas ADD COLUMN IF NOT EXISTS ativo BOOLEAN NOT NULL DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_empresas_ativo ON public.empresas(ativo);