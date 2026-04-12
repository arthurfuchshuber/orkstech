
-- Fix overly permissive INSERT policies
DROP POLICY "System can insert notificacoes_sistema" ON public.notificacoes_sistema;
CREATE POLICY "Insert notificacoes_sistema for own user"
  ON public.notificacoes_sistema FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY "System can insert historico_sistema" ON public.historico_sistema;
CREATE POLICY "Insert historico_sistema for own user"
  ON public.historico_sistema FOR INSERT
  WITH CHECK (auth.uid() = user_id);
