-- Add receivable reconciliation support
ALTER TABLE public.pluggy_transactions
  ADD COLUMN IF NOT EXISTS reconciled_receivable_id uuid REFERENCES public.accounts_receivable(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pluggy_tx_reconciled_receivable
  ON public.pluggy_transactions(reconciled_receivable_id)
  WHERE reconciled_receivable_id IS NOT NULL;

-- Update cashflow_consolidated to also exclude transactions reconciled to receivables
CREATE OR REPLACE FUNCTION public.cashflow_consolidated(
  p_user_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE (
  source text,
  source_id uuid,
  movement_date date,
  description text,
  amount numeric,
  direction text,
  bank_account_id uuid,
  bank_account_name text,
  category_id uuid,
  category_name text,
  document_number text,
  status text,
  origin text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  -- Accounts Payable (pending/overdue) - projected outflows
  SELECT
    'payable'::text AS source,
    ap.id AS source_id,
    ap.due_date AS movement_date,
    ap.description,
    ap.amount,
    'out'::text AS direction,
    ap.bank_account_id,
    cb.nome,
    ap.categoria_financeira_id,
    cf.nome,
    ap.document_number,
    ap.status::text,
    'manual'::text AS origin
  FROM public.accounts_payable ap
  LEFT JOIN public.contas_bancarias cb ON cb.id = ap.bank_account_id
  LEFT JOIN public.categorias_financeiras cf ON cf.id = ap.categoria_financeira_id
  WHERE ap.user_id = p_user_id
    AND ap.due_date BETWEEN p_start AND p_end
    AND ap.status IN ('pending', 'overdue')

  UNION ALL

  -- Accounts Payable (paid) - confirmed outflows
  SELECT
    'payable'::text,
    ap.id,
    COALESCE(ap.payment_date, ap.due_date),
    ap.description,
    ap.amount,
    'out'::text,
    ap.bank_account_id,
    cb.nome,
    ap.categoria_financeira_id,
    cf.nome,
    ap.document_number,
    ap.status::text,
    'manual'::text
  FROM public.accounts_payable ap
  LEFT JOIN public.contas_bancarias cb ON cb.id = ap.bank_account_id
  LEFT JOIN public.categorias_financeiras cf ON cf.id = ap.categoria_financeira_id
  WHERE ap.user_id = p_user_id
    AND COALESCE(ap.payment_date, ap.due_date) BETWEEN p_start AND p_end
    AND ap.status = 'paid'

  UNION ALL

  -- Accounts Receivable (pending/overdue) - projected inflows
  SELECT
    'receivable'::text,
    ar.id,
    ar.due_date,
    ar.description,
    ar.amount,
    'in'::text,
    ar.bank_account_id,
    cb2.nome,
    ar.categoria_financeira_id,
    cf2.nome,
    ar.document_number,
    ar.status::text,
    'manual'::text
  FROM public.accounts_receivable ar
  LEFT JOIN public.contas_bancarias cb2 ON cb2.id = ar.bank_account_id
  LEFT JOIN public.categorias_financeiras cf2 ON cf2.id = ar.categoria_financeira_id
  WHERE ar.user_id = p_user_id
    AND ar.due_date BETWEEN p_start AND p_end
    AND ar.status IN ('pending', 'overdue')

  UNION ALL

  -- Accounts Receivable (paid) - confirmed inflows
  SELECT
    'receivable'::text,
    ar.id,
    COALESCE(ar.payment_date, ar.due_date),
    ar.description,
    ar.amount,
    'in'::text,
    ar.bank_account_id,
    cb2.nome,
    ar.categoria_financeira_id,
    cf2.nome,
    ar.document_number,
    ar.status::text,
    'manual'::text
  FROM public.accounts_receivable ar
  LEFT JOIN public.contas_bancarias cb2 ON cb2.id = ar.bank_account_id
  LEFT JOIN public.categorias_financeiras cf2 ON cf2.id = ar.categoria_financeira_id
  WHERE ar.user_id = p_user_id
    AND COALESCE(ar.payment_date, ar.due_date) BETWEEN p_start AND p_end
    AND ar.status = 'paid'

  UNION ALL

  -- Pluggy bank transactions (excluding internal transfers and already reconciled)
  SELECT
    'pluggy'::text,
    pt.id,
    pt.date,
    pt.description,
    ABS(pt.amount),
    CASE WHEN pt.type = 'CREDIT' THEN 'in' ELSE 'out' END,
    cb5.id,
    cb5.nome,
    pt.categoria_financeira_id,
    cf5.nome,
    NULL::text,
    CASE WHEN pt.reconciled THEN 'reconciled' ELSE 'confirmed' END,
    'pluggy'::text
  FROM public.pluggy_transactions pt
  LEFT JOIN public.contas_bancarias cb5
    ON cb5.user_id = pt.user_id
    AND (cb5.banco = pt.pluggy_account_id OR cb5.id::text = pt.pluggy_account_id)
  LEFT JOIN public.categorias_financeiras cf5 ON cf5.id = pt.categoria_financeira_id
  WHERE pt.user_id = p_user_id
    AND pt.date BETWEEN p_start AND p_end
    AND pt.reconciled_payable_id IS NULL
    AND pt.reconciled_receivable_id IS NULL
    AND pt.is_internal_transfer = false

  ORDER BY movement_date ASC;
$$;