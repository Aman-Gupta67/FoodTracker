import { NextResponse } from "next/server";
import { parseMealText } from "@/lib/ai/parse-meal";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let text: unknown;
  try {
    ({ text } = await request.json());
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof text !== "string" || !text.trim()) {
    return NextResponse.json(
      { error: "Describe what you ate." },
      { status: 400 },
    );
  }

  try {
    const items = await parseMealText(text);
    return NextResponse.json({ items });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 500 },
    );
  }
}
