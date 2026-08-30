// A fetch() call that never completes (dropped connection, the PWA getting
// backgrounded mid-request) throws a plain TypeError whose message is
// whatever the browser engine happens to call it — "Load failed" in
// Safari/WebKit, "Failed to fetch" in Chrome, "NetworkError when attempting
// to fetch resource." in Firefox. None of those mean anything to a user;
// map them to one message that says what's actually true (retry works —
// it's not a data problem, this request just didn't complete). A raw
// `fetch()` call throws that TypeError directly, but supabase-js's
// `.rpc()`/`.from()` calls catch it internally and rethrow a plain
// PostgrestError-shaped object whose `.message` is the stringified
// original ("TypeError: Failed to fetch") — matched as a substring here
// so both shapes map to the same friendly message.
const NETWORK_ERROR_PATTERN =
  /Load failed|Failed to fetch|NetworkError when attempting to fetch resource/;

function extractMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  // Supabase's PostgrestError (and similar) are plain objects with a
  // `message` property — NOT instances of the native Error class. Checking
  // `instanceof Error` alone misses them entirely and falls through to
  // `String(e)`, which stringifies an object as the useless "[object
  // Object]" instead of the actual database error message.
  if (
    typeof e === "object" &&
    e !== null &&
    "message" in e &&
    typeof (e as { message: unknown }).message === "string"
  ) {
    return (e as { message: string }).message;
  }
  return String(e);
}

export function getErrorMessage(e: unknown): string {
  const message = extractMessage(e);
  if (NETWORK_ERROR_PATTERN.test(message)) {
    return "Network error — check your connection and try again.";
  }
  return message;
}
