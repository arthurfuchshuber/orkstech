
CREATE TABLE public.pluggy_investments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pluggy_item_id TEXT NOT NULL,
  pluggy_investment_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT,
  subtype TEXT,
  code TEXT,
  issuer TEXT,
  balance NUMERIC NOT NULL DEFAULT 0,
  amount_original NUMERIC DEFAULT 0,
  amount_profit NUMERIC DEFAULT 0,
  rate NUMERIC,
  rate_type TEXT,
  fixed_annual_rate NUMERIC,
  status TEXT DEFAULT 'ACTIVE',
  due_date DATE,
  currency_code TEXT DEFAULT 'BRL',
  investment_data JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(pluggy_investment_id)
);

ALTER TABLE public.pluggy_investments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pluggy_investments"
  ON public.pluggy_investments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own pluggy_investments"
  ON public.pluggy_investments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own pluggy_investments"
  ON public.pluggy_investments FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own pluggy_investments"
  ON public.pluggy_investments FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Super admins can view all pluggy_investments"
  ON public.pluggy_investments FOR SELECT TO authenticated
  USING (is_super_admin());
