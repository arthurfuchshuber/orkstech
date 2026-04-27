// Sincroniza o Quadro Societário (QSA) de todas as empresas com a Receita Federal.
// Pode ser invocada por cron diário ou manualmente passando { empresa_id }.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function onlyDigits(v: any): string {
  return String(v ?? "").replace(/\D/g, "");
}

function titleCase(s: string): string {
  if (!s) return s;
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

function normalizeQsa(qsa: any[]): any[] {
  if (!Array.isArray(qsa)) return [];
  return qsa.map((s: any) => {
    const rawDoc = String(s.cnpj_cpf_do_socio || s.cpf_cnpj_socio || "");
    const doc = onlyDigits(rawDoc);
    // Receita mascara CPF (***169339**) por LGPD — só 6 dígitos do meio são públicos
    const isMasked = /\*/.test(rawDoc) || (doc.length > 0 && doc.length < 11);
    const tipo_pessoa = doc.length === 14 ? "PJ" : "PF";
    return {
      nome: titleCase(String(s.nome_socio || s.nome || "").trim()),
      documento: doc,
      documento_completo: !isMasked && (doc.length === 11 || doc.length === 14),
      tipo_pessoa,
      qualificacao: String(s.qualificacao_socio || "").trim(),
      percentual_participacao: Number(s.percentual_capital_social ?? 0) || 0,
      data_entrada: s.data_entrada_sociedade || null,
    };
  }).filter((s) => s.nome && s.documento);
}

async function fetchQsa(cnpj: string): Promise<any[] | null> {
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cnpj}`);
    if (!r.ok) return null;
    const data = await r.json();
    return normalizeQsa(data.qsa || data.socios || []);
  } catch {
    return null;
  }
}

async function syncEmpresa(supabase: any, empresa: { id: string; cnpj: string; user_id: string }) {
  const cnpjClean = onlyDigits(empresa.cnpj);
  if (cnpjClean.length !== 14) return { empresa_id: empresa.id, skipped: true, reason: "cnpj_invalid" };

  const qsa = await fetchQsa(cnpjClean);
  if (!qsa) return { empresa_id: empresa.id, skipped: true, reason: "fetch_failed" };

  // Sócios já existentes
  const { data: existing } = await supabase
    .from("empresa_socios")
    .select("id, documento, status_socio")
    .eq("empresa_id", empresa.id);
  const byDoc = new Map<string, any>((existing ?? []).map((s: any) => [s.documento, s]));

  let created = 0, updated = 0, deactivated = 0;
  const docsFromReceita = new Set<string>();

  for (const s of qsa) {
    docsFromReceita.add(s.documento);
    const existingRow = byDoc.get(s.documento);
    if (existingRow) {
      // Atualiza apenas campos provenientes da Receita; preserva dados manuais
      const { error } = await supabase
        .from("empresa_socios")
        .update({
          nome_completo: s.nome,
          qualificacao: s.qualificacao || null,
          percentual_participacao: s.percentual_participacao,
          tipo_pessoa: s.tipo_pessoa,
          status_socio: "ativo",
          data_entrada: s.data_entrada || null,
        })
        .eq("id", existingRow.id);
      if (!error) updated++;
    } else {
      const { error } = await supabase.from("empresa_socios").insert({
        empresa_id: empresa.id,
        user_id: empresa.user_id,
        nome_completo: s.nome,
        documento: s.documento,
        // Só preenche CPF/CNPJ completo; se mascarado, deixa null para usuário completar
        cpf: s.tipo_pessoa === "PF" && s.documento_completo ? s.documento : null,
        tipo_pessoa: s.tipo_pessoa,
        qualificacao: s.qualificacao || null,
        cargo: s.qualificacao || null,
        percentual_participacao: s.percentual_participacao,
        data_entrada: s.data_entrada || null,
        administrador: /administrador/i.test(s.qualificacao || ""),
        origem: "receita_federal",
        status_socio: "ativo",
        ativo: true,
      });
      if (!error) created++;
    }
  }

  // Sócios que sumiram da Receita: marcar inativos (não excluir para preservar histórico)
  for (const [doc, row] of byDoc.entries()) {
    if (!docsFromReceita.has(doc) && row.status_socio !== "inativo") {
      await supabase
        .from("empresa_socios")
        .update({ status_socio: "inativo", ativo: false })
        .eq("id", row.id);
      deactivated++;
    }
  }

  await supabase.from("empresas").update({ last_qsa_sync_at: new Date().toISOString() }).eq("id", empresa.id);

  return { empresa_id: empresa.id, created, updated, deactivated, total_qsa: qsa.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json().catch(() => ({}));
    const { empresa_id } = body || {};

    let empresas: any[] = [];
    if (empresa_id) {
      const { data } = await supabase
        .from("empresas")
        .select("id, cnpj, user_id")
        .eq("id", empresa_id)
        .limit(1);
      empresas = data ?? [];
    } else {
      // Sincroniza apenas empresas que não tiveram sync nas últimas 20h (evita reexecução desnecessária)
      const cutoff = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString();
      const { data } = await supabase
        .from("empresas")
        .select("id, cnpj, user_id, last_qsa_sync_at")
        .or(`last_qsa_sync_at.is.null,last_qsa_sync_at.lt.${cutoff}`)
        .limit(200);
      empresas = data ?? [];
    }

    const results = [];
    for (const e of empresas) {
      const r = await syncEmpresa(supabase, e);
      results.push(r);
      // pequeno delay para não estourar rate-limit da BrasilAPI
      await new Promise((res) => setTimeout(res, 250));
    }

    return new Response(JSON.stringify({ ok: true, processed: results.length, results }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err?.message || "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
