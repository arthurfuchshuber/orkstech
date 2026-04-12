
DROP POLICY "Service role can manage webhooks_log" ON public.pluggy_webhooks_log;

CREATE POLICY "Only service role can manage webhooks_log" ON public.pluggy_webhooks_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
