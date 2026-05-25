// Sincroniza o Quadro Societário (QSA) de todas as empresas com a Receita Federal.
// Bulk (sem empresa_id): apenas CRON_SECRET. Manual: JWT + acesso à empresa.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  canAccessEmpresa,
  createServiceClient,
  isCronAuthorized,
  jsonResponse,
  requireAuthenticatedUser,
} from "../_shared/security.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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

  const { data: existing } = await supabase
    .from("empresa_socios")
    .select("id, documento, nome_completo, qualificacao, percentual_participacao, tipo_pessoa, data_entrada")
    .eq("empresa_id", empresa.id);
  const byDoc = new Map<string, any>((existing ?? []).map((s: any) => [s.documento, s]));

  let created = 0, updated = 0;

  for (const s of qsa) {
    const existingRow = byDoc.get(s.documento);
    if (existingRow) {
      const patch: Record<string, any> = {};
      if (s.nome && !existingRow.nome_completo) patch.nome_completo = s.nome;
      if (s.qualificacao && !existingRow.qualificacao) patch.qualificacao = s.qualificacao;
      if (
        s.percentual_participacao &&
        s.percentual_participacao > 0 &&
        (!existingRow.percentual_participacao || Number(existingRow.percentual_participacao) === 0)
      ) {
        patch.percentual_participacao = s.percentual_participacao;
      }
      if (s.data_entrada && !existingRow.data_entrada) patch.data_entrada = s.data_entrada;
      if (s.tipo_pessoa && existingRow.tipo_pessoa !== s.tipo_pessoa) patch.tipo_pessoa = s.tipo_pessoa;

      if (Object.keys(patch).length > 0) {
        const { error } = await supabase.from("empresa_socios").update(patch).eq("id", existingRow.id);
        if (!error) updated++;
      }
    } else {
      const { error } = await supabase.from("empresa_socios").insert({
        empresa_id: empresa.id,
        user_id: empresa.user_id,
        nome_completo: s.nome,
        documento: s.documento,
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

  await supabase.from("empresas").update({ last_qsa_sync_at: new Date().toISOString() }).eq("id", empresa.id);

  return { empresa_id: empresa.id, created, updated, deactivated: 0, total_qsa: qsa.length };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const { empresa_id } = body || {};

    const supabase = createServiceClient();

    if (empresa_id) {
      const auth = await requireAuthenticatedUser(req, corsHeaders);
      if ("response" in auth) return auth.response;

      const allowed = await canAccessEmpresa(auth.supabaseAdmin, auth.user.id, empresa_id);
      if (!allowed) {
        return jsonResponse({ error: "Forbidden" }, 403, corsHeaders);
      }
    } else if (!isCronAuthorized(req)) {
      return jsonResponse({ error: "Unauthorized" }, 401, corsHeaders);
    }

    let empresas: any[] = [];
    if (empresa_id) {
      const { data } = await supabase
        .from("empresas")
        .select("id, cnpj, user_id")
        .eq("id", empresa_id)
        .limit(1);
      empresas = data ?? [];
    } else {
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
      await new Promise((res) => setTimeout(res, 250));
    }

    return jsonResponse({ ok: true, processed: results.length, results }, 200, corsHeaders);
  } catch (err: any) {
    console.error('sync-qsa-empresas error:', err?.message || err);
    return jsonResponse({ error: "Erro interno ao sincronizar QSA." }, 500, corsHeaders);
  }
});
