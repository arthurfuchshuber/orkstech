
ALTER TABLE public.accounts_payable
ADD COLUMN cliente_id uuid REFERENCES public.clientes(id) ON DELETE SET NULL;

CREATE INDEX idx_accounts_payable_cliente_id ON public.accounts_payable(cliente_id);
