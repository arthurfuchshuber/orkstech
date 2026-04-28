
ALTER TABLE public.pluggy_transactions
  ADD COLUMN IF NOT EXISTS cost_center_id uuid REFERENCES public.centros_custo(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_method_id uuid,
  ADD COLUMN IF NOT EXISTS notes text;

CREATE INDEX IF NOT EXISTS idx_pluggy_tx_cost_center ON public.pluggy_transactions(cost_center_id) WHERE cost_center_id IS NOT NULL;
