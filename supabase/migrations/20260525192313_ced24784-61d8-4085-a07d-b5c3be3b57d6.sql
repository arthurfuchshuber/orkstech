
-- Fix CROSS_TENANT_DATA_LEAK: drop cross-tenant member access on pluggy tables.
-- Owners retain full access via "Users can ... own" policies; super admins via existing policies.
DROP POLICY IF EXISTS "Members of owner can view pluggy_bank_accounts" ON public.pluggy_bank_accounts;
DROP POLICY IF EXISTS "Members of owner can update pluggy_bank_accounts" ON public.pluggy_bank_accounts;
DROP POLICY IF EXISTS "Members of owner can view pluggy_connections" ON public.pluggy_connections;
DROP POLICY IF EXISTS "Members of owner can update pluggy_connections" ON public.pluggy_connections;
DROP POLICY IF EXISTS "Members of owner can view pluggy_investments" ON public.pluggy_investments;
DROP POLICY IF EXISTS "Members of owner can update pluggy_investments" ON public.pluggy_investments;
DROP POLICY IF EXISTS "Members of owner can view pluggy_notifications" ON public.pluggy_notifications;
DROP POLICY IF EXISTS "Members of owner can update pluggy_notifications" ON public.pluggy_notifications;
DROP POLICY IF EXISTS "Members of owner can view pluggy_transactions" ON public.pluggy_transactions;
DROP POLICY IF EXISTS "Members of owner can update pluggy_transactions" ON public.pluggy_transactions;

-- Fix STALE_OWNERSHIP_POLICY: drop legacy empresa_socios policies that trust auth.uid() = user_id (creator).
-- Access is now strictly controlled by is_empresa_member / is_empresa_owner / is_super_admin.
DROP POLICY IF EXISTS "Atualizar sócio da própria empresa" ON public.empresa_socios;
DROP POLICY IF EXISTS "Excluir sócio da própria empresa" ON public.empresa_socios;
DROP POLICY IF EXISTS "Inserir sócio da própria empresa" ON public.empresa_socios;
DROP POLICY IF EXISTS "Sócios visíveis ao dono e super admin" ON public.empresa_socios;

-- Re-add owner/super-admin SELECT coverage (the "Members can view" policy already covers active members).
CREATE POLICY "Owners and super admins can view empresa_socios"
ON public.empresa_socios
FOR SELECT
USING (is_super_admin() OR is_empresa_owner(auth.uid(), empresa_id));
