import { corsHeaders } from '@supabase/supabase-js/cors'
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    )

    const token = authHeader.replace('Bearer ', '')
    const { data: claims, error: claimsError } = await supabase.auth.getClaims(token)
    if (claimsError || !claims?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
    const userId = claims.claims.sub as string

    const url = new URL(req.url)
    const itemId = url.searchParams.get('itemId')
    const action = url.searchParams.get('action') || 'summary' // summary | transactions | accounts

    if (!itemId) {
      return new Response(JSON.stringify({ error: 'itemId is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const apiKey = await getPluggyApiKey()
    const headers = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }

    let result: unknown

    if (action === 'accounts') {
      const res = await fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, { headers })
      if (!res.ok) throw new Error(`Pluggy accounts error: ${res.status}`)
      result = await res.json()
    } else if (action === 'transactions') {
      const from = url.searchParams.get('from') || ''
      const to = url.searchParams.get('to') || ''
      const accountId = url.searchParams.get('accountId') || ''
      let txUrl = `https://api.pluggy.ai/transactions?accountId=${accountId}`
      if (from) txUrl += `&from=${from}`
      if (to) txUrl += `&to=${to}`
      const res = await fetch(txUrl, { headers })
      if (!res.ok) throw new Error(`Pluggy transactions error: ${res.status}`)
      result = await res.json()
    } else {
      // summary: item details + accounts
      const [itemRes, accountsRes] = await Promise.all([
        fetch(`https://api.pluggy.ai/items/${itemId}`, { headers }),
        fetch(`https://api.pluggy.ai/accounts?itemId=${itemId}`, { headers }),
      ])
      if (!itemRes.ok) throw new Error(`Pluggy item error: ${itemRes.status}`)
      if (!accountsRes.ok) throw new Error(`Pluggy accounts error: ${accountsRes.status}`)
      
      const item = await itemRes.json()
      const accounts = await accountsRes.json()

      result = { item, accounts: accounts.results || [] }

      // Update last_sync_at
      await supabase
        .from('pluggy_connections')
        .update({ last_sync_at: new Date().toISOString(), status: item.status || 'connected', connector_name: item.connector?.name || null })
        .eq('pluggy_item_id', itemId)
        .eq('user_id', userId)
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Pluggy sync error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
