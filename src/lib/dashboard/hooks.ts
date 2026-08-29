import { useQuery } from "@tanstack/react-query";
import { fetchDashboardData } from "./queries";

export function useDashboardData(startDate: string, endDate: string) {
  return useQuery({
    queryKey: ["dashboard-data", startDate, endDate],
    queryFn: () => fetchDashboardData(startDate, endDate),
  });
}
