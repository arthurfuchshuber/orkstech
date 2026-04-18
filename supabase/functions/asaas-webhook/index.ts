// Asaas webhook - public endpoint, validates by webhook_token query param
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

function onlyDigits(v?: string | null) {
  return (v || "").replace(/\D/g, "");
}

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

    const { data: cred, error: cErr } = await supabase
      .from("integracoes_credenciais")
      .select("id, user_id, empresa_id")
      .eq("provider", "asaas")
      .eq("webhook_token", token)
      .eq("ativo", true)
      .maybeSingle();
    if (cErr || !cred) return new Response("Invalid token", { status: 401 });

    const event = await req.json();
    const eventName: string = event?.event || "";
    console.log("[asaas-webhook]", eventName, event?.payment?.id || event?.customer?.id);

    // ============ CUSTOMER events ============
    if (eventName.startsWith("CUSTOMER_") && event?.customer) {
      const cust = event.customer;
      const doc = onlyDigits(cust?.cpfCnpj);
      if (doc) {
        // Find local cliente by cpf/cnpj for this user
        const { data: cli } = await supabase
          .from("clientes")
          .select("id, tipo")
          .eq("user_id", cred.user_id)
          .or(`cpf.eq.${doc},cnpj.eq.${doc}`)
          .maybeSingle();

        if (cli) {
          const isPF = cli.tipo === "pf";
          const nome = (cust?.name || "").toString().trim();
          const updatePayload: Record<string, unknown> = {
            email: cust?.email || null,
            telefone: onlyDigits(cust?.phone) || null,
            whatsapp: onlyDigits(cust?.mobilePhone) || null,
            cep: onlyDigits(cust?.postalCode) || null,
            logradouro: cust?.address || null,
            numero: cust?.addressNumber || null,
            complemento: cust?.complement || null,
            bairro: cust?.province || null,
            cidade: cust?.city || null,
            estado: cust?.state || null,
          };
          if (nome) {
            if (isPF) {
              updatePayload.nome_completo = nome;
            } else {
              updatePayload.razao_social = nome.toUpperCase();
              if (!cust?.company) updatePayload.nome_fantasia = nome.toUpperCase();
            }
          }
          await supabase.from("clientes").update(updatePayload).eq("id", cli.id);
        }
      }
      return new Response("ok", { status: 200, headers: corsHeaders });
    }

    const payment = event?.payment;
    if (!payment?.id) return new Response("ok", { status: 200 });

    // Find local cobranca
    const { data: cob } = await supabase
      .from("asaas_cobrancas")
      .select("*")
      .eq("asaas_payment_id", payment.id)
      .maybeSingle();

    if (!cob) {
      // Unknown payment - ignore
      return new Response("ok", { status: 200 });
    }

    await supabase.from("asaas_cobrancas")
      .update({
        status: payment.status,
        value: Number(payment.value) || cob.value,
        due_date: payment.dueDate || cob.due_date,
        payment_date: payment.paymentDate || payment.confirmedDate || null,
        invoice_url: payment.invoiceUrl ?? cob.invoice_url,
        bank_slip_url: payment.bankSlipUrl ?? cob.bank_slip_url,
        identification_field: payment.identificationField ?? cob.identification_field,
        raw_data: payment,
      })
      .eq("id", cob.id);

    // ============ PAYMENT_UPDATED: sync changes back to local accounts_receivable ============
    if (eventName === "PAYMENT_UPDATED" && cob.account_receivable_id) {
      const updateData: Record<string, unknown> = {};
      if (payment.value != null) updateData.amount = Number(payment.value);
      if (payment.dueDate) updateData.due_date = payment.dueDate;
      if (payment.description) updateData.description = payment.description;
      if (Object.keys(updateData).length > 0) {
        await supabase.from("accounts_receivable")
          .update(updateData)
          .eq("id", cob.account_receivable_id);
      }
    }

    // If confirmed/received, update receivable
    const confirmedEvents = ["PAYMENT_CONFIRMED", "PAYMENT_RECEIVED"];
    if (confirmedEvents.includes(eventName) && cob.account_receivable_id) {
      const { data: rec } = await supabase
        .from("accounts_receivable")
        .select("*")
        .eq("id", cob.account_receivable_id)
        .maybeSingle();

      if (rec && rec.status !== "paid") {
        await supabase.from("accounts_receivable")
          .update({
            status: "paid",
            payment_date: payment.paymentDate || payment.confirmedDate || new Date().toISOString().slice(0, 10),
          })
          .eq("id", rec.id);

        // Cash transaction
        await supabase.from("cash_transactions").insert({
          user_id: rec.user_id,
          empresa_id: rec.empresa_id,
          type: "income",
          amount: Number(payment.value),
          transaction_date: payment.paymentDate || new Date().toISOString().slice(0, 10),
          description: `Recebimento via Asaas: ${rec.description}`,
          bank_account_id: rec.bank_account_id,
          categoria_financeira_id: rec.categoria_financeira_id,
        });

        // Cliente history
        if (rec.cliente_id) {
          await supabase.from("cliente_interacoes").insert({
            user_id: rec.user_id,
            empresa_id: rec.empresa_id,
            cliente_id: rec.cliente_id,
            tipo: "financeiro",
            descricao: `Pagamento confirmado via Asaas (${cob.billing_type}). Valor: R$ ${Number(payment.value).toFixed(2)}`,
            usuario_nome: "Asaas",
          });
        }

        // Notification
        await supabase.from("notificacoes_sistema").insert({
          user_id: rec.user_id,
          empresa_id: rec.empresa_id,
          titulo: "Pagamento recebido",
          descricao: `${rec.description} — R$ ${Number(payment.value).toFixed(2)} confirmado via Asaas`,
          tipo: "sucesso",
          entidade_tipo: "conta_receber",
          entidade_id: rec.id,
        });
      }
    }

    return new Response("ok", { status: 200, headers: corsHeaders });
  } catch (e) {
    console.error("[asaas-webhook] error:", e);
    return new Response("error", { status: 500 });
  }
});
