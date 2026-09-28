import type { ReactNode } from 'react'

import { ApiError } from '../api/client'

interface StateProps {
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, children, action }: StateProps) {
  return (
    <div className="state">
      <h2>{title}</h2>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const message = error instanceof ApiError ? error.message : 'Algo deu errado.'
  return (
    <div className="state" role="alert">
      <h2>Não foi possível carregar</h2>
      <p>{message}</p>
      {onRetry && (
        <button type="button" className="btn" onClick={onRetry}>
          Tentar novamente
        </button>
      )}
    </div>
  )
}

export function GridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="movie-grid" aria-busy="true" aria-label="Carregando filmes">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="movie-card">
          <div className="skeleton" style={{ aspectRatio: '2 / 3' }} />
          <div className="skeleton" style={{ height: 14, width: '80%' }} />
        </div>
      ))}
    </div>
  )
}
