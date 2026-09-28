import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'

import { request } from './client'
import type {
  CatalogParams,
  Genre,
  MovieDetail,
  MovieInput,
  MovieListItem,
  Page,
  RatingSummary,
  Review,
  ReviewCreated,
  ReviewInput,
} from './types'

// Chaves hierárquicas: invalidar ['movies'] atualiza catálogo, detalhes e avaliações.
export const movieKeys = {
  all: ['movies'] as const,
  list: (params: CatalogParams) => ['movies', 'list', params] as const,
  detail: (id: string) => ['movies', 'detail', id] as const,
  reviews: (id: string, page: number) => ['movies', 'reviews', id, page] as const,
}

export function useCatalog(params: CatalogParams) {
  return useQuery({
    queryKey: movieKeys.list(params),
    queryFn: () => request<Page<MovieListItem>>('/movies', { query: { ...params } }),
    // Mantém a página anterior visível enquanto a próxima carrega.
    placeholderData: keepPreviousData,
  })
}

export function useGenres() {
  return useQuery({
    queryKey: ['genres'],
    queryFn: () => request<Genre[]>('/genres'),
    staleTime: Infinity,
  })
}

export function useMovie(id: string) {
  return useQuery({
    queryKey: movieKeys.detail(id),
    queryFn: () => request<MovieDetail>(`/movies/${encodeURIComponent(id)}`),
  })
}

export function useReviews(movieId: string, page: number) {
  return useQuery({
    queryKey: movieKeys.reviews(movieId, page),
    queryFn: () =>
      request<Page<Review>>(`/movies/${encodeURIComponent(movieId)}/reviews`, {
        query: { page, page_size: 10 },
      }),
    placeholderData: keepPreviousData,
  })
}

export function useCreateMovie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: MovieInput) =>
      request<MovieDetail>('/movies', { method: 'POST', body: input }),
    onSuccess: (movie) => {
      queryClient.setQueryData(movieKeys.detail(movie.sk_movie_id), movie)
      return queryClient.invalidateQueries({ queryKey: [...movieKeys.all, 'list'] })
    },
  })
}

export function useUpdateMovie(id: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: Partial<MovieInput>) =>
      request<MovieDetail>(`/movies/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
    onSuccess: (movie) => {
      queryClient.setQueryData(movieKeys.detail(id), movie)
      return queryClient.invalidateQueries({ queryKey: [...movieKeys.all, 'list'] })
    },
  })
}

export function useDeleteMovie() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) =>
      request<void>(`/movies/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    // O detalhe do filme removido é descartado por quem chamou, depois de sair da
    // página; removê-lo aqui faria a página ainda montada buscá-lo de novo (404).
    onSuccess: () => queryClient.invalidateQueries({ queryKey: [...movieKeys.all, 'list'] }),
  })
}

export function useCreateReview(movieId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: ReviewInput) =>
      request<ReviewCreated>(`/movies/${encodeURIComponent(movieId)}/reviews`, {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: movieKeys.all }),
  })
}

export function useDeleteReview() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (reviewId: string) =>
      request<RatingSummary>(`/reviews/${encodeURIComponent(reviewId)}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: movieKeys.all }),
  })
}
