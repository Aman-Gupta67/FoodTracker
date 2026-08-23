import { LocalCatalogProvider } from "./local-catalog-provider";
import { OffProvider } from "./off-provider";
import type { FoodCandidate, FoodProvider, FoodQuery } from "./types";

// Registered in priority order (lower first). Adding OFF/FDC/LLM later is
// appending to this array, not touching call sites.
const providers: FoodProvider[] = [
  new LocalCatalogProvider(),
  new OffProvider(),
].sort((a, b) => a.priority - b.priority);

// Walks registered providers in priority order, stopping at the first
// non-empty result.
export async function resolveFoodCandidates(
  q: FoodQuery,
  signal: AbortSignal,
): Promise<FoodCandidate[]> {
  for (const provider of providers) {
    if (!provider.canHandle(q)) continue;
    const results = await provider.search(q, signal);
    if (results.length > 0) return results;
  }
  return [];
}
