ALTER TABLE public.accounts_payable ADD COLUMN IF NOT EXISTS grupo_id UUID;
CREATE INDEX IF NOT EXISTS idx_accounts_payable_grupo_id ON public.accounts_payable(grupo_id);

ALTER TABLE public.accounts_receivable ADD COLUMN IF NOT EXISTS grupo_id UUID;
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_grupo_id ON public.accounts_receivable(grupo_id);