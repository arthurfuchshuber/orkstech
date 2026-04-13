import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function getTargetEmpresaId(
  supabaseAdmin: any,
  targetUserId: string
): Promise<string | null> {
  // First check profile empresa_id
  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("empresa_id")
    .eq("user_id", targetUserId)
    .single();
  if (profile?.empresa_id) return profile.empresa_id;

  // Fallback: check if user owns an empresa
  const { data: empresa } = await supabaseAdmin
    .from("empresas")
    .select("id")
    .eq("user_id", targetUserId)
    .limit(1)
    .single();
  return empresa?.id ?? null;
}

async function isLastAdminOfEmpresa(
  supabaseAdmin: any,
  targetUserId: string,
  adminLevelId: string | undefined,
  empresaId: string | null
): Promise<boolean> {
  if (!adminLevelId || !empresaId) return false;

  // Check if target user is Admin
  const { data: targetProfile } = await supabaseAdmin
    .from("profiles")
    .select("nivel_permissao_id")
    .eq("user_id", targetUserId)
    .single();

  if (targetProfile?.nivel_permissao_id !== adminLevelId) return false;

  // Get empresa owner
  const { data: empresaData } = await supabaseAdmin
    .from("empresas")
    .select("user_id")
    .eq("id", empresaId)
    .single();
  const ownerId = empresaData?.user_id;

  // Count active admins: those with empresa_id on profile + the owner
  const { data: adminProfiles } = await supabaseAdmin
    .from("profiles")
    .select("user_id")
    .eq("empresa_id", empresaId)
    .eq("nivel_permissao_id", adminLevelId)
    .eq("ativo", true);

  const adminUserIds = new Set((adminProfiles ?? []).map((p: any) => p.user_id));

  // Also check if owner is an active admin (may not have empresa_id on profile)
  if (ownerId && !adminUserIds.has(ownerId)) {
    const { data: ownerProfile } = await supabaseAdmin
      .from("profiles")
      .select("nivel_permissao_id, ativo")
      .eq("user_id", ownerId)
      .single();
    if (ownerProfile?.nivel_permissao_id === adminLevelId && ownerProfile?.ativo) {
      adminUserIds.add(ownerId);
    }
  }

  return adminUserIds.size <= 1;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  // Authenticate caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.replace("Bearer ", "");
  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !caller) {
    return new Response(JSON.stringify({ error: "Não autorizado" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get caller profile with empresa_id
  const { data: callerProfile } = await supabaseAdmin
    .from("profiles")
    .select("nivel_permissao_id, empresa_id")
    .eq("user_id", caller.id)
    .single();

  const { data: adminLevel } = await supabaseAdmin
    .from("niveis_permissao")
    .select("id")
    .eq("nome", "Admin")
    .eq("is_system", true)
    .single();

  const { data: superAdminLevel } = await supabaseAdmin
    .from("niveis_permissao")
    .select("id")
    .eq("nome", "Super Admin")
    .eq("is_system", true)
    .single();

  const isAdmin = callerProfile?.nivel_permissao_id === adminLevel?.id;
  const isSuperAdmin = callerProfile?.nivel_permissao_id === superAdminLevel?.id;
  const callerEmpresaId = callerProfile?.empresa_id;

  try {
    const body = await req.json();
    const { action } = body;

    // LIST - scoped by empresa
    if (action === "list") {
      // Accept optional empresa_id from request body for scoping
      const requestEmpresaId = body.empresa_id || callerEmpresaId;

      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("user_id, nome, cpf, telefone, data_nascimento, nivel_permissao_id, ativo, empresa_id");

      // Filter by empresa (unless Super Admin viewing all)
      // Also include the empresa owner (user_id on empresas table) who may not have empresa_id on their profile
      let empresaOwnerId: string | null = null;
      if (requestEmpresaId) {
        const { data: empresaData } = await supabaseAdmin
          .from("empresas")
          .select("user_id")
          .eq("id", requestEmpresaId)
          .single();
        empresaOwnerId = empresaData?.user_id ?? null;
      }

      let filteredProfiles = isSuperAdmin && !body.empresa_id
        ? profiles
        : (profiles ?? []).filter((p: any) => {
            if (!requestEmpresaId) return false;
            // Match by empresa_id on profile OR by being the empresa owner
            return p.empresa_id === requestEmpresaId || p.user_id === empresaOwnerId;
          });

      // Always hide Super Admin users from non-super-admin views
      if (!isSuperAdmin && superAdminLevel?.id) {
        filteredProfiles = (filteredProfiles ?? []).filter(
          (p: any) => p.nivel_permissao_id !== superAdminLevel.id
        );
      }

      const userIds = (filteredProfiles ?? []).map((p: any) => p.user_id);

      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      const scopedUsers = users.filter((u: any) => userIds.includes(u.id));

      const { data: niveis } = await supabaseAdmin
        .from("niveis_permissao")
        .select("id, nome")
        .order("ordem");

      // Filter out Super Admin from niveis for non-super-admins
      const visibleNiveis = isSuperAdmin
        ? niveis
        : (niveis ?? []).filter((n: any) => n.nome !== "Super Admin");

      const result = scopedUsers.map((u: any) => {
        const profile = filteredProfiles?.find((p: any) => p.user_id === u.id);
        const nivel = niveis?.find((n: any) => n.id === profile?.nivel_permissao_id);
        return {
          id: u.id,
          email: u.email,
          created_at: u.created_at,
          nome: profile?.nome ?? null,
          cpf: profile?.cpf ?? null,
          telefone: profile?.telefone ?? null,
          data_nascimento: profile?.data_nascimento ?? null,
          nivel_permissao_id: profile?.nivel_permissao_id ?? null,
          nivel_nome: nivel?.nome ?? "Sem nível",
          ativo: profile?.ativo ?? true,
        };
      });

      return new Response(JSON.stringify({ users: result, niveis: visibleNiveis }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // All other actions require Admin or Super Admin
    if (!isAdmin && !isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Apenas administradores podem realizar esta ação" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // CREATE USER
    if (action === "create_user") {
      const schema = z.object({
        email: z.string().email(),
        password: z.string().min(6),
        nome: z.string().min(1),
        nivel_permissao_id: z.string().uuid(),
      });
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: "Dados inválidos", details: parsed.error.flatten().fieldErrors }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!callerEmpresaId) {
        return new Response(JSON.stringify({ error: "Você precisa ter uma empresa cadastrada para criar usuários" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isSuperAdmin && parsed.data.nivel_permissao_id === superAdminLevel?.id) {
        return new Response(JSON.stringify({ error: "Você não pode criar um Super Admin" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: parsed.data.email,
        password: parsed.data.password,
        email_confirm: true,
        user_metadata: { full_name: parsed.data.nome },
      });

      if (createError) {
        if (createError.message?.includes("already been registered")) {
          return new Response(JSON.stringify({ error: "Este e-mail já está cadastrado no sistema" }), {
            status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        throw createError;
      }

      await supabaseAdmin
        .from("profiles")
        .update({
          nome: parsed.data.nome,
          nivel_permissao_id: parsed.data.nivel_permissao_id,
          empresa_id: callerEmpresaId,
        })
        .eq("user_id", newUser.user.id);

      return new Response(JSON.stringify({ success: true, user_id: newUser.user.id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_role") {
      const schema = z.object({ user_id: z.string().uuid(), nivel_permissao_id: z.string().uuid() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!isSuperAdmin && parsed.data.nivel_permissao_id === superAdminLevel?.id) {
        return new Response(JSON.stringify({ error: "Você não pode atribuir o nível Super Admin" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent removing Admin role from the last admin of the empresa (applies to ALL callers)
      const { data: targetProfile } = await supabaseAdmin
        .from("profiles")
        .select("nivel_permissao_id")
        .eq("user_id", parsed.data.user_id)
        .single();

      if (
        targetProfile?.nivel_permissao_id === adminLevel?.id &&
        parsed.data.nivel_permissao_id !== adminLevel?.id
      ) {
        const targetEmpresaId = body.empresa_id ?? await getTargetEmpresaId(supabaseAdmin, parsed.data.user_id);
        const lastAdmin = await isLastAdminOfEmpresa(
          supabaseAdmin, parsed.data.user_id, adminLevel?.id, targetEmpresaId
        );
        if (lastAdmin) {
          return new Response(JSON.stringify({ error: "Não é possível remover o nível Admin do único administrador da empresa." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ nivel_permissao_id: parsed.data.nivel_permissao_id })
        .eq("user_id", parsed.data.user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "toggle_active") {
      const schema = z.object({ user_id: z.string().uuid(), ativo: z.boolean() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (parsed.data.user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode desativar a si mesmo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent deactivating the last admin (applies to ALL callers)
      if (!parsed.data.ativo) {
        const targetEmpresaId = body.empresa_id ?? await getTargetEmpresaId(supabaseAdmin, parsed.data.user_id);
        const lastAdmin = await isLastAdminOfEmpresa(
          supabaseAdmin, parsed.data.user_id, adminLevel?.id, targetEmpresaId
        );
        if (lastAdmin) {
          return new Response(JSON.stringify({ error: "Não é possível inativar o único administrador da empresa." }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { error } = await supabaseAdmin
        .from("profiles")
        .update({ ativo: parsed.data.ativo })
        .eq("user_id", parsed.data.user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "update_profile") {
      const schema = z.object({
        user_id: z.string().uuid(),
        nome: z.string().max(255).nullable().optional(),
        cpf: z.string().max(20).nullable().optional(),
        telefone: z.string().max(20).nullable().optional(),
        data_nascimento: z.string().nullable().optional(),
      });
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { user_id, ...fields } = parsed.data;
      const { error } = await supabaseAdmin
        .from("profiles")
        .update(fields)
        .eq("user_id", user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      const schema = z.object({ user_id: z.string().uuid() });
      const parsed = schema.safeParse(body);
      if (!parsed.success) {
        return new Response(JSON.stringify({ error: "Dados inválidos" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (parsed.data.user_id === caller.id) {
        return new Response(JSON.stringify({ error: "Você não pode excluir a si mesmo" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent deleting the last admin (applies to ALL callers)
      const targetEmpresaId = body.empresa_id ?? await getTargetEmpresaId(supabaseAdmin, parsed.data.user_id);
      const lastAdmin = await isLastAdminOfEmpresa(
        supabaseAdmin, parsed.data.user_id, adminLevel?.id, targetEmpresaId
      );
      if (lastAdmin) {
        return new Response(JSON.stringify({ error: "Não é possível excluir o único administrador da empresa." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Prevent deleting Super Admin users (unless caller is Super Admin)
      if (!isSuperAdmin) {
        const { data: targetProfile } = await supabaseAdmin
          .from("profiles")
          .select("nivel_permissao_id")
          .eq("user_id", parsed.data.user_id)
          .single();
        if (targetProfile?.nivel_permissao_id === superAdminLevel?.id) {
          return new Response(JSON.stringify({ error: "Você não pode excluir um Super Admin" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(parsed.data.user_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});