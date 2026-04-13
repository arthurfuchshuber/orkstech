-- Add UPDATE policies for storage buckets
CREATE POLICY "Users can update own attachments"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'attachments' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'attachments' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can update own client-documents"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'client-documents' AND (auth.uid())::text = (storage.foldername(name))[1])
WITH CHECK (bucket_id = 'client-documents' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- Mask existing card numbers to last 4 digits
UPDATE public.formas_pagamento
SET numero_cartao = '****' || RIGHT(numero_cartao, 4)
WHERE numero_cartao IS NOT NULL
  AND LENGTH(numero_cartao) > 4
  AND numero_cartao NOT LIKE '****%';

-- Create trigger to auto-mask card numbers on insert/update
CREATE OR REPLACE FUNCTION public.mask_card_number()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.numero_cartao IS NOT NULL AND LENGTH(NEW.numero_cartao) > 4 AND NEW.numero_cartao NOT LIKE '****%' THEN
    NEW.numero_cartao := '****' || RIGHT(NEW.numero_cartao, 4);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_mask_card_number
BEFORE INSERT OR UPDATE ON public.formas_pagamento
FOR EACH ROW EXECUTE FUNCTION public.mask_card_number();