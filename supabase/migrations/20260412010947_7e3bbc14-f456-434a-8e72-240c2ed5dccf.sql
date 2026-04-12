
CREATE TABLE public.pluggy_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pluggy_item_id TEXT NOT NULL,
  connector_name TEXT,
  status TEXT NOT NULL DEFAULT 'connected',
  last_sync_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.pluggy_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own pluggy_connections" ON public.pluggy_connections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own pluggy_connections" ON public.pluggy_connections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own pluggy_connections" ON public.pluggy_connections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own pluggy_connections" ON public.pluggy_connections FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_pluggy_connections_updated_at
  BEFORE UPDATE ON public.pluggy_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
