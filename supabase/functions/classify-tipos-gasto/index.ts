// Edge function: classifica transações de SAÍDA em "Tipos de Gasto" via Lovable AI.
// Aceita:
//   POST { empresa_id?: string, only_uncategorized?: boolean }
// Auth:
//   - JWT do usuário (front)  OU
//   - Bearer CRON_SECRET (para chamadas agendadas e triggers internos).
//     Quando autenticado por CRON_SECRET e empresa_id não é informado, processa TODAS empresas.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_SECRET = Deno.env.get("CRON_SECRET");

const CHUNK_SIZE = 30; // transações por chamada de IA
const MAX_TXS_PER_RUN = 300; // teto por execução para evitar timeout
const MAX_AI_TXS_PER_RUN = 120; // heurística resolve o óbvio; IA só revisa o restante

interface Tx {
  table: "accounts_payable" | "pluggy_transactions" | "manual_bank_transactions" | "cash_transactions";
  id: string;
  descricao: string;
}

const HEURISTIC_RULES: Array<{ tipo: string; patterns: RegExp[] }> = [
  { tipo: "Transporte", patterns: [/\b(uber|99\s?pop|99\s?taxi|taxi|táxi|cabify|metro|metr[oô]|onibus|ônibus|buser|rodoviari|pedagio|pedágio|estacionamento|posto|combustivel|combustível|shell|ipiranga|petrobras|raizen|sem parar)\b/i] },
  { tipo: "Alimentação", patterns: [/\b(ifood|restaurante|lanchonete|padaria|mercado|supermercado|hortifruti|acai|aça[ií]|pizzaria|burger|hamburg|mcdonald|bk |burger king|caf[eé]|bar\b|bebidas|confeitaria|bolo|koch|angeloni|carrefour|assai|assa[ií]|extra|pao de acucar|pão de açúcar|atacadao|atacadão)\b/i] },
  { tipo: "Assinaturas", patterns: [/\b(netflix|spotify|amazon prime|prime video|disney|hbo|max\b|globoplay|youtube|google storage|icloud|apple\.com\/bill|microsoft|adobe|canva|notion|dropbox|openai|chatgpt|claude|recorrente|assinatura)\b/i] },
  { tipo: "Saúde", patterns: [/\b(farmacia|farmácia|drogaria|droga\s?raia|drogasil|pacheco|panvel|ultrafarma|hospital|clinica|clínica|laboratorio|laboratório|exame|medico|m[eé]dico|odonto|dentista|sou funcional)\b/i] },
  { tipo: "Moradia", patterns: [/\b(aluguel|condominio|condomínio|energia|eletrica|elétrica|enel|cemig|copel|celesc|light|agua|água|saneamento|sabesp|comgas|gás|internet|vivo|claro|tim\s?s\s?a|oi\b|imovel|imóvel|manutencao|manutenção)\b/i] },
  { tipo: "Educação", patterns: [/\b(escola|faculdade|universidade|curso|udemy|alura|hotmart|coursera|educa|livraria|material escolar|mensalidade escolar)\b/i] },
  { tipo: "Lazer", patterns: [/\b(cinema|teatro|show|ingresso|sympla|eventim|steam|playstation|xbox|nintendo|viagem|hotel|airbnb|booking|decolar|latam|gol linhas|azul linhas|barbearia do lazer)\b/i] },
  { tipo: "Cuidados Pessoais", patterns: [/\b(barbearia|salao|salão|beleza|cosmetico|cosmético|perfume|maquiagem|academia|smart fit|bio ritmo|cabeleireiro|manicure|estetica|estética)\b/i] },
  { tipo: "Compras", patterns: [/\b(amazon|mercado livre|mercadolivre|shopee|magalu|magazine luiza|americanas|lojas renner|renner|riachuelo|cea|c&a|zara|shein|aliexpress|loja|informatica|informática|eletronico|eletrônico)\b/i] },
  { tipo: "Seguros", patterns: [/\b(seguro|seguradora|porto seguro|tokio marine|allianz|azul seguros|bradesco seguros|mapfre)\b/i] },
  { tipo: "Empréstimos", patterns: [/\b(emprestimo|empréstimo|financiamento|parcela financiamento|credito pessoal|crédito pessoal|consignado)\b/i] },
  { tipo: "Consumos", patterns: [/\b(consumo|material de limpeza|descartaveis|descartáveis|utilidades|suprimentos)\b/i] },
];

