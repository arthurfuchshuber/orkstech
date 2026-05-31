// Edge function: classifica transações de saída em "Tipos de Gasto" via Lovable AI.
// POST { empresa_id: string, only_uncategorized?: boolean }
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

interface Tx {
  table: "accounts_payable" | "pluggy_transactions" | "manual_bank_transactions" | "cash_transactions";
  id: string;
  descricao: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY ausente");
    const body = await req.json().catch(() => ({}));
    const empresaId: string | undefined = body.empresa_id;
    const onlyUncategorized: boolean = body.only_uncategorized ?? true;
    if (!empresaId) {
      return new Response(JSON.stringify({ error: "empresa_id obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization") ?? "";
    const userClient = createClient(SUPABASE_URL, SERVICE_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Tipos disponíveis na empresa
    const { data: tipos, error: tiposErr } = await admin
      .from("tipos_gasto")
      .select("id, nome, emoji")
      .eq("empresa_id", empresaId)
      .eq("ativo", true)
      .order("nome");
    if (tiposErr) throw tiposErr;
    if (!tipos?.length) {
      return new Response(JSON.stringify({ classified: 0, message: "Nenhum tipo cadastrado" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Carregar transações de SAÍDA por tabela
    const txs: Tx[] = [];

    // accounts_payable: todas (saída por natureza)
    const apQ = admin.from("accounts_payable").select("id, titulo, descricao, beneficiario_nome").eq("empresa_id", empresaId);
    if (onlyUncategorized) apQ.is("tipo_gasto_id", null);
    const { data: aps } = await apQ.limit(500);
    aps?.forEach((r: any) => txs.push({ table: "accounts_payable", id: r.id, descricao: [r.titulo, r.beneficiario_nome, r.descricao].filter(Boolean).join(" • ") }));

    // pluggy_transactions: saída = amount < 0 ou type='DEBIT'
    const plQ = admin.from("pluggy_transactions").select("id, description, amount, type").eq("empresa_id", empresaId).lt("amount", 0);
    if (onlyUncategorized) plQ.is("tipo_gasto_id", null);
    const { data: pls } = await plQ.limit(500);
    pls?.forEach((r: any) => txs.push({ table: "pluggy_transactions", id: r.id, descricao: r.description ?? "" }));

    // manual_bank_transactions: saída = amount < 0
    const mbQ = admin.from("manual_bank_transactions").select("id, description, amount").eq("empresa_id", empresaId).lt("amount", 0);
    if (onlyUncategorized) mbQ.is("tipo_gasto_id", null);
    const { data: mbs } = await mbQ.limit(500);
    mbs?.forEach((r: any) => txs.push({ table: "manual_bank_transactions", id: r.id, descricao: r.description ?? "" }));

    // cash_transactions: saída = amount < 0
    const csQ = admin.from("cash_transactions").select("id, description, amount").eq("empresa_id", empresaId).lt("amount", 0);
    if (onlyUncategorized) csQ.is("tipo_gasto_id", null);
    const { data: css } = await csQ.limit(500);
    css?.forEach((r: any) => txs.push({ table: "cash_transactions", id: r.id, descricao: r.description ?? "" }));

    if (!txs.length) {
      return new Response(JSON.stringify({ classified: 0, total: 0, message: "Nada a classificar" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3) Montar prompt e chamar Lovable AI (tool calling para JSON estruturado)
    const tiposList = tipos.map((t: any) => `- ${t.nome}`).join("\n");
    const txList = txs.map((t, i) => `${i}. ${t.descricao || "(sem descrição)"}`).join("\n");

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content:
              "Você classifica transações financeiras brasileiras em categorias de tipo de gasto. Use APENAS os nomes da lista fornecida. Se não tiver certeza razoável, retorne null para aquela transação.",
          },
          {
            role: "user",
            content: `Categorias disponíveis:\n${tiposList}\n\nTransações (índice. descrição):\n${txList}\n\nClassifique cada transação retornando uma lista de objetos {index, tipo_nome_or_null}.`,
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "classificar_transacoes",
              description: "Retorna a classificação de cada transação.",
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
      console.error("AI gateway err", aiResp.status, errTxt);
      if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Limite de uso da IA atingido. Tente novamente em instantes." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiResp.status === 402) return new Response(JSON.stringify({ error: "Créditos de IA esgotados. Adicione créditos em Configurações > Workspace > Uso." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      throw new Error("Falha na IA");
    }

    const aiJson = await aiResp.json();
    const toolCall = aiJson.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall ? JSON.parse(toolCall.function.arguments) : { classificacoes: [] };
    const classificacoes: Array<{ index: number; tipo_nome: string | null }> = args.classificacoes ?? [];

    // 4) Aplicar atualizações
    const tipoByNome = new Map<string, string>();
    tipos.forEach((t: any) => tipoByNome.set(t.nome.toLowerCase(), t.id));

    let updated = 0;
    let unrecognized = 0;
    // Agrupar por tabela para batch
    const byTable: Record<string, Array<{ id: string; tipo_gasto_id: string }>> = {};
    for (const c of classificacoes) {
      const tx = txs[c.index];
      if (!tx) continue;
      if (!c.tipo_nome) { unrecognized++; continue; }
      const tipoId = tipoByNome.get(c.tipo_nome.toLowerCase());
      if (!tipoId) { unrecognized++; continue; }
      (byTable[tx.table] ??= []).push({ id: tx.id, tipo_gasto_id: tipoId });
    }

    for (const [table, rows] of Object.entries(byTable)) {
      for (const r of rows) {
        const { error } = await admin.from(table).update({ tipo_gasto_id: r.tipo_gasto_id }).eq("id", r.id);
        if (!error) updated++;
      }
    }

    return new Response(JSON.stringify({
      total: txs.length,
      classified: updated,
      unrecognized,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("classify-tipos-gasto error", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
