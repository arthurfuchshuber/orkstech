
CREATE TABLE public.pluggy_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'informacao',
  titulo TEXT NOT NULL,
  descricao TEXT NOT NULL,
  lida BOOLEAN NOT NULL DEFAULT false,
  webhook_log_id UUID REFERENCES public.pluggy_webhooks_log(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pluggy_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pluggy_notifications" ON public.pluggy_notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own pluggy_notifications" ON public.pluggy_notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Service role can insert pluggy_notifications" ON public.pluggy_notifications FOR INSERT TO service_role WITH CHECK (true);
CREATE POLICY "Users can delete own pluggy_notifications" ON public.pluggy_notifications FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_pluggy_notifications_user_unread ON public.pluggy_notifications(user_id, lida) WHERE lida = false;

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.pluggy_notifications;
