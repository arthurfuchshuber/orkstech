import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { cnpj } = await req.json();
    const cleanCnpj = cnpj?.replace(/\D/g, "");

    if (!cleanCnpj || cleanCnpj.length !== 14) {
      return new Response(
        JSON.stringify({ error: "CNPJ inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Query BrasilAPI for CNPJ data
    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: "CNPJ não encontrado na Receita Federal" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();

    // Check if company is active
    const situacao = (data.descricao_situacao_cadastral || "").toUpperCase();
    if (situacao !== "ATIVA") {
      return new Response(
        JSON.stringify({
          error: `CNPJ com situação cadastral: ${data.descricao_situacao_cadastral || "INATIVA"}. Apenas empresas ATIVAS podem ser cadastradas.`,
          situacao: data.descricao_situacao_cadastral,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return normalized company data
    return new Response(
      JSON.stringify({
        razao_social: data.razao_social || "",
        nome_fantasia: data.nome_fantasia || "",
        telefone: data.ddd_telefone_1
          ? `${data.ddd_telefone_1}`.replace(/\D/g, "").slice(0, 11)
          : "",
        email: data.email || "",
        logradouro: [data.descricao_tipo_de_logradouro, data.logradouro, data.numero, data.complemento]
          .filter(Boolean)
          .join(" "),
        bairro: data.bairro || "",
        cidade: data.municipio || "",
        estado: data.uf || "",
        cep: (data.cep || "").replace(/\D/g, ""),
        situacao: data.descricao_situacao_cadastral,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Erro ao consultar CNPJ" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
