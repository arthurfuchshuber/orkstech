
-- Enum for recurrence interval
CREATE TYPE public.recurrence_interval AS ENUM ('monthly', 'weekly', 'yearly');

-- Enum for payable status
CREATE TYPE public.payable_status AS ENUM ('pending', 'paid', 'overdue', 'cancelled');

-- Enum for cash transaction type
CREATE TYPE public.cash_transaction_type AS ENUM ('income', 'expense');

-- Accounts Payable table
CREATE TABLE public.accounts_payable (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  description TEXT NOT NULL,
  supplier_name TEXT,
  document_number TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE NOT NULL,
  issue_date DATE,
  payment_date DATE,
  status public.payable_status NOT NULL DEFAULT 'pending',
  category_id UUID REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  cost_center_id UUID REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  payment_method_id UUID REFERENCES public.formas_pagamento(id) ON DELETE SET NULL,
  installment_number INTEGER DEFAULT 1,
  installment_total INTEGER DEFAULT 1,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurrence_interval public.recurrence_interval,
  notes TEXT,
  attachment_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.accounts_payable ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own accounts_payable" ON public.accounts_payable FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own accounts_payable" ON public.accounts_payable FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own accounts_payable" ON public.accounts_payable FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own accounts_payable" ON public.accounts_payable FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_accounts_payable_updated_at
  BEFORE UPDATE ON public.accounts_payable
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Cash Transactions table
CREATE TABLE public.cash_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  type public.cash_transaction_type NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
  description TEXT,
  account_payable_id UUID REFERENCES public.accounts_payable(id) ON DELETE SET NULL,
  bank_account_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own cash_transactions" ON public.cash_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own cash_transactions" ON public.cash_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cash_transactions" ON public.cash_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cash_transactions" ON public.cash_transactions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_cash_transactions_updated_at
  BEFORE UPDATE ON public.cash_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for common queries
CREATE INDEX idx_accounts_payable_user_status ON public.accounts_payable(user_id, status);
CREATE INDEX idx_accounts_payable_due_date ON public.accounts_payable(user_id, due_date);
CREATE INDEX idx_cash_transactions_user ON public.cash_transactions(user_id, transaction_date);
