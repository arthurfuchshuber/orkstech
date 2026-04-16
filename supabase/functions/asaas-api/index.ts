// Asaas API proxy - manages credentials, customers and payments
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ASAAS_BASE = "https://api.asaas.com/v3";
const ASAAS_SANDBOX = "https://api-sandbox.asaas.com/v3";

interface CredRow {
  id: string;
  api_key: string;
  ambiente: string;
  empresa_id: string | null;
}

async function asaasFetch(cred: CredRow, path: string, init: RequestInit = {}) {
  const base = cred.ambiente === "sandbox" ? ASAAS_SANDBOX : ASAAS_BASE;
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      "access_token": cred.api_key,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let data: any;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) {
    throw new Error(`Asaas API ${res.status}: ${data?.errors?.[0]?.description || text || res.statusText}`);
  }
  return data;
}

function onlyDigits(v?: string | null) {
  return (v || "").replace(/\D/g, "");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: cErr } = await supabase.auth.getClaims(token);
    if (cErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userId = claims.claims.sub as string;

    const body = await req.json();
    const { action, empresa_id } = body;

    // Service-role client for cred reads (bypass RLS for safety) - but still scoped to userId
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // ============ TEST CONNECTION ============
    if (action === "test") {
      const { api_key, ambiente } = body;
      if (!api_key) throw new Error("api_key obrigatória");
      const res = await asaasFetch(
        { id: "", api_key, ambiente: ambiente || "production", empresa_id: null },
        "/myAccount"
      );
      return new Response(JSON.stringify({ success: true, account: res }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For other actions, require credentials saved
    let credQuery = serviceClient
      .from("integracoes_credenciais")
      .select("id, api_key, ambiente, empresa_id")
      .eq("user_id", userId)
      .eq("provider", "asaas")
      .eq("ativo", true);
    if (empresa_id) credQuery = credQuery.eq("empresa_id", empresa_id);
    const { data: creds, error: credErr } = await credQuery.limit(1).maybeSingle();
    if (credErr) throw credErr;
    if (!creds) throw new Error("Asaas não configurado para esta empresa");
    const cred = creds as CredRow;

    // ============ CREATE PAYMENT ============
    if (action === "create_payment") {
      const { receivable_id } = body;
      if (!receivable_id) throw new Error("receivable_id obrigatório");

      // Load receivable
      const { data: rec, error: recErr } = await serviceClient
        .from("accounts_receivable")
        .select("*")
        .eq("id", receivable_id)
        .eq("user_id", userId)
        .single();
      if (recErr || !rec) throw new Error("Lançamento não encontrado");
      if (!rec.cliente_id) throw new Error("Lançamento precisa estar vinculado a um cliente");

      // Load cliente
      const { data: cliente, error: cliErr } = await serviceClient
        .from("clientes")
        .select("*")
        .eq("id", rec.cliente_id)
        .eq("user_id", userId)
        .single();
      if (cliErr || !cliente) throw new Error("Cliente não encontrado");

      // Find or create Asaas customer
      const cpfCnpj = onlyDigits(cliente.tipo === "pf" ? cliente.cpf : cliente.cnpj);
      if (!cpfCnpj) throw new Error("Cliente sem CPF/CNPJ cadastrado");

      let asaasCustomerId: string | null = null;
      const search = await asaasFetch(cred, `/customers?cpfCnpj=${cpfCnpj}`);
      if (search?.data?.length > 0) {
        asaasCustomerId = search.data[0].id;
      } else {
        // Create customer using local data
        const nome = cliente.tipo === "pf"
          ? cliente.nome_completo
          : (cliente.nome_fantasia || cliente.razao_social);
        if (!nome) throw new Error("Cliente sem nome cadastrado");

        const customerPayload: Record<string, unknown> = {
          name: nome,
          cpfCnpj,
          email: cliente.email || undefined,
          mobilePhone: onlyDigits(cliente.whatsapp || cliente.telefone) || undefined,
          postalCode: onlyDigits(cliente.cep) || undefined,
          address: cliente.logradouro || undefined,
          addressNumber: cliente.numero || undefined,
          complement: cliente.complemento || undefined,
          province: cliente.bairro || undefined,
        };
        const created = await asaasFetch(cred, "/customers", {
          method: "POST",
          body: JSON.stringify(customerPayload),
        });
        asaasCustomerId = created.id;
      }

      // Create payment
      const billingType = (body.billing_type || "BOLETO").toUpperCase(); // BOLETO | PIX | CREDIT_CARD | UNDEFINED
      const paymentPayload = {
        customer: asaasCustomerId,
        billingType,
        value: Number(rec.amount),
        dueDate: rec.due_date,
        description: rec.description?.slice(0, 500) || undefined,
        externalReference: rec.id,
      };
      const payment = await asaasFetch(cred, "/payments", {
        method: "POST",
        body: JSON.stringify(paymentPayload),
      });

      // Get PIX QR if billing is PIX
      let pixQr: any = null;
      if (billingType === "PIX") {
        try { pixQr = await asaasFetch(cred, `/payments/${payment.id}/pixQrCode`); } catch { /* ignore */ }
      }

      // Save mapping
      const { data: cobranca, error: cobErr } = await serviceClient
        .from("asaas_cobrancas")
        .insert({
          user_id: userId,
          empresa_id: rec.empresa_id || cred.empresa_id,
          account_receivable_id: rec.id,
          cliente_id: rec.cliente_id,
          asaas_customer_id: asaasCustomerId,
          asaas_payment_id: payment.id,
          billing_type: billingType,
          status: payment.status || "PENDING",
          value: payment.value,
          due_date: payment.dueDate,
          invoice_url: payment.invoiceUrl,
          bank_slip_url: payment.bankSlipUrl,
          pix_qr_code: pixQr?.encodedImage || null,
          pix_payload: pixQr?.payload || null,
          identification_field: payment.identificationField || null,
          raw_data: payment,
        })
        .select()
        .single();
      if (cobErr) throw cobErr;

      // Log on cliente history
      await serviceClient.from("cliente_interacoes").insert({
        user_id: userId,
        cliente_id: rec.cliente_id,
        empresa_id: rec.empresa_id,
        tipo: "financeiro",
        descricao: `Cobrança gerada no Asaas (${billingType}). Valor: R$ ${Number(rec.amount).toFixed(2)} • Vencimento: ${rec.due_date}`,
        usuario_nome: "Sistema",
      });

      return new Response(JSON.stringify({ success: true, cobranca, payment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ CANCEL PAYMENT ============
    if (action === "cancel_payment") {
      const { cobranca_id } = body;
      if (!cobranca_id) throw new Error("cobranca_id obrigatório");
      const { data: cob, error } = await serviceClient
        .from("asaas_cobrancas").select("*").eq("id", cobranca_id).eq("user_id", userId).single();
      if (error || !cob) throw new Error("Cobrança não encontrada");

      await asaasFetch(cred, `/payments/${cob.asaas_payment_id}`, { method: "DELETE" });

      await serviceClient.from("asaas_cobrancas")
        .update({ status: "CANCELED" })
        .eq("id", cobranca_id);

      if (cob.cliente_id) {
        await serviceClient.from("cliente_interacoes").insert({
          user_id: userId,
          cliente_id: cob.cliente_id,
          empresa_id: cob.empresa_id,
          tipo: "financeiro",
          descricao: `Cobrança Asaas cancelada (${cob.billing_type}) • R$ ${Number(cob.value).toFixed(2)}`,
          usuario_nome: "Sistema",
        });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ REFRESH PAYMENT ============
    if (action === "refresh_payment") {
      const { cobranca_id } = body;
      const { data: cob, error } = await serviceClient
        .from("asaas_cobrancas").select("*").eq("id", cobranca_id).eq("user_id", userId).single();
      if (error || !cob) throw new Error("Cobrança não encontrada");
      const payment = await asaasFetch(cred, `/payments/${cob.asaas_payment_id}`);
      await serviceClient.from("asaas_cobrancas")
        .update({ status: payment.status, payment_date: payment.paymentDate || null, raw_data: payment })
        .eq("id", cobranca_id);
      return new Response(JSON.stringify({ success: true, payment }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error(`Ação não suportada: ${action}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[asaas-api]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
