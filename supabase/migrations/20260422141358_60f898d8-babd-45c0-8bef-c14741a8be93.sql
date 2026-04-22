-- Plan overrides table: Super Admins can override Stripe plan metadata
CREATE TABLE public.plan_overrides (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id TEXT NOT NULL UNIQUE,
  display_name TEXT,
  tagline TEXT,
  description TEXT,
  features JSONB NOT NULL DEFAULT '[]'::jsonb,
  highlight BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_overrides ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (needed for pricing cards)
CREATE POLICY "Authenticated can view plan_overrides"
ON public.plan_overrides
FOR SELECT
TO authenticated
USING (true);

-- Only Super Admins can write
CREATE POLICY "Super admins can insert plan_overrides"
ON public.plan_overrides
FOR INSERT
TO authenticated
WITH CHECK (is_super_admin());

CREATE POLICY "Super admins can update plan_overrides"
ON public.plan_overrides
FOR UPDATE
TO authenticated
USING (is_super_admin());

CREATE POLICY "Super admins can delete plan_overrides"
ON public.plan_overrides
FOR DELETE
TO authenticated
USING (is_super_admin());

-- Trigger for updated_at
CREATE TRIGGER update_plan_overrides_updated_at
BEFORE UPDATE ON public.plan_overrides
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Index
CREATE INDEX idx_plan_overrides_product_id ON public.plan_overrides(product_id);