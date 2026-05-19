import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// Image optimization is not yet implemented.
// This function is a no-op until a real WASM/API-based pipeline is built.
// Disable the storage webhook from the Supabase dashboard to stop invoking this.
Deno.serve(async (_req) => {
  return new Response(JSON.stringify({ skipped: true }), {
    headers: { "Content-Type": "application/json" },
  });
});
