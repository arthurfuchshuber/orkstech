import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export function isCronAuthorized(req: Request): boolean {
  const secret = Deno.env.get("CRON_SECRET");
  if (!secret) {
    console.error("CRON_SECRET is not configured");
    return false;
  }
  const bearer = getBearerToken(req);
  if (bearer && timingSafeEqual(bearer, secret)) return true;
  const headerSecret = req.headers.get("x-cron-secret");
  return headerSecret != null && timingSafeEqual(headerSecret, secret);
}

export function requireCronAuth(req: Request): Response | null {
  if (isCronAuthorized(req)) return null;
  return jsonResponse({ error: "Unauthorized" }, 401);
}

export function createServiceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function createUserClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
}

export async function requireAuthenticatedUser(
  req: Request,
  corsHeaders: Record<string, string>,
): Promise<
  | { user: { id: string }; authHeader: string; supabaseAdmin: SupabaseClient }
  | { response: Response }
> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return { response: jsonResponse({ error: "Unauthorized" }, 401, corsHeaders) };
  }

  const supabaseAdmin = createServiceClient();
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return { response: jsonResponse({ error: "Unauthorized" }, 401, corsHeaders) };
  }

  return { user, authHeader, supabaseAdmin };
}

export async function isSuperAdmin(
  supabaseAdmin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("nivel_permissao_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (!profile?.nivel_permissao_id) return false;

  const { data: nivel } = await supabaseAdmin
    .from("niveis_permissao")
    .select("nome")
    .eq("id", profile.nivel_permissao_id)
    .maybeSingle();

  return nivel?.nome === "Super Admin";
}

export async function canAccessEmpresa(
  supabaseAdmin: SupabaseClient,
  userId: string,
  empresaId: string,
): Promise<boolean> {
  if (await isSuperAdmin(supabaseAdmin, userId)) return true;

  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("user_id")
    .eq("id", empresaId)
    .maybeSingle();

  if (empresa?.user_id === userId) return true;

  const { data: member } = await supabaseAdmin
    .from("empresa_membros")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("user_id", userId)
    .eq("ativo", true)
    .maybeSingle();

  return !!member;
}

export async function canAccessCliente(
  supabaseAdmin: SupabaseClient,
  userId: string,
  clienteId: string,
): Promise<boolean> {
  if (await isSuperAdmin(supabaseAdmin, userId)) return true;

  const { data: cliente } = await supabaseAdmin
    .from("clientes")
    .select("user_id, empresa_id")
    .eq("id", clienteId)
    .maybeSingle();

  if (!cliente) return false;
  if (cliente.user_id === userId) return true;
  if (cliente.empresa_id) return canAccessEmpresa(supabaseAdmin, userId, cliente.empresa_id);
  return false;
}

export type PluggyConnectionRow = { id: string; user_id: string };

export async function assertPluggyItemAccess(
  supabaseAdmin: SupabaseClient,
  itemId: string,
  callerUserId: string,
  options: { isInternalCron?: boolean; internalUserId?: string | null },
  corsHeaders: Record<string, string> = {},
): Promise<
  | { conn: PluggyConnectionRow; ownerUserId: string }
  | { error: Response }
> {
  const { data: conn } = await supabaseAdmin
    .from("pluggy_connections")
    .select("id, user_id")
    .eq("pluggy_item_id", itemId)
    .maybeSingle();

  if (options.isInternalCron) {
    if (!conn) {
      return { error: jsonResponse({ error: "Connection not found" }, 404, corsHeaders) };
    }
    const internalUserId = options.internalUserId?.trim();
    if (!internalUserId || conn.user_id !== internalUserId) {
      return { error: jsonResponse({ error: "Forbidden" }, 403, corsHeaders) };
    }
    return { conn, ownerUserId: conn.user_id };
  }

  if (!conn) {
    const superAdmin = await isSuperAdmin(supabaseAdmin, callerUserId);
    if (!superAdmin) {
      return { error: jsonResponse({ error: "Connection not found" }, 404, corsHeaders) };
    }
    return { conn: { id: "", user_id: callerUserId }, ownerUserId: callerUserId };
  }

  const superAdmin = await isSuperAdmin(supabaseAdmin, callerUserId);
  if (conn.user_id !== callerUserId && !superAdmin) {
    return { error: jsonResponse({ error: "Forbidden" }, 403, corsHeaders) };
  }

  return { conn, ownerUserId: conn.user_id };
}

export function verifyPluggyWebhookSecret(req: Request): boolean {
  const secret = Deno.env.get("PLUGGY_WEBHOOK_SECRET");
  if (!secret) {
    console.error("PLUGGY_WEBHOOK_SECRET is not configured");
    return false;
  }

  const header =
    req.headers.get("x-pluggy-webhook-secret") ??
    req.headers.get("x-webhook-secret") ??
    req.headers.get("x-pluggy-secret");

  if (header && timingSafeEqual(header, secret)) return true;

  try {
    const url = new URL(req.url);
    const querySecret = url.searchParams.get("secret");
    if (querySecret && timingSafeEqual(querySecret, secret)) return true;
  } catch {
    // ignore
  }

  return false;
}

export function jsonResponse(
  body: unknown,
  status = 200,
  corsHeaders: Record<string, string> = {},
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) {
    out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return out === 0;
}
