// ClickSign — sincronização inicial do histórico de documentos
// Busca documentos ativos/finalizados da conta ClickSign, vincula ao cliente correto
// e, quando solicitado, cria retroativamente apenas o CONTRATANTE real.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CS_BASE = "https://app.clicksign.com";
const CS_SANDBOX = "https://sandbox.clicksign.com";

const ACTIVE_STATUSES = ["running", "closed", "auto_closed", "pending", "waiting"];
const FINISHED_STATUSES = ["closed", "auto_closed"];

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

interface SyncedDoc {
  csDoc: any;
  signers: any[];
  status: string;
}

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9@. ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

function getSignerDoc(signer: any): string {
  return onlyDigits(signer?.documentation || signer?.cpf || signer?.cnpj);
}

function hasValidDocument(signer: any): boolean {
  const doc = getSignerDoc(signer);
  return doc.length === 11 || doc.length === 14;
}

function signerFingerprints(signer: any): string[] {
  const doc = getSignerDoc(signer);
  const email = normalize(signer?.email);
  const name = normalize(signer?.name);
  return [doc ? `doc:${doc}` : "", email ? `email:${email}` : "", name ? `name:${name}` : ""].filter(Boolean);
}

function primarySignerFingerprint(signer: any): string | null {
  const doc = getSignerDoc(signer);
  if (doc) return `doc:${doc}`;
  const email = normalize(signer?.email);
  if (email) return `email:${email}`;
  const name = normalize(signer?.name);
  return name ? `name:${name}` : null;
}

function buildLikelyInternalSignerSet(docs: SyncedDoc[]): Set<string> {
  const counts = new Map<string, number>();
  for (const doc of docs) {
    const seen = new Set<string>();
    for (const signer of doc.signers || []) {
      const fp = primarySignerFingerprint(signer);
      if (fp) seen.add(fp);
    }
    for (const fp of seen) counts.set(fp, (counts.get(fp) || 0) + 1);
  }

  const threshold = docs.length <= 2 ? 2 : Math.max(3, Math.ceil(docs.length * 0.35));
  const internal = new Set<string>();
  for (const doc of docs) {
    for (const signer of doc.signers || []) {
      const fp = primarySignerFingerprint(signer);
      if (fp && (counts.get(fp) || 0) >= threshold) {
        for (const alias of signerFingerprints(signer)) internal.add(alias);
      }
    }
  }
  return internal;
}

function isLikelyInternalSigner(signer: any, internalSet: Set<string>): boolean {
  return signerFingerprints(signer).some((fp) => internalSet.has(fp));
}

function signerNameMatchesDocument(signer: any, docName: string | null | undefined): boolean {
  const docNorm = normalize(docName || "");
  const name = normalize(signer?.name);
  if (!docNorm || !name) return false;
  if (docNorm.includes(name)) return true;
  const words = name.split(" ").filter((w) => w.length > 2);
  if (words.length === 1) return docNorm.includes(words[0]);
  return words.slice(0, 2).every((w) => docNorm.includes(w));
}

// Detecta se o domínio do email do signatário contém parte do nome dele
// (ex: alexandre@pereiradeandrade.com → "pereiradeandrade" bate com o sobrenome).
// É um sinal forte de titularidade — geralmente quem usa email de domínio próprio
// é o contratante principal, não um co-signatário/cônjuge.
function emailDomainMatchesName(signer: any): boolean {
  const email = String(signer?.email || "").toLowerCase();
  const at = email.indexOf("@");
  if (at < 0) return false;
  const domain = email.slice(at + 1).split(".")[0] || "";
  if (domain.length < 5) return false;
  // Ignora domínios públicos comuns
  const publicDomains = ["gmail", "hotmail", "outlook", "yahoo", "icloud", "live", "uol", "bol", "terra", "msn", "globo"];
  if (publicDomains.includes(domain)) return false;
  const nameNorm = normalize(signer?.name).replace(/\s+/g, "");
  if (!nameNorm) return false;
  // Se o domínio (≥5 chars) está contido no nome normalizado, é match.
  return nameNorm.includes(domain);
}

