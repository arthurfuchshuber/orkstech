
-- Add supplier_id column referencing fornecedores
ALTER TABLE public.accounts_payable 
ADD COLUMN supplier_id uuid REFERENCES public.fornecedores(id) ON DELETE SET NULL;

-- Create index for performance
CREATE INDEX idx_accounts_payable_supplier_id ON public.accounts_payable(supplier_id);
