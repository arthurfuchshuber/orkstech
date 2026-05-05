const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

async function fetchAllTransactions(apiKey: string, accountId: string): Promise<any[]> {
  const headers = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }
  const allTxs: any[] = []
  let page = 1
  const pageSize = 500

  while (true) {
    const url = `https://api.pluggy.ai/transactions?accountId=${accountId}&pageSize=${pageSize}&page=${page}`
    const res = await fetch(url, { headers })
    if (!res.ok) {
      console.error(`Transactions fetch error page ${page}: ${res.status}`)
      break
    }
    const data = await res.json()
    const results = data.results || []
    allTxs.push(...results)

    if (results.length < pageSize || allTxs.length >= (data.total || Infinity)) {
      break
    }
    page++
  }

  return allTxs
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = user.id

    const url = new URL(req.url)
    const itemId = url.searchParams.get('itemId')
    const action = url.searchParams.get('action') || 'full_sync'

    if (!itemId) {
      return new Response(JSON.stringify({ error: 'itemId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const apiKey = await getPluggyApiKey()
    const headers = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }

    // Step 1: Trigger item update at Pluggy to fetch fresh data from the bank
    const triggerUpdate = url.searchParams.get('skipUpdate') !== 'true'
    if (triggerUpdate) {
      console.log(`Triggering item update for ${itemId}...`)
      const updateRes = await fetch(`https://api.pluggy.ai/items/${itemId}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify({}),
      })
      if (updateRes.ok) {
        // Poll until item finishes updating (max ~60s)
        const maxWait = 60_000
        const pollInterval = 3_000
        const start = Date.now()
        while (Date.now() - start < maxWait) {
          await new Promise((r) => setTimeout(r, pollInterval))
          const checkRes = await fetch(`https://api.pluggy.ai/items/${itemId}`, { headers })
          if (!checkRes.ok) break
          const checkItem = await checkRes.json()
          console.log(`Item ${itemId} status: ${checkItem.status}`)
          if (checkItem.status === 'UPDATED' || checkItem.status === 'LOGIN_ERROR' || checkItem.status === 'OUTDATED') {
            break
          }
        }
      } else {
        console.warn(`Item update trigger failed (${updateRes.status}), proceeding with cached data`)
      }
    }

    // Step 2: Fetch item details, accounts, and investments from Pluggy
    const [itemRes, accountsRes, investmentsRes] = await Promise.all([
      fetch(`https://api.pluggy.ai/items/${itemId}`, { headers }),
      fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, { headers }),
      fetch(`https://api.pluggy.ai/investments?itemId=${itemId}&pageSize=500`, { headers }),
    ])
    if (!itemRes.ok) throw new Error(`Pluggy item error: ${itemRes.status}`)
    if (!accountsRes.ok) throw new Error(`Pluggy accounts error: ${accountsRes.status}`)

    const item = await itemRes.json()
    const accountsData = await accountsRes.json()
    const accounts = accountsData.results || []

    // Sum active investments and save individual investment details
    let totalInvestments = 0
    let investmentsList: any[] = []
    if (investmentsRes.ok) {
      const investmentsData = await investmentsRes.json()
      investmentsList = investmentsData.results || []
      // PADRÃO ÚNICO: usar 'balance' (valor líquido/resgatável) — o que o SaaS de fato exibe
      // como "Investimentos". Ignora 'amount' (bruto), pois mistura valor com IR provisionado.
      // Considera apenas posições ATIVAS (status ACTIVE), excluindo TOTAL_WITHDRAWAL.
      totalInvestments = investmentsList
        .filter((inv: any) => (inv.status || 'ACTIVE') === 'ACTIVE' && Number(inv.balance ?? 0) > 0)
        .reduce((sum: number, inv: any) => sum + Number(inv.balance ?? 0), 0)
      totalInvestments = Math.round(totalInvestments * 100) / 100
      console.log(`[pluggy-sync] Total investments (balance líquido) item ${itemId}: R$ ${totalInvestments} de ${investmentsList.length} investimentos`)
    }

    // Get connection and resolve the real owner user_id
    const { data: conn } = await supabaseAdmin
      .from('pluggy_connections')
      .select('id, user_id')
      .eq('pluggy_item_id', itemId)
      .maybeSingle()

    const connectionId = conn?.id || null
    // Use the connection owner's user_id (important for Super Admin syncing on behalf of another user)
    const ownerUserId = conn?.user_id || userId

    // Save individual investments with yield data
    let savedInvestments = 0
    if (investmentsList.length > 0) {
      const BATCH = 200
      for (let i = 0; i < investmentsList.length; i += BATCH) {
        const batch = investmentsList.slice(i, i + BATCH).map((inv: any) => ({
          user_id: ownerUserId,
          pluggy_item_id: itemId,
          pluggy_investment_id: inv.id,
          name: inv.name || 'Investimento',
          type: inv.type || null,
          subtype: inv.subtype || null,
          code: inv.code || null,
          issuer: inv.issuer || null,
          balance: inv.balance ?? 0,
          amount_original: inv.amountOriginal ?? null,
          amount_profit: inv.amountProfit ?? null,
          rate: inv.rate ?? null,
          rate_type: inv.rateType || null,
          fixed_annual_rate: inv.fixedAnnualRate ?? null,
          status: inv.status || 'ACTIVE',
          due_date: inv.dueDate ? inv.dueDate.split('T')[0] : null,
          currency_code: inv.currencyCode || 'BRL',
          investment_data: {
            value: inv.value ?? null,
            quantity: inv.quantity ?? null,
            taxes: inv.taxes ?? null,
            taxes2: inv.taxes2 ?? null,
            amount: inv.amount ?? null,
            amountWithdrawal: inv.amountWithdrawal ?? null,
            lastMonthRate: inv.lastMonthRate ?? null,
            lastTwelveMonthsRate: inv.lastTwelveMonthsRate ?? null,
            annualRate: inv.annualRate ?? null,
            owner: inv.owner || null,
            date: inv.date || null,
          },
          updated_at: new Date().toISOString(),
        }))

        const { error: invErr } = await supabaseAdmin
          .from('pluggy_investments')
          .upsert(batch, { onConflict: 'pluggy_investment_id', ignoreDuplicates: false })

        if (invErr) {
          console.error('Investment upsert error:', invErr)
        } else {
          savedInvestments += batch.length
        }
      }
      console.log(`Saved ${savedInvestments} investments for item ${itemId}`)
    }

    // Upsert bank accounts
    let savedAccounts = 0
    let savedTransactions = 0

    for (const acc of accounts) {
      // For credit cards, fetch the actual bill from Pluggy Bills API
      let billAmount: number | null = null
      let billDueDate: string | null = null
      let openBillAmount: number | null = null

      if (acc.type === 'CREDIT') {
        // 1) Try the Bills API. The OPEN bill is the partial bill in formation.
        try {
          const billsRes = await fetch(`https://api.pluggy.ai/accounts/${acc.id}/bills`, { headers })
          const billsBody = await billsRes.text()
          if (!billsRes.ok) {
            console.warn(`Bills endpoint ${billsRes.status} for account ${acc.id}: ${billsBody.slice(0, 300)}`)
          } else {
            const billsData = JSON.parse(billsBody)
            const bills = billsData.results || []
            console.log(`Bills for ${acc.id}: ${bills.length} bills, statuses=${bills.map((b: any) => b.status).join(',')}`)
            const openBill = bills.find((b: any) => (b.status || '').toUpperCase() === 'OPEN')
            const today = new Date().toISOString().split('T')[0]
            const futureBills = bills
              .filter((b: any) => b.dueDate && b.dueDate.split('T')[0] >= today)
              .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
            const chosen = openBill || futureBills[0] || bills[0]
            if (chosen) {
              billAmount = chosen.totalAmount ?? chosen.amount ?? null
              billDueDate = chosen.dueDate ? chosen.dueDate.split('T')[0] : null
            }
          }
        } catch (e) {
          console.error('Bills fetch error:', e)
        }

        // 2) Fallback: calculate the NEXT BILL TO MATURE (BTG-style: shows only the closing bill,
        //    not the future bill in formation).
        //    Strategy:
        //      a) Find the next billing close date. We derive it from `balanceDueDate` recurring monthly
        //         (assume close = dueDate - 3 days, typical for most issuers).
        //      b) Find the previous close date (one month before the next close).
        //      c) Sum DEBITs in [previousClose+1 .. nextClose] = next bill to mature.
        if (billAmount == null) {
          try {
            const today = new Date()
            const lookback = new Date(today)
            lookback.setDate(lookback.getDate() - 90)
            const fromDate = lookback.toISOString().split('T')[0]
            const txRes = await fetch(
              `https://api.pluggy.ai/transactions?accountId=${acc.id}&from=${fromDate}&pageSize=500`,
              { headers }
            )
            if (txRes.ok) {
              const txData = await txRes.json()
              const txs: any[] = txData.results || []

              // Determine the day-of-month for due date (from balanceDueDate, recurring monthly)
              const rawDue = acc.creditData?.balanceDueDate
              const dueDay = rawDue ? new Date(rawDue).getUTCDate() : 5

              // Project the NEXT due date >= today (recurring on dueDay each month)
              const projectNextDue = (): Date => {
                const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), dueDay))
                if (d.getTime() < today.getTime()) d.setUTCMonth(d.getUTCMonth() + 1)
                return d
              }
              const nextDue = projectNextDue()
              // Closing date = due date - 3 days (typical "melhor dia de compra" gap)
              const nextClose = new Date(nextDue)
              nextClose.setUTCDate(nextClose.getUTCDate() - 3)
              const prevClose = new Date(nextClose)
              prevClose.setUTCMonth(prevClose.getUTCMonth() - 1)

              const nextCloseMs = nextClose.getTime()
              const prevCloseMs = prevClose.getTime()

              // Sum DEBITs in (prevClose, nextClose]
              openBillAmount = txs
                .filter((tx) => {
                  const isDebit = tx.type === 'DEBIT' || tx.amount > 0
                  if (!isDebit) return false
                  const t = new Date(tx.date).getTime()
                  return t > prevCloseMs && t <= nextCloseMs
                })
                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
              openBillAmount = Math.round((openBillAmount ?? 0) * 100) / 100
              console.log(
                `Next bill to mature: R$ ${openBillAmount} | window: ${prevClose.toISOString().split('T')[0]} → ${nextClose.toISOString().split('T')[0]} | due: ${nextDue.toISOString().split('T')[0]}`
              )
              billDueDate = billDueDate || nextDue.toISOString().split('T')[0]
            }
          } catch (e) {
            console.error('Next bill calc error:', e)
          }
        }
      }

      const accountPayload = {
        user_id: ownerUserId,
        connection_id: connectionId,
        pluggy_item_id: itemId,
        pluggy_account_id: acc.id,
        name: acc.name || 'Conta',
        type: acc.type || 'BANK',
        subtype: acc.subtype || null,
        balance: acc.balance ?? 0,
        currency_code: acc.currencyCode || 'BRL',
        credit_limit: acc.creditData?.limit ?? acc.creditData?.creditLimit ?? null,
        credit_available: acc.creditData?.availableCreditLimit ?? null,
        credit_bill_amount: acc.type === 'CREDIT' ? (acc.balance ?? billAmount ?? openBillAmount ?? null) : null,
        credit_bill_due_date: billDueDate || acc.creditData?.balanceDueDate || null,
        bank_data: {
          ...(acc.bankData || {}),
          creditData: acc.creditData || null,
          owner: acc.owner || null,
          taxNumber: acc.taxNumber || null,
          marketingName: acc.marketingName || null,
          number: acc.number || null,
          balanceCloseDate: acc.creditData?.balanceCloseDate || null,
          openBillAmount: openBillAmount,
          totalDebt: acc.type === 'CREDIT' ? (acc.balance ?? null) : null,
          hasBillData: billAmount != null,
          hasOpenBillCalc: openBillAmount != null,
          totalInvestments: acc.type !== 'CREDIT' ? totalInvestments : 0,
        },
        updated_at: new Date().toISOString(),
      }

      const { error: accErr } = await supabaseAdmin
        .from('pluggy_bank_accounts')
        .upsert(accountPayload, { onConflict: 'pluggy_account_id' })

      if (accErr) {
        console.error('Account upsert error:', accErr)
      } else {
        savedAccounts++
      }

      // Fetch and save transactions for this account
      if (action === 'full_sync' || action === 'transactions') {
        const transactions = await fetchAllTransactions(apiKey, acc.id)

        if (transactions.length > 0) {
          const BATCH = 200
          for (let i = 0; i < transactions.length; i += BATCH) {
            const batch = transactions.slice(i, i + BATCH).map((tx: any) => ({
              user_id: ownerUserId,
              pluggy_account_id: acc.id,
              pluggy_transaction_id: tx.id,
              description: tx.description || tx.descriptionRaw || null,
              amount: tx.amount ?? 0,
              type: tx.type || 'DEBIT',
              date: tx.date ? tx.date.split('T')[0] : new Date().toISOString().split('T')[0],
              category: tx.category || null,
              payment_data: tx.paymentData || {},
              updated_at: new Date().toISOString(),
            }))

            const { error: txErr } = await supabaseAdmin
              .from('pluggy_transactions')
              .upsert(batch, { onConflict: 'pluggy_transaction_id', ignoreDuplicates: false })

            if (txErr) {
              console.error('Transaction upsert error:', txErr)
            } else {
              savedTransactions += batch.length
            }
          }
        }
      }
    }

    // Update connection last_sync_at
    await supabaseAdmin
      .from('pluggy_connections')
      .update({
        last_sync_at: new Date().toISOString(),
        status: item.status || 'connected',
        connector_name: item.connector?.name || null,
      })
      .eq('pluggy_item_id', itemId)
      .eq('user_id', ownerUserId)

    // Resolve empresa_id (primeira empresa do owner) para logs
    const { data: empresaRow } = await supabaseAdmin
      .from('empresas')
      .select('id')
      .eq('user_id', ownerUserId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle()

    // Grava log de sincronização (auditoria)
    const durationMs = Date.now() - syncStartedAt
    await supabaseAdmin.from('pluggy_sync_logs').insert({
      user_id: ownerUserId,
      empresa_id: empresaRow?.id || null,
      pluggy_item_id: itemId,
      connector_name: item.connector?.name || null,
      source: 'pluggy',
      value_type: 'liquido', // SEMPRE balance (líquido/resgatável)
      status: 'success',
      accounts_count: savedAccounts,
      transactions_count: savedTransactions,
      investments_count: savedInvestments,
      total_investments: totalInvestments,
      duration_ms: durationMs,
      metadata: { action, itemStatus: item.status },
    })

    // Reconcilia automaticamente todas as contas vinculadas a este item
    const { data: contasItem } = await supabaseAdmin
      .from('contas_bancarias')
      .select('id')
      .eq('user_id', ownerUserId)
      .in('pluggy_account_id', accounts.map((a: any) => a.id).filter(Boolean))

    let reconciled = 0
    for (const c of contasItem || []) {
      try {
        await supabaseAdmin.rpc('reconciliar_investimentos_conta', { p_conta_id: c.id })
        reconciled++
      } catch (e) {
        console.error('reconcile error', c.id, e)
      }
    }

    const result = {
      item: { id: item.id, status: item.status, connector: item.connector },
      accounts: accounts.length,
      savedAccounts,
      savedTransactions,
      savedInvestments,
      totalInvestments,
      reconciled,
      durationMs,
      message: `Sincronizado: ${savedAccounts} contas, ${savedTransactions} transações, ${savedInvestments} investimentos (líquido R$ ${totalInvestments.toFixed(2)}). ${reconciled} reconciliação(ões) gravada(s).`,
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Pluggy sync error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})