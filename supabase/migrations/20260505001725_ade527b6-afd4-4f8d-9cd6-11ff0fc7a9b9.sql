-- FASE 1: Padronização do cálculo de investimentos para valor LÍQUIDO (resgatável).
-- Recalcula bank_data.totalInvestments e contas_bancarias.investimento_sincronizado
-- a partir da soma de pluggy_investments.balance (ACTIVE), garantindo coerência total
-- entre Extrato, Dashboard e Cards.

WITH agg AS (
  SELECT
    pi.user_id,
    pi.pluggy_item_id,
    ROUND(SUM(COALESCE(pi.balance, 0))::numeric, 2) AS total_liquido
  FROM public.pluggy_investments pi
  WHERE COALESCE(pi.status, 'ACTIVE') = 'ACTIVE'
    AND COALESCE(pi.balance, 0) > 0
  GROUP BY pi.user_id, pi.pluggy_item_id
)
UPDATE public.pluggy_bank_accounts pba
SET bank_data = jsonb_set(
      COALESCE(pba.bank_data, '{}'::jsonb),
      '{totalInvestments}',
      to_jsonb(CASE WHEN pba.type = 'CREDIT' THEN 0 ELSE agg.total_liquido END),
      true
    ),
    updated_at = now()
FROM agg
WHERE pba.user_id = agg.user_id
  AND pba.pluggy_item_id = agg.pluggy_item_id;

-- Sincroniza para contas_bancarias.investimento_sincronizado
WITH agg AS (
  SELECT
    cb.id AS conta_id,
    ROUND(SUM(COALESCE(pi.balance, 0))::numeric, 2) AS total_liquido
  FROM public.contas_bancarias cb
  JOIN public.pluggy_bank_accounts pba ON pba.pluggy_account_id = cb.pluggy_account_id
  JOIN public.pluggy_investments pi
    ON pi.user_id = pba.user_id AND pi.pluggy_item_id = pba.pluggy_item_id
  WHERE COALESCE(pi.status, 'ACTIVE') = 'ACTIVE'
    AND COALESCE(pi.balance, 0) > 0
    AND pba.type <> 'CREDIT'
  GROUP BY cb.id
)
UPDATE public.contas_bancarias cb
SET investimento_sincronizado = agg.total_liquido,
    ultima_sync_at = now(),
    updated_at = now()
FROM agg
WHERE cb.id = agg.conta_id
  AND cb.investimento_sincronizado IS DISTINCT FROM agg.total_liquido;