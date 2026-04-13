-- Fix: drop the overly permissive storage SELECT policy on client-documents
-- The restrictive policy "Users can view own client-documents" already exists
DROP POLICY IF EXISTS "Users can view client documents" ON storage.objects;