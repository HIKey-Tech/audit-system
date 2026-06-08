'use client';

import { ReactNode, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import * as RadixTooltip from '@radix-ui/react-tooltip';

export const Providers = ({ children }: { children: ReactNode }): JSX.Element => {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              if (error instanceof Error && error.message.toLowerCase().includes('session expired')) {
                return false;
              }
              return failureCount < 1;
            },
          },
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <RadixTooltip.Provider delayDuration={200} skipDelayDuration={300}>
        {children}
      </RadixTooltip.Provider>
      <Toaster
        position="top-right"
        richColors
        closeButton
        toastOptions={{
          style: {
            fontFamily: 'var(--font-inter)',
            fontSize: '13px',
          },
        }}
      />
    </QueryClientProvider>
  );
};
