import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Link, useNavigate, useParams } from 'react-router-dom'

import { ApiError } from '../api/client'
import { movieKeys, useDeleteMovie, useMovie } from '../api/movies'
import type { MovieDetail, Person } from '../api/types'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ArrowLeftIcon, EditIcon, TrashIcon } from '../components/Icons'
import { Poster } from '../components/Poster'
import { RatingPanel } from '../components/RatingPanel'
import { ReviewForm } from '../components/ReviewForm'
import { ReviewList } from '../components/ReviewList'
import { EmptyState, ErrorState } from '../components/States'
import { useToast } from '../lib/toast'
import { catalogHref } from '../lib/catalogLocation'
import {
  formatDate,
  formatMoney,
  formatNumber,
  formatRuntime,
  genreLabel,
  pluralize,
} from '../lib/format'

function names(people: Person[]): string {
  return people.map((person) => person.nome_pessoa).join(', ')
}

function Facts({ movie }: { movie: MovieDetail }) {
  const performance = movie.desempenho
  const rows: [string, ReactNode][] = [
    ['Lançamento', formatDate(movie.data_lancamento) ?? movie.ano_lancamento],
    ['Duração', formatRuntime(movie.duracao_minutos)],
    ['Roteiro', names(movie.roteiristas)],
    ['Produção', movie.produtoras.map((company) => company.nome_produtora).join(', ')],
    ['Orçamento', formatMoney(performance?.orcamento_usd ?? null)],
    ['Bilheteria', formatMoney(performance?.receita_usd ?? null)],
    [
      'Nota TMDB',
      performance?.nota_tmdb
        ? `${performance.nota_tmdb.toFixed(1)} (${formatNumber(performance.qtd_tmdb ?? 0)} votos)`
        : null,
    ],
    [
      'Nota IMDb',
      performance?.nota_imdb
        ? `${performance.nota_imdb.toFixed(1)} (${formatNumber(performance.qtd_imdb ?? 0)} votos)`
        : null,
    ],
  ]
  const visible = rows.filter(([, value]) => value)
  if (!visible.length) return null

  return (
    <dl className="facts">
      {visible.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  )
}

export function MovieDetailPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const notify = useToast()
  const movie = useMovie(id)
  const deleteMovie = useDeleteMovie()
  const queryClient = useQueryClient()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [reviewsPage, setReviewsPage] = useState(1)

  if (movie.isPending) {
    return (
      <div className="container" aria-busy="true">
        <p className="muted">Carregando filme…</p>
      </div>
    )
  }

  if (movie.isError) {
    if (movie.error instanceof ApiError && movie.error.status === 404) {
      return (
        <div className="container">
          <EmptyState
            title="Filme não encontrado"
            action={
              <Link to="/" className="btn">
                Voltar ao catálogo
              </Link>
            }
          >
            Ele pode ter sido removido do catálogo.
          </EmptyState>
        </div>
      )
    }
    return (
      <div className="container">
        <ErrorState error={movie.error} onRetry={() => movie.refetch()} />
      </div>
    )
  }

  const data = movie.data

  async function handleDelete() {
    try {
      await deleteMovie.mutateAsync(data.sk_movie_id)
      notify(`“${data.titulo}” foi removido do catálogo.`)
      navigate(catalogHref(), { replace: true })
      queryClient.removeQueries({ queryKey: movieKeys.detail(data.sk_movie_id) })
    } catch {
      notify('Não foi possível remover o filme.', 'error')
      setConfirmingDelete(false)
    }
  }

  return (
    <>
      <div className={`backdrop ${data.url_backdrop ? '' : 'backdrop--empty'}`}>
        {data.url_backdrop && <img src={data.url_backdrop} alt="" />}
      </div>

      <div className="container">
        <section className="movie-hero" aria-labelledby="movie-title">
          <div className="movie-hero__poster">
            <Poster src={data.url_poster} title={data.titulo} eager />
          </div>
          <div className="movie-hero__body">
            <Link to={catalogHref()} className="back-link">
              <ArrowLeftIcon size={16} /> Catálogo
            </Link>
            <h1 id="movie-title" className="movie-title">
              {data.titulo}
            </h1>
            <div className="movie-subtitle dot-separated">
              {data.ano_lancamento && <span>{data.ano_lancamento}</span>}
              {data.diretores.length > 0 && (
                <span>
                  Direção de <strong>{names(data.diretores)}</strong>
                </span>
              )}
              {formatRuntime(data.duracao_minutos) && <span>{formatRuntime(data.duracao_minutos)}</span>}
              {data.status_filme && data.status_filme !== 'Lançado' && (
                <span className="status-badge">{data.status_filme}</span>
              )}
            </div>
            {data.generos.length > 0 && (
              <ul className="chips" aria-label="Gêneros">
                {data.generos
                  .map((genre) => ({ ...genre, label: genreLabel(genre.nome_genero) }))
                  .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
                  .map((genre) => (
                    <li key={genre.sk_genre_id}>
                      <Link className="chip" to={`/?genero=${genre.sk_genre_id}`}>
                        {genre.label}
                      </Link>
                    </li>
                  ))}
              </ul>
            )}
            {data.sinopse ? (
              <p className="synopsis">{data.sinopse}</p>
            ) : (
              <p className="synopsis muted">Sinopse não informada.</p>
            )}
            <div className="movie-actions">
              <Link to={`/filmes/${data.sk_movie_id}/editar`} className="btn">
                <EditIcon size={16} /> Editar
              </Link>
              <button type="button" className="btn btn--danger" onClick={() => setConfirmingDelete(true)}>
                <TrashIcon size={16} /> Excluir
              </button>
            </div>
          </div>
        </section>

        <div className="movie-layout">
          <section aria-labelledby="reviews-title">
            <h2 id="reviews-title" className="section-title">
              Avaliações
              <span>{pluralize(data.avaliacoes.quantidade, 'avaliação', 'avaliações')}</span>
            </h2>
            <ReviewForm movieId={data.sk_movie_id} onCreated={() => setReviewsPage(1)} />
            <ReviewList movieId={data.sk_movie_id} page={reviewsPage} onPageChange={setReviewsPage} />
          </section>

          <aside>
            <div className="aside-block">
              <h2 className="section-title">Nota média</h2>
              <RatingPanel summary={data.avaliacoes} distribution={data.distribuicao_estrelas} />
            </div>
            <div className="aside-block">
              <h2 className="section-title">Detalhes</h2>
              <Facts movie={data} />
            </div>
            {data.elenco.length > 0 && (
              <div className="aside-block">
                <h2 className="section-title">Elenco</h2>
                <ul className="people-list">
                  {data.elenco.map((person) => (
                    <li key={person.sk_person_id}>{person.nome_pessoa}</li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Excluir filme?"
        confirmLabel="Excluir filme"
        pending={deleteMovie.isPending}
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      >
        <p>
          <strong>{data.titulo}</strong> e todas as suas avaliações serão removidos
          permanentemente.
        </p>
      </ConfirmDialog>
    </>
  )
}
