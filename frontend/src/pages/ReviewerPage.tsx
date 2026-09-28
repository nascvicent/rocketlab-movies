import { Link, useParams } from 'react-router-dom'

import { ApiError } from '../api/client'
import { useReviewer } from '../api/movies'
import type { Achievement, ReviewedMovie } from '../api/types'
import { ArrowLeftIcon } from '../components/Icons'
import { Poster } from '../components/Poster'
import { StarRating } from '../components/Stars'
import { EmptyState, ErrorState } from '../components/States'
import { catalogHref } from '../lib/catalogLocation'
import { formatNumber, formatRuntime, formatStars, genreLabel, pluralize } from '../lib/format'
import { personaFor, screenTime } from '../lib/fun'
import { avatarColor, initials } from '../lib/avatar'

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="stat-card">
      <span className="stat-card__label">{label}</span>
      <strong className="stat-card__value">{value}</strong>
      {hint && <span className="stat-card__hint">{hint}</span>}
    </div>
  )
}

function AchievementCard({ achievement }: { achievement: Achievement }) {
  const { conquistada, atual, meta } = achievement
  return (
    <li className={`badge ${conquistada ? 'badge--unlocked' : ''}`}>
      <span className="badge__icon" aria-hidden="true">
        {achievement.icone}
      </span>
      <div className="badge__body">
        <strong>{achievement.titulo}</strong>
        <span>{achievement.descricao}</span>
        {conquistada ? (
          <span className="badge__status">Conquistada!</span>
        ) : (
          <div
            className="badge__progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={meta}
            aria-valuenow={atual}
            aria-label={`${achievement.titulo}: ${atual} de ${meta}`}
          >
            <div style={{ width: `${(atual / meta) * 100}%` }} />
            <span>
              {atual}/{meta}
            </span>
          </div>
        )}
      </div>
    </li>
  )
}

function MovieHighlight({ label, movie }: { label: string; movie: ReviewedMovie }) {
  return (
    <Link to={`/filmes/${movie.sk_movie_id}`} className="highlight">
      <div className="highlight__poster">
        <Poster src={movie.url_poster} title={movie.titulo} />
      </div>
      <div>
        <span className="stat-card__label">{label}</span>
        <strong>{movie.titulo}</strong>
        <StarRating value={movie.estrelas} size={14} />
        <p className="highlight__quote">“{movie.comentario}”</p>
      </div>
    </Link>
  )
}

export function ReviewerPage() {
  const { nome = '' } = useParams()
  const reviewer = useReviewer(nome)

  if (reviewer.isPending) return <div className="container muted">Carregando perfil…</div>
  if (reviewer.isError) {
    return (
      <div className="container">
        {reviewer.error instanceof ApiError && reviewer.error.status === 404 ? (
          <EmptyState
            title="Avaliador não encontrado"
            action={
              <Link to={catalogHref()} className="btn">
                Voltar ao catálogo
              </Link>
            }
          >
            Ninguém com esse nome avaliou filmes ainda.
          </EmptyState>
        ) : (
          <ErrorState error={reviewer.error} onRetry={() => reviewer.refetch()} />
        )}
      </div>
    )
  }

  const profile = reviewer.data
  const unlocked = profile.conquistas.filter((item) => item.conquistada).length
  const hours = Math.round(profile.minutos_assistidos / 60)

  return (
    <div className="container reviewer">
      <Link to={catalogHref()} className="back-link">
        <ArrowLeftIcon size={16} /> Catálogo
      </Link>

      <header className="reviewer-hero">
        <span
          className="avatar avatar--large"
          style={{ background: avatarColor(profile.nome) }}
          aria-hidden="true"
        >
          {initials(profile.nome)}
        </span>
        <div>
          <h1>{profile.nome}</h1>
          <p className="reviewer-hero__persona">{personaFor(profile.genero_favorito)}</p>
          <p className="muted">
            {pluralize(profile.quantidade, 'avaliação', 'avaliações')} ·{' '}
            {unlocked}/{profile.conquistas.length} conquistas
          </p>
        </div>
      </header>

      <section aria-labelledby="stats-title">
        <h2 id="stats-title" className="section-title">
          Sua vida em horas de cinema
        </h2>
        <div className="stat-grid">
          <StatCard
            label="Tempo de tela"
            value={screenTime(profile.minutos_assistidos)}
            hint={`${formatNumber(hours)} horas de filmes avaliados`}
          />
          <StatCard
            label="Nota média"
            value={`${formatStars(profile.media_estrelas)} ★`}
            hint={
              profile.media_estrelas >= 3.5
                ? 'Coração generoso'
                : profile.media_estrelas <= 2
                  ? 'Crítico exigente'
                  : 'Na medida certa'
            }
          />
          <StatCard
            label="Duração média"
            value={formatRuntime(profile.duracao_media_minutos) ?? '–'}
            hint="por filme"
          />
          <StatCard
            label="Gênero do coração"
            value={profile.genero_favorito ? genreLabel(profile.genero_favorito) : '–'}
          />
          <StatCard label="Diretor oficial" value={profile.diretor_favorito ?? '–'} hint="o mais avaliado" />
        </div>
      </section>

      <section aria-labelledby="badges-title">
        <h2 id="badges-title" className="section-title">
          Conquistas <span>{unlocked} desbloqueadas</span>
        </h2>
        <ul className="badge-grid">
          {profile.conquistas.map((achievement) => (
            <AchievementCard key={achievement.id} achievement={achievement} />
          ))}
        </ul>
      </section>

      <section aria-labelledby="highlights-title">
        <h2 id="highlights-title" className="section-title">
          Destaques
        </h2>
        <div className="highlights">
          <MovieHighlight label="Mais amado" movie={profile.melhor_filme} />
          {profile.pior_filme && <MovieHighlight label="Menos amado" movie={profile.pior_filme} />}
        </div>
      </section>

      <section aria-labelledby="films-title">
        <h2 id="films-title" className="section-title">
          Filmes avaliados
          {profile.quantidade > profile.filmes.length && (
            <span>mostrando {profile.filmes.length} de {profile.quantidade}</span>
          )}
        </h2>
        <div className="movie-grid">
          {profile.filmes.map((movie, index) => (
            <Link key={`${movie.sk_movie_id}-${index}`} to={`/filmes/${movie.sk_movie_id}`} className="movie-card">
              <div className="movie-card__poster">
                <Poster src={movie.url_poster} title={movie.titulo} />
              </div>
              <div>
                <h3 className="movie-card__title">{movie.titulo}</h3>
                <StarRating value={movie.estrelas} size={13} />
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
