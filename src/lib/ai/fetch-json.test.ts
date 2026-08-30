import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchJsonWithRetry } from "./fetch-json";

// A dropped connection mid-request during a cold serverless-function
// invocation surfaces client-side as this exact TypeError shape — a real
// production incident this test guards against regressing.
function networkError(message: string) {
  return new TypeError(message);
}

function jsonResponse(ok: boolean, body: unknown) {
  return { ok, json: () => Promise.resolve(body) } as Response;
}

describe("fetchJsonWithRetry", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the first response when it succeeds", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(true, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { res, body } = await fetchJsonWithRetry("/api/x", {});

    expect(res.ok).toBe(true);
    expect(body).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries once on a network-shaped failure and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(networkError("Load failed"))
      .mockResolvedValueOnce(jsonResponse(true, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const { res, body } = await fetchJsonWithRetry("/api/x", {});

    expect(res.ok).toBe(true);
    expect(body).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("throws after the retry also fails", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(networkError("Failed to fetch"))
      .mockRejectedValueOnce(networkError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJsonWithRetry("/api/x", {})).rejects.toThrow("Failed to fetch");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("does not retry a real error response (e.g. 401) — returns it as-is", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(false, { error: "Not authenticated." }));
    vi.stubGlobal("fetch", fetchMock);

    const { res, body } = await fetchJsonWithRetry("/api/x", {});

    expect(res.ok).toBe(false);
    expect(body).toEqual({ error: "Not authenticated." });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not retry a non-network error (e.g. a JSON parse failure)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError("Unexpected token")),
    } as unknown as Response);
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchJsonWithRetry("/api/x", {})).rejects.toThrow("Unexpected token");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
