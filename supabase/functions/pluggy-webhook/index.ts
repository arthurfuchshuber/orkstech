import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { jsonResponse, verifyPluggyWebhookSecret } from '../_shared/security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-pluggy-webhook-secret, x-webhook-secret',
}

async function getPluggyApiKey(): Promise<string> {
  const res = await fetch('https://api.pluggy.ai/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: Deno.env.get('PLUGGY_CLIENT_ID')!,
      clientSecret: Deno.env.get('PLUGGY_CLIENT_SECRET')!,
    }),
  })
  if (!res.ok) throw new Error('Pluggy auth failed')
  const { apiKey } = await res.json()
  return apiKey
}

function createServiceClient(): any {
  return createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
}

// ─── Conciliação automática ────────────────────────────────────────
// Tenta vincular uma transação bancária a uma conta a pagar existente.
// Match por: valor absoluto igual + data próxima ao vencimento (±5 dias).
// Se encontrar, marca a conta como paga e a transação como conciliada.
async function tryReconcile(
  supabase: any,
  tx: { id: string; amount: number; date: string; description: string },
  userId: string
) {
  // Só concilia débitos (saídas de dinheiro = pagamentos)
  const absAmount = Math.abs(tx.amount)
  if (absAmount === 0) return null

  const txDate = new Date(tx.date)
  const minDate = new Date(txDate)
  minDate.setDate(minDate.getDate() - 5)
  const maxDate = new Date(txDate)
  maxDate.setDate(maxDate.getDate() + 5)

  // Busca contas a pagar pendentes/vencidas com mesmo valor
  const { data: candidates } = await supabase
    .from('accounts_payable')
    .select('id, description, amount, due_date, supplier_name')
    .eq('user_id', userId)
    .in('status', ['pending', 'overdue'])
    .gte('due_date', minDate.toISOString().split('T')[0])
    .lte('due_date', maxDate.toISOString().split('T')[0])

  if (!candidates || candidates.length === 0) return null

  // Filtra por valor igual (tolerância de 1 centavo)
  const match = candidates.find((c: any) => Math.abs(c.amount - absAmount) < 0.02)
  if (!match) return null

  // Baixa automática
  await supabase
    .from('accounts_payable')
    .update({
      status: 'paid',
      payment_date: tx.date,
    })
    .eq('id', match.id)

  // Marca transação como conciliada
  await supabase
    .from('pluggy_transactions')
    .update({
      reconciled: true,
      reconciled_payable_id: match.id,
    })
    .eq('id', tx.id)

  // Cria cash_transaction
  await supabase.from('cash_transactions').insert({
    user_id: userId,
    type: 'expense',
    amount: absAmount,
    transaction_date: tx.date,
    description: `Conciliação automática: ${match.description}`,
    account_payable_id: match.id,
  })

  console.log(`Reconciled tx ${tx.id} with payable ${match.id} (${match.description}, R$${absAmount})`)
  return match
}