function selectCustomerSigner(signers: any[], docName: string | null | undefined, internalSet: Set<string>): any | null {
  const eligible = (signers || []).filter(hasValidDocument);
  if (!eligible.length) return null;

  const byRole = eligible.filter((s) => {
    const role = String(s?.sign_as || s?.role || s?.signer_role || "").toLowerCase();
    return ["contractee", "contratante", "customer", "client", "cliente"].includes(role);
  }).filter((s) => !isLikelyInternalSigner(s, internalSet));
  if (byRole.length === 1) return byRole[0];

  const byFilename = eligible.filter((s) => signerNameMatchesDocument(s, docName));
  const externalByFilename = byFilename.filter((s) => !isLikelyInternalSigner(s, internalSet));
  if (externalByFilename.length === 1) return externalByFilename[0];
  if (byFilename.length === 1) return byFilename[0];

  const external = eligible.filter((s) => !isLikelyInternalSigner(s, internalSet));
  if (external.length === 1) return external[0];

  // Desempate por domínio próprio de email (sinal forte de titularidade)
  if (external.length > 1) {
    const byOwnDomain = external.filter(emailDomainMatchesName);
    if (byOwnDomain.length === 1) return byOwnDomain[0];
  }

  return null;
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

function matchClienteFromSigner(signer: any | null, clientes: ClienteRow[]): string | null {
  if (!signer || !clientes?.length) return null;
  const sName = normalize(signer?.name);
  const sEmail = normalize(signer?.email);
  const sDoc = getSignerDoc(signer);

  for (const c of clientes) {
    if (sDoc && (onlyDigits(c.cpf) === sDoc || onlyDigits(c.cnpj) === sDoc)) return c.id;
    if (sEmail && c.email && normalize(c.email) === sEmail) return c.id;
    if (sName && sName.split(" ").length >= 2) {
      const cNames = [c.nome_completo, c.nome_fantasia, c.razao_social]
        .filter(Boolean)
        .map((n) => normalize(n));
      if (cNames.some((n) => n === sName)) return c.id;
    }
  }
  return null;
}

async function createClienteFromSigner(
  supabase: any,
  userId: string,
  empresaId: string | null,
  signer: any,
): Promise<string | null> {
  try {
    const docRaw = getSignerDoc(signer);
    const isCnpj = docRaw.length === 14;
    const isCpf = docRaw.length === 11;
    if (!isCnpj && !isCpf) return null;

    const tipo: "pj" | "pf" = isCnpj ? "pj" : "pf";
    const rawName = (signer?.name || "").trim();
    if (!rawName && !signer?.email) return null;

    const payload: Record<string, any> = {
      user_id: userId,
      empresa_id: empresaId,
      tipo,
      email: signer?.email || null,
      telefone: onlyDigits(signer?.phone_number || signer?.phone) || null,
      ativo: true,
      observacoes: "Cliente criado automaticamente via ClickSign (sync retroativo)",
    };
    if (tipo === "pj") {
      payload.razao_social = rawName;
      payload.nome_fantasia = rawName;
      payload.cnpj = docRaw;
    } else {
      payload.nome_completo = rawName;
      payload.cpf = docRaw;
    }

    const { data, error } = await supabase
      .from("clientes")
      .insert(payload)
      .select("id")
      .single();
    if (error) {
      console.error("[clicksign-sync] failed to auto-create cliente:", error);
      return null;
    }
    return data.id;
  } catch (e) {
    console.error("[clicksign-sync] createClienteFromSigner error:", e);
    return null;
  }
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
    const createClients: boolean = body?.create_clients === true;

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

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

    let clientesQuery = serviceClient
      .from("clientes")
      .select("id, nome_completo, nome_fantasia, razao_social, email, cpf, cnpj")
      .eq("user_id", userId);
    if (empresaId) clientesQuery = clientesQuery.eq("empresa_id", empresaId);
    const { data: clientes, error: cliErr } = await clientesQuery;
    if (cliErr) throw cliErr;
    const clientesList: ClienteRow[] = (clientes || []) as ClienteRow[];

    let totalProcessed = 0;
    let page = 1;
    const perPage = 50;
    const maxPages = 20;
    const docsToProcess: SyncedDoc[] = [];

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
        if (!ACTIVE_STATUSES.includes(summaryStatus)) continue;

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

        docsToProcess.push({
          csDoc,
          signers,
          status: csDoc?.status || summaryStatus,
        });
      }

      if (docsArray.length < perPage) break;
      page++;
    }

    const internalSigners = buildLikelyInternalSignerSet(
      docsToProcess.filter((d) => FINISHED_STATUSES.includes(d.status))
    );

    let inserted = 0;
    let updated = 0;
    let matched = 0;
    let clientsCreated = 0;
    let clientsLinkedByCpfCnpj = 0;
    let skippedWithoutContractee = 0;

    for (const { csDoc, signers, status } of docsToProcess) {
      const docName = csDoc?.filename || csDoc?.path || "Documento ClickSign";
      const customerSigner = selectCustomerSigner(signers, docName, internalSigners);
      let matchedClienteId = matchClienteFromSigner(customerSigner, clientesList);
      if (matchedClienteId) matched++;

      let autoCreatedClienteId: string | null = null;
      let autoLinkedClienteId: string | null = null;
      if (createClients && !matchedClienteId && FINISHED_STATUSES.includes(status)) {
        if (!customerSigner) {
          skippedWithoutContractee++;
        } else {
          const contracteeDoc = getSignerDoc(customerSigner);
          if (contracteeDoc && (contracteeDoc.length === 11 || contracteeDoc.length === 14)) {
            const docField = contracteeDoc.length === 14 ? "cnpj" : "cpf";
            let q = serviceClient
              .from("clientes")
              .select("id, nome_completo, nome_fantasia, razao_social, email, cpf, cnpj")
              .eq("user_id", cred.user_id)
              .eq(docField, contracteeDoc)
              .limit(1);
            if (cred.empresa_id) q = q.eq("empresa_id", cred.empresa_id);
            const { data: existing } = await q.maybeSingle();
            if (existing?.id) {
              autoLinkedClienteId = existing.id;
              matchedClienteId = existing.id;
              clientsLinkedByCpfCnpj++;
              if (!clientesList.some((c) => c.id === existing.id)) clientesList.push(existing as ClienteRow);
            }
          }
          if (!matchedClienteId) {
            const newId = await createClienteFromSigner(
              serviceClient,
              cred.user_id,
              cred.empresa_id,
              customerSigner,
            );
            if (newId) {
              const contracteeDoc = getSignerDoc(customerSigner);
              autoCreatedClienteId = newId;
              matchedClienteId = newId;
              clientsCreated++;
              clientesList.push({
                id: newId,
                nome_completo: customerSigner?.name || null,
                nome_fantasia: customerSigner?.name || null,
                razao_social: customerSigner?.name || null,
                email: customerSigner?.email || null,
                cpf: contracteeDoc.length === 11 ? contracteeDoc : null,
                cnpj: contracteeDoc.length === 14 ? contracteeDoc : null,
              });
            }
          }
        }
      }

      const downloadUrl = csDoc?.downloads?.signed_file_url || csDoc?.downloads?.original_file_url || null;
      const originalUrl = csDoc?.downloads?.original_file_url || null;

      const payload = {
        user_id: userId,
        empresa_id: cred.empresa_id,
        clicksign_document_key: csDoc.key,
        nome: docName,
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

      let docRowId: string | null = null;

      if (existing) {
        const updatePayload: any = { ...payload };
        if (existing.cliente_id && !autoCreatedClienteId && !autoLinkedClienteId) updatePayload.cliente_id = existing.cliente_id;
        delete updatePayload.user_id;
        delete updatePayload.clicksign_document_key;
        await serviceClient.from("clicksign_documentos")
          .update(updatePayload).eq("id", existing.id);
        docRowId = existing.id;
        updated++;
      } else {
        const { data: ins } = await serviceClient
          .from("clicksign_documentos")
          .insert(payload)
          .select("id")
          .single();
        docRowId = ins?.id || null;
        inserted++;
      }

      if (matchedClienteId && (autoCreatedClienteId || autoLinkedClienteId)) {
        if (autoCreatedClienteId) {
          await serviceClient.from("cliente_interacoes").insert({
            user_id: cred.user_id,
            empresa_id: cred.empresa_id,
            cliente_id: autoCreatedClienteId,
            tipo: "clicksign_auto_create",
            descricao: `Cliente criado retroativamente via sincronização ClickSign — contrato "${docName}"`,
            usuario_nome: "ClickSign",
          });
        } else if (autoLinkedClienteId) {
          await serviceClient.from("cliente_interacoes").insert({
            user_id: cred.user_id,
            empresa_id: cred.empresa_id,
            cliente_id: autoLinkedClienteId,
            tipo: "clicksign_auto_link",
            descricao: `Documento "${docName}" vinculado retroativamente — cliente já cadastrado (CPF/CNPJ correspondente)`,
            usuario_nome: "ClickSign",
          });
        }
        await serviceClient.from("cliente_interacoes").insert({
          user_id: cred.user_id,
          empresa_id: cred.empresa_id,
          cliente_id: matchedClienteId,
          tipo: "documento",
          descricao: `Documento "${docName}" assinado`,
          usuario_nome: "ClickSign",
        });
      }
    }

    return new Response(JSON.stringify({
      success: true,
      inserted,
      updated,
      matched,
      totalProcessed,
      clients_created: clientsCreated,
      clients_linked_by_cpf_cnpj: clientsLinkedByCpfCnpj,
      skipped_without_contractee: skippedWithoutContractee,
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
