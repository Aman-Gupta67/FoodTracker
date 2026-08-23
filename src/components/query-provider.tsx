"use client";

import { useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";

// Phase 5's offline acceptance criterion ("view past days" in airplane
// mode) needs log/dish/target data to survive a reload without network —
// TanStack Query's own in-memory cache doesn't (it's empty on a fresh page
// load). Persisting to localStorage is the minimal way to satisfy that
// without hand-rolling a Dexie table for log data, which CLAUDE.md's stack
// section scopes Dexie to catalog-only.
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            gcTime: ONE_WEEK_MS,
            staleTime: 5 * 60 * 1000,
          },
        },
      }),
  );

  const [persister] = useState(() =>
    typeof window !== "undefined"
      ? createSyncStoragePersister({ storage: window.localStorage })
      : null,
  );

  if (!persister) {
    // Server render has no window/localStorage — falls back to a plain
    // provider for that pass only; the client mount below always has one.
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  }

  return (
    <PersistQueryClientProvider
      client={client}
      persistOptions={{ persister, maxAge: ONE_WEEK_MS }}
    >
      {children}
    </PersistQueryClientProvider>
  );
}
