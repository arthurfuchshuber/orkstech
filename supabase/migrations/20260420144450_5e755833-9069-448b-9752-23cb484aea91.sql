-- 1) Coluna nullable inicialmente
ALTER TABLE public.pluggy_transactions
  ADD COLUMN IF NOT EXISTS is_internal_transfer boolean DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pluggy_tx_internal
  ON public.pluggy_transactions (user_id, is_internal_transfer);

-- 2) Função classificadora
CREATE OR REPLACE FUNCTION public.is_pluggy_internal_transfer(
  p_category text, p_description text, p_payment_data jsonb
)
RETURNS boolean LANGUAGE sql IMMUTABLE
AS $$
  SELECT COALESCE(
    COALESCE(p_category, '') IN (
      'Investments', 'Mutual funds', 'Investimentos',
      'Same person transfer', 'Transferência entre contas próprias'
    )
    OR (COALESCE(p_description, '') ~* '(aplica[cç][aã]o|resgate)\s+(rdb|cdb|lci|lca|fundo|tesouro|poupan[cç]a)')
    OR (COALESCE(p_description, '') ~* '(caixinha|cofrinho|reserva\s+autom[aá]tica)')
    OR (
      p_payment_data IS NOT NULL
      AND (p_payment_data->'payer'->'documentNumber'->>'value') IS NOT NULL
      AND (p_payment_data->'payer'->'documentNumber'->>'value')
          = (p_payment_data->'receiver'->'documentNumber'->>'value')
    ),
    false
  );
$$;

-- 3) Trigger
CREATE OR REPLACE FUNCTION public.set_pluggy_internal_transfer()
RETURNS trigger LANGUAGE plpgsql
AS $$
BEGIN
  NEW.is_internal_transfer := COALESCE(
    public.is_pluggy_internal_transfer(NEW.category, NEW.description, NEW.payment_data),
    false
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pluggy_tx_internal ON public.pluggy_transactions;
CREATE TRIGGER trg_pluggy_tx_internal
  BEFORE INSERT OR UPDATE OF category, description, payment_data
  ON public.pluggy_transactions
  FOR EACH ROW EXECUTE FUNCTION public.set_pluggy_internal_transfer();

-- 4) Backfill
UPDATE public.pluggy_transactions
SET is_internal_transfer = COALESCE(
  public.is_pluggy_internal_transfer(category, description, payment_data),
  false
);

UPDATE public.pluggy_transactions SET is_internal_transfer = false WHERE is_internal_transfer IS NULL;
ALTER TABLE public.pluggy_transactions ALTER COLUMN is_internal_transfer SET NOT NULL;

-- 5) cashflow_consolidated com a flag
CREATE OR REPLACE FUNCTION public.cashflow_consolidated(
  p_user_id uuid, p_empresa_id uuid, p_start date, p_end date
)
RETURNS TABLE(
  movement_date date, source_table text, source_id uuid, direction text,
  amount numeric, description text, category text, document_number text,
  status text, origin text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT * FROM (
    SELECT ar.due_date AS movement_date, 'accounts_receivable'::TEXT AS source_table, ar.id AS source_id, 'inflow'::TEXT AS direction,
      ar.amount, ar.description, cf.nome AS category, ar.document_number, ar.status::text AS status, 'system'::TEXT AS origin
    FROM public.accounts_receivable ar
    LEFT JOIN public.categorias_financeiras cf ON cf.id = ar.categoria_financeira_id
    WHERE ar.user_id = p_user_id
      AND (p_empresa_id IS NULL OR ar.empresa_id = p_empresa_id)
      AND ar.due_date BETWEEN p_start AND p_end
      AND ar.status <> 'cancelled'
    UNION ALL
    SELECT ap.due_date, 'accounts_payable'::TEXT, ap.id, 'outflow'::TEXT,
      ap.amount, ap.description, cf2.nome, ap.document_number, ap.status::text, 'system'::TEXT
    FROM public.accounts_payable ap
    LEFT JOIN public.categorias_financeiras cf2 ON cf2.id = ap.categoria_financeira_id
    WHERE ap.user_id = p_user_id
      AND (p_empresa_id IS NULL OR ap.empresa_id = p_empresa_id)
      AND ap.due_date BETWEEN p_start AND p_end
      AND ap.status::text <> 'cancelled'
    UNION ALL
    SELECT f.forecast_date, 'cashflow_forecasts'::TEXT, f.id, f.direction::text,
      f.amount, f.description, f.category, f.document_number, f.status::text, f.source::text
    FROM public.cashflow_forecasts f
    WHERE f.user_id = p_user_id
      AND (p_empresa_id IS NULL OR f.empresa_id = p_empresa_id)
      AND f.forecast_date BETWEEN p_start AND p_end
      AND f.status <> 'cancelled'
    UNION ALL
    SELECT mbt.transaction_date, 'manual_bank_transactions'::TEXT, mbt.id,
      CASE WHEN mbt.type = 'CREDIT' OR mbt.amount > 0 THEN 'inflow' ELSE 'outflow' END,
      ABS(mbt.amount), mbt.description, cf3.nome, mbt.document_number, 'confirmed'::text, mbt.source
    FROM public.manual_bank_transactions mbt
    LEFT JOIN public.categorias_financeiras cf3 ON cf3.id = mbt.categoria_financeira_id
    WHERE mbt.user_id = p_user_id
      AND (p_empresa_id IS NULL OR mbt.empresa_id = p_empresa_id)
      AND mbt.transaction_date BETWEEN p_start AND p_end
    UNION ALL
    SELECT ct.transaction_date, 'cash_transactions'::TEXT, ct.id,
      CASE WHEN ct.type = 'income' THEN 'inflow' ELSE 'outflow' END,
      ABS(ct.amount), COALESCE(ct.description, 'Movimento de caixa'),
      cf4.nome, NULL::text, 'confirmed'::text, 'cash'::text
    FROM public.cash_transactions ct
    LEFT JOIN public.categorias_financeiras cf4 ON cf4.id = ct.categoria_financeira_id
    WHERE ct.user_id = p_user_id
      AND (p_empresa_id IS NULL OR ct.empresa_id = p_empresa_id)
      AND ct.transaction_date BETWEEN p_start AND p_end
      AND ct.account_payable_id IS NULL
    UNION ALL
    SELECT pt.date, 'pluggy_transactions'::TEXT, pt.id,
      CASE WHEN pt.type = 'CREDIT' OR pt.amount > 0 THEN 'inflow' ELSE 'outflow' END,
      ABS(pt.amount), pt.description, cf5.nome, NULL::text,
      CASE WHEN pt.reconciled THEN 'reconciled' ELSE 'confirmed' END, 'pluggy'::text
    FROM public.pluggy_transactions pt
    LEFT JOIN public.categorias_financeiras cf5 ON cf5.id = pt.categoria_financeira_id
    WHERE pt.user_id = p_user_id
      AND pt.date BETWEEN p_start AND p_end
      AND pt.reconciled_payable_id IS NULL
      AND pt.is_internal_transfer = false
  ) consolidated
  ORDER BY movement_date ASC;
$function$;