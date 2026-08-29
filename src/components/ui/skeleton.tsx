import { cn } from "@/lib/utils";

// Shimmer placeholder — replaces bare "Loading…" text everywhere so first
// paint never shows a blank/text-only wait state.
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-stone-200", className)}
    />
  );
}
