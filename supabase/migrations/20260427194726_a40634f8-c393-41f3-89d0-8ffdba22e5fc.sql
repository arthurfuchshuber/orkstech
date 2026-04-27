-- 1. empresa_socios: novos campos
ALTER TABLE public.empresa_socios
  ADD COLUMN IF NOT EXISTS tipo_pessoa text NOT NULL DEFAULT 'PF' CHECK (tipo_pessoa IN ('PF','PJ')),
  ADD COLUMN IF NOT EXISTS documento text,
  ADD COLUMN IF NOT EXISTS qualificacao text,
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual','receita_federal')),
  ADD COLUMN IF NOT EXISTS status_socio text NOT NULL DEFAULT 'ativo' CHECK (status_socio IN ('ativo','inativo'));

-- Backfill documento a partir do cpf existente
UPDATE public.empresa_socios
SET documento = regexp_replace(COALESCE(cpf,''), '\D', '', 'g')
WHERE documento IS NULL AND cpf IS NOT NULL;

-- Torna cpf opcional (mantém para retrocompat)
ALTER TABLE public.empresa_socios ALTER COLUMN cpf DROP NOT NULL;

-- Índice único por empresa+documento (evita duplicidade entre sync e manual)
CREATE UNIQUE INDEX IF NOT EXISTS empresa_socios_empresa_doc_uniq
  ON public.empresa_socios (empresa_id, documento)
  WHERE documento IS NOT NULL AND documento <> '';

-- 2. empresas: timestamp da última sincronização QSA
ALTER TABLE public.empresas
  ADD COLUMN IF NOT EXISTS last_qsa_sync_at timestamptz;