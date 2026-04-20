-- Enable pg_cron and pg_net to support scheduled background jobs (Open Finance auto-sync)
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;