// AI routes call an LLM, and a cold serverless function invocation (the
// first request after a deploy or after the function has been idle) adds
// its own startup latency on top of that — occasionally enough to exceed
// the function's time budget and kill the connection mid-request, which
// the browser reports as a generic "Load failed"/"Failed to fetch". A
// manual retry almost always succeeds because the function is warm by
// then. Retrying once, silently, here turns that into "it just works"
// instead of surfacing an error the user has to notice and act on
// themselves — but ONLY for a network-shaped failure, never for a real
// 4xx/5xx response body, which is returned as-is on the first try.
const NETWORK_ERROR_PATTERN =
  /Load failed|Failed to fetch|NetworkError when attempting to fetch resource/;

function isNetworkError(e: unknown): boolean {
  return e instanceof TypeError && NETWORK_ERROR_PATTERN.test(e.message);
}

export async function fetchJsonWithRetry(
  url: string,
  options: RequestInit,
): Promise<{ res: Response; body: unknown }> {
  try {
    const res = await fetch(url, options);
    const body = await res.json();
    return { res, body };
  } catch (e) {
    if (!isNetworkError(e)) throw e;
    const res = await fetch(url, options);
    const body = await res.json();
    return { res, body };
  }
}
