import { getAuthedClient } from "@/lib/supabase/client";
import { fetchDailyMacroTotals, type DailyMacroTotal } from "@/lib/log/queries";
import { fetchWeightLog } from "@/lib/profile/queries";

export interface DashboardData {
  macroTotals: Record<string, DailyMacroTotal>;
  weightLog: { date: string; weightKg: number }[];
}

// The Dashboard fires two reads (log_entry macros + weight_log) for the
// same date range — sharing one auth check between them instead of each
// paying its own getUser() round-trip is most of the screen's load time.
export async function fetchDashboardData(
  startDate: string,
  endDate: string,
): Promise<DashboardData> {
  const authed = await getAuthedClient();
  if (!authed) return { macroTotals: {}, weightLog: [] };

  const [macroTotals, weightLog] = await Promise.all([
    fetchDailyMacroTotals(startDate, endDate, authed),
    fetchWeightLog(startDate, endDate, authed),
  ]);

  return { macroTotals, weightLog };
}
