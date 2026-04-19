import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";

import { ApiError } from "./error";
import type { TelemetryAdapter } from "./telemetry";

type CreateQueryClientOptions = {
  telemetry?: TelemetryAdapter;
};

export function createQueryClient(options: CreateQueryClientOptions = {}) {
  const { telemetry } = options;

  return new QueryClient({
    mutationCache: new MutationCache({
      onError: (error, _variables, _context, mutation) => {
        telemetry?.captureError(error, {
          operation: "mutation",
          mutationKey: mutation.options.mutationKey,
        });
      },
    }),
    queryCache: new QueryCache({
      onError: (error, query) => {
        telemetry?.captureError(error, {
          operation: "query",
          queryKey: query.queryKey,
        });
      },
    }),
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.kind === "offline") {
              return false;
            }

            if (error.status === 401 || error.status === 403) {
              return false;
            }
          }

          return failureCount < 1;
        },
        staleTime: 30_000,
        refetchOnReconnect: true,
        refetchOnWindowFocus: true,
      },
    },
  });
}
