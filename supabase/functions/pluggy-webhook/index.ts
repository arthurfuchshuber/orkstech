import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Use service role for webhook processing
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const body = await req.json()
    const { event, itemId } = body

    console.log(`Webhook received: event=${event}, itemId=${itemId}`)

    // Log the webhook
    await supabase.from('pluggy_webhooks_log').insert({
      event_type: event,
      item_id: itemId,
      payload: body,
    })

    if (!itemId) {
      return new Response(JSON.stringify({ ok: true, message: 'No itemId' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Find the connection owner
    const { data: connection } = await supabase
      .from('pluggy_connections')
      .select('*')
      .eq('pluggy_item_id', itemId)
      .single()

    if (!connection) {
      console.error(`No connection found for itemId=${itemId}`)
      await supabase.from('pluggy_webhooks_log').update({ error_message: 'Connection not found' })
        .eq('item_id', itemId).eq('processed', false).order('created_at', { ascending: false }).limit(1)
      return new Response(JSON.stringify({ ok: true, message: 'Connection not found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userId = connection.user_id
    const apiKey = await getPluggyApiKey()
    const pluggyHeaders = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }

    // Handle different events
    if (event === 'item/updated' || event === 'ITEM_UPDATED') {
      await processItemUpdated(supabase, pluggyHeaders, itemId, userId, connection.id)
    } else if (event === 'item/error' || event === 'ITEM_ERROR') {
      await supabase.from('pluggy_connections')
        .update({ status: 'error' })
        .eq('id', connection.id)
      console.log(`Connection ${connection.id} marked as error`)
    } else if (event === 'transactions/updated' || event === 'TRANSACTIONS_UPDATED') {
      await processTransactions(supabase, pluggyHeaders, itemId, userId)
    }

    // Mark webhook as processed
    await supabase.from('pluggy_webhooks_log')
      .update({ processed: true })
      .eq('item_id', itemId)
      .eq('event_type', event)
      .eq('processed', false)
      .order('created_at', { ascending: false })
      .limit(1)

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Webhook error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})

async function processItemUpdated(
  supabase: any,
  pluggyHeaders: Record<string, string>,
  itemId: string,
  userId: string,
  connectionId: string
) {
  // Fetch accounts from Pluggy
  const accountsRes = await fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, { headers: pluggyHeaders })
  if (!accountsRes.ok) {
    console.error('Failed to fetch accounts:', accountsRes.status)
    return
  }
  const { results: accounts } = await accountsRes.json()

  // Fetch item details for connector name
  const itemRes = await fetch(`https://api.pluggy.ai/items/${itemId}`, { headers: pluggyHeaders })
  let connectorName = null
  if (itemRes.ok) {
    const item = await itemRes.json()
    connectorName = item.connector?.name
  }

  // Update connection
  await supabase.from('pluggy_connections').update({
    status: 'connected',
    last_sync_at: new Date().toISOString(),
    connector_name: connectorName,
  }).eq('id', connectionId)

  // Upsert accounts
  for (const account of accounts || []) {
    const accountData: Record<string, unknown> = {
      user_id: userId,
      connection_id: connectionId,
      pluggy_item_id: itemId,
      pluggy_account_id: account.id,
      name: account.name || 'Conta',
      type: account.type || 'BANK',
      subtype: account.subtype || null,
      balance: account.balance || 0,
      currency_code: account.currencyCode || 'BRL',
      bank_data: account.bankData || {},
    }

    // Credit card specific fields
    if (account.type === 'CREDIT') {
      accountData.credit_limit = account.creditData?.limit || null
      accountData.credit_available = account.creditData?.availableCreditLimit || null
      accountData.credit_bill_amount = account.creditData?.balanceClose || null
      accountData.credit_bill_due_date = account.creditData?.balanceCloseDate || null
    }

    // Upsert by pluggy_account_id
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

  // Also fetch transactions for each account
  await processTransactions(supabase, pluggyHeaders, itemId, userId)

  console.log(`Processed ${accounts?.length || 0} accounts for itemId=${itemId}`)
}

async function processTransactions(
  supabase: any,
  pluggyHeaders: Record<string, string>,
  itemId: string,
  userId: string
) {
  // Get all accounts for this item
  const { data: accounts } = await supabase
    .from('pluggy_bank_accounts')
    .select('pluggy_account_id')
    .eq('pluggy_item_id', itemId)
    .eq('user_id', userId)

  if (!accounts || accounts.length === 0) {
    console.log('No accounts found for transaction sync')
    return
  }

  let totalNew = 0

  for (const account of accounts) {
    // Fetch last 90 days of transactions
    const now = new Date()
    const from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const to = now.toISOString().split('T')[0]

    const txRes = await fetch(
      `https://api.pluggy.ai/transactions?accountId=${account.pluggy_account_id}&from=${from}&to=${to}&pageSize=500`,
      { headers: pluggyHeaders }
    )

    if (!txRes.ok) {
      console.error(`Failed to fetch transactions for account ${account.pluggy_account_id}:`, txRes.status)
      continue
    }

    const { results: transactions } = await txRes.json()

    for (const tx of transactions || []) {
      // Check if already exists
      const { data: existing } = await supabase
        .from('pluggy_transactions')
        .select('id')
        .eq('pluggy_transaction_id', tx.id)
        .maybeSingle()

      if (!existing) {
        await supabase.from('pluggy_transactions').insert({
          user_id: userId,
          pluggy_account_id: account.pluggy_account_id,
          pluggy_transaction_id: tx.id,
          description: tx.description || tx.descriptionRaw || '',
          amount: tx.amount || 0,
          date: tx.date?.split('T')[0] || new Date().toISOString().split('T')[0],
          type: tx.type || 'DEBIT',
          category: tx.category || null,
          payment_data: tx.paymentData || {},
        })
        totalNew++
      }
    }
  }

  console.log(`Synced ${totalNew} new transactions for itemId=${itemId}`)
}
