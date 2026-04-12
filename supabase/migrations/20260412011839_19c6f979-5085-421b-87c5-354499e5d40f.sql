
-- Contas bancárias sincronizadas via Pluggy
CREATE TABLE public.pluggy_bank_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  connection_id UUID REFERENCES public.pluggy_connections(id) ON DELETE CASCADE,
  pluggy_item_id TEXT NOT NULL,
  pluggy_account_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'BANK',
  subtype TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  currency_code TEXT DEFAULT 'BRL',
  credit_limit NUMERIC,
  credit_available NUMERIC,
  credit_bill_amount NUMERIC,
  credit_bill_due_date DATE,
  bank_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pluggy_bank_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pluggy_bank_accounts" ON public.pluggy_bank_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pluggy_bank_accounts" ON public.pluggy_bank_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pluggy_bank_accounts" ON public.pluggy_bank_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pluggy_bank_accounts" ON public.pluggy_bank_accounts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_pluggy_bank_accounts_updated_at
  BEFORE UPDATE ON public.pluggy_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Transações bancárias sincronizadas
CREATE TABLE public.pluggy_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pluggy_account_id TEXT NOT NULL,
  pluggy_transaction_id TEXT NOT NULL UNIQUE,
  description TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  date DATE NOT NULL,
  type TEXT NOT NULL DEFAULT 'DEBIT',
  category TEXT,
  payment_data JSONB DEFAULT '{}',
  reconciled BOOLEAN NOT NULL DEFAULT false,
  reconciled_payable_id UUID REFERENCES public.accounts_payable(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pluggy_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own pluggy_transactions" ON public.pluggy_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pluggy_transactions" ON public.pluggy_transactions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pluggy_transactions" ON public.pluggy_transactions FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pluggy_transactions" ON public.pluggy_transactions FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_pluggy_transactions_updated_at
  BEFORE UPDATE ON public.pluggy_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_pluggy_transactions_account ON public.pluggy_transactions(pluggy_account_id);
CREATE INDEX idx_pluggy_transactions_date ON public.pluggy_transactions(date DESC);

-- Log de webhooks recebidos
CREATE TABLE public.pluggy_webhooks_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  item_id TEXT,
  payload JSONB NOT NULL DEFAULT '{}',
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Webhook log não tem RLS pois é acessado pela edge function com service role
ALTER TABLE public.pluggy_webhooks_log ENABLE ROW LEVEL SECURITY;

-- Service role policy para a edge function escrever
CREATE POLICY "Service role can manage webhooks_log" ON public.pluggy_webhooks_log
  FOR ALL USING (true) WITH CHECK (true);
