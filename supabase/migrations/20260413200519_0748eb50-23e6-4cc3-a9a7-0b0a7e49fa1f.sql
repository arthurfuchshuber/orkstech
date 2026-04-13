
-- Fix clientes SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view clientes" ON public.clientes;
CREATE POLICY "Users can view own clientes"
  ON public.clientes FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix fornecedores SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view fornecedores" ON public.fornecedores;
CREATE POLICY "Users can view own fornecedores"
  ON public.fornecedores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix empresas SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view empresas" ON public.empresas;
CREATE POLICY "Users can view own empresas"
  ON public.empresas FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix colaboradores SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view colaboradores" ON public.colaboradores;
CREATE POLICY "Users can view own colaboradores"
  ON public.colaboradores FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix produtos SELECT policy
DROP POLICY IF EXISTS "Authenticated users can view produtos" ON public.produtos;
CREATE POLICY "Users can view own produtos"
  ON public.produtos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Fix formas_pagamento UPDATE policy (add WITH CHECK)
DROP POLICY IF EXISTS "Users can update own formas_pagamento" ON public.formas_pagamento;
CREATE POLICY "Users can update own formas_pagamento"
  ON public.formas_pagamento FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Make storage buckets private
UPDATE storage.buckets SET public = false WHERE id IN ('attachments', 'client-documents');

-- Fix storage policies: remove public SELECT on attachments
DROP POLICY IF EXISTS "Public can view attachments" ON storage.objects;

-- Fix storage policies: remove public SELECT on client-documents  
DROP POLICY IF EXISTS "Public can view client-documents" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view client documents" ON storage.objects;

-- Ensure owner-scoped SELECT policies exist for storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Users can view own attachments'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "Users can view own attachments"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'attachments' AND auth.uid()::text = (storage.foldername(name))[1])
    $sql$;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' AND policyname = 'Users can view own client-documents'
  ) THEN
    EXECUTE $sql$
      CREATE POLICY "Users can view own client-documents"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'client-documents' AND auth.uid()::text = (storage.foldername(name))[1])
    $sql$;
  END IF;
END $$;