// ─── Notificações persistentes ─────────────────────────────────────
// Salva notificações no banco para que o frontend possa exibi-las em tempo real.
// Usamos uma tabela dedicada ou, como o Event Bus é client-side,
// utilizamos a tabela pluggy_webhooks_log como fonte para o frontend polling.
// Para notificações reais, vamos inserir na pluggy_webhooks_log com um campo processável.

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (!verifyPluggyWebhookSecret(req)) {
    return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)
  }

  const supabase = createServiceClient()

  try {
    const body = await req.json()
    const { event, itemId } = body

    console.log(`Webhook received: event=${event}, itemId=${itemId}`)

    // Log webhook
    const { data: logEntry } = await supabase.from('pluggy_webhooks_log').insert({
      event_type: event,
      item_id: itemId,
      payload: body,
    }).select('id').single()

    if (!itemId) {
      return new Response(JSON.stringify({ ok: true, message: 'No itemId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find connection owner
    const { data: connection } = await supabase
      .from('pluggy_connections')
      .select('*')
      .eq('pluggy_item_id', itemId)
      .single()

    if (!connection) {
      console.error(`No connection found for itemId=${itemId}`)
      if (logEntry) {
        await supabase.from('pluggy_webhooks_log')
          .update({ error_message: 'Connection not found' })
          .eq('id', logEntry.id)
      }
      return new Response(JSON.stringify({ ok: true, message: 'Connection not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = connection.user_id
    const apiKey = await getPluggyApiKey()
    const pluggyHeaders = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }

    const notifications: Array<{ tipo: string; titulo: string; descricao: string }> = []

    // Handle events
    if (event === 'item/updated' || event === 'ITEM_UPDATED') {
      const result = await processItemUpdated(supabase, pluggyHeaders, itemId, userId, connection.id)
      if (result.newTransactions > 0) {
        notifications.push({
          tipo: 'informacao',
          titulo: 'Transações sincronizadas',
          descricao: `${result.newTransactions} nova(s) transação(ões) importada(s) de ${connection.connector_name || 'banco conectado'}.`,
        })
      }
      if (result.reconciledCount > 0) {
        notifications.push({
          tipo: 'informacao',
          titulo: 'Conciliação automática',
          descricao: `${result.reconciledCount} conta(s) a pagar foi(ram) baixada(s) automaticamente.`,
        })
      }
      if (result.creditCards.length > 0) {
        for (const cc of result.creditCards) {
          notifications.push({
            tipo: 'alerta',
            titulo: `Cartão ${cc.name} atualizado`,
            descricao: `Fatura: R$ ${cc.billAmount?.toFixed(2) || '0,00'} | Venc.: ${cc.billDueDate || 'N/A'} | Limite disp.: R$ ${cc.available?.toFixed(2) || '0,00'}`,
          })
        }
      }
      notifications.push({
        tipo: 'informacao',
        titulo: 'Saldos atualizados',
        descricao: `${result.accountCount} conta(s) de ${connection.connector_name || 'banco'} sincronizada(s) com sucesso.`,
      })
    } else if (event === 'item/error' || event === 'ITEM_ERROR') {
      await supabase.from('pluggy_connections')
        .update({ status: 'error' })
        .eq('id', connection.id)
      notifications.push({
        tipo: 'alerta',
        titulo: 'Erro na conexão bancária',
        descricao: `A conexão com ${connection.connector_name || 'banco'} apresentou um erro. Reconecte para continuar recebendo dados.`,
      })
    } else if (event === 'transactions/updated' || event === 'TRANSACTIONS_UPDATED') {
      const result = await processTransactionsOnly(supabase, pluggyHeaders, itemId, userId)
      if (result.newTransactions > 0) {
        notifications.push({
          tipo: 'informacao',
          titulo: 'Novas transações',
          descricao: `${result.newTransactions} nova(s) transação(ões) recebida(s) de ${connection.connector_name || 'banco'}.`,
        })
      }
      if (result.reconciledCount > 0) {
        notifications.push({
          tipo: 'informacao',
          titulo: 'Conciliação automática',
          descricao: `${result.reconciledCount} conta(s) a pagar baixada(s) automaticamente.`,
        })
      }
    }

    // Persist notifications in dedicated table
    if (notifications.length > 0) {
      const notifRows = notifications.map((n) => ({
        user_id: userId,
        tipo: n.tipo,
        titulo: n.titulo,
        descricao: n.descricao,
        webhook_log_id: logEntry?.id || null,
      }))
      const { error: notifError } = await supabase.from('pluggy_notifications').insert(notifRows)
      if (notifError) console.error('Failed to insert notifications:', notifError)
    }

    // Mark webhook as processed
    if (logEntry) {
      await supabase.from('pluggy_webhooks_log')
        .update({ processed: true })
        .eq('id', logEntry.id)
    }

    console.log(`Webhook processed. Notifications: ${notifications.length}`)

    return new Response(JSON.stringify({ ok: true, notifications: notifications.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: 'Erro interno ao processar webhook.' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

// ─── Process item updated (accounts + transactions + reconciliation) ───
async function processItemUpdated(
  supabase: any,
  pluggyHeaders: Record<string, string>,
  itemId: string,
  userId: string,
  connectionId: string
): Promise<{
  accountCount: number
  newTransactions: number
  reconciledCount: number
  creditCards: Array<{ name: string; billAmount: number | null; billDueDate: string | null; available: number | null }>
}> {
  // Fetch accounts + item in parallel
  const [accountsRes, itemRes] = await Promise.all([
    fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, { headers: pluggyHeaders }),
    fetch(`https://api.pluggy.ai/items/${itemId}`, { headers: pluggyHeaders }),
  ])

  let connectorName: string | null = null
  if (itemRes.ok) {
    const item = await itemRes.json()
    connectorName = item.connector?.name || null
  } else {
    await itemRes.text() // consume body
  }

  if (!accountsRes.ok) {
    const errText = await accountsRes.text()
    console.error('Failed to fetch accounts:', errText)
    return { accountCount: 0, newTransactions: 0, reconciledCount: 0, creditCards: [] }
  }

  const { results: accounts } = await accountsRes.json()

  // Update connection
  await supabase.from('pluggy_connections').update({
    status: 'connected',
    last_sync_at: new Date().toISOString(),
    connector_name: connectorName,
  }).eq('id', connectionId)

  const creditCards: Array<{ name: string; billAmount: number | null; billDueDate: string | null; available: number | null }> = []

  // Upsert accounts
  for (const account of accounts || []) {
    const creditData = account.creditData || {}
    const accountData: Record<string, unknown> = {
      user_id: userId,
      connection_id: connectionId,
      pluggy_item_id: itemId,
      pluggy_account_id: account.id,
      name: account.name || 'Conta',
      type: account.type || 'BANK',
      subtype: account.subtype || null,
      balance: account.balance ?? 0,
      currency_code: account.currencyCode || 'BRL',
      bank_data: {
        ...(account.bankData || {}),
        creditData,
        owner: account.owner || null,
        taxNumber: account.taxNumber || null,
        marketingName: account.marketingName || null,
        number: account.number || null,
      },
    }

    // Credit card data
    if (account.type === 'CREDIT') {
      accountData.credit_limit = creditData.limit ?? null
      accountData.credit_available = creditData.availableCreditLimit ?? null
      accountData.credit_bill_amount = creditData.balanceClose ?? null
      accountData.credit_bill_due_date = creditData.balanceCloseDate?.split('T')[0] ?? null

      creditCards.push({
        name: account.name || 'Cartão',
        billAmount: creditData.balanceClose ?? null,
        billDueDate: creditData.balanceCloseDate?.split('T')[0] ?? null,
        available: creditData.availableCreditLimit ?? null,
      })
    }

    const { data: existing } = await supabase
      .from('pluggy_bank_accounts')
      .select('id')
      .eq('pluggy_account_id', account.id)
      .maybeSingle()

    if (existing) {
      await supabase.from('pluggy_bank_accounts').update(accountData).eq('id', existing.id)
    } else {
      await supabase.from('pluggy_bank_accounts').insert(accountData)
    }
  }

  // Process transactions with reconciliation
  const txResult = await processTransactionsOnly(supabase, pluggyHeaders, itemId, userId)

  console.log(`Processed ${accounts?.length || 0} accounts, ${txResult.newTransactions} new txs, ${txResult.reconciledCount} reconciled`)

  return {
    accountCount: accounts?.length || 0,
    newTransactions: txResult.newTransactions,
    reconciledCount: txResult.reconciledCount,
    creditCards,
  }
}

// ─── Process transactions with auto-reconciliation ───
async function processTransactionsOnly(
  supabase: any,
  pluggyHeaders: Record<string, string>,
  itemId: string,
  userId: string
): Promise<{ newTransactions: number; reconciledCount: number }> {
  const { data: accounts } = await supabase
    .from('pluggy_bank_accounts')
    .select('pluggy_account_id')
    .eq('pluggy_item_id', itemId)
    .eq('user_id', userId)

  if (!accounts || accounts.length === 0) {
    console.log('No accounts found for transaction sync')
    return { newTransactions: 0, reconciledCount: 0 }
  }

  let totalNew = 0
  let totalReconciled = 0

  for (const account of accounts) {
    const now = new Date()
    const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const to = now.toISOString().split('T')[0]

    const txRes = await fetch(
      `https://api.pluggy.ai/transactions?accountId=${account.pluggy_account_id}&from=${from}&to=${to}&pageSize=500`,
      { headers: pluggyHeaders }
    )

    if (!txRes.ok) {
      const errText = await txRes.text()
      console.error(`Failed to fetch transactions for ${account.pluggy_account_id}:`, errText)
      continue
    }

    const { results: transactions } = await txRes.json()

    for (const tx of transactions || []) {
      const { data: existing } = await supabase
        .from('pluggy_transactions')
        .select('id')
        .eq('pluggy_transaction_id', tx.id)
        .maybeSingle()

      if (!existing) {
        const { data: inserted } = await supabase.from('pluggy_transactions').insert({
          user_id: userId,
          pluggy_account_id: account.pluggy_account_id,
          pluggy_transaction_id: tx.id,
          description: tx.description || tx.descriptionRaw || '',
          amount: tx.amount ?? 0,
          date: tx.date?.split('T')[0] || new Date().toISOString().split('T')[0],
          type: tx.type || 'DEBIT',
          category: tx.category || null,
          payment_data: tx.paymentData || {},
        }).select('id, amount, date, description').single()

        totalNew++

        // Try auto-reconciliation for debit transactions (payments)
        if (inserted && (tx.type === 'DEBIT' || tx.amount < 0)) {
          const reconciled = await tryReconcile(supabase, {
            id: inserted.id,
            amount: inserted.amount,
            date: inserted.date,
            description: inserted.description || '',
          }, userId)
          if (reconciled) totalReconciled++
        }
      }
    }
  }

  console.log(`Synced ${totalNew} new transactions, ${totalReconciled} reconciled for itemId=${itemId}`)
  return { newTransactions: totalNew, reconciledCount: totalReconciled }
}
