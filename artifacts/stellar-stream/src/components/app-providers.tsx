"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ClerkProvider, useClerk } from "@clerk/react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    return addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId.current !== undefined && previousUserId.current !== userId) {
        queryClient.clear();
      }
      previousUserId.current = userId;
    });
  }, [addListener, queryClient]);

  return null;
}

export default function AppProviders({
  children,
  publishableKey,
  proxyUrl,
}: {
  children: ReactNode;
  publishableKey: string;
  proxyUrl: string;
}) {
  const router = useRouter();
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return (
    <ClerkProvider
      publishableKey={publishableKey}
      proxyUrl={proxyUrl}
      signInUrl="/sign-in"
      signUpUrl="/sign-up"
      routerPush={(path) => router.push(path)}
      routerReplace={(path) => router.replace(path)}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        {children}
      </QueryClientProvider>
    </ClerkProvider>
  );
}
