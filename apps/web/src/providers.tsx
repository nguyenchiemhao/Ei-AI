import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError } from './lib/api-client';
import { useTheme } from './state/theme';

// A 401 is handled by the client itself — it refreshes once and retries — so by the time a query
// sees one, refreshing has already failed and repeating the request cannot help. The same is true
// of every 4xx: the request was wrong, not unlucky.
function retry(failureCount: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status < 500) return false;
  return failureCount < 2;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry, staleTime: 30_000, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  useTheme();
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
