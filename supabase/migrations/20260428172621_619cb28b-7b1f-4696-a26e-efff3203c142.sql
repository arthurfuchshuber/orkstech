
CREATE TABLE IF NOT EXISTS public.integration_notification_prefs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE CASCADE,
  provider text NOT NULL,
  silenced_popup boolean NOT NULL DEFAULT false,
  silenced_banner boolean NOT NULL DEFAULT false,
  silenced_bell boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, empresa_id, provider)
);

ALTER TABLE public.integration_notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages own prefs"
  ON public.integration_notification_prefs
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE TRIGGER trg_integration_notif_prefs_updated
  BEFORE UPDATE ON public.integration_notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
