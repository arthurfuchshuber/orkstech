
ALTER TABLE public.integracoes_credenciais
  ADD COLUMN IF NOT EXISTS last_error text;
