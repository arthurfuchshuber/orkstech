ALTER TABLE public.contas_bancarias 
ADD COLUMN IF NOT EXISTS saldo_investimento numeric NOT NULL DEFAULT 0;