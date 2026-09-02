import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// API routes are excluded from the redirect-to-/login behavior entirely —
// an API consumer expects a JSON error response, not a 307 to an HTML
// page. Each API route is responsible for its own auth check and error
// shape (phone-login has none by design; parse-meal returns a 401 JSON).
const PUBLIC_PATHS = ["/login", "/api/"];

// Caches "this session's user has a profile row" so the check below only
// hits the DB once per session instead of once per navigation — profiles
// are never deleted in this app, so once true it stays true for the life
// of the session. Cleared on sign-out (see ProfilePage) so a different
// number logging in on the same device/browser gets re-checked fresh.
const HAS_PROFILE_COOKIE = "ft_has_profile";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublicPath = PUBLIC_PATHS.some((path) =>
    request.nextUrl.pathname.startsWith(path),
  );

  if (!user && !isPublicPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  if (user && request.nextUrl.pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    return NextResponse.redirect(homeUrl);
  }

  // A brand-new user has no `profile` row until they save the Profile form
  // once (saveProfileAndTargets writes every required field together in one
  // upsert, so a row existing at all means it's complete) — until then,
  // every other screen would just show absent targets. Gate on that instead
  // of letting them wander a blank app.
  if (
    user &&
    !isPublicPath &&
    !request.nextUrl.pathname.startsWith("/profile") &&
    request.cookies.get(HAS_PROFILE_COOKIE)?.value !== "1"
  ) {
    const { data: profileRow, error: profileError } = await supabase
      .from("profile")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();
    // Fail OPEN on a query error (RLS hiccup, transient DB issue) — this
    // gate is a UX nicety, not a security boundary (RLS already protects
    // the data regardless), so the wrong failure mode here is locking an
    // already-onboarded real user out of their own app, not occasionally
    // skipping the gate for a genuinely new one.
    if (!profileError && !profileRow) {
      const profileUrl = request.nextUrl.clone();
      profileUrl.pathname = "/profile";
      return NextResponse.redirect(profileUrl);
    }
    if (!profileError && profileRow) {
      response.cookies.set(HAS_PROFILE_COOKIE, "1", {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
  }

  return response;
}
