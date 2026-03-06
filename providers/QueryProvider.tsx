/**
 * QueryProvider.tsx
 * Wraps the app with TanStack Query's QueryClient.
 *
 * Default staleTime per-hook:
 *   - Activities / community feed: 60_000 ms (configured in useActivities)
 *   - Chat conversations: 0 ms + Supabase Realtime subscription (in useChat)
 *
 * The global default here is intentionally conservative.
 */
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 60_000,          // 1 min default — overridden per hook
            retry: 2,
            retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10_000),
            refetchOnWindowFocus: false, // Not useful in mobile
        },
        mutations: {
            retry: 1,
        },
    },
});

export function QueryProvider({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
