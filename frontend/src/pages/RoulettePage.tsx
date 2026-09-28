import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import { ApiError } from '../api/client'
import { useGenres, useRoulette } from '../api/movies'
import type { MovieListItem } from '../api/types'
import { Poster } from '../components/Poster'
import { StarRating } from '../components/Stars'
import { formatRuntime, genreLabel } from '../lib/format'
import { MOODS } from '../lib/fun'

const SPIN_MS = 1400

const IMDB_OPTIONS = [
  { value: '', label: 'Qualquer nota' },
  { value: '6', label: '6+ no IMDb' },
  { value: '7', label: '7+ no IMDb' },
  { value: '8', label: '8+ no IMDb' },
]

const SPIN_PHRASES = [
  'Embaralhando as fitas…',
  'Consultando a pipoca…',
  'Rebobinando o destino…',
  'Apagando as luzes da sala…',
]

const RUNTIME_OPTIONS = [
  { value: '', label: 'Qualquer duração' },
  { value: '90', label: 'Até 1h30' },
  { value: '120', label: 'Até 2h' },
]

function RouletteResult({ movie }: { movie: MovieListItem }) {
  const runtime = formatRuntime(movie.duracao_minutos)
  return (
    <article className="roulette-result" aria-live="polite">
      <div className="roulette-result__poster">
        <Poster src={movie.url_poster} title={movie.titulo} eager />
      </div>
      <div className="roulette-result__body">
        <span className="roulette-result__kicker">Hoje você assiste…</span>
        <h2>{movie.titulo}</h2>
        <p className="muted">
          {[movie.ano_lancamento, runtime, movie.generos.map(genreLabel).join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </p>
        {movie.nota_imdb != null && (
          <span className="imdb-badge">IMDb {movie.nota_imdb.toFixed(1).replace('.', ',')}</span>
        )}
        {movie.avaliacoes.media_estrelas !== null && (
          <StarRating value={movie.avaliacoes.media_estrelas} size={18} />
        )}
        <Link to={`/filmes/${movie.sk_movie_id}`} className="btn btn--primary">
          Ver detalhes do filme
        </Link>
      </div>
    </article>
  )
}

export function RoulettePage() {
  const genres = useGenres()
  const roulette = useRoulette()
  const [moodId, setMoodId] = useState(MOODS[0].id)
  const [maxRuntime, setMaxRuntime] = useState('')
  const [minImdb, setMinImdb] = useState('')
  const [includeObscure, setIncludeObscure] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [phrase, setPhrase] = useState(0)

  // Troca as frases enquanto a roleta gira.
  useEffect(() => {
    if (!spinning) return
    const timer = window.setInterval(() => setPhrase((current) => current + 1), 350)
    return () => window.clearInterval(timer)
  }, [spinning])

  async function spin() {
    const mood = MOODS.find((item) => item.id === moodId) ?? MOODS[0]
    const genreIds = (genres.data ?? [])
      .filter((genre) => mood.genres.includes(genre.nome_genero))
      .map((genre) => genre.sk_genre_id)

    setSpinning(true)
    // O suspense mínimo faz parte da graça; a requisição corre em paralelo.
    const minimumSpin = new Promise((resolve) => window.setTimeout(resolve, SPIN_MS))
    await Promise.allSettled([
      roulette.mutateAsync({
        generos: genreIds,
        duracao_max: maxRuntime ? Number(maxRuntime) : undefined,
        nota_imdb_min: minImdb ? Number(minImdb) : undefined,
        apenas_conhecidos: !includeObscure,
      }),
      minimumSpin,
    ])
    setSpinning(false)
  }

  const error = roulette.error instanceof ApiError ? roulette.error.message : null

  return (
    <div className="container roulette">
      <div className="page-heading">
        <div>
          <h1>Roleta do que assistir</h1>
          <p>Escolha o seu humor, gire e deixe o destino decidir a sessão de hoje.</p>
        </div>
      </div>

      <section className="roulette-panel" aria-label="Preferências da roleta">
        <fieldset className="mood-picker">
          <legend className="field__label">Como você está se sentindo?</legend>
          {MOODS.map((mood) => (
            <label key={mood.id} className="mood">
              <input
                type="radio"
                name="mood"
                value={mood.id}
                checked={moodId === mood.id}
                onChange={() => setMoodId(mood.id)}
              />
              <span>
                <span className="mood__emoji" aria-hidden="true">
                  {mood.emoji}
                </span>
                {mood.label}
              </span>
            </label>
          ))}
        </fieldset>

        <div className="roulette-options">
          <div className="field">
            <label className="field__label" htmlFor="roulette-runtime">
              Quanto tempo você tem?
            </label>
            <select
              id="roulette-runtime"
              className="select"
              value={maxRuntime}
              onChange={(event) => setMaxRuntime(event.target.value)}
            >
              {RUNTIME_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label className="field__label" htmlFor="roulette-imdb">
              Nota mínima
            </label>
            <select
              id="roulette-imdb"
              className="select"
              value={minImdb}
              onChange={(event) => setMinImdb(event.target.value)}
            >
              {IMDB_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={includeObscure}
              onChange={(event) => setIncludeObscure(event.target.checked)}
            />
            Incluir filmes pouco conhecidos
          </label>
          <button
            type="button"
            className="btn btn--primary roulette-spin"
            onClick={spin}
            disabled={spinning || genres.isPending}
          >
            <span className={spinning ? 'roulette-die is-rolling' : 'roulette-die'} aria-hidden="true">
              🎲
            </span>
            {roulette.data || error ? 'Girar de novo' : 'Girar a roleta'}
          </button>
        </div>
      </section>

      <div className="roulette-stage">
        {spinning ? (
          <div className="roulette-reel" role="status">
            <div className="roulette-reel__strip" aria-hidden="true">
              {['🎬', '🍿', '🎞️', '🎟️', '📽️', '🎬'].map((icon, index) => (
                <span key={index}>{icon}</span>
              ))}
            </div>
            <p>{SPIN_PHRASES[phrase % SPIN_PHRASES.length]}</p>
          </div>
        ) : error ? (
          <div className="state" role="alert">
            <h2>Nada por aqui</h2>
            <p>{error}</p>
          </div>
        ) : roulette.data ? (
          <RouletteResult key={roulette.data.sk_movie_id} movie={roulette.data} />
        ) : (
          <div className="state">
            <p>O próximo filme favorito pode estar a um giro de distância.</p>
          </div>
        )}
      </div>
    </div>
  )
}
