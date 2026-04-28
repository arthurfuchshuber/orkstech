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
      // Use 'amount' (gross value, matching what the bank app displays) instead of 'balance' (net value after taxes)
      // This aligns our totals with what the user sees in the bank's mobile app
      totalInvestments = investmentsList
        .filter((inv: any) => (inv.amount ?? inv.balance ?? 0) > 0)
        .reduce((sum: number, inv: any) => sum + (inv.amount ?? inv.balance ?? inv.value ?? 0), 0)
      totalInvestments = Math.round(totalInvestments * 100) / 100
      console.log(`Total investments for item ${itemId}: R$ ${totalInvestments} from ${investmentsList.length} investments`)
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

        // 2) Fallback: calculate the OPEN bill from transactions.
        //    Strategy: fetch the last 90 days of transactions and find the most recent payment
        //    (CREDIT type with description containing "pagamento"). Everything AFTER that payment
        //    is the current open bill in formation. This is robust even when balanceCloseDate is null
        //    or balanceDueDate is stale.
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
              // Sort ascending by date
              txs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
              // Find date of the most recent bill payment (CREDIT/positive entry on a credit card)
              let lastPaymentDate: string | null = null
              for (let i = txs.length - 1; i >= 0; i--) {
                const tx = txs[i]
                const isPayment = tx.type === 'CREDIT' || tx.amount < 0
                const desc = (tx.description || '').toLowerCase()
                if (isPayment && (desc.includes('pagamento') || desc.includes('payment'))) {
                  lastPaymentDate = tx.date
                  break
                }
              }
              const cutoff = lastPaymentDate ? new Date(lastPaymentDate).getTime() : 0
              // Sum debits AFTER the last payment = current open bill
              openBillAmount = txs
                .filter((tx) => {
                  const isDebit = tx.type === 'DEBIT' || tx.amount > 0
                  return isDebit && new Date(tx.date).getTime() > cutoff
                })
                .reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
              openBillAmount = Math.round((openBillAmount ?? 0) * 100) / 100
              console.log(`Open bill calc: R$ ${openBillAmount} (last payment: ${lastPaymentDate || 'none in 90d'}, ${txs.length} txs analyzed)`)
            }
          } catch (e) {
            console.error('Open bill calc error:', e)
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
        credit_bill_amount: billAmount ?? openBillAmount ?? (acc.type === 'CREDIT' ? (acc.balance ?? null) : null),
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

    const result = {
      item: { id: item.id, status: item.status, connector: item.connector },
      accounts: accounts.length,
      savedAccounts,
      savedTransactions,
      message: `Sincronizado: ${savedAccounts} contas, ${savedTransactions} transações, ${savedInvestments} investimentos`,
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Pluggy sync error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})