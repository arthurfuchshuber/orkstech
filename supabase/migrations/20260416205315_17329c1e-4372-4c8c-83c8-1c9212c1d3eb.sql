-- Habilita pg_cron e pg_net para agendar chamadas HTTP
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Remove agendamento antigo se existir
DO $$
BEGIN
  PERFORM cron.unschedule('pluggy-auto-sync-every-4h');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Agenda execução automática a cada 4 horas
SELECT cron.schedule(
  'pluggy-auto-sync-every-4h',
  '0 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://uadwnxqcpfcrpuyetpaw.supabase.co/functions/v1/pluggy-auto-sync',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{}'::jsonb
  ) AS request_id;
  $$
);