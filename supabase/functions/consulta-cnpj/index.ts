import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { jsonResponse, requireAuthenticatedUser } from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function onlyDigits(v: any): string {
  return String(v ?? "").replace(/\D/g, "");
}

function normalizeQsa(qsa: any[]): any[] {
  if (!Array.isArray(qsa)) return [];
  return qsa.map((s: any) => {
    const rawDoc = String(s.cnpj_cpf_do_socio || s.cpf_cnpj_socio || "");
    const doc = onlyDigits(rawDoc);
    const isMasked = /\*/.test(rawDoc) || (doc.length > 0 && doc.length < 11);
    const tipo_pessoa = doc.length === 14 ? "PJ" : "PF";
    return {
      nome: String(s.nome_socio || s.nome || "").trim(),
      documento: doc,
      documento_completo: !isMasked && (doc.length === 11 || doc.length === 14),
      documento_mascarado: isMasked,
      tipo_pessoa,
      qualificacao: String(s.qualificacao_socio || s.codigo_qualificacao_socio || "").trim(),
      percentual_participacao: Number(s.percentual_capital_social ?? s.percentual_participacao ?? 0) || 0,
      data_entrada: s.data_entrada_sociedade || null,
    };
  }).filter((s) => s.nome && s.documento);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const auth = await requireAuthenticatedUser(req, corsHeaders);
  if ("response" in auth) return auth.response;

  try {
    const { cnpj } = await req.json();
    const cleanCnpj = onlyDigits(cnpj);

    if (!cleanCnpj || cleanCnpj.length !== 14) {
      return jsonResponse({ error: "CNPJ inválido" }, 400, corsHeaders);
    }

    const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);

    if (!response.ok) {
      return jsonResponse({ error: "CNPJ não encontrado na Receita Federal" }, 404, corsHeaders);
    }

    const data = await response.json();

    const situacao = (data.descricao_situacao_cadastral || "").toUpperCase();
    if (situacao !== "ATIVA") {
      return jsonResponse(
        {
          error: `CNPJ com situação cadastral: ${data.descricao_situacao_cadastral || "INATIVA"}. Apenas empresas ATIVAS podem ser cadastradas.`,
          situacao: data.descricao_situacao_cadastral,
        },
        422,
        corsHeaders,
      );
    }

    const qsa = normalizeQsa(data.qsa || data.socios || []);

    return jsonResponse(
      {
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
        qsa,
      },
      200,
      corsHeaders,
    );
  } catch {
    return jsonResponse({ error: "Erro ao consultar CNPJ" }, 500, corsHeaders);
  }
});
