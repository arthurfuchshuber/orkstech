
-- Add empresa_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS empresa_id UUID REFERENCES public.empresas(id) ON DELETE SET NULL;

-- Backfill: link existing empresa owners
UPDATE public.profiles p
SET empresa_id = e.id
FROM public.empresas e
WHERE e.user_id = p.user_id
  AND p.empresa_id IS NULL;

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_profiles_empresa_id ON public.profiles(empresa_id);
