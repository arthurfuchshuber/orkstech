// Asaas API proxy - manages credentials, customers and payments
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    // ============ TEST CONNECTION (no creds required) ============
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
    // NOTE: lifecycle actions (sync_history, purge_history) must work even if `ativo=false`,
    // because they are triggered immediately after toggling the integration off/on.
    const lifecycleAction = action === "sync_history" || action === "purge_history";
    let credQuery = serviceClient
      .from("integracoes_credenciais")
      .select("id, api_key, ambiente, empresa_id")
      .eq("user_id", userId)
      .eq("provider", "asaas");
    if (!lifecycleAction) credQuery = credQuery.eq("ativo", true);
    if (empresa_id) credQuery = credQuery.eq("empresa_id", empresa_id);
    const { data: creds, error: credErr } = await credQuery.limit(1).maybeSingle();
    if (credErr) throw credErr;
    if (!creds) throw new Error("Asaas não configurado para esta empresa");
    const cred = creds as CredRow;

    // ============ HELPER: ensure customer exists & is up-to-date ============
    async function ensureAsaasCustomer(cliente: any): Promise<string> {
      const cpfCnpj = onlyDigits(cliente.tipo === "pf" ? cliente.cpf : cliente.cnpj);
      if (!cpfCnpj) throw new Error("Cliente sem CPF/CNPJ cadastrado");

      const nome = cliente.tipo === "pf"
        ? cliente.nome_completo
        : (cliente.nome_fantasia || cliente.razao_social);
      if (!nome) throw new Error("Cliente sem nome cadastrado");

      const payload: Record<string, unknown> = {
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

      const search = await asaasFetch(cred, `/customers?cpfCnpj=${cpfCnpj}`);
      if (search?.data?.length > 0) {
        const existingId = search.data[0].id;
        // Update with latest local data
        try {
          await asaasFetch(cred, `/customers/${existingId}`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
        } catch (e) {
          console.warn("[asaas-api] customer update failed, continuing:", e);
        }
        return existingId;
      }

      const created = await asaasFetch(cred, "/customers", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return created.id;
    }

    // ============ HELPER: create one payment for a receivable id ============
    async function createPaymentForReceivable(receivableId: string, billingType: string) {
      const { data: rec, error: recErr } = await serviceClient
        .from("accounts_receivable")
        .select("*")
        .eq("id", receivableId)
        .eq("user_id", userId)
        .single();
      if (recErr || !rec) throw new Error(`Lançamento ${receivableId} não encontrado`);
      if (!rec.cliente_id) throw new Error("Lançamento precisa estar vinculado a um cliente");

      // Skip if already has an active charge
      const { data: existingCob } = await serviceClient
        .from("asaas_cobrancas")
        .select("id, status")
        .eq("account_receivable_id", rec.id)
        .not("status", "in", "(CANCELED,REFUNDED)")
        .maybeSingle();
      if (existingCob) {
        return { skipped: true, reason: "Já existe cobrança ativa", cobranca_id: existingCob.id };
      }

      const { data: cliente, error: cliErr } = await serviceClient
        .from("clientes")
        .select("*")
        .eq("id", rec.cliente_id)
        .eq("user_id", userId)
        .single();
      if (cliErr || !cliente) throw new Error("Cliente não encontrado");

      const asaasCustomerId = await ensureAsaasCustomer(cliente);

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

      let pixQr: any = null;
      if (billingType === "PIX") {
        try { pixQr = await asaasFetch(cred, `/payments/${payment.id}/pixQrCode`); } catch { /* ignore */ }
      }

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

      await serviceClient.from("cliente_interacoes").insert({
        user_id: userId,
        cliente_id: rec.cliente_id,
        empresa_id: rec.empresa_id,
        tipo: "financeiro",
        descricao: `Cobrança gerada no Asaas (${billingType}). Valor: R$ ${Number(rec.amount).toFixed(2)} • Vencimento: ${rec.due_date}`,
        usuario_nome: "Sistema",
      });

      return { cobranca, payment };
    }

    // ============ CREATE PAYMENT (single) ============
    if (action === "create_payment") {
      const { receivable_id } = body;
      if (!receivable_id) throw new Error("receivable_id obrigatório");
      const billingType = (body.billing_type || "BOLETO").toUpperCase();
      if (!["BOLETO", "PIX", "CREDIT_CARD"].includes(billingType)) {
        throw new Error("billing_type inválido");
      }
      const result = await createPaymentForReceivable(receivable_id, billingType);
      return new Response(JSON.stringify({ success: true, ...result }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ CREATE PAYMENTS BULK (uma por parcela) ============
    if (action === "create_payments_bulk") {
      const { receivable_ids, billing_type } = body;
      if (!Array.isArray(receivable_ids) || receivable_ids.length === 0) {
        throw new Error("receivable_ids deve ser um array não vazio");
      }
      const billingType = (billing_type || "BOLETO").toUpperCase();
      if (!["BOLETO", "PIX", "CREDIT_CARD"].includes(billingType)) {
        throw new Error("billing_type inválido");
      }

      const results: Array<{ receivable_id: string; success: boolean; error?: string; cobranca_id?: string }> = [];
      for (const rid of receivable_ids) {
        try {
          const r = await createPaymentForReceivable(rid, billingType);
          results.push({ receivable_id: rid, success: true, cobranca_id: (r as any).cobranca?.id || (r as any).cobranca_id });
        } catch (e) {
          results.push({ receivable_id: rid, success: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
      const okCount = results.filter(r => r.success).length;
      return new Response(JSON.stringify({ success: true, total: results.length, ok: okCount, results }), {
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

    // ============ SYNC HISTORY (full backfill of all charges) ============
    if (action === "sync_history") {
      let offset = 0;
      const limit = 100;
      let totalFetched = 0;
      let inserted = 0;
      let updated = 0;

      while (true) {
        const page = await asaasFetch(cred, `/payments?limit=${limit}&offset=${offset}`);
        const list: any[] = page?.data || [];
        if (list.length === 0) break;
        totalFetched += list.length;

        for (const payment of list) {
          // Check if already exists locally
          const { data: existing } = await serviceClient
            .from("asaas_cobrancas")
            .select("id")
            .eq("user_id", userId)
            .eq("asaas_payment_id", payment.id)
            .maybeSingle();

          // Try linking to a local receivable via externalReference
          let accountReceivableId: string | null = null;
          let clienteIdLocal: string | null = null;
          let empresaIdLocal: string | null = cred.empresa_id;

          if (payment.externalReference) {
            const { data: rec } = await serviceClient
              .from("accounts_receivable")
              .select("id, cliente_id, empresa_id")
              .eq("id", payment.externalReference)
              .eq("user_id", userId)
              .maybeSingle();
            if (rec) {
              accountReceivableId = rec.id;
              clienteIdLocal = rec.cliente_id;
              empresaIdLocal = rec.empresa_id || empresaIdLocal;
            }
          }

          // Link/Create local cliente from Asaas customer (CPF=PF / CNPJ=PJ)
          if (!clienteIdLocal && payment.customer) {
            try {
              const cust = await asaasFetch(cred, `/customers/${payment.customer}`);
              const doc = onlyDigits(cust?.cpfCnpj);
              if (doc) {
                const isPF = doc.length === 11;
                const tipo = isPF ? "pf" : "pj";

                // Try to find existing cliente by document
                const { data: cli } = await serviceClient
                  .from("clientes")
                  .select("id, empresa_id")
                  .eq("user_id", userId)
                  .or(`cpf.eq.${doc},cnpj.eq.${doc}`)
                  .maybeSingle();

                if (cli) {
                  clienteIdLocal = cli.id;
                  empresaIdLocal = cli.empresa_id || empresaIdLocal;
                } else {
                  // Auto-create cliente from Asaas data
                  const nome = (cust?.name || "Cliente Asaas").toString().trim().slice(0, 120);
                  const insertCliente: Record<string, unknown> = {
                    user_id: userId,
                    empresa_id: empresaIdLocal,
                    tipo,
                    email: cust?.email || null,
                    telefone: cust?.phone || null,
                    whatsapp: cust?.mobilePhone || null,
                    cep: onlyDigits(cust?.postalCode) || null,
                    logradouro: cust?.address || null,
                    numero: cust?.addressNumber || null,
                    complemento: cust?.complement || null,
                    bairro: cust?.province || null,
                    cidade: cust?.city || null,
                    estado: cust?.state || null,
                    observacoes: "Importado automaticamente do Asaas",
                  };
                  if (isPF) {
                    insertCliente.cpf = doc;
                    insertCliente.nome_completo = nome.toUpperCase();
                  } else {
                    insertCliente.cnpj = doc;
                    insertCliente.razao_social = nome.toUpperCase();
                    insertCliente.nome_fantasia = nome.toUpperCase();
                  }
                  const { data: newCli, error: cliErr } = await serviceClient
                    .from("clientes")
                    .insert(insertCliente)
                    .select("id")
                    .single();
                  if (!cliErr && newCli) clienteIdLocal = newCli.id;
                }
              }
            } catch (e) {
              console.warn("[asaas-api] customer lookup/create failed:", (e as Error).message);
            }
          }

          // ===== Auto-create local accounts_receivable so charges show in Contas a Receber / Dashboard =====
          const isPaid = ["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH"].includes(payment.status);
          const isOverdue = payment.status === "OVERDUE";
          const localStatus = isPaid ? "paid" : isOverdue ? "overdue" : "pending";
          const localPaymentDate = payment.paymentDate || payment.clientPaymentDate || payment.confirmedDate || null;

          // Resolve payer name (supplier_name) from local client when available
          let payerName: string | null = null;
          let payerPessoaTipo: "pf" | "pj" = "pj";
          if (clienteIdLocal) {
            const { data: cliRow } = await serviceClient
              .from("clientes")
              .select("tipo, nome_completo, razao_social, nome_fantasia")
              .eq("id", clienteIdLocal)
              .maybeSingle();
            if (cliRow) {
              payerPessoaTipo = (cliRow.tipo as "pf" | "pj") || "pj";
              payerName = cliRow.tipo === "pf"
                ? (cliRow.nome_completo || null)
                : (cliRow.nome_fantasia || cliRow.razao_social || null);
            }
          }

          if (!accountReceivableId) {
            // Anti-duplicidade: procura receivable existente por document_number = payment.id
            // (caso a integração tenha sido purgada e reativada, ou registro criado manualmente antes)
            const { data: existingRec } = await serviceClient
              .from("accounts_receivable")
              .select("id")
              .eq("user_id", userId)
              .eq("document_number", payment.id)
              .maybeSingle();

            if (existingRec) {
              accountReceivableId = existingRec.id;
              await serviceClient
                .from("accounts_receivable")
                .update({
                  status: localStatus,
                  payment_date: localPaymentDate,
                  cliente_id: clienteIdLocal,
                  supplier_name: payerName,
                  pessoa_tipo: payerPessoaTipo,
                  amount: Number(payment.value) || 0,
                  due_date: payment.dueDate,
                })
                .eq("id", existingRec.id);
            } else {
              const description = payment.description || `Cobrança Asaas ${payment.id}`;
              const { data: newRec } = await serviceClient
                .from("accounts_receivable")
                .insert({
                  user_id: userId,
                  empresa_id: empresaIdLocal,
                  cliente_id: clienteIdLocal,
                  supplier_name: payerName,
                  description,
                  amount: Number(payment.value) || 0,
                  due_date: payment.dueDate,
                  payment_date: localPaymentDate,
                  status: localStatus,
                  document_number: payment.id,
                  pessoa_tipo: payerPessoaTipo,
                  notes: `Importado do Asaas (${payment.billingType || "UNDEFINED"})`,
                })
                .select("id")
                .single();
              if (newRec) accountReceivableId = newRec.id;
            }
          } else {
            await serviceClient
              .from("accounts_receivable")
              .update({
                status: localStatus,
                payment_date: localPaymentDate,
                cliente_id: clienteIdLocal,
                supplier_name: payerName,
                pessoa_tipo: payerPessoaTipo,
              })
              .eq("id", accountReceivableId);
          }

          const row = {
            user_id: userId,
            empresa_id: empresaIdLocal,
            account_receivable_id: accountReceivableId,
            cliente_id: clienteIdLocal,
            asaas_customer_id: payment.customer || null,
            asaas_payment_id: payment.id,
            billing_type: payment.billingType || "UNDEFINED",
            status: payment.status || "PENDING",
            value: Number(payment.value) || 0,
            due_date: payment.dueDate,
            payment_date: localPaymentDate,
            invoice_url: payment.invoiceUrl || null,
            bank_slip_url: payment.bankSlipUrl || null,
            identification_field: payment.identificationField || null,
            raw_data: payment,
          };

          if (existing) {
            await serviceClient.from("asaas_cobrancas").update(row).eq("id", existing.id);
            updated++;
          } else {
            await serviceClient.from("asaas_cobrancas").insert(row);
            inserted++;
          }
        }

        if (list.length < limit) break;
        offset += limit;
        if (offset > 5000) break; // safety guard
      }

      return new Response(JSON.stringify({ success: true, totalFetched, inserted, updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ PURGE HISTORY (delete all local charges for this user/empresa) ============
    if (action === "purge_history") {
      // 1) Collect linked receivable IDs that came from Asaas import
      let listQ = serviceClient
        .from("asaas_cobrancas")
        .select("id, account_receivable_id")
        .eq("user_id", userId);
      if (cred.empresa_id) listQ = listQ.eq("empresa_id", cred.empresa_id);
      const { data: cobs } = await listQ;
      const receivableIds = (cobs ?? [])
        .map((c: any) => c.account_receivable_id)
        .filter((id: any): id is string => !!id);

      // 2) Delete cobranças first (FK-safe)
      let delQ = serviceClient.from("asaas_cobrancas").delete().eq("user_id", userId);
      if (cred.empresa_id) delQ = delQ.eq("empresa_id", cred.empresa_id);
      const { error: delErr, count } = await delQ;
      if (delErr) throw delErr;

      // 3) Delete the auto-imported receivables (only those flagged "Importado do Asaas")
      let deletedRecs = 0;
      if (receivableIds.length > 0) {
        const { count: rc } = await serviceClient
          .from("accounts_receivable")
          .delete({ count: "exact" })
          .in("id", receivableIds)
          .like("notes", "Importado do Asaas%");
        deletedRecs = rc ?? 0;
      }

      return new Response(JSON.stringify({ success: true, deleted: count ?? null, deletedReceivables: deletedRecs }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ UPDATE CUSTOMER (push local cliente changes to Asaas) ============
    if (action === "update_customer") {
      const { cliente_id } = body;
      if (!cliente_id) throw new Error("cliente_id obrigatório");

      const { data: cliente, error: cliErr } = await serviceClient
        .from("clientes")
        .select("*")
        .eq("id", cliente_id)
        .eq("user_id", userId)
        .single();
      if (cliErr || !cliente) throw new Error("Cliente não encontrado");

      const cpfCnpj = onlyDigits(cliente.tipo === "pf" ? cliente.cpf : cliente.cnpj);
      if (!cpfCnpj) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "Cliente sem CPF/CNPJ" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Find existing customer in Asaas by cpfCnpj
      const search = await asaasFetch(cred, `/customers?cpfCnpj=${cpfCnpj}`);
      if (!search?.data?.length) {
        return new Response(JSON.stringify({ success: true, skipped: true, reason: "Cliente não existe no Asaas" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const asaasCustomerId = search.data[0].id;

      const nome = cliente.tipo === "pf"
        ? cliente.nome_completo
        : (cliente.nome_fantasia || cliente.razao_social);

      const payload: Record<string, unknown> = {
        name: nome || undefined,
        cpfCnpj,
        email: cliente.email || undefined,
        phone: onlyDigits(cliente.telefone) || undefined,
        mobilePhone: onlyDigits(cliente.whatsapp || cliente.telefone) || undefined,
        postalCode: onlyDigits(cliente.cep) || undefined,
        address: cliente.logradouro || undefined,
        addressNumber: cliente.numero || undefined,
        complement: cliente.complemento || undefined,
        province: cliente.bairro || undefined,
      };

      const updated = await asaasFetch(cred, `/customers/${asaasCustomerId}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      // Update asaas_cobrancas with latest customer id reference (for safety)
      await serviceClient.from("asaas_cobrancas")
        .update({ asaas_customer_id: asaasCustomerId })
        .eq("user_id", userId)
        .eq("cliente_id", cliente_id);

      return new Response(JSON.stringify({ success: true, asaas_customer_id: asaasCustomerId, customer: updated }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ============ UPDATE PAYMENT (push local receivable changes to Asaas) ============
    if (action === "update_payment") {
      const { receivable_id, scope } = body;
      if (!receivable_id) throw new Error("receivable_id obrigatório");
      const editScope = scope === "group" ? "group" : "single";

      // Resolve target receivable IDs
      let targetIds: string[] = [receivable_id];
      if (editScope === "group") {
        const { data: rec } = await serviceClient
          .from("accounts_receivable")
          .select("grupo_id")
          .eq("id", receivable_id)
          .eq("user_id", userId)
          .maybeSingle();
        if (rec?.grupo_id) {
          const { data: siblings } = await serviceClient
            .from("accounts_receivable")
            .select("id")
            .eq("user_id", userId)
            .eq("grupo_id", rec.grupo_id);
          targetIds = (siblings ?? []).map((s: any) => s.id);
        }
      }

      const results: Array<{ id: string; success: boolean; skipped?: boolean; reason?: string; error?: string }> = [];
      for (const rid of targetIds) {
        try {
          const { data: rec } = await serviceClient
            .from("accounts_receivable")
            .select("id, amount, due_date, description")
            .eq("id", rid)
            .eq("user_id", userId)
            .maybeSingle();
          if (!rec) { results.push({ id: rid, success: false, error: "não encontrada" }); continue; }

          const { data: cob } = await serviceClient
            .from("asaas_cobrancas")
            .select("id, asaas_payment_id, status")
            .eq("account_receivable_id", rid)
            .eq("user_id", userId)
            .maybeSingle();
          if (!cob) { results.push({ id: rid, success: true, skipped: true, reason: "sem cobrança Asaas" }); continue; }
          if (["RECEIVED", "CONFIRMED", "RECEIVED_IN_CASH", "REFUNDED"].includes(cob.status)) {
            results.push({ id: rid, success: true, skipped: true, reason: `status ${cob.status} não editável` });
            continue;
          }

          const payload = {
            value: Number(rec.amount),
            dueDate: rec.due_date,
            description: rec.description?.slice(0, 500) || undefined,
          };
          const updated = await asaasFetch(cred, `/payments/${cob.asaas_payment_id}`, {
            method: "POST",
            body: JSON.stringify(payload),
          });
          await serviceClient.from("asaas_cobrancas")
            .update({
              value: updated.value,
              due_date: updated.dueDate,
              status: updated.status || cob.status,
              raw_data: updated,
            })
            .eq("id", cob.id);
          results.push({ id: rid, success: true });
        } catch (e) {
          results.push({ id: rid, success: false, error: e instanceof Error ? e.message : String(e) });
        }
      }
      const ok = results.filter(r => r.success && !r.skipped).length;
      return new Response(JSON.stringify({ success: true, total: results.length, ok, results }), {
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