const j = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) return j(500, { error: "LOVABLE_API_KEY não configurada" });

    const body = await req.json().catch(() => ({} as any));
    const onlyUncategorized: boolean = body.only_uncategorized ?? true;
    const requestedEmpresa: string | undefined = body.empresa_id;

    // ---- Autenticação ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const isCron = !!CRON_SECRET && token === CRON_SECRET;

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    let empresaIds: string[] = [];
    if (isCron) {
      if (requestedEmpresa) {
        empresaIds = [requestedEmpresa];
      } else {
        const { data: emps } = await admin.from("empresas").select("id");
        empresaIds = (emps ?? []).map((e: any) => e.id);
      }
    } else {
      const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userErr } = await userClient.auth.getUser();
      if (userErr || !userData?.user) return j(401, { error: "Não autenticado" });
      if (!requestedEmpresa) return j(400, { error: "empresa_id obrigatório" });
      empresaIds = [requestedEmpresa];
    }

    let grandTotal = 0;
    let grandClassified = 0;
    let grandUnrecognized = 0;
    const perEmpresa: Record<string, { total: number; classified: number; unrecognized: number }> = {};

    for (const empresaId of empresaIds) {
      const res = await classifyEmpresa(admin, empresaId, onlyUncategorized);
      perEmpresa[empresaId] = res;
      grandTotal += res.total;
      grandClassified += res.classified;
      grandUnrecognized += res.unrecognized;
    }

    return j(200, {
      total: grandTotal,
      classified: grandClassified,
      unrecognized: grandUnrecognized,
      empresas: empresaIds.length,
      detail: perEmpresa,
    });
  } catch (e: any) {
    console.error("classify-tipos-gasto fatal", e);
    return j(500, { error: e?.message ?? "Erro desconhecido" });
  }
});

