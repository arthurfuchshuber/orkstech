
-- Add categoria_financeira_id to pluggy_transactions
ALTER TABLE public.pluggy_transactions
ADD COLUMN categoria_financeira_id uuid REFERENCES public.categorias_financeiras(id);

-- Create accounts_receivable table
CREATE TABLE public.accounts_receivable (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id),
  description text NOT NULL,
  amount numeric NOT NULL DEFAULT 0,
  due_date date NOT NULL,
  payment_date date,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'overdue', 'cancelled')),
  cliente_id uuid REFERENCES public.clientes(id),
  supplier_name text,
  document_number text,
  categoria_financeira_id uuid REFERENCES public.categorias_financeiras(id),
  category_id uuid REFERENCES public.categorias_cadastro(id),
  cost_center_id uuid REFERENCES public.centros_custo(id),
  bank_account_id uuid REFERENCES public.contas_bancarias(id),
  payment_method_id uuid REFERENCES public.formas_pagamento(id),
  installment_number integer DEFAULT 1,
  installment_total integer DEFAULT 1,
  is_recurring boolean NOT NULL DEFAULT false,
  recurrence_interval text CHECK (recurrence_interval IS NULL OR recurrence_interval IN ('monthly', 'weekly', 'yearly')),
  pessoa_tipo text NOT NULL DEFAULT 'pj' CHECK (pessoa_tipo IN ('pf', 'pj')),
  notes text,
  attachment_url text,
  juros_multa numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.accounts_receivable ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own accounts_receivable"
ON public.accounts_receivable FOR SELECT TO public
USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all accounts_receivable"
ON public.accounts_receivable FOR SELECT TO authenticated
USING (is_super_admin());

CREATE POLICY "Users can create own accounts_receivable"
ON public.accounts_receivable FOR INSERT TO public
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own accounts_receivable"
ON public.accounts_receivable FOR UPDATE TO public
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own accounts_receivable"
ON public.accounts_receivable FOR DELETE TO public
USING (auth.uid() = user_id);

-- Updated_at trigger
CREATE TRIGGER set_updated_at_accounts_receivable
BEFORE UPDATE ON public.accounts_receivable
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
