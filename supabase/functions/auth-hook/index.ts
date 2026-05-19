import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js'

const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''

Deno.serve(async (req) => {
  const { user, event } = await req.json()

  // Enrich claims on sign-in only.
  // Live ban changes are handled by the client via Realtime + profile refresh.
  if (event === 'SignIn') {
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('role, is_banned, ban_reason, ban_report_id')
      .eq('id', user.id)
      .single()

    if (!error && profile) {
      return new Response(
        JSON.stringify({
          // app_metadata is server-only (not writable by the user via updateUser)
          // — prevents users from overriding their own role or ban status in the JWT.
          app_metadata: {
            role: profile.role,
            is_banned: profile.is_banned,
            ban_reason: profile.ban_reason,
            ban_report_id: profile.ban_report_id,
          },
        }),
        { headers: { "Content-Type": "application/json" } },
      )
    }
  }

  return new Response(JSON.stringify({}), {
    headers: { "Content-Type": "application/json" },
  })
})
