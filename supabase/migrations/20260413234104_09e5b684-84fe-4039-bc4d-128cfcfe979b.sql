-- Remove old FK to categorias_financeiras
ALTER TABLE public.accounts_payable
  DROP CONSTRAINT IF EXISTS accounts_payable_category_id_fkey;

-- Clear any existing category_id values (they reference the old table)
UPDATE public.accounts_payable SET category_id = NULL WHERE category_id IS NOT NULL;

-- Add new FK to categorias_cadastro
ALTER TABLE public.accounts_payable
  ADD CONSTRAINT accounts_payable_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES public.categorias_cadastro(id);