// Supabase's PostgrestError (and similar) are plain objects with a
// `message` property — NOT instances of the native Error class. Checking
// `instanceof Error` alone misses them entirely and falls through to
// `String(e)`, which stringifies an object as the useless "[object
// Object]" instead of the actual database error message.
export function getErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
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
