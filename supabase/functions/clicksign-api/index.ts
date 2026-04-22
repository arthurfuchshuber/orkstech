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

async function fetchFreshDownloadUrls(cred: CredRow, key: string): Promise<{ signed: string | null; original: string | null; doc: any }> {
  const res = await csFetch(cred, `/api/v1/documents/${key}`);
  const csDoc = res?.document || res;
  return {
    signed: csDoc?.downloads?.signed_file_url || null,
    original: csDoc?.downloads?.original_file_url || null,
    doc: csDoc,
  };
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
      const fresh = await fetchFreshDownloadUrls(cred as CredRow, doc.clicksign_document_key);
      await serviceClient.from("clicksign_documentos")
        .update({
          status: fresh.doc?.status || doc.status,
          url_assinado: fresh.signed,
          url_original: fresh.original,
          finalizado_em: fresh.doc?.finished_at || null,
          raw_data: fresh.doc,
        })
        .eq("id", documento_id);
      return new Response(JSON.stringify({ success: true, document: fresh.doc }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "download_document") {
      const { documento_id } = body;
      const { data: doc, error } = await serviceClient
        .from("clicksign_documentos").select("*").eq("id", documento_id).eq("user_id", userId).single();
      if (error || !doc) throw new Error("Documento não encontrado");

      // Busca URL fresca (S3 expira em 5 min)
      const fresh = await fetchFreshDownloadUrls(cred as CredRow, doc.clicksign_document_key);
      const fileUrl = fresh.signed || fresh.original;
      if (!fileUrl) throw new Error("URL de download indisponível");

      const fileRes = await fetch(fileUrl);
      if (!fileRes.ok) throw new Error(`Falha ao baixar arquivo: ${fileRes.status}`);
      const buffer = await fileRes.arrayBuffer();

      // Atualiza cache de URLs
      await serviceClient.from("clicksign_documentos")
        .update({ url_assinado: fresh.signed, url_original: fresh.original })
        .eq("id", documento_id);

      const filename = doc.nome || `documento-${doc.clicksign_document_key}.pdf`;
      return new Response(buffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
          "Cache-Control": "private, max-age=60",
        },
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
