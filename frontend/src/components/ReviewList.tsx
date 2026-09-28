import { useState } from 'react'
import { Link } from 'react-router-dom'

import { useDeleteReview, useReviews } from '../api/movies'
import type { Review } from '../api/types'
import { avatarColor, initials } from '../lib/avatar'
import { formatRelativeDate } from '../lib/format'
import { ConfirmDialog } from './ConfirmDialog'
import { TrashIcon } from './Icons'
import { Pagination } from './Pagination'
import { StarRating } from './Stars'
import { EmptyState, ErrorState } from './States'
import { useToast } from '../lib/toast'

interface ReviewListProps {
  movieId: string
  page: number
  onPageChange: (page: number) => void
}

export function ReviewList({ movieId, page, onPageChange }: ReviewListProps) {
  const reviews = useReviews(movieId, page)
  const deleteReview = useDeleteReview()
  const notify = useToast()
  const [pendingDelete, setPendingDelete] = useState<Review | null>(null)

  async function confirmDelete() {
    if (!pendingDelete) return
    try {
      await deleteReview.mutateAsync(pendingDelete.sk_movie_review_id)
      notify('Avaliação removida.')
      // Se a página ficou vazia, volta uma.
      if (reviews.data && reviews.data.items.length === 1 && page > 1) onPageChange(page - 1)
    } catch {
      notify('Não foi possível remover a avaliação.', 'error')
    } finally {
      setPendingDelete(null)
    }
  }

  if (reviews.isPending) return <p className="muted">Carregando avaliações…</p>
  if (reviews.isError) return <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />

  const { items, pages } = reviews.data
  if (!items.length) {
    return <EmptyState title="Nenhuma avaliação ainda">Seja o primeiro a avaliar este filme.</EmptyState>
  }

  return (
    <>
      <ul className="review-list" aria-busy={reviews.isPlaceholderData}>
        {items.map((review) => (
          <li key={review.sk_movie_review_id} className="review">
            <span
              className="avatar"
              style={{ background: avatarColor(review.nome) }}
              aria-hidden="true"
            >
              {initials(review.nome)}
            </span>
            <div>
              <div className="review__header">
                <Link
                  to={`/avaliadores/${encodeURIComponent(review.nome)}`}
                  className="review__author"
                  title={`Ver o perfil de ${review.nome}`}
                >
                  {review.nome}
                </Link>
                <StarRating value={review.estrelas} size={14} />
                <time dateTime={review.created_at}>{formatRelativeDate(review.created_at)}</time>
              </div>
              <p className="review__text">{review.comentario}</p>
            </div>
            <div className="review__actions">
              <button
                type="button"
                className="btn btn--ghost btn--icon"
                aria-label={`Remover avaliação de ${review.nome}`}
                title="Remover avaliação"
                onClick={() => setPendingDelete(review)}
              >
                <TrashIcon size={16} />
              </button>
            </div>
          </li>
        ))}
      </ul>
      <Pagination page={page} pages={pages} onChange={onPageChange} label="Páginas de avaliações" />
      <ConfirmDialog
        open={pendingDelete !== null}
        title="Remover avaliação?"
        confirmLabel="Remover"
        pending={deleteReview.isPending}
        onConfirm={confirmDelete}
        onCancel={() => setPendingDelete(null)}
      >
        <p>
          A avaliação de <strong>{pendingDelete?.nome}</strong> será excluída e a média do filme,
          recalculada.
        </p>
      </ConfirmDialog>
    </>
  )
}
