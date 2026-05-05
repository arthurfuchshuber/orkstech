-- ============================================================
-- FASE 2: limite de divergência configurável por conta
-- ============================================================
ALTER TABLE public.contas_bancarias
  ADD COLUMN IF NOT EXISTS divergencia_alerta_limite numeric NOT NULL DEFAULT 1.00;

COMMENT ON COLUMN public.contas_bancarias.divergencia_alerta_limite IS
  'Limite em reais para disparar alerta de divergência entre saldo agregado e soma dos investimentos detalhados (ATIVOS). Padrão R$ 1,00.';

-- ============================================================
-- FASE 3: logs de sincronização Pluggy
-- ============================================================
CREATE TABLE IF NOT EXISTS public.pluggy_sync_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  pluggy_item_id text NOT NULL,
  connector_name text,
  source text NOT NULL DEFAULT 'pluggy', -- pluggy / manual / system
  value_type text NOT NULL DEFAULT 'liquido', -- liquido (balance) | bruto (amount)
  status text NOT NULL DEFAULT 'success', -- success | error | partial
  accounts_count int NOT NULL DEFAULT 0,
  transactions_count int NOT NULL DEFAULT 0,
  investments_count int NOT NULL DEFAULT 0,
  total_investments numeric NOT NULL DEFAULT 0,
  duration_ms int,
  error_message text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pluggy_sync_logs_user_created
  ON public.pluggy_sync_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pluggy_sync_logs_item
  ON public.pluggy_sync_logs (pluggy_item_id, created_at DESC);

ALTER TABLE public.pluggy_sync_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view sync logs" ON public.pluggy_sync_logs;
CREATE POLICY "Members can view sync logs" ON public.pluggy_sync_logs
  FOR SELECT USING (
    user_id = auth.uid()
    OR (empresa_id IS NOT NULL AND public.is_empresa_member(empresa_id))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Service can insert sync logs" ON public.pluggy_sync_logs;
CREATE POLICY "Service can insert sync logs" ON public.pluggy_sync_logs
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR public.is_super_admin()
  );

-- ============================================================
-- FASE 2/4: snapshots de reconciliação de investimento
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reconciliacoes_investimento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid,
  conta_id uuid NOT NULL REFERENCES public.contas_bancarias(id) ON DELETE CASCADE,
  saldo_agregado numeric NOT NULL DEFAULT 0,         -- contas_bancarias.investimento_sincronizado
  soma_detalhada numeric NOT NULL DEFAULT 0,         -- SUM(pluggy_investments.balance ACTIVE)
  divergencia numeric NOT NULL DEFAULT 0,            -- ABS(soma - agregado)
  limite_configurado numeric NOT NULL DEFAULT 1.00,
  status text NOT NULL DEFAULT 'ok',                 -- ok | divergente | sem_dados
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,       -- { investimentos: [{ id, name, balance, status, updated_at }] }
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recinv_conta_created
  ON public.reconciliacoes_investimento (conta_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recinv_user_status
  ON public.reconciliacoes_investimento (user_id, status, created_at DESC);

ALTER TABLE public.reconciliacoes_investimento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members can view reconciliations" ON public.reconciliacoes_investimento;
CREATE POLICY "Members can view reconciliations" ON public.reconciliacoes_investimento
  FOR SELECT USING (
    user_id = auth.uid()
    OR (empresa_id IS NOT NULL AND public.is_empresa_member(empresa_id))
    OR public.is_super_admin()
  );

DROP POLICY IF EXISTS "Members can insert reconciliations" ON public.reconciliacoes_investimento;
CREATE POLICY "Members can insert reconciliations" ON public.reconciliacoes_investimento
  FOR INSERT WITH CHECK (
    user_id = auth.uid() OR public.is_super_admin()
  );

-- ============================================================
-- Função de reconciliação por conta
-- ============================================================
CREATE OR REPLACE FUNCTION public.reconciliar_investimentos_conta(p_conta_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_conta RECORD;
  v_soma numeric := 0;
  v_div numeric := 0;
  v_status text := 'ok';
  v_detalhes jsonb;
  v_id uuid;
BEGIN
  SELECT cb.*, pba.pluggy_item_id, pba.user_id AS pba_user_id
    INTO v_conta
  FROM public.contas_bancarias cb
  LEFT JOIN public.pluggy_bank_accounts pba ON pba.pluggy_account_id = cb.pluggy_account_id
  WHERE cb.id = p_conta_id;

  IF v_conta.id IS NULL THEN
    RAISE EXCEPTION 'Conta não encontrada';
  END IF;

  IF v_conta.user_id <> auth.uid() AND NOT public.is_super_admin()
     AND NOT public.is_empresa_member(v_conta.empresa_id) THEN
    RAISE EXCEPTION 'Permissão negada';
  END IF;

  -- Soma líquida (balance) das posições ATIVAS
  SELECT COALESCE(SUM(pi.balance), 0),
         COALESCE(jsonb_agg(jsonb_build_object(
           'id', pi.id,
           'name', pi.name,
           'type', pi.type,
           'subtype', pi.subtype,
           'balance', pi.balance,
           'amount_original', pi.amount_original,
           'amount_profit', pi.amount_profit,
           'status', pi.status,
           'updated_at', pi.updated_at
         ) ORDER BY pi.balance DESC), '[]'::jsonb)
    INTO v_soma, v_detalhes
  FROM public.pluggy_investments pi
  WHERE pi.user_id = COALESCE(v_conta.pba_user_id, v_conta.user_id)
    AND pi.pluggy_item_id = v_conta.pluggy_item_id
    AND COALESCE(pi.status, 'ACTIVE') = 'ACTIVE'
    AND COALESCE(pi.balance, 0) > 0;

  v_div := ROUND(ABS(v_soma - COALESCE(v_conta.investimento_sincronizado, 0))::numeric, 2);

  IF v_conta.pluggy_item_id IS NULL THEN
    v_status := 'sem_dados';
  ELSIF v_div > COALESCE(v_conta.divergencia_alerta_limite, 1.00) THEN
    v_status := 'divergente';
  ELSE
    v_status := 'ok';
  END IF;

  INSERT INTO public.reconciliacoes_investimento (
    user_id, empresa_id, conta_id, saldo_agregado, soma_detalhada,
    divergencia, limite_configurado, status, detalhes
  ) VALUES (
    v_conta.user_id, v_conta.empresa_id, v_conta.id,
    COALESCE(v_conta.investimento_sincronizado, 0), v_soma,
    v_div, COALESCE(v_conta.divergencia_alerta_limite, 1.00), v_status,
    jsonb_build_object('investimentos', v_detalhes)
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'conta_id', v_conta.id,
    'saldo_agregado', COALESCE(v_conta.investimento_sincronizado, 0),
    'soma_detalhada', v_soma,
    'divergencia', v_div,
    'limite', COALESCE(v_conta.divergencia_alerta_limite, 1.00),
    'status', v_status,
    'investimentos', v_detalhes
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reconciliar_investimentos_conta(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconciliar_investimentos_conta(uuid) TO authenticated;