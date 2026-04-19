
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE public.cashflow_direction AS ENUM ('inflow', 'outflow');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cashflow_source AS ENUM ('manual', 'csv', 'xlsx', 'google_sheets', 'system');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.cashflow_status AS ENUM ('forecast', 'confirmed', 'cancelled', 'reconciled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.cashflow_forecasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  direction public.cashflow_direction NOT NULL,
  forecast_date DATE NOT NULL,
  amount NUMERIC(14,2) NOT NULL CHECK (amount >= 0),
  description TEXT NOT NULL,
  document_number TEXT,
  category TEXT,
  source public.cashflow_source NOT NULL DEFAULT 'manual',
  status public.cashflow_status NOT NULL DEFAULT 'forecast',
  import_id UUID,
  bank_account_id UUID REFERENCES public.contas_bancarias(id) ON DELETE SET NULL,
  notes TEXT,
  dedup_hash TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cf_forecasts_user_date ON public.cashflow_forecasts(user_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_cf_forecasts_empresa_date ON public.cashflow_forecasts(empresa_id, forecast_date);
CREATE INDEX IF NOT EXISTS idx_cf_forecasts_hash ON public.cashflow_forecasts(dedup_hash);
CREATE INDEX IF NOT EXISTS idx_cf_forecasts_status ON public.cashflow_forecasts(status);

ALTER TABLE public.cashflow_forecasts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cf_forecasts_select" ON public.cashflow_forecasts;
CREATE POLICY "cf_forecasts_select" ON public.cashflow_forecasts FOR SELECT
  USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "cf_forecasts_insert" ON public.cashflow_forecasts;
CREATE POLICY "cf_forecasts_insert" ON public.cashflow_forecasts FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cf_forecasts_update" ON public.cashflow_forecasts;
CREATE POLICY "cf_forecasts_update" ON public.cashflow_forecasts FOR UPDATE
  USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "cf_forecasts_delete" ON public.cashflow_forecasts;
CREATE POLICY "cf_forecasts_delete" ON public.cashflow_forecasts FOR DELETE
  USING (auth.uid() = user_id OR public.is_super_admin());

DROP TRIGGER IF EXISTS trg_cf_forecasts_updated ON public.cashflow_forecasts;
CREATE TRIGGER trg_cf_forecasts_updated BEFORE UPDATE ON public.cashflow_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.cashflow_imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  empresa_id UUID REFERENCES public.empresas(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  source public.cashflow_source NOT NULL,
  source_url TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  errors JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cf_imports_user ON public.cashflow_imports(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cf_imports_empresa ON public.cashflow_imports(empresa_id, created_at DESC);

ALTER TABLE public.cashflow_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cf_imports_select" ON public.cashflow_imports;
CREATE POLICY "cf_imports_select" ON public.cashflow_imports FOR SELECT
  USING (auth.uid() = user_id OR public.is_super_admin());

DROP POLICY IF EXISTS "cf_imports_insert" ON public.cashflow_imports;
CREATE POLICY "cf_imports_insert" ON public.cashflow_imports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cf_imports_delete" ON public.cashflow_imports;
CREATE POLICY "cf_imports_delete" ON public.cashflow_imports FOR DELETE
  USING (auth.uid() = user_id OR public.is_super_admin());

ALTER TABLE public.cashflow_forecasts
  DROP CONSTRAINT IF EXISTS cf_forecasts_import_fk,
  ADD CONSTRAINT cf_forecasts_import_fk FOREIGN KEY (import_id)
    REFERENCES public.cashflow_imports(id) ON DELETE SET NULL;

-- Normalize text using translate (no extension dependency)
CREATE OR REPLACE FUNCTION public.cashflow_normalize_text(p_text TEXT)
RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public
AS $$
  SELECT regexp_replace(
    lower(translate(coalesce(p_text, ''),
      'ÁÀÂÃÄÅáàâãäåÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñÝýÿ',
      'AAAAAAaaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNnYyy'
    )),
    '[^a-z0-9]+', '', 'g'
  );
$$;

CREATE OR REPLACE FUNCTION public.cashflow_generate_hash(
  p_empresa_id UUID,
  p_user_id UUID,
  p_direction TEXT,
  p_date DATE,
  p_amount NUMERIC,
  p_description TEXT,
  p_document TEXT
) RETURNS TEXT
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions
AS $$
  SELECT encode(
    extensions.digest(
      coalesce(p_empresa_id::text, p_user_id::text) || '|' ||
      lower(p_direction) || '|' ||
      to_char(p_date, 'YYYY-MM-DD') || '|' ||
      to_char(round(p_amount::numeric, 2), 'FM999999990.00') || '|' ||
      public.cashflow_normalize_text(p_description) || '|' ||
      public.cashflow_normalize_text(coalesce(p_document, '')),
      'sha256'
    ),
    'hex'
  );
$$;

CREATE OR REPLACE FUNCTION public.cashflow_check_duplicate(
  p_user_id UUID,
  p_empresa_id UUID,
  p_direction TEXT,
  p_date DATE,
  p_amount NUMERIC,
  p_description TEXT,
  p_document TEXT
) RETURNS TABLE(found BOOLEAN, source_table TEXT, source_id UUID, source_description TEXT)
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash TEXT;
  v_norm_desc TEXT;
BEGIN
  v_hash := public.cashflow_generate_hash(p_empresa_id, p_user_id, p_direction, p_date, p_amount, p_description, p_document);
  v_norm_desc := public.cashflow_normalize_text(p_description);

  RETURN QUERY
    SELECT TRUE, 'cashflow_forecasts'::TEXT, f.id, f.description
    FROM public.cashflow_forecasts f
    WHERE f.user_id = p_user_id
      AND f.dedup_hash = v_hash
      AND f.status <> 'cancelled'
    LIMIT 1;
  IF FOUND THEN RETURN; END IF;

  IF lower(p_direction) = 'inflow' THEN
    RETURN QUERY
      SELECT TRUE, 'accounts_receivable'::TEXT, ar.id, ar.description
      FROM public.accounts_receivable ar
      WHERE ar.user_id = p_user_id
        AND (p_empresa_id IS NULL OR ar.empresa_id = p_empresa_id)
        AND ar.due_date = p_date
        AND round(ar.amount::numeric, 2) = round(p_amount::numeric, 2)
        AND public.cashflow_normalize_text(ar.description) = v_norm_desc
        AND ar.status <> 'cancelled'
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  IF lower(p_direction) = 'outflow' THEN
    RETURN QUERY
      SELECT TRUE, 'accounts_payable'::TEXT, ap.id, ap.description
      FROM public.accounts_payable ap
      WHERE ap.user_id = p_user_id
        AND (p_empresa_id IS NULL OR ap.empresa_id = p_empresa_id)
        AND ap.due_date = p_date
        AND round(ap.amount::numeric, 2) = round(p_amount::numeric, 2)
        AND public.cashflow_normalize_text(ap.description) = v_norm_desc
        AND ap.status::text <> 'cancelled'
      LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::UUID, NULL::TEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.cashflow_set_hash()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.dedup_hash := public.cashflow_generate_hash(
    NEW.empresa_id, NEW.user_id, NEW.direction::text,
    NEW.forecast_date, NEW.amount, NEW.description, NEW.document_number
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cf_forecasts_hash ON public.cashflow_forecasts;
CREATE TRIGGER trg_cf_forecasts_hash BEFORE INSERT OR UPDATE OF forecast_date, amount, description, document_number, direction
  ON public.cashflow_forecasts
  FOR EACH ROW EXECUTE FUNCTION public.cashflow_set_hash();

CREATE OR REPLACE FUNCTION public.cashflow_consolidated(
  p_user_id UUID,
  p_empresa_id UUID,
  p_start DATE,
  p_end DATE
) RETURNS TABLE(
  movement_date DATE,
  source_table TEXT,
  source_id UUID,
  direction TEXT,
  amount NUMERIC,
  description TEXT,
  category TEXT,
  document_number TEXT,
  status TEXT,
  origin TEXT
)
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  ORDER BY movement_date ASC;
$$;
