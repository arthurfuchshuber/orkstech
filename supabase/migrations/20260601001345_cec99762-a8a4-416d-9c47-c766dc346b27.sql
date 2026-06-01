-- Cron: classifica automaticamente Tipos de Gasto a cada 15 min (apenas registros sem classificação)
DO $$
BEGIN
  PERFORM cron.unschedule('classify-tipos-gasto-every-15m');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'classify-tipos-gasto-every-15m',
  '*/15 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://uadwnxqcpfcrpuyetpaw.supabase.co/functions/v1/classify-tipos-gasto',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || coalesce(nullif(current_setting('app.cron_secret', true), ''), 'UNCONFIGURED')
    ),
    body := jsonb_build_object('only_uncategorized', true)
  ) AS request_id;
  $$
);