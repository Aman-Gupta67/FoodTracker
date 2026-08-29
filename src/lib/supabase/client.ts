import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

// A read triggered by TanStack Query's refetchOnMount (e.g. once the
// localStorage-persisted cache goes stale) can fire before this fresh
// client's session restoration finishes — an anon-role request against an
// RLS-scoped table returns 200 with an empty result, not an error, silently
// overwriting good cached data with nothing. Every user-scoped read must
// await the session first and short-circuit when absent, rather than query
// straight away.
export async function getAuthedClient() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

// For call sites that fire several user-scoped reads together (e.g. the
// Dashboard) and want to share one auth check instead of paying its
// round-trip once per read.
export type AuthedClient = NonNullable<Awaited<ReturnType<typeof getAuthedClient>>>;
