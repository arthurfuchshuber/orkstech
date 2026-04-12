import { corsHeaders } from '@supabase/supabase-js/cors'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Validate auth
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

    // Get Pluggy API key
    const clientId = Deno.env.get('PLUGGY_CLIENT_ID')!
    const clientSecret = Deno.env.get('PLUGGY_CLIENT_SECRET')!

    // Authenticate with Pluggy
    const authRes = await fetch('https://api.pluggy.ai/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientId, clientSecret }),
    })

    if (!authRes.ok) {
      const errBody = await authRes.text()
      console.error('Pluggy auth failed:', errBody)
      return new Response(JSON.stringify({ error: 'Failed to authenticate with Pluggy' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { apiKey } = await authRes.json()

    // Parse optional itemId for reconnection
    let itemId: string | undefined
    if (req.method === 'POST') {
      try {
        const body = await req.json()
        itemId = body.itemId
      } catch { /* no body */ }
    }

    // Create connect token
    const connectBody: Record<string, unknown> = {}
    if (itemId) connectBody.itemId = itemId

    const connectRes = await fetch('https://api.pluggy.ai/connect_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify(connectBody),
    })

    if (!connectRes.ok) {
      const errBody = await connectRes.text()
      console.error('Pluggy connect token failed:', errBody)
      return new Response(JSON.stringify({ error: 'Failed to create connect token' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { accessToken } = await connectRes.json()

    return new Response(JSON.stringify({ connectToken: accessToken }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Error:', err)
    return new Response(JSON.stringify({ error: 'Internal server error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
  }
})
