import { NextResponse } from "next/server";
import { suggestAliases } from "@/lib/ai/suggest-aliases";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { foodName, existingAliases } = (body ?? {}) as {
    foodName?: unknown;
    existingAliases?: unknown;
  };

  if (
    typeof foodName !== "string" ||
    !foodName.trim() ||
    !Array.isArray(existingAliases) ||
    !existingAliases.every((a) => typeof a === "string")
  ) {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    const aliases = await suggestAliases(foodName, existingAliases);
    return NextResponse.json({ aliases });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
