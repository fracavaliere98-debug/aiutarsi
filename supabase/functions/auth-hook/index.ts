import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { createClient } from 'npm:@supabase/supabase-js'

// Create a Supabase client with the Auth context of the logged in user.
const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''

Deno.serve(async (req) => {
  const { user, event, session } = await req.json()
  
  // This hook runs on user creation, sign in, and token refresh
  if (event === 'TokenRefresh' || event === 'SignIn') {
    // Only fetch role and is_banned via the secure bypass query (service role needed to read profiles efficiently)
    // Actually, we must use service_role to read true profile data without RLS interference
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('role, is_banned')
      .eq('id', user.id)
      .single()

    if (!error && profile) {
      return new Response(
        JSON.stringify({
          // Update the user metadata with the latest database values
          // Note: using user_metadata requires you to map it via map_claim in SQL if you use complex claims,
          // but we can also just inject them straight into the token via app_metadata.
          // By putting them in app_metadata/user_metadata, we can read them via auth.jwt()
          user_metadata: {
            ...user.user_metadata,
            role: profile.role,
            is_banned: profile.is_banned
          }
        }),
        { headers: { "Content-Type": "application/json" } },
      )
    }
  }

  // Return the original payload if no changes are made
  return new Response(JSON.stringify({}), {
    headers: { "Content-Type": "application/json" },
  })
})
