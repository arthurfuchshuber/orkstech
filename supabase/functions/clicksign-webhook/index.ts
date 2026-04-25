// ClickSign webhook - public endpoint, validates by webhook_token in URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

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

/** Picks the signer marked as "contractee" (CONTRATANTE), with fallback to the first signer. */
function pickContractee(signers: any[]): any | null {
  if (!signers?.length) return null;
  const contractee = signers.find((s) => {
    const role = String(s?.sign_as || s?.role || s?.signer_role || "").toLowerCase();
    return role === "contractee" || role === "contratante";
  });
  return contractee || signers[0] || null;
}

/** Creates a cliente from a ClickSign signer. Returns the new cliente id, or null on failure. */
async function createClienteFromSigner(
  supabase: any,
  userId: string,
  empresaId: string | null,
  signer: any,
): Promise<string | null> {
  try {
    const docRaw = onlyDigits(signer?.documentation || signer?.cpf || signer?.cnpj);
    const isCnpj = docRaw.length === 14;
    const isCpf = docRaw.length === 11;
    const tipo: "pj" | "pf" = isCnpj ? "pj" : "pf";
    const rawName = (signer?.name || "").trim();
    if (!rawName && !signer?.email && !docRaw) return null;

    const payload: Record<string, any> = {
      user_id: userId,
      empresa_id: empresaId,
      tipo,
      email: signer?.email || null,
      telefone: onlyDigits(signer?.phone_number || signer?.phone) || null,
      ativo: true,
      observacoes: "Cliente criado automaticamente via ClickSign",
      // produto_segmento_id is intentionally null — ClickSign-created clients are exempt
    };
    if (tipo === "pj") {
      payload.razao_social = rawName;
      payload.nome_fantasia = rawName;
      payload.cnpj = docRaw || null;
    } else {
      payload.nome_completo = rawName;
      payload.cpf = docRaw || null;
    }

    const { data, error } = await supabase
      .from("clientes")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      console.error("[clicksign-webhook] failed to auto-create cliente:", error);
      return null;
    }
    return data.id;
  } catch (e) {
    console.error("[clicksign-webhook] createClienteFromSigner error:", e);
    return null;
  }
}

async function findClienteIdFromSigners(
  supabase: any,
  userId: string,
  empresaId: string | null,
  signers: any[],
): Promise<string | null> {
  if (!signers?.length) return null;
  let q = supabase
    .from("clientes")
    .select("id, nome_completo, nome_fantasia, razao_social, email, cpf, cnpj")
    .eq("user_id", userId);
  if (empresaId) q = q.eq("empresa_id", empresaId);
  const { data: clientes } = await q;
  if (!clientes?.length) return null;

  for (const signer of signers) {
    const sName = normalize(signer?.name);
    const sEmail = normalize(signer?.email);
    const sDoc = onlyDigits(signer?.documentation || signer?.cpf || signer?.cnpj);

    for (const c of clientes) {
      if (sDoc && (onlyDigits(c.cpf) === sDoc || onlyDigits(c.cnpj) === sDoc)) return c.id;
      if (sEmail && c.email && normalize(c.email) === sEmail) return c.id;
      if (sName && sName.split(" ").length >= 2) {
        const names = [c.nome_completo, c.nome_fantasia, c.razao_social]
          .filter(Boolean).map((n: string) => normalize(n));
        if (names.some((n: string) => n === sName)) return c.id;
      }
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return new Response("Missing token", { status: 401 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cred } = await supabase
      .from("integracoes_credenciais")
      .select("id, user_id, empresa_id")
      .eq("provider", "clicksign")
      .eq("webhook_token", token)
      .eq("ativo", true)
      .maybeSingle();
    if (!cred) return new Response("Invalid token", { status: 401 });

    const event = await req.json();
    console.log("[clicksign-webhook]", event?.event?.name, event?.document?.key);

    const csDoc = event?.document;
    if (!csDoc?.key) return new Response("ok", { status: 200 });

    const signers = csDoc?.signers || csDoc?.list?.signers || [];
    const status = csDoc?.status || "unknown";
    const downloadUrl = csDoc?.downloads?.signed_file_url || csDoc?.downloads?.original_file_url || null;
    const originalUrl = csDoc?.downloads?.original_file_url || null;

    const { data: doc } = await supabase
      .from("clicksign_documentos")
      .select("*")
      .eq("clicksign_document_key", csDoc.key)
      .maybeSingle();

    let docId: string;
    let clienteId: string | null;

    if (!doc) {
      // Documento ainda não existe — cria e tenta auto-vincular cliente
      clienteId = await findClienteIdFromSigners(supabase, cred.user_id, cred.empresa_id, signers);
      const { data: inserted, error: insErr } = await supabase
        .from("clicksign_documentos")
        .insert({
          user_id: cred.user_id,
          empresa_id: cred.empresa_id,
          clicksign_document_key: csDoc.key,
          nome: csDoc?.filename || csDoc?.path || "Documento ClickSign",
          status,
          cliente_id: clienteId,
          signatarios: signers,
          url_original: originalUrl,
          url_assinado: downloadUrl,
          finalizado_em: csDoc?.finished_at || null,
          raw_data: csDoc,
        })
        .select("id")
        .single();
      if (insErr) throw insErr;
      docId = inserted.id;
    } else {
      // Atualiza, preservando vínculo manual se houver
      clienteId = doc.cliente_id || await findClienteIdFromSigners(supabase, cred.user_id, cred.empresa_id, signers);
      await supabase.from("clicksign_documentos")
        .update({
          status,
          url_original: originalUrl,
          url_assinado: downloadUrl,
          finalizado_em: csDoc?.finished_at || null,
          raw_data: csDoc,
          signatarios: signers,
          cliente_id: clienteId,
          nome: csDoc?.filename || doc.nome,
        })
        .eq("id", doc.id);
      docId = doc.id;
    }

    // Notifica quando finalizado
    const finishedEvents = ["auto_close", "close", "document_closed"];
    if (finishedEvents.includes(event?.event?.name)) {
      if (clienteId) {
        await supabase.from("cliente_interacoes").insert({
          user_id: cred.user_id,
          empresa_id: cred.empresa_id,
          cliente_id: clienteId,
          tipo: "documento",
          descricao: `Documento "${csDoc?.filename || "ClickSign"}" assinado`,
          usuario_nome: "ClickSign",
        });
      }

      await supabase.from("notificacoes_sistema").insert({
        user_id: cred.user_id,
        empresa_id: cred.empresa_id,
        titulo: "Documento assinado",
        descricao: `${csDoc?.filename || "Documento"} foi totalmente assinado`,
        tipo: "sucesso",
        entidade_tipo: "clicksign_documento",
        entidade_id: docId,
      });
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("[clicksign-webhook] error:", e);
    return new Response("error", { status: 500 });
  }
});
