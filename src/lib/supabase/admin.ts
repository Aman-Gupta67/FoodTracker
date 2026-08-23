import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Uses the service_role key — bypasses RLS entirely. The `server-only`
// import above makes bundling this into any client component a build
// error, not just a code-review mistake. Only ever call this from Route
// Handlers / Server Actions, never from a component that could ship to
// the browser.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is not set — required for phone login (see .env.example).",
    );
  }

  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
