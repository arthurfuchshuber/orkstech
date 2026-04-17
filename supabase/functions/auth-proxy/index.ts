import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Content-Type": "application/json",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? "";

    if (!supabaseUrl || !publishableKey) {
      return new Response(JSON.stringify({ error: "Configuração de autenticação indisponível." }), {
        status: 500,
        headers: corsHeaders,
      });
    }

    const { action, email, password, name } = await req.json();

    if (!email || !password || !action) {
      return new Response(JSON.stringify({ error: "Dados de autenticação incompletos." }), {
        status: 400,
        headers: corsHeaders,
      });
    }

    const endpoint =
      action === "signIn"
        ? `${supabaseUrl}/auth/v1/token?grant_type=password`
        : `${supabaseUrl}/auth/v1/signup`;

    const payload =
      action === "signIn"
        ? { email, password }
        : { email, password, data: { full_name: name ?? "" } };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Falha inesperada na autenticação." }),
      {
        status: 500,
        headers: corsHeaders,
      },
    );
  }
});