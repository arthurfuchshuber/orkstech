
-- Add dre_group enum
CREATE TYPE public.dre_group AS ENUM (
  'revenue',
  'deductions', 
  'costs',
  'operational_expenses',
  'financial_expenses',
  'financial_revenue',
  'taxes'
);

-- Add dre_group to categorias_financeiras
ALTER TABLE public.categorias_financeiras 
ADD COLUMN dre_group public.dre_group NULL;

-- Add categoria_financeira_id to cash_transactions for DRE linkage
ALTER TABLE public.cash_transactions 
ADD COLUMN categoria_financeira_id UUID NULL REFERENCES public.categorias_financeiras(id);

-- Add categoria_financeira_id to accounts_payable for DRE linkage
ALTER TABLE public.accounts_payable 
ADD COLUMN categoria_financeira_id UUID NULL REFERENCES public.categorias_financeiras(id);
