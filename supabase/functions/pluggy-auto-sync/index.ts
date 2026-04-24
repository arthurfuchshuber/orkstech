// Auto-sync de todas as conexões Pluggy ativas.
// Disparado por pg_cron a cada algumas horas para manter os bancos
// sempre sincronizados sem necessidade de ação manual do usuário.
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

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Busca todas as conexões (independente de status) para tentar reativar.
    // EXCETO as marcadas como `disabled` — significa que a empresa do dono foi
    // inativada/excluída pelo admin e não deve mais sincronizar.
    const { data: connections, error } = await supabase
      .from('pluggy_connections')
      .select('id, pluggy_item_id, user_id, connector_name, status')
      .neq('status', 'disabled')

    if (error) throw error
    if (!connections || connections.length === 0) {
      return new Response(JSON.stringify({ ok: true, processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const apiKey = await getPluggyApiKey()
    const headers = { 'X-API-KEY': apiKey, 'Content-Type': 'application/json' }

    let updated = 0
    let needsAction = 0
    let errors = 0

    // Dispara update em paralelo (limitado) para todos os items
    await Promise.all(
      connections.map(async (conn) => {
        try {
          // 1. Trigger update no Pluggy (refresh do item)
          const updateRes = await fetch(`https://api.pluggy.ai/items/${conn.pluggy_item_id}`, {
            method: 'PATCH',
            headers,
            body: JSON.stringify({}),
          })

          if (!updateRes.ok) {
            // Item pode ter sido removido no Pluggy
            errors++
            return
          }

          // 2. Verifica status final do item (sem aguardar polling longo)
          await new Promise((r) => setTimeout(r, 5000))
          const checkRes = await fetch(`https://api.pluggy.ai/items/${conn.pluggy_item_id}`, { headers })
          if (!checkRes.ok) {
            errors++
            return
          }
          const item = await checkRes.json()

          // Mapeia status do Pluggy para nosso schema
          let newStatus = 'connected'
          if (item.status === 'LOGIN_ERROR' || item.status === 'WAITING_USER_INPUT') {
            newStatus = 'login_required'
            needsAction++
          } else if (item.status === 'OUTDATED') {
            newStatus = 'outdated'
          } else if (item.status === 'UPDATED' || item.status === 'PARTIAL_SUCCESS') {
            newStatus = 'connected'
            updated++
          }

          await supabase
            .from('pluggy_connections')
            .update({
              status: newStatus,
              last_sync_at: new Date().toISOString(),
              connector_name: item.connector?.name || conn.connector_name,
            })
            .eq('id', conn.id)

          // Se reconectou OK, dispara sync completo para puxar accounts/transactions
          if (newStatus === 'connected') {
            // Chama pluggy-sync internamente (com skipUpdate=true pois já demos PATCH)
            const syncUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/pluggy-sync?itemId=${conn.pluggy_item_id}&action=full_sync&skipUpdate=true`
            // Fire-and-forget: não esperamos a sync completa terminar para liberar este endpoint
            fetch(syncUrl, {
              headers: {
                Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}`,
                'X-Internal-User-Id': conn.user_id,
              },
            }).catch((e) => console.error(`Background sync failed for ${conn.pluggy_item_id}:`, e))
          }
        } catch (e) {
          console.error(`Auto-sync failed for ${conn.pluggy_item_id}:`, e)
          errors++
        }
      })
    )

    const result = {
      ok: true,
      processed: connections.length,
      updated,
      needsAction,
      errors,
      message: `Processado: ${connections.length} conexões. ${updated} atualizadas, ${needsAction} requerem reautenticação.`,
    }

    console.log('Auto-sync result:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('Auto-sync error:', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
