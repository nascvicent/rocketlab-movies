import { Link } from 'react-router-dom'

import type { MovieListItem } from '../api/types'
import { formatStars, genreLabel } from '../lib/format'
import { StarShape } from './Icons'
import { Poster } from './Poster'

export function MovieCard({ movie, eager }: { movie: MovieListItem; eager?: boolean }) {
  const { avaliacoes } = movie
  const rating =
    avaliacoes.media_estrelas === null
      ? 'sem avaliações'
      : `nota média ${formatStars(avaliacoes.media_estrelas)} de 5`

  return (
    <Link
      to={`/filmes/${movie.sk_movie_id}`}
      className="movie-card"
      aria-label={`${movie.titulo}${movie.ano_lancamento ? ` (${movie.ano_lancamento})` : ''}, ${rating}`}
      title={movie.generos.map(genreLabel).join(', ') || undefined}
    >
      <div className="movie-card__poster">
        <Poster src={movie.url_poster} title={movie.titulo} eager={eager} />
      </div>
      <div>
        <h3 className="movie-card__title">{movie.titulo}</h3>
        <div className="movie-card__meta">
          <span>{movie.ano_lancamento ?? '—'}</span>
          {avaliacoes.media_estrelas !== null && (
            <span className="movie-card__rating">
              <StarShape size={13} style={{ color: 'var(--star)' }} />
              {formatStars(avaliacoes.media_estrelas)}
              <span className="muted">({avaliacoes.quantidade})</span>
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
