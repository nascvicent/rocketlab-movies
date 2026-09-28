import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Route, Routes, useParams } from 'react-router-dom'

import { createQueryClient } from './api/queryClient'
import { Layout } from './components/Layout'
import { ToastProvider } from './components/Toast'
import { CatalogPage } from './pages/CatalogPage'
import { MovieDetailPage } from './pages/MovieDetailPage'
import { MovieCreatePage, MovieEditPage, NotFoundPage } from './pages/MovieFormPages'

const queryClient = createQueryClient()

/** Remonta a página ao trocar de filme, zerando estados locais (ex.: página de avaliações). */
function KeyedMovieDetail() {
  const { id } = useParams()
  return <MovieDetailPage key={id} />
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<CatalogPage />} />
        <Route path="filmes/novo" element={<MovieCreatePage />} />
        <Route path="filmes/:id" element={<KeyedMovieDetail />} />
        <Route path="filmes/:id/editar" element={<MovieEditPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
