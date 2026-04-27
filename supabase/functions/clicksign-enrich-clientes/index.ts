// ClickSign — enriquece clientes com telefone/endereço extraído do PDF assinado
// Usa Lovable AI Gateway (Gemini) para ler o PDF do contrato e identificar
// os dados de contato/endereço do CONTRATANTE (cliente).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CS_BASE = "https://app.clicksign.com";
const CS_SANDBOX = "https://sandbox.clicksign.com";
const LOVABLE_AI_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

interface CredRow {
  id: string;
  user_id: string;
  api_key: string;
  ambiente: string;
  empresa_id: string | null;
}

function onlyDigits(s: string | null | undefined): string {
  return (s || "").replace(/\D/g, "");
}

function normalize(s: string | null | undefined): string {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  if (!text) return null;
  const n = normalize(text);
  if (["null", "undefined", "na", "n a", "nu", "nil", "none", "sem", "s n", "sn", "nao informado"].includes(n)) return null;
  return text;
}

function cleanUf(value: unknown): string | null {
  const text = cleanText(value)?.toUpperCase().replace(/[^A-Z]/g, "") || "";
  const valid = new Set(["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"]);
  return valid.has(text) ? text : null;
}

function hasMissing(value: unknown): boolean {
  return !cleanText(value);
}

function cleanPhone(value: unknown): string | null {
  const digits = onlyDigits(String(value ?? ""));
  return digits.length >= 10 && digits.length <= 11 ? digits : null;
}

function cleanCep(value: unknown): string | null {
  const digits = onlyDigits(String(value ?? ""));
  return digits.length === 8 ? digits : null;
}

function getNested(obj: any, paths: string[]): any {
  for (const path of paths) {
    const value = path.split(".").reduce((acc, key) => acc?.[key], obj);
    if (value !== undefined && value !== null && value !== "") return value;
  }
  return null;
}

function signerMatchesCliente(signer: any, cliente: { nome: string; documento: string }): boolean {
  const signerDoc = onlyDigits(signer?.documentation || signer?.cpf || signer?.cnpj || signer?.document || signer?.document_number);
  if (cliente.documento && signerDoc === cliente.documento) return true;
  const signerName = normalize(signer?.name || signer?.nome);
  const clienteName = normalize(cliente.nome);
  if (!signerName || !clienteName) return false;
  if (signerName === clienteName) return true;
  const words = clienteName.split(" ").filter((w) => w.length > 2);
  return words.length >= 2 && words.slice(0, 2).every((w) => signerName.includes(w));
}

function extractFromSigner(signers: any[] | null | undefined, cliente: { nome: string; documento: string }): Partial<ExtractedClienteData> {
  const signer = (signers || []).find((s) => signerMatchesCliente(s, cliente));
  if (!signer) return {};
  return {
    telefone: cleanPhone(getNested(signer, ["phone_number", "phone", "phoneNumber", "cellphone", "mobile", "whatsapp", "contact.phone_number", "contact.phone"])),
    cep: cleanCep(getNested(signer, ["address.zipcode", "address.zip_code", "address.postal_code", "cep", "zipcode", "zip_code"])),
    logradouro: cleanText(getNested(signer, ["address.street", "address.address", "address.logradouro", "logradouro", "street"])),
    numero: cleanText(getNested(signer, ["address.number", "numero", "number"])),
    complemento: cleanText(getNested(signer, ["address.complement", "address.complemento", "complemento", "complement"])),
    bairro: cleanText(getNested(signer, ["address.neighborhood", "address.bairro", "bairro", "neighborhood"])),
    cidade: cleanText(getNested(signer, ["address.city", "address.cidade", "cidade", "city"])),
    estado: cleanUf(getNested(signer, ["address.state", "address.estado", "estado", "state"])),
  };
}

