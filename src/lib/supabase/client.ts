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
//
// A screen with several independent queries (Add's dishes/targets/
// entries/recents/frequents, Home's entries/targets/profile) fires this
// once per query on mount — five network round trips to the SAME
// auth.getUser() check where one would do. Caching the in-flight promise
// for a few seconds coalesces that whole mount-time burst into one actual
// request; later calls (a different page visited seconds later) still get
// a fresh check. Both sign-in and sign-out do a full page reload
// (window.location.href), which wipes this module-level cache along with
// everything else — no explicit invalidation needed.
const AUTHED_CLIENT_CACHE_MS = 5000;
let cachedAuthedClient: {
  promise: Promise<{ supabase: ReturnType<typeof createClient>; userId: string } | null>;
  at: number;
} | null = null;

export async function getAuthedClient() {
  const now = Date.now();
  if (cachedAuthedClient && now - cachedAuthedClient.at < AUTHED_CLIENT_CACHE_MS) {
    return cachedAuthedClient.promise;
  }
  const promise = (async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user ? { supabase, userId: user.id } : null;
  })();
  cachedAuthedClient = { promise, at: now };
  return promise;
}

// For call sites that fire several user-scoped reads together (e.g. the
// Dashboard) and want to share one auth check instead of paying its
// round-trip once per read.
export type AuthedClient = NonNullable<Awaited<ReturnType<typeof getAuthedClient>>>;
