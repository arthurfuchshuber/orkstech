// ClickSign API proxy
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CS_BASE = "https://app.clicksign.com";
const CS_SANDBOX = "https://sandbox.clicksign.com";

interface CredRow {
  id: string;
  api_key: string;
  ambiente: string;
  empresa_id: string | null;
}

async function csFetch(cred: CredRow, path: string, init: RequestInit = {}) {
  const base = cred.ambiente === "sandbox" ? CS_SANDBOX : CS_BASE;
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${base}${path}${sep}access_token=${encodeURIComponent(cred.api_key)}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "Accept": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`ClickSign API ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;
    const body = await req.json();
    const { action, empresa_id } = body;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    if (action === "test") {
      const { api_key, ambiente } = body;
      if (!api_key) throw new Error("api_key obrigatória");
      // ClickSign não tem endpoint /me; tentar listar 1 documento
      const res = await csFetch(
        { id: "", api_key, ambiente: ambiente || "production", empresa_id: null },
        "/api/v1/documents"
      );
      return new Response(JSON.stringify({ success: true, sample: res }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let credQuery = serviceClient
      .from("integracoes_credenciais")
      .select("id, api_key, ambiente, empresa_id")
      .eq("user_id", userId)
      .eq("provider", "clicksign")
      .eq("ativo", true);
    if (empresa_id) credQuery = credQuery.eq("empresa_id", empresa_id);
    const { data: cred, error: credErr } = await credQuery.limit(1).maybeSingle();
    if (credErr) throw credErr;
    if (!cred) throw new Error("ClickSign não configurado para esta empresa");

    if (action === "refresh_document") {
      const { documento_id } = body;
      const { data: doc, error } = await serviceClient
        .from("clicksign_documentos").select("*").eq("id", documento_id).eq("user_id", userId).single();
      if (error || !doc) throw new Error("Documento não encontrado");
      const res = await csFetch(cred as CredRow, `/api/v1/documents/${doc.clicksign_document_key}`);
      const csDoc = res?.document;
      const status = csDoc?.status || doc.status;
      const downloadUrl = csDoc?.downloads?.signed_file_url || null;
      await serviceClient.from("clicksign_documentos")
        .update({
          status,
          url_assinado: downloadUrl,
          finalizado_em: csDoc?.finished_at || null,
          raw_data: csDoc,
        })
        .eq("id", documento_id);
      return new Response(JSON.stringify({ success: true, document: csDoc }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Ação não suportada: ${action}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[clicksign-api]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
