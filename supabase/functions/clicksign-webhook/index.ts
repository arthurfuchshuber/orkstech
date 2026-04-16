// ClickSign webhook - public endpoint, validates by webhook_token in URL
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    if (!token) return new Response("Missing token", { status: 401 });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: cred } = await supabase
      .from("integracoes_credenciais")
      .select("id, user_id, empresa_id")
      .eq("provider", "clicksign")
      .eq("webhook_token", token)
      .eq("ativo", true)
      .maybeSingle();
    if (!cred) return new Response("Invalid token", { status: 401 });

    const event = await req.json();
    console.log("[clicksign-webhook]", event?.event?.name, event?.document?.key);

    const csDoc = event?.document;
    if (!csDoc?.key) return new Response("ok", { status: 200 });

    const { data: doc } = await supabase
      .from("clicksign_documentos")
      .select("*")
      .eq("clicksign_document_key", csDoc.key)
      .maybeSingle();

    if (!doc) return new Response("ok", { status: 200 });

    const status = csDoc?.status || doc.status;
    const downloadUrl = csDoc?.downloads?.signed_file_url || null;

    await supabase.from("clicksign_documentos")
      .update({
        status,
        url_assinado: downloadUrl,
        finalizado_em: csDoc?.finished_at || null,
        raw_data: csDoc,
      })
      .eq("id", doc.id);

    // Notify when finalized
    const finishedEvents = ["auto_close", "close", "document_closed"];
    if (finishedEvents.includes(event?.event?.name) && doc.cliente_id) {
      await supabase.from("cliente_interacoes").insert({
        user_id: doc.user_id,
        empresa_id: doc.empresa_id,
        cliente_id: doc.cliente_id,
        tipo: "documento",
        descricao: `Documento "${doc.nome}" assinado via ClickSign`,
        usuario_nome: "ClickSign",
      });

      await supabase.from("notificacoes_sistema").insert({
        user_id: doc.user_id,
        empresa_id: doc.empresa_id,
        titulo: "Documento assinado",
        descricao: `${doc.nome} foi totalmente assinado`,
        tipo: "sucesso",
        entidade_tipo: "clicksign_documento",
        entidade_id: doc.id,
      });
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("[clicksign-webhook] error:", e);
    return new Response("error", { status: 500 });
  }
});
