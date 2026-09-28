import type { RatingSummary } from '../api/types'
import { formatStars, pluralize } from '../lib/format'
import { StarRating } from './Stars'

interface RatingPanelProps {
  summary: RatingSummary
  distribution: Record<string, number>
}

/** Média geral do filme e a distribuição das notas por estrela. */
export function RatingPanel({ summary, distribution }: RatingPanelProps) {
  const counts = [5, 4, 3, 2, 1].map((star) => ({ star, count: distribution[star] ?? 0 }))
  const max = Math.max(1, ...counts.map((row) => row.count))

  return (
    <div className="rating-panel">
      <div className="rating-panel__score">
        <span className="rating-panel__number" aria-hidden="true">
          {formatStars(summary.media_estrelas)}
        </span>
        <div>
          <StarRating value={summary.media_estrelas} size={20} />
          <p className="rating-panel__count">
            {summary.quantidade
              ? `Média de ${pluralize(summary.quantidade, 'avaliação', 'avaliações')}`
              : 'Ainda sem avaliações'}
          </p>
        </div>
      </div>
      {summary.quantidade > 0 && (
        <div className="histogram" aria-label="Distribuição das notas">
          {counts.map(({ star, count }) => (
            <div key={star} className="histogram__row">
              <span>{star}★</span>
              <div
                className="histogram__track"
                role="img"
                aria-label={`${star} estrela${star > 1 ? 's' : ''}: ${pluralize(count, 'avaliação', 'avaliações')}`}
              >
                <div className="histogram__bar" style={{ width: `${(count / max) * 100}%` }} />
              </div>
              <span>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
