// ClickSign — sincronização inicial do histórico de documentos
// Busca todos os documentos ativos da conta ClickSign e tenta vincular ao cliente
// cadastrado via match por nome, email ou CPF/CNPJ dos signatários.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CS_BASE = "https://app.clicksign.com";
const CS_SANDBOX = "https://sandbox.clicksign.com";

// Status considerados "ativos" no ClickSign
const ACTIVE_STATUSES = ["running", "closed", "auto_closed", "pending", "waiting"];

interface CredRow {
  id: string;
  user_id: string;
  api_key: string;
  ambiente: string;
  empresa_id: string | null;
}

interface ClienteRow {
  id: string;
  nome_completo: string | null;
  nome_fantasia: string | null;
  razao_social: string | null;
  email: string | null;
  cpf: string | null;
  cnpj: string | null;
}

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@. ]/g, "")
    .trim();
}

function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

async function csFetch(cred: CredRow, path: string): Promise<any> {
  const base = cred.ambiente === "sandbox" ? CS_SANDBOX : CS_BASE;
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${base}${path}${sep}access_token=${encodeURIComponent(cred.api_key)}`, {
    headers: { Accept: "application/json" },
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(`ClickSign ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
  return data;
}

function matchClienteFromSigners(signers: any[], clientes: ClienteRow[]): string | null {
  if (!signers?.length || !clientes?.length) return null;

  for (const signer of signers) {
    const sName = normalize(signer?.name);
    const sEmail = normalize(signer?.email);
    const sDoc = onlyDigits(signer?.documentation || signer?.cpf || signer?.cnpj);

    for (const c of clientes) {
      // Match por documento (mais confiável)
      if (sDoc && (onlyDigits(c.cpf) === sDoc || onlyDigits(c.cnpj) === sDoc)) {
        return c.id;
      }
      // Match por email
      if (sEmail && c.email && normalize(c.email) === sEmail) {
        return c.id;
      }
      // Match por nome (exige nome completo, pelo menos 2 palavras)
      if (sName && sName.split(" ").length >= 2) {
        const cNames = [c.nome_completo, c.nome_fantasia, c.razao_social]
          .filter(Boolean)
          .map(n => normalize(n));
        if (cNames.some(n => n === sName)) return c.id;
      }
    }
  }
  return null;
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
    const body = await req.json().catch(() => ({}));
    const empresaId: string | null = body?.empresa_id || null;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Carrega credencial ClickSign
    let credQuery = serviceClient
      .from("integracoes_credenciais")
      .select("id, user_id, api_key, ambiente, empresa_id")
      .eq("user_id", userId)
      .eq("provider", "clicksign")
      .eq("ativo", true);
    if (empresaId) credQuery = credQuery.eq("empresa_id", empresaId);
    const { data: cred, error: credErr } = await credQuery.limit(1).maybeSingle();
    if (credErr) throw credErr;
    if (!cred) throw new Error("ClickSign não configurado para esta empresa");

    // Carrega clientes da empresa para fazer match
    let clientesQuery = serviceClient
      .from("clientes")
      .select("id, nome_completo, nome_fantasia, razao_social, email, cpf, cnpj")
      .eq("user_id", userId);
    if (empresaId) clientesQuery = clientesQuery.eq("empresa_id", empresaId);
    const { data: clientes, error: cliErr } = await clientesQuery;
    if (cliErr) throw cliErr;

    // Busca todos os documentos da conta ClickSign (paginado)
    let inserted = 0;
    let updated = 0;
    let matched = 0;
    let totalProcessed = 0;
    let page = 1;
    const perPage = 50;
    const maxPages = 20; // safety cap (1000 docs)

    while (page <= maxPages) {
      let res: any;
      try {
        res = await csFetch(cred as CredRow, `/api/v1/documents?page=${page}&per_page=${perPage}`);
      } catch (e) {
        console.error("[clicksign-sync] page error", page, e);
        break;
      }

      const docs = res?.documents || res?.document || [];
      const docsArray: any[] = Array.isArray(docs) ? docs : [docs];
      if (docsArray.length === 0) break;

      for (const csDocSummary of docsArray) {
        if (!csDocSummary?.key) continue;
        totalProcessed++;
        const summaryStatus = csDocSummary?.status || "unknown";
        // Filtra: somente status considerados ativos
        if (!ACTIVE_STATUSES.includes(summaryStatus)) continue;

        // O endpoint /documents lista NÃO traz signers — buscar detalhe individual
        let csDoc: any = csDocSummary;
        let signers: any[] = csDocSummary?.signers || csDocSummary?.list?.signers || [];
        try {
          const detail = await csFetch(cred as CredRow, `/api/v1/documents/${csDocSummary.key}`);
          const detailDoc = detail?.document || detail;
          if (detailDoc) {
            csDoc = { ...csDocSummary, ...detailDoc };
            signers = detailDoc?.signers
              || detailDoc?.list?.signers
              || (Array.isArray(detailDoc?.signatures) ? detailDoc.signatures.map((s: any) => s?.signer || s) : [])
              || [];
          }
        } catch (e) {
          console.warn("[clicksign-sync] detail fetch failed for", csDocSummary.key, String(e).slice(0, 200));
        }

        const status = csDoc?.status || summaryStatus;
        const matchedClienteId = matchClienteFromSigners(signers, (clientes || []) as ClienteRow[]);
        if (matchedClienteId) matched++;

        const downloadUrl = csDoc?.downloads?.signed_file_url || csDoc?.downloads?.original_file_url || null;
        const originalUrl = csDoc?.downloads?.original_file_url || null;

        const payload = {
          user_id: userId,
          empresa_id: cred.empresa_id,
          clicksign_document_key: csDoc.key,
          nome: csDoc?.filename || csDoc?.path || "Documento ClickSign",
          status,
          cliente_id: matchedClienteId,
          signatarios: signers,
          url_original: originalUrl,
          url_assinado: downloadUrl,
          finalizado_em: csDoc?.finished_at || null,
          raw_data: csDoc,
        };

        const { data: existing } = await serviceClient
          .from("clicksign_documentos")
          .select("id, cliente_id")
          .eq("clicksign_document_key", csDoc.key)
          .maybeSingle();

        if (existing) {
          // Preserva cliente_id manual se já houver vínculo, senão atualiza com o match
          const updatePayload: any = { ...payload };
          if (existing.cliente_id) updatePayload.cliente_id = existing.cliente_id;
          delete updatePayload.user_id;
          delete updatePayload.clicksign_document_key;
          await serviceClient.from("clicksign_documentos")
            .update(updatePayload).eq("id", existing.id);
          updated++;
        } else {
          await serviceClient.from("clicksign_documentos").insert(payload);
          inserted++;
        }
      }

      if (docsArray.length < perPage) break;
      page++;
    }

    return new Response(JSON.stringify({
      success: true,
      inserted, updated, matched, totalProcessed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[clicksign-sync-historico]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
