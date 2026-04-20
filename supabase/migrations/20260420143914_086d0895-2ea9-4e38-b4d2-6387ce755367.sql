-- Excluir transferências internas (aplicações/resgates de investimento) do fluxo de caixa
-- Racional: aplicação financeira NÃO é despesa, é transferência entre caixa líquido <-> investimento.
-- O saldo de investimento já é rastreado separadamente em pluggy_investments e exibido no Dashboard 360º.
CREATE OR REPLACE FUNCTION public.cashflow_consolidated(
  p_user_id uuid,
  p_empresa_id uuid,
  p_start date,
  p_end date
)
RETURNS TABLE(
  movement_date date,
  source_table text,
  source_id uuid,
  direction text,
  amount numeric,
  description text,
  category text,
  document_number text,
  status text,
  origin text
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- 1) Contas a Receber
  SELECT
    ar.due_date AS movement_date,
    'accounts_receivable'::TEXT,
    ar.id,
    'inflow'::TEXT,
    ar.amount,
    ar.description,
    cf.nome,
    ar.document_number,
    ar.status::text,
    'system'::TEXT
  FROM public.accounts_receivable ar
  LEFT JOIN public.categorias_financeiras cf ON cf.id = ar.categoria_financeira_id
  WHERE ar.user_id = p_user_id
    AND (p_empresa_id IS NULL OR ar.empresa_id = p_empresa_id)
    AND ar.due_date BETWEEN p_start AND p_end
    AND ar.status <> 'cancelled'

  UNION ALL

  -- 2) Contas a Pagar
  SELECT
    ap.due_date,
    'accounts_payable'::TEXT,
    ap.id,
    'outflow'::TEXT,
    ap.amount,
    ap.description,
    cf2.nome,
    ap.document_number,
    ap.status::text,
    'system'::TEXT
  FROM public.accounts_payable ap
  LEFT JOIN public.categorias_financeiras cf2 ON cf2.id = ap.categoria_financeira_id
  WHERE ap.user_id = p_user_id
    AND (p_empresa_id IS NULL OR ap.empresa_id = p_empresa_id)
    AND ap.due_date BETWEEN p_start AND p_end
    AND ap.status::text <> 'cancelled'

  UNION ALL

  -- 3) Previsões importadas
  SELECT
    f.forecast_date,
    'cashflow_forecasts'::TEXT,
    f.id,
    f.direction::text,
    f.amount,
    f.description,
    f.category,
    f.document_number,
    f.status::text,
    f.source::text
  FROM public.cashflow_forecasts f
  WHERE f.user_id = p_user_id
    AND (p_empresa_id IS NULL OR f.empresa_id = p_empresa_id)
    AND f.forecast_date BETWEEN p_start AND p_end
    AND f.status <> 'cancelled'

  UNION ALL

  -- 4) Movimentos manuais do extrato bancário
  SELECT
    mbt.transaction_date,
    'manual_bank_transactions'::TEXT,
    mbt.id,
    CASE WHEN mbt.type = 'CREDIT' OR mbt.amount > 0 THEN 'inflow' ELSE 'outflow' END,
    ABS(mbt.amount),
    mbt.description,
    cf3.nome,
    mbt.document_number,
    'confirmed'::text,
    mbt.source
  FROM public.manual_bank_transactions mbt
  LEFT JOIN public.categorias_financeiras cf3 ON cf3.id = mbt.categoria_financeira_id
  WHERE mbt.user_id = p_user_id
    AND (p_empresa_id IS NULL OR mbt.empresa_id = p_empresa_id)
    AND mbt.transaction_date BETWEEN p_start AND p_end

  UNION ALL

  -- 5) Movimentos de caixa avulsos (sem vínculo com AP, evitando duplicidade)
  SELECT
    ct.transaction_date,
    'cash_transactions'::TEXT,
    ct.id,
    CASE WHEN ct.type = 'income' THEN 'inflow' ELSE 'outflow' END,
    ABS(ct.amount),
    COALESCE(ct.description, 'Movimento de caixa'),
    cf4.nome,
    NULL::text,
    'confirmed'::text,
    'cash'::text
  FROM public.cash_transactions ct
  LEFT JOIN public.categorias_financeiras cf4 ON cf4.id = ct.categoria_financeira_id
  WHERE ct.user_id = p_user_id
    AND (p_empresa_id IS NULL OR ct.empresa_id = p_empresa_id)
    AND ct.transaction_date BETWEEN p_start AND p_end
    AND ct.account_payable_id IS NULL

  UNION ALL

  -- 6) Open Finance (Pluggy) — transações ainda não conciliadas com AP
  -- EXCLUI aplicações/resgates de investimento (transferência interna, não despesa/receita)
  SELECT
    pt.date AS movement_date,
    'pluggy_transactions'::TEXT,
    pt.id,
    CASE WHEN pt.type = 'CREDIT' OR pt.amount > 0 THEN 'inflow' ELSE 'outflow' END,
    ABS(pt.amount),
    pt.description,
    cf5.nome,
    NULL::text,
    CASE WHEN pt.reconciled THEN 'reconciled' ELSE 'confirmed' END,
    'pluggy'::text
  FROM public.pluggy_transactions pt
  LEFT JOIN public.categorias_financeiras cf5 ON cf5.id = pt.categoria_financeira_id
  WHERE pt.user_id = p_user_id
    AND pt.date BETWEEN p_start AND p_end
    AND pt.reconciled_payable_id IS NULL
    -- Exclui transferências internas para investimentos (aplicação/resgate)
    AND COALESCE(pt.category, '') NOT IN ('Investments', 'Mutual funds', 'Investimentos')
    AND pt.description !~* '(aplica[cç][aã]o|resgate)\s+(rdb|cdb|lci|lca|fundo|tesouro)'

  ORDER BY movement_date ASC;
$function$;