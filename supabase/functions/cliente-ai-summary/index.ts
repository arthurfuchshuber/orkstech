// Edge function: cliente-ai-summary
// Generates a strategic Customer Success analysis using Lovable AI Gateway.
// Input: client snapshot (cliente, financial buckets, recent interactions).
// Output: { insights: [{ tone, text }], recommendation: string }

import {
  canAccessCliente,
  jsonResponse,
  requireAuthenticatedUser,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const auth = await requireAuthenticatedUser(req, corsHeaders);
  if ("response" in auth) return auth.response;

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const payload = await req.json();

    const clienteId = payload?.cliente_id as string | undefined;
    if (!clienteId) {
      return jsonResponse({ error: "cliente_id is required" }, 400, corsHeaders);
    }

    const allowed = await canAccessCliente(auth.supabaseAdmin, auth.user.id, clienteId);
    if (!allowed) {
      return jsonResponse({ error: "Forbidden" }, 403, corsHeaders);
    }

    const systemPrompt = `Você é um Especialista Sênior em Customer Success B2B com foco em retenção, expansão de receita e redução de churn.

Sua missão é gerar uma ANÁLISE ESTRATÉGICA de alto nível sobre o cliente — NUNCA repita números brutos ou listagens (eles já aparecem em outro card "Visão Macro do Cliente" abaixo do seu).

Foque em:
- Diagnóstico de saúde da conta (sinais ocultos, padrões, tendências)
- Risco real de churn / oportunidade de expansão
- Recomendações de ação concretas, cirúrgicas e priorizadas
- Sugestões de abordagem comercial / relacional (próximos passos)

Tom: gerencial, conciso, estratégico. Pense como um CSM sênior reportando ao diretor.

REGRAS DE FORMATO (obrigatório):
- Devolva 3 a 5 insights curtos (máx ~140 caracteres cada)
- Cada insight tem um "tone": "danger" (alerta crítico), "warn" (atenção), "ok" (positivo) ou "info" (neutro/observação)
- Termine com 1 "recommendation" — uma única frase de ação prioritária para o time atender o cliente AGORA
- NÃO inclua valores monetários nem contagens (o card abaixo já mostra)
- NÃO use bullets, asteriscos ou markdown nos textos`;

    const userPrompt = `Analise o seguinte cliente e devolva insights estratégicos:

${JSON.stringify(payload, null, 2)}`;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          tools: [
            {
              type: "function",
              function: {
                name: "report_cs_analysis",
                description: "Devolve a análise estratégica de Customer Success",
                parameters: {
                  type: "object",
                  properties: {
                    insights: {
                      type: "array",
                      minItems: 3,
                      maxItems: 5,
                      items: {
                        type: "object",
                        properties: {
                          tone: {
                            type: "string",
                            enum: ["danger", "warn", "ok", "info"],
                          },
                          text: { type: "string" },
                        },
                        required: ["tone", "text"],
                        additionalProperties: false,
                      },
                    },
                    recommendation: { type: "string" },
                  },
                  required: ["insights", "recommendation"],
                  additionalProperties: false,
                },
              },
            },
          ],
          tool_choice: {
            type: "function",
            function: { name: "report_cs_analysis" },
          },
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI gateway error:", response.status, errText);
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "rate_limited" }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "payment_required" }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "gateway_error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    const args = toolCall?.function?.arguments
      ? JSON.parse(toolCall.function.arguments)
      : null;

    if (!args) {
      return new Response(
        JSON.stringify({ error: "invalid_response" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify(args), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cliente-ai-summary error:", e);
    return new Response(
      JSON.stringify({ error: "Não foi possível gerar o resumo do cliente." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
