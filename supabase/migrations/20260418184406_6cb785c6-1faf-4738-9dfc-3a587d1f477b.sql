-- Tabela de cache de assinaturas (sincronizada via webhook)
CREATE TABLE public.subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  email TEXT NOT NULL,
  stripe_customer_id TEXT UNIQUE,
  stripe_subscription_id TEXT UNIQUE,
  status TEXT, -- active, trialing, past_due, canceled, unpaid, incomplete, incomplete_expired, paused, null
  product_id TEXT,
  price_id TEXT,
  current_period_end TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  last_synced_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscribers_user_id ON public.subscribers(user_id);
CREATE INDEX idx_subscribers_stripe_customer ON public.subscribers(stripe_customer_id);
CREATE INDEX idx_subscribers_status ON public.subscribers(status);

ALTER TABLE public.subscribers ENABLE ROW LEVEL SECURITY;

-- Usuário lê o próprio
CREATE POLICY "Users can view their own subscription"
  ON public.subscribers FOR SELECT
  USING (auth.uid() = user_id);

-- Super admin vê tudo
CREATE POLICY "Super admins can view all subscriptions"
  ON public.subscribers FOR SELECT
  USING (public.is_super_admin());

-- Apenas edge functions (service role) escrevem; nenhum INSERT/UPDATE/DELETE para usuários

CREATE TRIGGER update_subscribers_updated_at
  BEFORE UPDATE ON public.subscribers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de log de webhooks Stripe
CREATE TABLE public.stripe_webhooks_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  processed BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_stripe_webhooks_event_id ON public.stripe_webhooks_log(stripe_event_id);
CREATE INDEX idx_stripe_webhooks_processed ON public.stripe_webhooks_log(processed);

ALTER TABLE public.stripe_webhooks_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admins can view webhook logs"
  ON public.stripe_webhooks_log FOR SELECT
  USING (public.is_super_admin());

-- Helper: retorna se o usuário tem acesso (assinatura ativa ou trial válido)
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscribers
    WHERE user_id = p_user_id
      AND status IN ('active', 'trialing')
      AND (current_period_end IS NULL OR current_period_end > now())
  ) OR public.is_super_admin();
$$;