async function classifyEmpresa(
  admin: ReturnType<typeof createClient>,
  empresaId: string,
  onlyUncategorized: boolean,
): Promise<{ total: number; classified: number; unrecognized: number }> {
  const { data: empresa, error: empresaErr } = await admin
    .from("empresas")
    .select("id, user_id")
    .eq("id", empresaId)
    .maybeSingle();
  if (empresaErr || !empresa?.user_id) {
    console.error("[", empresaId, "] erro empresa:", empresaErr ?? "empresa não encontrada");
    return { total: 0, classified: 0, unrecognized: 0 };
  }
  const ownerUserId = empresa.user_id as string;

  // 1) Tipos da empresa
  const { data: tipos, error: tiposErr } = await admin
    .from("tipos_gasto")
    .select("id, nome, emoji")
    .eq("empresa_id", empresaId)
    .eq("ativo", true)
    .order("nome");
  if (tiposErr) {
    console.error("[", empresaId, "] erro tipos:", tiposErr);
    return { total: 0, classified: 0, unrecognized: 0 };
  }
  if (!tipos?.length) return { total: 0, classified: 0, unrecognized: 0 };

  // 2) Coletar transações de saída
  const txs: Tx[] = [];

  // accounts_payable (todas saídas)
  {
    let q = admin
      .from("accounts_payable")
      .select("id, description, supplier_name, notes, document_number, amount")
      .eq("empresa_id", empresaId)
      .limit(MAX_TXS_PER_RUN);
    if (onlyUncategorized) q = q.is("tipo_gasto_id", null);
    const { data, error } = await q;
    if (error) console.error("[", empresaId, "] ap err:", error);
    data?.forEach((r: any) =>
      txs.push({
        table: "accounts_payable",
        id: r.id,
        descricao: [r.description, r.supplier_name, r.notes, r.document_number].filter(Boolean).join(" • "),
      }),
    );
  }

  // pluggy_transactions: saída (amount < 0) e ignora transferência interna
  {
    let q = admin
      .from("pluggy_transactions")
      .select("id, description, amount, type, is_internal_transfer, payment_data")
      .eq("user_id", ownerUserId)
      .lt("amount", 0)
      .or("is_internal_transfer.is.null,is_internal_transfer.eq.false")
      .limit(MAX_TXS_PER_RUN);
    if (onlyUncategorized) q = q.is("tipo_gasto_id", null);
    const { data, error } = await q;
    if (error) console.error("[", empresaId, "] pluggy err:", error);
    data?.forEach((r: any) => {
      const receiver = r.payment_data?.receiver?.name || r.payment_data?.receiver?.documentNumber?.value;
      const payer = r.payment_data?.payer?.name || r.payment_data?.payer?.documentNumber?.value;
      txs.push({
        table: "pluggy_transactions",
        id: r.id,
        descricao: [r.description, receiver, payer].filter(Boolean).join(" • "),
      });
    });
  }

  // manual_bank_transactions
  {
    let q = admin
      .from("manual_bank_transactions")
      .select("id, description, amount")
      .eq("empresa_id", empresaId)
      .lt("amount", 0)
      .limit(MAX_TXS_PER_RUN);
    if (onlyUncategorized) q = q.is("tipo_gasto_id", null);
    const { data, error } = await q;
    if (error) console.error("[", empresaId, "] mb err:", error);
    data?.forEach((r: any) =>
      txs.push({ table: "manual_bank_transactions", id: r.id, descricao: r.description ?? "" }),
    );
  }

  // cash_transactions
  {
    let q = admin
      .from("cash_transactions")
      .select("id, description, amount")
      .eq("empresa_id", empresaId)
      .lt("amount", 0)
      .limit(MAX_TXS_PER_RUN);
    if (onlyUncategorized) q = q.is("tipo_gasto_id", null);
    const { data, error } = await q;
    if (error) console.error("[", empresaId, "] cash err:", error);
    data?.forEach((r: any) =>
      txs.push({ table: "cash_transactions", id: r.id, descricao: r.description ?? "" }),
    );
  }

  console.log(`[${empresaId}] coletadas ${txs.length} transações para classificar`);
  if (!txs.length) return { total: 0, classified: 0, unrecognized: 0 };

  const tipoByNome = new Map<string, string>();
  tipos.forEach((t: any) => tipoByNome.set(normalize(t.nome), t.id));
  const tiposList = tipos.map((t: any) => `- ${t.nome}`).join("\n");

  let classified = 0;
  let unrecognized = 0;

  for (let start = 0; start < txs.length; start += CHUNK_SIZE) {
    const chunk = txs.slice(start, start + CHUNK_SIZE);
    const txList = chunk
      .map((t, i) => `${i}. ${t.descricao?.trim() || "(sem descrição)"}`)
      .join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content:
              "Você é especialista em finanças pessoais brasileiras. Classifica cada transação de SAÍDA em UMA das categorias fornecidas, usando o nome do estabelecimento/descrição (ex: Uber/99/Táxi → Transporte; iFood/restaurante/mercado/padaria → Alimentação; Netflix/Spotify/iCloud → Assinaturas; farmácia/drogaria/clínica → Saúde; aluguel/condomínio/luz/água → Moradia; escola/curso/Udemy → Educação; cinema/Steam/bar → Lazer; barbeiro/salão → Cuidados Pessoais; loja/Amazon/Shopee/Magalu → Compras; seguro → Seguros; empréstimo/financiamento → Empréstimos; pedágio/combustível → Transporte). Use APENAS os nomes da lista. Se a descrição for genérica demais (ex: 'PIX ENVIADO', 'TED', sem nome reconhecível), retorne null para aquela transação.",
          },
          {
            role: "user",
            content: `Categorias disponíveis:\n${tiposList}\n\nClassifique cada transação (índice. descrição):\n${txList}`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classificar_transacoes",
              description: "Classifica cada transação.",
              parameters: {
                type: "object",
                properties: {
                  classificacoes: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        index: { type: "integer" },
                        tipo_nome: { type: ["string", "null"] },
                      },
                      required: ["index", "tipo_nome"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["classificacoes"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "classificar_transacoes" } },
      }),
    });

    if (!aiResp.ok) {
      const errTxt = await aiResp.text();
      console.error(`[${empresaId}] AI ${aiResp.status}:`, errTxt.slice(0, 400));
      if (aiResp.status === 429 || aiResp.status === 402) {
        // não adianta continuar tentando
        return { total: txs.length, classified, unrecognized: txs.length - classified };
      }
      continue;
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.warn(`[${empresaId}] sem tool_call`);
      continue;
    }
    let args: any;
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      console.error("parse args err", e);
      continue;
    }
    const classificacoes: Array<{ index: number; tipo_nome: string | null }> =
      args.classificacoes ?? [];

    for (const c of classificacoes) {
      const tx = chunk[c.index];
      if (!tx) continue;
      if (!c.tipo_nome) {
        unrecognized++;
        continue;
      }
      const tipoId = tipoByNome.get(normalize(c.tipo_nome));
      if (!tipoId) {
        unrecognized++;
        continue;
      }
      const { error } = await admin
        .from(tx.table)
        .update({ tipo_gasto_id: tipoId })
        .eq("id", tx.id)
        .is("tipo_gasto_id", null); // só atualiza se ainda estiver vazio
      if (!error) classified++;
      else console.error("update err", tx.table, tx.id, error.message);
    }
  }

  console.log(`[${empresaId}] done: classified=${classified} unrecognized=${unrecognized}`);
  return { total: txs.length, classified, unrecognized };
}

function normalize(s: string) {
  return (s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}