async function fetchAddressByCep(cep: string): Promise<Partial<ExtractedClienteData>> {
  try {
    const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
    if (!res.ok) return {};
    const data = await res.json();
    if (data?.erro) return {};
    return {
      cep,
      logradouro: cleanText(data.logradouro),
      bairro: cleanText(data.bairro),
      cidade: cleanText(data.localidade),
      estado: cleanUf(data.uf),
    };
  } catch {
    return {};
  }
}

async function csFetch(cred: CredRow, path: string) {
  const base = cred.ambiente === "sandbox" ? CS_SANDBOX : CS_BASE;
  const sep = path.includes("?") ? "&" : "?";
  const res = await fetch(`${base}${path}${sep}access_token=${encodeURIComponent(cred.api_key)}`, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`ClickSign ${res.status}`);
  return res.json();
}

async function fetchSignedPdf(cred: CredRow, key: string): Promise<Uint8Array | null> {
  try {
    const data = await csFetch(cred, `/api/v1/documents/${key}`);
    const csDoc = data?.document || data;
    const url = csDoc?.downloads?.signed_file_url || csDoc?.downloads?.original_file_url;
    if (!url) return null;
    const res = await fetch(url);
    if (!res.ok) return null;
    return new Uint8Array(await res.arrayBuffer());
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)) as any);
  }
  return btoa(binary);
}

interface ExtractedClienteData {
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
}

