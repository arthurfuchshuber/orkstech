const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-user-id, x-cron-secret',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  assertPluggyItemAccess,
  createServiceClient,
  createUserClient,
  isCronAuthorized,
} from '../_shared/security.ts'

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

async function fetchAllTransactions(apiKey: string, accountId: string, opts?: { includeFuture?: boolean }): Promise<any[]> {
  const headers = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }
  const allTxs: any[] = []
  let page = 1
  const pageSize = 500

  // Para cartões de crédito precisamos puxar parcelas FUTURAS (12 meses à frente)
  // — Pluggy por padrão devolve só até hoje. Forçamos um range explícito.
  let rangeQS = ''
  if (opts?.includeFuture) {
    const today = new Date()
    const from = new Date(today); from.setUTCFullYear(from.getUTCFullYear() - 1)
    const to = new Date(today); to.setUTCMonth(to.getUTCMonth() + 12)
    rangeQS = `&from=${from.toISOString().split('T')[0]}&to=${to.toISOString().split('T')[0]}`
  }

  while (true) {
    const url = `https://api.pluggy.ai/transactions?accountId=${accountId}&pageSize=${pageSize}&page=${page}${rangeQS}`
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

  const syncStartedAt = Date.now()
  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const url = new URL(req.url)
    const itemId = url.searchParams.get('itemId')
    const action = url.searchParams.get('action') || 'full_sync'

    if (!itemId) {
      return new Response(JSON.stringify({ error: 'itemId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabaseAdmin = createServiceClient()
    const internalCron = isCronAuthorized(req)
    let callerUserId: string

    if (internalCron) {
      const internalUserId = req.headers.get('X-Internal-User-Id')
      if (!internalUserId) {
        return new Response(JSON.stringify({ error: 'X-Internal-User-Id required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      callerUserId = internalUserId
    } else {
      const supabase = createUserClient(authHeader)
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
      callerUserId = user.id
    }

    const access = await assertPluggyItemAccess(supabaseAdmin, itemId, callerUserId, {
      isInternalCron: internalCron,
      internalUserId: req.headers.get('X-Internal-User-Id'),
    }, corsHeaders)
    if ('error' in access) return access.error

    const { conn, ownerUserId } = access
    const connectionId = conn.id || null

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
      // === Cálculo da FATURA ATUAL EXATA (próximo vencimento) ===
      // Pluggy não expõe nativamente "fatura atual em formação". Construímos a partir das transações.
      // Estratégia:
      //  A) Se existir bill OPEN no /bills → soma todas as txs com creditCardMetadata.billId === openBill.id
      //  B) Caso contrário, define janela do ciclo via balanceCloseDate (ou projeta de balanceDueDate)
      //     e soma PENDING + POSTED do ciclo, excluindo tipo CREDIT (estornos/pagamentos)
      //  Dedup por tx.id. Log detalhado das incluídas/excluídas.
      let faturaAtualExata: number | null = null
      let faturaProximoMes: number | null = null
      let billDueDate: string | null = null
      let billCloseDate: string | null = null
      let cycleStart: string | null = null
      let cycleEnd: string | null = null
      let openBillId: string | null = null
      let faturaSource: 'open_bill_id' | 'cycle_window' | null = null
      const bilhetagem: { incluidas: number; excluidas: number; motivos: Record<string, number> } = {
        incluidas: 0, excluidas: 0, motivos: {},
      }
      const bilhetagemProx: { incluidas: number; excluidas: number } = { incluidas: 0, excluidas: 0 }
      let allCardTxs: any[] = []

      if (acc.type === 'CREDIT') {
        // 1) Busca TODAS as transações do cartão
        allCardTxs = await fetchAllTransactions(apiKey, acc.id)
        // dedup defensivo por id
        const seenIds = new Set<string>()
        allCardTxs = allCardTxs.filter((t: any) => {
          if (!t.id || seenIds.has(t.id)) return false
          seenIds.add(t.id); return true
        })

        // 2) Tenta /bills para descobrir OPEN bill + faturas futuras
        let openBill: any = null
        let allBills: any[] = []
        let openBillCloseDate: string | null = null
        try {
          const billsRes = await fetch(`https://api.pluggy.ai/accounts/${acc.id}/bills`, { headers })
          if (billsRes.ok) {
            const billsData = await billsRes.json()
            allBills = billsData.results || []
            openBill = allBills.find((b: any) => (b.status || '').toUpperCase() === 'OPEN') || null
            console.log(`[bills ${acc.id}] ${allBills.length} faturas, statuses=${allBills.map((b: any) => `${b.status}@${b.dueDate?.split('T')[0]}=${b.totalAmount ?? b.amount}`).join(' | ')}`)
            if (openBill) {
              openBillId = openBill.id
              billDueDate = openBill.dueDate ? openBill.dueDate.split('T')[0] : null
              // Pluggy expõe finishDate/closeDate em alguns conectores
              openBillCloseDate = (openBill.finishDate || openBill.closeDate || openBill.billDate || null)
              if (openBillCloseDate) openBillCloseDate = String(openBillCloseDate).split('T')[0]
            }
          } else {
            console.warn(`[bills ${acc.id}] HTTP ${billsRes.status}`)
          }
        } catch (e) {
          console.error(`[bills ${acc.id}] erro:`, e)
        }

        const countExcl = (motivo: string) => {
          bilhetagem.excluidas++
          bilhetagem.motivos[motivo] = (bilhetagem.motivos[motivo] || 0) + 1
        }

        // 3-A) Caminho preferido: somar por billId
        if (openBillId) {
          faturaSource = 'open_bill_id'
          let total = 0
          for (const tx of allCardTxs) {
            const meta = tx.creditCardMetadata || {}
            const status = (tx.status || 'POSTED').toUpperCase()
            const isCharge = tx.type === 'DEBIT' && Number(tx.amount) > 0
            if (meta.billId !== openBillId) { countExcl('outro_ciclo'); continue }
            if (!isCharge) { countExcl('estorno_ou_pagamento'); continue }
            if (status !== 'PENDING' && status !== 'POSTED') { countExcl(`status_${status}`); continue }
            total += Math.abs(Number(tx.amount))
            bilhetagem.incluidas++
          }
          faturaAtualExata = Math.round(total * 100) / 100
          console.log(`[fatura_atual_exata ${acc.id}] via OPEN billId=${openBillId}: R$ ${faturaAtualExata} (in=${bilhetagem.incluidas}, out=${bilhetagem.excluidas})`)
        } else {
          // 3-B) Fallback inteligente — escolhe a melhor estratégia disponível:
          //   (i)  balanceCloseDate confiável (presente e/ou balanceDueDate futuro) → cycle_window
          //   (ii) caso contrário, detecta o último PAGAMENTO da fatura anterior (CREDIT grande / desc "pagamento")
          //        e usa essa data como início do novo ciclo → last_payment_window (preciso quando o banco não envia close)
          //   (iii) último recurso: heurística de 7 dias antes do próximo vencimento
          const today = new Date()
          const closeRaw = acc.creditData?.balanceCloseDate
          const dueRaw = acc.creditData?.balanceDueDate
          const dueRawDate = dueRaw ? new Date(dueRaw) : null
          const dueIsStale = dueRawDate ? (today.getTime() - dueRawDate.getTime()) > 35 * 86400000 : true
          const hasReliableCycle = !!closeRaw || (dueRawDate && !dueIsStale)

          // Detecta último pagamento (entrada de crédito que quita fatura anterior)
          // Critérios: type CREDIT, amount negativo significativo (>R$ 50 em módulo),
          // OU descrição que contém "pagamento"/"payment".
          const payments = allCardTxs
            .filter((tx: any) => {
              const desc = String(tx.description || '').toLowerCase()
              const isCreditType = tx.type === 'CREDIT' || Number(tx.amount) < 0
              const looksLikePayment = /pagamento|payment|pgto/.test(desc) || Math.abs(Number(tx.amount)) >= 50
              return isCreditType && looksLikePayment
            })
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
          const lastPayment = payments[0] || null

          let prevClose: Date, nextClose: Date, nextDue: Date

          if (hasReliableCycle) {
            faturaSource = 'cycle_window'
            if (closeRaw) {
              nextClose = new Date(closeRaw)
              if (nextClose.getTime() < today.getTime()) {
                nextClose = new Date(nextClose); nextClose.setUTCMonth(nextClose.getUTCMonth() + 1)
              }
              nextDue = dueRawDate || new Date(nextClose.getTime() + 10 * 86400000)
              if (dueRawDate && nextDue.getTime() < today.getTime()) {
                nextDue = new Date(nextDue); nextDue.setUTCMonth(nextDue.getUTCMonth() + 1)
              }
            } else {
              const dueDay = dueRawDate!.getUTCDate()
              nextDue = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), dueDay))
              if (nextDue.getTime() < today.getTime()) nextDue.setUTCMonth(nextDue.getUTCMonth() + 1)
              nextClose = new Date(nextDue); nextClose.setUTCDate(nextClose.getUTCDate() - 7)
            }
            prevClose = new Date(nextClose); prevClose.setUTCMonth(prevClose.getUTCMonth() - 1)
          } else if (lastPayment) {
            faturaSource = 'last_payment_window' as any
            // Novo ciclo começa na data do último pagamento (inclusiva)
            prevClose = new Date(lastPayment.date)
            prevClose.setUTCHours(0, 0, 0, 0)
            // Subtrai 1ms para que o filtro "> prevMs" inclua transações da própria data do pagamento
            prevClose = new Date(prevClose.getTime() - 1)
            // Próximo fechamento ~30 dias após o anterior; vencimento ~7 dias depois (apenas exibição)
            nextClose = new Date(prevClose.getTime() + 30 * 86400000)
            if (nextClose.getTime() < today.getTime()) nextClose = new Date(today.getTime() + 7 * 86400000)
            nextDue = dueRawDate && dueRawDate.getTime() > today.getTime()
              ? dueRawDate
              : new Date(nextClose.getTime() + 7 * 86400000)
          } else {
            faturaSource = 'cycle_window'
            const dueDay = dueRawDate ? dueRawDate.getUTCDate() : 5
            nextDue = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), dueDay))
            if (nextDue.getTime() < today.getTime()) nextDue.setUTCMonth(nextDue.getUTCMonth() + 1)
            nextClose = new Date(nextDue); nextClose.setUTCDate(nextClose.getUTCDate() - 7)
            prevClose = new Date(nextClose); prevClose.setUTCMonth(prevClose.getUTCMonth() - 1)
          }

          billCloseDate = nextClose.toISOString().split('T')[0]
          billDueDate = nextDue.toISOString().split('T')[0]
          cycleStart = new Date(prevClose.getTime() + 1).toISOString().split('T')[0]
          cycleEnd = billCloseDate

          const prevMs = prevClose.getTime(), nextMs = nextClose.getTime()
          let total = 0
          for (const tx of allCardTxs) {
            const status = (tx.status || 'POSTED').toUpperCase()
            const isCharge = tx.type === 'DEBIT' && Number(tx.amount) > 0
            const t = new Date(tx.date).getTime()
            if (!(t > prevMs && t <= nextMs)) { countExcl('fora_do_ciclo'); continue }
            if (!isCharge) { countExcl('estorno_ou_pagamento'); continue }
            if (status !== 'PENDING' && status !== 'POSTED') { countExcl(`status_${status}`); continue }
            total += Math.abs(Number(tx.amount))
            bilhetagem.incluidas++
          }
          faturaAtualExata = Math.round(total * 100) / 100
          console.log(`[fatura_atual_exata ${acc.id}] via ${faturaSource} ${cycleStart}→${cycleEnd} (lastPayment=${lastPayment?.date || 'n/a'}): R$ ${faturaAtualExata} (in=${bilhetagem.incluidas}, out=${bilhetagem.excluidas})`)
        }

        // === Cálculo da FATURA do PRÓXIMO MÊS ===
        // Estratégia em cascata:
        //  P1) Pluggy /bills: somar TOTAL de todas as faturas com dueDate > openBill.dueDate
        //      (ou status FUTURE). Isso captura parcelas futuras + lançamentos pré-agendados
        //      com 100% de precisão, pois é exatamente o que o banco já fechou pro próximo ciclo.
        //  P2) Transações com creditCardMetadata.billId != openBillId E em bill com dueDate posterior.
        //  P3) Cutoff por data: usa CLOSE date da fatura aberta (não dueDate!) para somar txs futuras.
        try {
          let totalProx = 0
          let proxSource: string | null = null

          // P1: usa totalAmount/amount das próprias faturas futuras
          if (allBills.length > 0 && billDueDate) {
            const openDueMs = new Date(billDueDate).getTime()
            const futureBills = allBills.filter((b: any) => {
              const st = (b.status || '').toUpperCase()
              if (st === 'CLOSED' || st === 'PAID') return false
              if (b.id === openBillId) return false
              const d = b.dueDate ? new Date(b.dueDate).getTime() : 0
              return d > openDueMs
            })
            if (futureBills.length > 0) {
              for (const fb of futureBills) {
                const amt = Number(fb.totalAmount ?? fb.amount ?? 0)
                if (amt > 0) totalProx += amt
                bilhetagemProx.incluidas++
              }
              proxSource = 'bills_total'
            }
          }

          // P2/P3: fallback por transações
          if (totalProx === 0) {
            let cutoffMs: number | null = null
            if (openBillCloseDate) {
              cutoffMs = new Date(openBillCloseDate).getTime()
              proxSource = 'tx_after_close'
            } else if (billCloseDate) {
              cutoffMs = new Date(billCloseDate).getTime()
              proxSource = 'tx_after_close'
            } else if (billDueDate) {
              // Sem closeDate: estima close = due - 7d
              cutoffMs = new Date(billDueDate).getTime() - 7 * 86400000
              proxSource = 'tx_after_estimated_close'
            }
            if (cutoffMs != null) {
              for (const tx of allCardTxs) {
                const status = (tx.status || 'POSTED').toUpperCase()
                const isCharge = tx.type === 'DEBIT' && Number(tx.amount) > 0
                const t = new Date(tx.date).getTime()
                if (t <= cutoffMs) continue
                if (!isCharge) continue
                if (status !== 'PENDING' && status !== 'POSTED') continue
                // Ignora txs do próprio openBill (já contam na fatura atual)
                if (openBillId && tx.creditCardMetadata?.billId === openBillId) continue
                totalProx += Math.abs(Number(tx.amount))
                bilhetagemProx.incluidas++
              }
            }
          }

          faturaProximoMes = Math.round(totalProx * 100) / 100
          ;(bilhetagemProx as any).source = proxSource
          console.log(`[fatura_proximo_mes ${acc.id}] source=${proxSource} R$ ${faturaProximoMes} (in=${bilhetagemProx.incluidas})`)
        } catch (e) {
          console.error(`[fatura_proximo_mes ${acc.id}] erro:`, e)
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
        // credit_bill_amount agora = fatura_atual_exata (próximo vencimento)
        credit_bill_amount: acc.type === 'CREDIT' ? faturaAtualExata : null,
        credit_bill_due_date: billDueDate || acc.creditData?.balanceDueDate || null,
        bank_data: {
          ...(acc.bankData || {}),
          creditData: acc.creditData || null,
          owner: acc.owner || null,
          taxNumber: acc.taxNumber || null,
          marketingName: acc.marketingName || null,
          number: acc.number || null,
          balanceCloseDate: acc.creditData?.balanceCloseDate || null,
          // Fatura atual exata + auditoria
          fatura_atual_exata: faturaAtualExata,
          fatura_source: faturaSource,
          fatura_open_bill_id: openBillId,
          fatura_cycle_start: cycleStart,
          fatura_cycle_end: cycleEnd,
          fatura_close_date: billCloseDate,
          fatura_breakdown: bilhetagem,
          fatura_proximo_mes: faturaProximoMes,
          fatura_proximo_mes_breakdown: bilhetagemProx,
          // legados (compat com UI atual)
          openBillAmount: faturaAtualExata,
          totalDebt: acc.type === 'CREDIT' ? (acc.balance ?? null) : null,
          hasBillData: faturaAtualExata != null,
          hasOpenBillCalc: faturaAtualExata != null,
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
        // Reaproveita txs do cartão (já buscadas para o cálculo da fatura)
        const transactions = acc.type === 'CREDIT' ? allCardTxs : await fetchAllTransactions(apiKey, acc.id)

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
              payment_data: {
                ...(tx.paymentData || {}),
                status: tx.status || null,
                creditCardMetadata: tx.creditCardMetadata || null,
              },
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