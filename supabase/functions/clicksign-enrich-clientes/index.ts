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
    const res = await fetch(LOVABLE_AI_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-pro",
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
      }),
    });

    if (!res.ok) {
      console.error("[enrich] AI Gateway error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = JSON.parse(content);
    return {
      telefone: parsed.telefone ? onlyDigits(parsed.telefone) : null,
      cep: parsed.cep ? onlyDigits(parsed.cep) : null,
      logradouro: parsed.logradouro || null,
      numero: parsed.numero ? String(parsed.numero) : null,
      complemento: parsed.complemento || null,
      bairro: parsed.bairro || null,
      cidade: parsed.cidade || null,
      estado: parsed.estado ? String(parsed.estado).toUpperCase().slice(0, 2) : null,
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
      .select("id, nome_completo, razao_social, nome_fantasia, cpf, cnpj, telefone, cep, logradouro, cidade, estado")
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

    for (const c of clientes) {
      const nome = c.nome_completo || c.razao_social || c.nome_fantasia || "";
      const needsTel = !c.telefone;
      const needsAddr = !c.cep || !c.cidade || !c.logradouro;
      if (only_missing && !needsTel && !needsAddr) {
        console.log(`[enrich] skip(completo): ${nome}`);
        skipped++;
        continue;
      }

      // Busca TODOS os documentos ClickSign vinculados (tenta o mais recente primeiro)
      const { data: docs } = await service
        .from("clicksign_documentos")
        .select("clicksign_document_key, status, created_at")
        .eq("user_id", userId)
        .eq("cliente_id", c.id)
        .in("status", ["closed", "auto_closed", "running"])
        .order("created_at", { ascending: false });

      if (!docs?.length) {
        console.log(`[enrich] skip(sem doc): ${nome}`);
        skipped++;
        continue;
      }

      const documento = onlyDigits(c.cpf || c.cnpj);
      let extractedData: ExtractedClienteData | null = null;
      let usedDocKey: string | null = null;

      // Tenta cada documento até obter dados úteis
      for (const doc of docs) {
        if (!doc.clicksign_document_key) continue;
        const pdf = await fetchSignedPdf(cred as CredRow, doc.clicksign_document_key);
        if (!pdf) {
          console.log(`[enrich] pdf indisponível ${doc.clicksign_document_key} (${nome})`);
          continue;
        }
        const result = await extractFromPdf(pdf, { nome, documento });
        if (result && (result.telefone || result.cep || result.logradouro || result.cidade)) {
          extractedData = result;
          usedDocKey = doc.clicksign_document_key;
          break;
        }
        console.log(`[enrich] doc sem dados úteis ${doc.clicksign_document_key} (${nome})`);
      }

      if (!extractedData) {
        console.log(`[enrich] FAIL: ${nome} (${documento}) — IA não retornou dados em ${docs.length} doc(s)`);
        failed++;
        continue;
      }

      const patch: Record<string, any> = {};
      if (needsTel && extractedData.telefone) patch.telefone = extractedData.telefone;
      if (!c.cep && extractedData.cep) patch.cep = extractedData.cep;
      if (!c.logradouro && extractedData.logradouro) patch.logradouro = extractedData.logradouro;
      if (extractedData.numero) patch.numero = extractedData.numero;
      if (extractedData.complemento) patch.complemento = extractedData.complemento;
      if (extractedData.bairro) patch.bairro = extractedData.bairro;
      if (!c.cidade && extractedData.cidade) patch.cidade = extractedData.cidade;
      if (!c.estado && extractedData.estado) patch.estado = extractedData.estado;

      if (Object.keys(patch).length === 0) {
        console.log(`[enrich] skip(sem patch): ${nome} — IA retornou só dados já existentes`);
        skipped++;
        continue;
      }

      const { error: upErr } = await service.from("clientes").update(patch).eq("id", c.id);
      if (upErr) {
        console.error(`[enrich] update error ${nome}:`, upErr);
        failed++;
        continue;
      }

      await service.from("cliente_interacoes").insert({
        user_id: userId,
        empresa_id: cred.empresa_id,
        cliente_id: c.id,
        tipo: "clicksign_enrich",
        descricao: `Dados extraídos automaticamente do contrato assinado (${usedDocKey?.slice(0,8)}): ${Object.keys(patch).join(", ")}`,
        usuario_nome: "ClickSign + IA",
      });

      console.log(`[enrich] OK ${nome}: ${Object.keys(patch).join(", ")}`);
      enriched++;
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
