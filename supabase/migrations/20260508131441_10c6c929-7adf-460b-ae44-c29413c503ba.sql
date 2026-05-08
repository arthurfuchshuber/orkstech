
CREATE TABLE public.business_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid NOT NULL REFERENCES public.empresas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  nome text NOT NULL,
  descricao text,
  cor text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_business_units_empresa ON public.business_units(empresa_id);
CREATE INDEX idx_business_units_ativo ON public.business_units(empresa_id, ativo);

ALTER TABLE public.business_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view business_units"
  ON public.business_units FOR SELECT
  USING (public.is_empresa_member(empresa_id));

CREATE POLICY "Members can insert business_units"
  ON public.business_units FOR INSERT
  WITH CHECK (public.is_empresa_member(empresa_id));

CREATE POLICY "Members can update business_units"
  ON public.business_units FOR UPDATE
  USING (public.is_empresa_member(empresa_id));

CREATE POLICY "Members can delete business_units"
  ON public.business_units FOR DELETE
  USING (public.is_empresa_member(empresa_id));

CREATE TRIGGER trg_business_units_updated_at
  BEFORE UPDATE ON public.business_units
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.accounts_payable
  ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;
CREATE INDEX idx_ap_business_unit ON public.accounts_payable(empresa_id, business_unit_id);

ALTER TABLE public.accounts_receivable
  ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;
CREATE INDEX idx_ar_business_unit ON public.accounts_receivable(empresa_id, business_unit_id);

ALTER TABLE public.pluggy_transactions
  ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;
CREATE INDEX idx_pluggy_tx_business_unit ON public.pluggy_transactions(user_id, business_unit_id);

ALTER TABLE public.manual_bank_transactions
  ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;
CREATE INDEX idx_mbt_business_unit ON public.manual_bank_transactions(user_id, business_unit_id);

ALTER TABLE public.cash_transactions
  ADD COLUMN business_unit_id uuid REFERENCES public.business_units(id) ON DELETE SET NULL;
CREATE INDEX idx_ct_business_unit ON public.cash_transactions(user_id, business_unit_id);
