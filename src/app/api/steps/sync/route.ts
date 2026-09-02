import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// An iOS Shortcuts automation can't hold a normal Supabase session/cookie,
// so it authenticates with a per-profile bearer token instead (see
// profile.steps_sync_token / regenerateStepsSyncToken) — the service-role
// client resolves which user that token belongs to, same pattern as
// phone-login resolving an identity before minting a session.

function isValidBody(value: unknown): value is { date: string; steps: number } {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.date === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(v.date) &&
    typeof v.steps === "number" &&
    Number.isFinite(v.steps) &&
    v.steps >= 0
  );
}

export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) {
    return NextResponse.json(
      { error: "Missing Authorization: Bearer <token> header." },
      { status: 401 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return NextResponse.json(
      { error: "Body must be { date: \"YYYY-MM-DD\", steps: number }." },
      { status: 400 },
    );
  }

  // Wrapped as a whole rather than checked error-by-error like the steps
  // above: createAdminClient() throws synchronously (e.g. a missing
  // SUPABASE_SERVICE_ROLE_KEY on a misconfigured deploy) — uncaught, that
  // becomes a bare empty 500 with no diagnostic, silently breaking every
  // Shortcut sync. Every unexpected failure past body validation should
  // read the same as the errors already handled explicitly below.
  try {
    const admin = createAdminClient();

    const { data: profile, error: lookupError } = await admin
      .from("profile")
      .select("user_id")
      .eq("steps_sync_token", token)
      .maybeSingle();

    if (lookupError) {
      return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }
    if (!profile) {
      return NextResponse.json({ error: "Invalid or revoked token." }, { status: 401 });
    }

    const { error: upsertError } = await admin.from("steps_log").upsert(
      {
        user_id: profile.user_id,
        logged_date: body.date,
        steps: Math.round(body.steps),
      },
      { onConflict: "user_id,logged_date" },
    );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
