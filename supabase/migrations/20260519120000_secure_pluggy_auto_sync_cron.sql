-- Atualiza o cron do pluggy-auto-sync para enviar CRON_SECRET no header Authorization.
-- Configure o mesmo valor em:
--   1) Supabase Dashboard → Edge Functions → Secrets → CRON_SECRET
--   2) SQL Editor (uma vez): ALTER DATABASE postgres SET app.cron_secret = 'seu-secret-longo-aleatorio';

DO $$
BEGIN
  PERFORM cron.unschedule('pluggy-auto-sync-every-4h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'pluggy-auto-sync-every-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uadwnxqcpfcrpuyetpaw.supabase.co/functions/v1/pluggy-auto-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(nullif(current_setting('app.cron_secret', true), ''), 'UNCONFIGURED')
    ),
    body := '{}'::jsonb
  ) AS request_id;
  $$
);
