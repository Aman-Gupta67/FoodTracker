"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getErrorMessage } from "@/lib/error";
import {
  requestProfileRecommendation,
  type ProfileRecommendationRequest,
} from "@/lib/ai/profile-recommendation-client";
import type { ProfileRecommendation } from "@/lib/ai/profile-recommendation";

// Explicit trigger, not auto-fetch-on-change — the profile form changes on
// every keystroke, and firing an LLM call per edit would be wasteful and
// noisy. The user asks for the analysis when they actually want it.
export function AiRecommendationSection({
  input,
}: {
  input: ProfileRecommendationRequest;
}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ProfileRecommendation | null>(null);

  async function handleAnalyze() {
    setIsLoading(true);
    setError(null);
    try {
      setResult(await requestProfileRecommendation(input));
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <div className="mb-1 flex items-center gap-1.5">
        <Sparkles size={16} className="text-primary-600" />
        <p className="text-[13.5px] font-bold">AI coach</p>
      </div>
      {!result ? (
        <p className="mb-3 text-xs text-stone-500">
          Get a quick read on whether your targets make sense for your goal.
        </p>
      ) : null}
      <Button
        variant="outline"
        className="w-full rounded-2xl border-primary-200 bg-primary-50 text-primary-700"
        onClick={handleAnalyze}
        disabled={isLoading}
      >
        {isLoading ? "Analyzing…" : result ? "Re-analyze" : "Get AI analysis"}
      </Button>

      {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

      {result ? (
        <div className="mt-3 text-sm">
          <p className="text-stone-700">{result.summary}</p>
          {result.suggestions.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-stone-600">
              {result.suggestions.map((s, i) => (
                <li key={i}>{s}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
