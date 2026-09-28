import { QueryClient } from '@tanstack/react-query'

import { ApiError } from './client'

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Cache de consultas: voltar ao catálogo ou reabrir um filme é instantâneo.
        staleTime: 60_000,
        refetchOnWindowFocus: false,
        // Erros 4xx (ex.: filme inexistente) não melhoram com novas tentativas.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
          failureCount < 2,
      },
    },
  })
}