async function extractFromPdf(
  pdfBytes: Uint8Array,
  cliente: { nome: string; documento: string }
): Promise<ExtractedClienteData | null> {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) {
    console.error("[enrich] LOVABLE_API_KEY ausente");
    return null;
  }

  const base64 = bytesToBase64(pdfBytes);
  const docFmt = cliente.documento
    ? cliente.documento.length === 11
      ? `${cliente.documento.slice(0,3)}.${cliente.documento.slice(3,6)}.${cliente.documento.slice(6,9)}-${cliente.documento.slice(9)}`
      : `${cliente.documento.slice(0,2)}.${cliente.documento.slice(2,5)}.${cliente.documento.slice(5,8)}/${cliente.documento.slice(8,12)}-${cliente.documento.slice(12)}`
    : "";

  const prompt = `Você está analisando um contrato em PDF. LEIA O DOCUMENTO INTEIRO, página por página.

OBJETIVO: extrair dados de contato e endereço da pessoa identificada como CONTRATANTE / CLIENTE / LOCATÁRIO / SACADO / COMPRADOR / TOMADOR (nunca do CONTRATADO / LOCADOR / VENDEDOR / PRESTADOR).

ÂNCORAS PARA LOCALIZAR ESTA PESSOA (use a que encontrar primeiro):
1. CPF/CNPJ: "${docFmt}" ou "${cliente.documento}" (ignore pontuação ao comparar)
2. Nome: "${cliente.nome}" (ignore acentos, maiúsculas, ordem de sobrenomes; aceite variações)

Procure em TODAS as seções: "PARTE II", "QUALIFICAÇÃO DAS PARTES", "DADOS DO CONTRATANTE", "CONTRATANTE:", "LOCATÁRIO:", "Identificação", anexos, rodapés. Os dados podem estar em parágrafos corridos (ex: "residente à Rua X, nº 123, bairro Y, Cidade/UF, CEP 12345-678, telefone (45) 99999-9999").

EXTRAIA estes campos (retorne null APENAS se realmente não encontrar):
- telefone: apenas dígitos com DDD (ex: "45999200738"). Aceite celular OU fixo. Pode aparecer como "Tel:", "Telefone:", "Cel:", "Contato:", "WhatsApp:", "Fone:".
- cep: 8 dígitos sem traço
- logradouro: nome da rua/avenida SEM número (ex: "Rua das Flores")
- numero: número do imóvel (ex: "123")
- complemento: apto/sala/bloco, ou null
- bairro
- cidade: apenas o nome (ex: "Curitiba", sem "/PR")
- estado: sigla UF de 2 letras maiúsculas

REGRAS CRÍTICAS:
- NÃO invente dados. Se o campo não aparece no PDF, use null.
- Se houver MÚLTIPLOS contratantes no documento, escolha aquele que bate com o CPF/Nome acima.
- Se o endereço aparecer só uma vez perto do nome do contratante, use-o mesmo se não houver rótulo "Endereço:".

Responda APENAS com JSON válido (sem markdown, sem comentários) no formato:
{"telefone":"...","cep":"...","logradouro":"...","numero":"...","complemento":"...","bairro":"...","cidade":"...","estado":"..."}`;

  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 45000);
    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              {
                type: "image_url",
                image_url: { url: `data:application/pdf;base64,${base64}` },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 600,
      }),
      signal: ctrl.signal,
    }).finally(() => clearTimeout(tid));

    if (!res.ok) {
      console.error("[enrich] AI Gateway error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return {
      telefone: cleanPhone(parsed.telefone),
      cep: cleanCep(parsed.cep),
      logradouro: cleanText(parsed.logradouro),
      numero: cleanText(parsed.numero),
      complemento: cleanText(parsed.complemento),
      bairro: cleanText(parsed.bairro),
      cidade: cleanText(parsed.cidade),
      estado: cleanUf(parsed.estado),
    };
  } catch (e) {
    console.error("[enrich] extract error:", e);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims } = await supabase.auth.getClaims(token);
    if (!claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claims.claims.sub as string;
    const { empresa_id, cliente_id, only_missing = true } = await req.json();

    const service = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let credQ = service
      .from("integracoes_credenciais")
      .select("id, user_id, api_key, ambiente, empresa_id")
      .eq("user_id", userId)
      .eq("provider", "clicksign")
      .eq("ativo", true);
    if (empresa_id) credQ = credQ.eq("empresa_id", empresa_id);
    const { data: cred } = await credQ.limit(1).maybeSingle();
    if (!cred) throw new Error("ClickSign não configurado");

    // Seleciona clientes a enriquecer
    let cliQ = service
      .from("clientes")
      .select("id, nome_completo, razao_social, nome_fantasia, cpf, cnpj, telefone, cep, logradouro, numero, complemento, bairro, cidade, estado")
      .eq("user_id", userId);
    if (empresa_id) cliQ = cliQ.eq("empresa_id", empresa_id);
    if (cliente_id) cliQ = cliQ.eq("id", cliente_id);
    const { data: clientes } = await cliQ;
    if (!clientes?.length) {
      return new Response(JSON.stringify({ enriched: 0, skipped: 0, failed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let enriched = 0;
    let skipped = 0;
    let failed = 0;

    console.log(`[enrich] iniciando — ${clientes.length} cliente(s) | only_missing=${only_missing}`);

    // Processa um único cliente (extrair + atualizar). Retorna 'enriched' | 'skipped' | 'failed'
    const processCliente = async (c: any): Promise<"enriched" | "skipped" | "failed"> => {
      const nome = c.nome_completo || c.razao_social || c.nome_fantasia || "";
      const needsTel = !cleanPhone(c.telefone);
      const needsAddr = hasMissing(c.cep) || hasMissing(c.cidade) || hasMissing(c.logradouro) || !cleanUf(c.estado);
      if (only_missing && !needsTel && !needsAddr) {
        console.log(`[enrich] skip(completo): ${nome}`);
        return "skipped";
      }

      const { data: docs } = await service
        .from("clicksign_documentos")
        .select("clicksign_document_key, status, created_at, signatarios")
        .eq("user_id", userId)
        .eq("cliente_id", c.id)
        .in("status", ["closed", "auto_closed", "running"])
        .order("created_at", { ascending: false })
        .limit(3); // tenta no máximo 3 docs por cliente

      if (!docs?.length) {
        console.log(`[enrich] skip(sem doc): ${nome}`);
        return "skipped";
      }

      const documento = onlyDigits(c.cpf || c.cnpj);
      let extractedData: ExtractedClienteData | null = null;
      let usedDocKey: string | null = null;

      for (const doc of docs) {
        const signerData = extractFromSigner(doc.signatarios, { nome, documento });
        if (!doc.clicksign_document_key) continue;
        const pdf = await fetchSignedPdf(cred as CredRow, doc.clicksign_document_key);
        const result = pdf ? await extractFromPdf(pdf, { nome, documento }) : null;
        const cepBase = result?.cep || signerData.cep;
        const viaCepData = cepBase ? await fetchAddressByCep(cepBase) : {};
        const merged: ExtractedClienteData = {
          telefone: signerData.telefone || result?.telefone || null,
          cep: signerData.cep || result?.cep || viaCepData.cep || null,
          logradouro: viaCepData.logradouro || signerData.logradouro || result?.logradouro || null,
          numero: signerData.numero || result?.numero || null,
          complemento: signerData.complemento || result?.complemento || null,
          bairro: viaCepData.bairro || signerData.bairro || result?.bairro || null,
          cidade: viaCepData.cidade || signerData.cidade || result?.cidade || null,
          estado: viaCepData.estado || signerData.estado || result?.estado || null,
        };
        if (merged.telefone || merged.cep || merged.logradouro || merged.cidade || merged.estado) {
          extractedData = merged;
          usedDocKey = doc.clicksign_document_key;
          break;
        }
      }

      if (!extractedData) {
        console.log(`[enrich] FAIL: ${nome} (${documento})`);
        return "failed";
      }

      const patch: Record<string, any> = {};
      if (needsTel && extractedData.telefone) patch.telefone = extractedData.telefone;
      if (hasMissing(c.cep) && extractedData.cep) patch.cep = extractedData.cep;
      if (hasMissing(c.logradouro) && extractedData.logradouro) patch.logradouro = extractedData.logradouro;
      if (hasMissing(c.numero) && extractedData.numero) patch.numero = extractedData.numero;
      if (hasMissing(c.complemento) && extractedData.complemento) patch.complemento = extractedData.complemento;
      if (hasMissing(c.bairro) && extractedData.bairro) patch.bairro = extractedData.bairro;
      if (hasMissing(c.cidade) && extractedData.cidade) patch.cidade = extractedData.cidade;
      if (!cleanUf(c.estado) && extractedData.estado) patch.estado = extractedData.estado;

      if (Object.keys(patch).length === 0) return "skipped";

      const { error: upErr } = await service.from("clientes").update(patch).eq("id", c.id);
      if (upErr) {
        console.error(`[enrich] update error ${nome}:`, upErr);
        return "failed";
      }

      await service.from("cliente_interacoes").insert({
        user_id: userId,
        empresa_id: cred.empresa_id,
        cliente_id: c.id,
        tipo: "clicksign_enrich",
        descricao: `Dados extraídos do contrato assinado (${usedDocKey?.slice(0,8)}): ${Object.keys(patch).join(", ")}`,
        usuario_nome: "ClickSign + IA",
      });

      console.log(`[enrich] OK ${nome}: ${Object.keys(patch).join(", ")}`);
      return "enriched";
    };

    // Processa em batches paralelos de 4 (acelera ~4x sem estourar rate-limit)
    const BATCH = 4;
    for (let i = 0; i < clientes.length; i += BATCH) {
      const slice = clientes.slice(i, i + BATCH);
      const results = await Promise.all(slice.map((c) => processCliente(c).catch((e) => {
        console.error(`[enrich] exception:`, e);
        return "failed" as const;
      })));
      for (const r of results) {
        if (r === "enriched") enriched++;
        else if (r === "skipped") skipped++;
        else failed++;
      }
    }

    console.log(`[enrich] fim — enriched=${enriched} skipped=${skipped} failed=${failed}`);
    return new Response(
      JSON.stringify({ enriched, skipped, failed, total: clientes.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[clicksign-enrich-clientes] error:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
