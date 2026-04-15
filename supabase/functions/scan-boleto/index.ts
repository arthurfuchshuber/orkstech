import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { file_base64, file_type, categorias_financeiras, centros_custo } = await req.json();

    if (!file_base64) {
      return new Response(JSON.stringify({ error: "file_base64 is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const mimeType = file_type || "application/pdf";

    // Build dynamic context for AI classification
    let classificationContext = "";
    if (categorias_financeiras && categorias_financeiras.length > 0) {
      classificationContext += `\n\nCATEGORIAS FINANCEIRAS DISPONÍVEIS (use o id exato para suggested_categoria_financeira_id):
${categorias_financeiras.map((c: any) => `- id: "${c.id}" | tipo: "${c.tipo}" | nome: "${c.nome}"`).join("\n")}`;
    }
    if (centros_custo && centros_custo.length > 0) {
      classificationContext += `\n\nCENTROS DE CUSTO DISPONÍVEIS (use o id exato para suggested_centro_custo_id):
${centros_custo.map((c: any) => `- id: "${c.id}" | nome: "${c.nome}"`).join("\n")}`;
    }

    const systemPrompt = `Você é um especialista em leitura de boletos bancários brasileiros e classificação financeira.
Analise a imagem/PDF do boleto e extraia as seguintes informações:
- description: descrição/finalidade do boleto
- supplier_name: nome do beneficiário/cedente (empresa que vai receber o pagamento)
- supplier_cnpj: CNPJ do beneficiário/cedente (apenas números, 14 dígitos)
- supplier_phone: telefone do beneficiário se disponível (apenas números)
- supplier_email: email do beneficiário se disponível
- supplier_address: endereço completo do beneficiário se disponível
- document_number: número do documento ou nosso número
- amount: valor do boleto em centavos (ex: R$ 150,00 = 15000). IMPORTANTE: retorne em centavos como número inteiro.
- due_date: data de vencimento no formato YYYY-MM-DD
- barcode: código de barras ou linha digitável completa

CLASSIFICAÇÃO FINANCEIRA:
Com base na descrição e beneficiário do boleto, sugira a melhor classificação:
- suggested_tipo_financeiro: o tipo financeiro mais adequado entre: receita, deducao, custo, despesa, receita_financeira, despesa_financeira, imposto, ajuste
  Dica: boletos de pagamento geralmente são "custo" (ligado à produção) ou "despesa" (operacional). Impostos usam "imposto". Tarifas bancárias usam "despesa_financeira".
- suggested_categoria_financeira_id: o ID da categoria financeira mais adequada da lista fornecida (deve corresponder ao tipo financeiro sugerido)
- suggested_centro_custo_id: o ID do centro de custo mais adequado da lista fornecida

Se algum campo não for encontrado ou não for possível classificar, retorne null para ele.
IMPORTANTE: O amount DEVE ser em centavos (inteiro). Ex: R$ 1.234,56 = 123456
IMPORTANTE: O supplier_cnpj deve conter APENAS os 14 dígitos numéricos, sem pontuação.
IMPORTANTE: Para suggested_categoria_financeira_id e suggested_centro_custo_id, use APENAS os IDs exatos fornecidos na lista.${classificationContext}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: `data:${mimeType};base64,${file_base64}`,
                },
              },
              {
                type: "text",
                text: "Extraia todos os dados deste boleto bancário e sugira a classificação financeira mais adequada.",
              },
            ],
          },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "extract_boleto",
              description: "Extrai dados estruturados de um boleto bancário e sugere classificação financeira",
              parameters: {
                type: "object",
                properties: {
                  description: { type: "string", description: "Descrição ou finalidade do pagamento" },
                  supplier_name: { type: "string", description: "Nome do beneficiário/cedente" },
                  supplier_cnpj: { type: "string", description: "CNPJ do beneficiário (apenas 14 dígitos numéricos)" },
                  supplier_phone: { type: "string", description: "Telefone do beneficiário (apenas números)" },
                  supplier_email: { type: "string", description: "Email do beneficiário" },
                  supplier_address: { type: "string", description: "Endereço completo do beneficiário" },
                  document_number: { type: "string", description: "Número do documento ou nosso número" },
                  amount: { type: "integer", description: "Valor em centavos (ex: R$ 150,00 = 15000)" },
                  due_date: { type: "string", description: "Data de vencimento no formato YYYY-MM-DD" },
                  barcode: { type: "string", description: "Linha digitável ou código de barras" },
                  suggested_tipo_financeiro: { type: "string", description: "Tipo financeiro sugerido: receita, deducao, custo, despesa, receita_financeira, despesa_financeira, imposto, ajuste", enum: ["receita", "deducao", "custo", "despesa", "receita_financeira", "despesa_financeira", "imposto", "ajuste"] },
                  suggested_categoria_financeira_id: { type: "string", description: "ID da categoria financeira sugerida" },
                  suggested_centro_custo_id: { type: "string", description: "ID do centro de custo sugerido" },
                },
                required: ["description", "supplier_name", "amount", "due_date"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "extract_boleto" } },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);

      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Limite de requisições excedido. Tente novamente em alguns segundos." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos insuficientes. Adicione créditos ao workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "Erro ao processar boleto com IA" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResult = await response.json();
    
    const toolCall = aiResult.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      console.error("No tool call in response:", JSON.stringify(aiResult));
      return new Response(JSON.stringify({ error: "Não foi possível extrair dados do boleto" }), {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const extracted = JSON.parse(toolCall.function.arguments);

    return new Response(JSON.stringify({ data: extracted }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("scan-boleto error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
