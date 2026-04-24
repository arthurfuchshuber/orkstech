ALTER TABLE public.subscribers
  ADD COLUMN IF NOT EXISTS is_complimentary boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS subscribers_is_complimentary_idx
  ON public.subscribers (is_complimentary)
  WHERE is_complimentary = true;