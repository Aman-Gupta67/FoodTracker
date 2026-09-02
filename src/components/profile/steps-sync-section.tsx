"use client";

import { useState } from "react";
import { Footprints, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegenerateStepsSyncToken } from "@/lib/profile/hooks";
import { getErrorMessage } from "@/lib/error";

// A PWA can't read HealthKit directly — no web API reaches it, even
// installed to the home screen. This is the workaround: an iOS Shortcuts
// automation reads today's step count from Health and POSTs it to
// /api/steps/sync, authenticated by this token instead of a normal login
// (a Shortcut can't hold a session/cookie).
export function StepsSyncSection({
  stepsSyncToken,
}: {
  stepsSyncToken: string | null;
}) {
  const [showInstructions, setShowInstructions] = useState(false);
  const [copied, setCopied] = useState<"token" | "url" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const regenerate = useRegenerateStepsSyncToken();

  const endpointUrl =
    typeof window !== "undefined" ? `${window.location.origin}/api/steps/sync` : "";

  async function copy(value: string, which: "token" | "url") {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // Clipboard access can be denied by the browser — the value is still
      // shown on screen to copy by hand, so this just isn't a hard failure.
    }
  }

  async function handleGenerate() {
    setError(null);
    try {
      await regenerate.mutateAsync();
    } catch (e) {
      setError(getErrorMessage(e));
    }
  }

  async function handleRegenerate() {
    if (
      !window.confirm(
        "Regenerate the sync token? Any Shortcut still using the old one will stop working until you update it.",
      )
    ) {
      return;
    }
    await handleGenerate();
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5">
        <Footprints size={16} className="text-primary-600" />
        <p className="text-[13.5px] font-bold">Steps sync</p>
      </div>
      <p className="mb-3 text-xs text-stone-500">
        Syncs daily step count from Apple Health via an iOS Shortcuts automation —
        there&rsquo;s no direct way for this app to read Health data.
      </p>

      {!stepsSyncToken ? (
        <Button
          variant="outline"
          className="w-full rounded-2xl border-primary-200 bg-primary-50 text-primary-700"
          onClick={handleGenerate}
          disabled={regenerate.isPending}
        >
          {regenerate.isPending ? "Generating…" : "Set up steps sync"}
        </Button>
      ) : (
        <div className="space-y-2.5">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Endpoint URL
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2">
              <code className="flex-1 truncate text-[11.5px] text-stone-700">{endpointUrl}</code>
              <button
                type="button"
                aria-label="Copy endpoint URL"
                onClick={() => copy(endpointUrl, "url")}
                className="flex-shrink-0 text-stone-400 hover:text-stone-600"
              >
                {copied === "url" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-stone-500">
              Token
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-stone-50 px-3 py-2">
              <code className="flex-1 truncate text-[11.5px] text-stone-700">{stepsSyncToken}</code>
              <button
                type="button"
                aria-label="Copy token"
                onClick={() => copy(stepsSyncToken, "token")}
                className="flex-shrink-0 text-stone-400 hover:text-stone-600"
              >
                {copied === "token" ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          <button
            type="button"
            className="text-xs font-semibold text-primary-700"
            onClick={() => setShowInstructions((v) => !v)}
          >
            {showInstructions ? "Hide setup steps" : "How to set this up →"}
          </button>

          {showInstructions ? (
            <ol className="list-decimal space-y-1.5 rounded-xl bg-stone-50 p-3 pl-6 text-[12px] text-stone-600">
              <li>Open the Shortcuts app → New Shortcut.</li>
              <li>
                Add <strong>Find Health Samples</strong> (or <strong>Get Health Sample</strong>) — type
                Steps, date range Today.
              </li>
              <li>
                Add <strong>Calculate Sum</strong> on the samples&rsquo; quantities to get one number.
              </li>
              <li>
                Add <strong>Get Contents of URL</strong>: method POST, URL is the endpoint above, headers
                include <code>Authorization: Bearer &lt;your token&gt;</code> and{" "}
                <code>Content-Type: application/json</code>, request body (JSON):{" "}
                <code>{"{ \"date\": \"<today, YYYY-MM-DD>\", \"steps\": <the sum> }"}</code>.
              </li>
              <li>
                Save, then in the Automation tab add a <strong>Time of Day</strong> trigger (e.g. 11:55
                PM daily) running this shortcut, with &ldquo;Ask Before Running&rdquo; turned off.
              </li>
              <li>
                Exact action names vary a little by iOS version — the shape above (find steps → sum →
                POST) is what matters.
              </li>
            </ol>
          ) : null}

          <button
            type="button"
            className="text-xs font-semibold text-stone-500 disabled:opacity-50"
            onClick={handleRegenerate}
            disabled={regenerate.isPending}
          >
            {regenerate.isPending ? "Regenerating…" : "Regenerate token"}
          </button>
        </div>
      )}

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
