import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

// Deliberate, explicit auth model change (2026-08-23): phone number as a
// bare identity key, with NO verification — anyone who types a given
// number gets that account. Accepted for this single-user/personal app;
// see CLAUDE.md's auth section for the full tradeoff.
//
// Flow: look up (or create) a Supabase Auth user for this phone number,
// then mint a real session server-side via generateLink + verifyOtp — no
// email or SMS is ever actually sent. The synthetic email below is never
// shown to the user; it only exists because Supabase Auth needs *some*
// identifier to generate a link against.

function normalizePhone(raw: string): string {
  return raw.replace(/[^\d+]/g, "");
}

function syntheticEmailFor(normalizedPhone: string): string {
  return `phone-${normalizedPhone.replace(/\+/g, "")}@phone.local`;
}

export async function POST(request: Request) {
  let phone: unknown;
  try {
    ({ phone } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof phone !== "string" || normalizePhone(phone).length < 6) {
    return NextResponse.json(
      { error: "Enter a valid phone number." },
      { status: 400 },
    );
  }

  const normalized = normalizePhone(phone);
  const syntheticEmail = syntheticEmailFor(normalized);
  const admin = createAdminClient();

  const { data: existing, error: lookupError } = await admin
    .from("phone_login")
    .select("user_id")
    .eq("phone_number", normalized)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  let userId = existing?.user_id as string | undefined;

  if (!userId) {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: syntheticEmail,
      email_confirm: true,
      phone: normalized,
      phone_confirm: true,
    });

    if (createError || !created.user) {
      return NextResponse.json(
        { error: createError?.message ?? "Could not create account." },
        { status: 500 },
      );
    }
    userId = created.user.id;

    const { error: mapError } = await admin
      .from("phone_login")
      .insert({ phone_number: normalized, user_id: userId });

    if (mapError) {
      return NextResponse.json({ error: mapError.message }, { status: 500 });
    }
  }

  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: "magiclink",
    email: syntheticEmail,
  });

  if (linkError || !linkData?.properties?.hashed_token) {
    return NextResponse.json(
      { error: linkError?.message ?? "Could not start a session." },
      { status: 500 },
    );
  }

  const supabase = await createClient();
  // verifyOtp's token_hash form takes ONLY token_hash + type — passing
  // email alongside it trips "Only the token_hash and type should be
  // provided". type is 'email' here (matching the link's own token kind),
  // not 'magiclink' (that type is for the {email, token} OTP-code form).
  const { error: verifyError } = await supabase.auth.verifyOtp({
    type: "email",
    token_hash: linkData.properties.hashed_token,
  });

  if (verifyError) {
    return NextResponse.json({ error: verifyError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
