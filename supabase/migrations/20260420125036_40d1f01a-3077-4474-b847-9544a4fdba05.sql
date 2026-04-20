-- 1. Add target column to cashflow_imports to identify which module the import belongs to
ALTER TABLE public.cashflow_imports
  ADD COLUMN IF NOT EXISTS target text NOT NULL DEFAULT 'cashflow';

ALTER TABLE public.cashflow_imports
  ADD CONSTRAINT cashflow_imports_target_check
  CHECK (target IN ('cashflow', 'payable', 'receivable', 'bank_statement'));

-- 2. Allow updating cashflow_imports (for delete cascade flow if needed)
DROP POLICY IF EXISTS "cf_imports_update" ON public.cashflow_imports;
CREATE POLICY "cf_imports_update"
  ON public.cashflow_imports
  FOR UPDATE
  USING ((auth.uid() = user_id) OR is_super_admin());

-- 3. Add import_id columns to payable & receivable so we can cascade delete
ALTER TABLE public.accounts_payable
  ADD COLUMN IF NOT EXISTS import_id uuid;
CREATE INDEX IF NOT EXISTS idx_accounts_payable_import_id ON public.accounts_payable(import_id);

ALTER TABLE public.accounts_receivable
  ADD COLUMN IF NOT EXISTS import_id uuid;
CREATE INDEX IF NOT EXISTS idx_accounts_receivable_import_id ON public.accounts_receivable(import_id);

-- 4. Create manual_bank_transactions table (manual entries in bank statement)
CREATE TABLE IF NOT EXISTS public.manual_bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  empresa_id uuid REFERENCES public.empresas(id) ON DELETE SET NULL,
  bank_account_id uuid REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  pluggy_account_id text,
  transaction_date date NOT NULL,
  amount numeric NOT NULL,
  type text NOT NULL CHECK (type IN ('CREDIT', 'DEBIT')),
  description text NOT NULL,
  document_number text,
  category text,
  notes text,
  categoria_financeira_id uuid REFERENCES public.categorias_financeiras(id) ON DELETE SET NULL,
  import_id uuid REFERENCES public.cashflow_imports(id) ON DELETE SET NULL,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'csv', 'xlsx', 'google_sheets')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mbt_user ON public.manual_bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_mbt_empresa ON public.manual_bank_transactions(empresa_id);
CREATE INDEX IF NOT EXISTS idx_mbt_date ON public.manual_bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_mbt_import ON public.manual_bank_transactions(import_id);

ALTER TABLE public.manual_bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own manual bank transactions"
  ON public.manual_bank_transactions FOR SELECT
  USING ((auth.uid() = user_id) OR is_super_admin());

CREATE POLICY "Users can create own manual bank transactions"
  ON public.manual_bank_transactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own manual bank transactions"
  ON public.manual_bank_transactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own manual bank transactions"
  ON public.manual_bank_transactions FOR DELETE
  USING ((auth.uid() = user_id) OR is_super_admin());

-- updated_at trigger
CREATE TRIGGER trg_mbt_updated_at
  BEFORE UPDATE ON public.manual_bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Apply DRE rules trigger for manual bank transactions
CREATE OR REPLACE FUNCTION public.aplicar_regras_dre_manual_bank()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_cat uuid;
  v_aplicar text;
BEGIN
  IF NEW.categoria_financeira_id IS NULL THEN
    IF NEW.type = 'DEBIT' OR NEW.amount < 0 THEN
      v_aplicar := 'pagar';
    ELSE
      v_aplicar := 'receber';
    END IF;

    v_cat := public.resolver_categoria_por_regras(
      NEW.user_id, NEW.empresa_id, v_aplicar,
      NEW.description, NULL, ABS(NEW.amount),
      NULL, NULL, NULL
    );
    IF v_cat IS NOT NULL THEN
      NEW.categoria_financeira_id := v_cat;
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE TRIGGER trg_aplicar_regras_dre_manual_bank
  BEFORE INSERT OR UPDATE ON public.manual_bank_transactions
  FOR EACH ROW EXECUTE FUNCTION public.aplicar_regras_dre_manual_bank();

-- 6. Update consolidated function to include manual bank transactions
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
SET search_path = public
AS $function$
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
  ORDER BY movement_date ASC;
$function$;

-- 7. Cascade delete an import: removes all records linked to it
CREATE OR REPLACE FUNCTION public.delete_import_cascade(p_import_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  v_user_id uuid;
  v_target text;
  v_deleted_forecasts int := 0;
  v_deleted_payable int := 0;
  v_deleted_receivable int := 0;
  v_deleted_manual int := 0;
BEGIN
  SELECT user_id, target INTO v_user_id, v_target
  FROM public.cashflow_imports
  WHERE id = p_import_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Import not found';
  END IF;

  IF v_user_id <> auth.uid() AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  WITH d AS (DELETE FROM public.cashflow_forecasts WHERE import_id = p_import_id RETURNING 1)
  SELECT count(*) INTO v_deleted_forecasts FROM d;

  WITH d AS (DELETE FROM public.accounts_payable WHERE import_id = p_import_id RETURNING 1)
  SELECT count(*) INTO v_deleted_payable FROM d;

  WITH d AS (DELETE FROM public.accounts_receivable WHERE import_id = p_import_id RETURNING 1)
  SELECT count(*) INTO v_deleted_receivable FROM d;

  WITH d AS (DELETE FROM public.manual_bank_transactions WHERE import_id = p_import_id RETURNING 1)
  SELECT count(*) INTO v_deleted_manual FROM d;

  DELETE FROM public.cashflow_imports WHERE id = p_import_id;

  RETURN jsonb_build_object(
    'forecasts', v_deleted_forecasts,
    'payable', v_deleted_payable,
    'receivable', v_deleted_receivable,
    'manual_bank', v_deleted_manual
  );
END;
$function$;