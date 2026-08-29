import "server-only";

// Groq's chat completions endpoint is OpenAI-compatible. Fast inference
// matters here specifically because this app's whole premise is
// sub-10-second logging — a slow LLM call would undermine the point.
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
// llama-3.3-70b-versatile was deprecated by Groq in June 2026; this is
// their recommended replacement at the same capability tier. Verified
// current as of this writing — Groq's model lineup moves fast enough that
// this is worth re-checking (console.groq.com/docs/models) if this ever
// 404s again.
const MODEL = "openai/gpt-oss-120b";

// openai/gpt-oss-120b occasionally returns an empty generation under
// json_object mode on more complex prompts (Groq's own server-side JSON
// validation then rejects the empty string with a 400
// json_validate_failed) — a known flakiness of this model with structured
// output, not something a prompt tweak reliably fixes. A transient empty
// generation is exactly the kind of thing a retry resolves, since
// generation isn't fully deterministic even at low temperature.
const MAX_ATTEMPTS = 3;

function isJsonValidationFailure(status: number, body: string): boolean {
  if (status !== 400) return false;
  try {
    const parsed = JSON.parse(body);
    return parsed?.error?.code === "json_validate_failed";
  } catch {
    return false;
  }
}

async function attemptCompletion(
  apiKey: string,
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const res = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
      // openai/gpt-oss-120b is a reasoning model — it spends tokens on
      // internal chain-of-thought before the final answer. On a harder
      // prompt (e.g. picking a food combination to hit a macro target),
      // default settings can let that reasoning consume the whole budget,
      // leaving nothing for the actual JSON output (an empty
      // "content" that Groq's own JSON validation then rejects — this
      // reproduces every time for a given prompt, not intermittently).
      // reasoning_effort trims that internal reasoning; a generous
      // max_completion_tokens is a second guard against the same failure.
      reasoning_effort: "low",
      max_completion_tokens: 2048,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    if (isJsonValidationFailure(res.status, body)) {
      throw new RetryableGroqError(`Groq API error (${res.status}): ${body}`);
    }
    throw new Error(`Groq API error (${res.status}): ${body}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim() === "") {
    throw new RetryableGroqError("Groq API returned empty content.");
  }
  return content;
}

class RetryableGroqError extends Error {}

export async function groqJsonCompletion(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GROQ_API_KEY is not set — required for AI features (see .env.example).",
    );
  }

  let lastError: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptCompletion(apiKey, systemPrompt, userPrompt);
    } catch (e) {
      lastError = e;
      if (!(e instanceof RetryableGroqError) || attempt === MAX_ATTEMPTS) {
        throw e;
      }
    }
  }
  throw lastError;
}
