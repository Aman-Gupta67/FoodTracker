import { TodayClient } from "./today-client";

export default async function TodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  return <TodayClient initialDate={date ?? null} />;
}
