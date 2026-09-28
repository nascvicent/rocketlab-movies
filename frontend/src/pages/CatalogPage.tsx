import { useEffect, useEffectEvent, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import { useCatalog, useGenres } from '../api/movies'
import type { CatalogParams, MovieSort } from '../api/types'
import { PlusIcon } from '../components/Icons'
import { MovieCard } from '../components/MovieCard'
import { Pagination } from '../components/Pagination'
import { EmptyState, ErrorState, GridSkeleton } from '../components/States'
import { rememberCatalogSearch } from '../lib/catalogLocation'
import { genreLabel, pluralize } from '../lib/format'
import { useDebouncedValue } from '../lib/useDebouncedValue'

const PAGE_SIZE = 24

const SORT_OPTIONS: { value: MovieSort; label: string }[] = [
  { value: 'popularidade', label: 'Mais populares' },
  { value: 'nota', label: 'Mais bem avaliados' },
  { value: 'recentes', label: 'Lançamentos mais recentes' },
  { value: 'antigos', label: 'Lançamentos mais antigos' },
  { value: 'titulo', label: 'Título (A–Z)' },
]

const FILTER_KEYS = ['q', 'genero', 'ordenar', 'ano_de', 'ano_ate', 'page'] as const
type FilterKey = (typeof FILTER_KEYS)[number]

function toYear(value: string | null): number | undefined {
  const year = Number(value)
  return value && Number.isInteger(year) && year >= 1870 && year <= 2100 ? year : undefined
}

function readParams(searchParams: URLSearchParams): CatalogParams {
  const sort = searchParams.get('ordenar') as MovieSort | null
  const page = Number(searchParams.get('page'))
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    page_size: PAGE_SIZE,
    q: searchParams.get('q') ?? undefined,
    genero: searchParams.get('genero') ?? undefined,
    ordenar: SORT_OPTIONS.some((option) => option.value === sort) ? (sort as MovieSort) : undefined,
    ano_de: toYear(searchParams.get('ano_de')),
    ano_ate: toYear(searchParams.get('ano_ate')),
  }
}

/** Campo de ano que só atualiza a URL depois que o usuário para de digitar. */
function YearInput({
  id,
  label,
  value,
  onCommit,
}: {
  id: string
  label: string
  value: number | undefined
  onCommit: (value: string) => void
}) {
  const [draft, setDraft] = useState(value?.toString() ?? '')
  const debounced = useDebouncedValue(draft, 500)

  const [lastValue, setLastValue] = useState(value)
  if (value !== lastValue) {
    setLastValue(value)
    setDraft(value?.toString() ?? '')
  }

  const commit = useEffectEvent((typed: string) => {
    if (typed === (value?.toString() ?? '')) return
    if (typed === '' || toYear(typed) !== undefined) onCommit(typed)
  })

  useEffect(() => commit(debounced), [debounced])

  return (
    <div className="field field--year">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="numeric"
        min={1870}
        max={2100}
        placeholder="Ano"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
    </div>
  )
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { search } = useLocation()
  const params = readParams(searchParams)

  useEffect(() => rememberCatalogSearch(search), [search])
  const catalog = useCatalog(params)
  const genres = useGenres()

  const hasFilters = Boolean(params.q || params.genero || params.ano_de || params.ano_ate)

  function update(changes: Partial<Record<FilterKey, string>>) {
    setSearchParams((current) => {
      for (const [key, value] of Object.entries(changes)) {
        if (value) current.set(key, value)
        else current.delete(key)
      }
      // Qualquer filtro novo volta para a primeira página.
      if (!('page' in changes)) current.delete('page')
      return current
    })
  }

  function goToPage(page: number) {
    update({ page: page > 1 ? String(page) : '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const data = catalog.data
  // Se a URL apontar para uma página além do fim (ex.: após remover filmes), volta à última.
  useEffect(() => {
    if (data && data.total > 0 && params.page > data.pages) goToPage(data.pages)
  })

  return (
    <div className="container">
      <div className="page-heading">
        <div>
          <h1>{params.q ? `Resultados para “${params.q}”` : 'Catálogo de filmes'}</h1>
          <p>
            {data
              ? pluralize(data.total, 'filme encontrado', 'filmes encontrados')
              : 'Navegue, filtre e avalie o acervo.'}
          </p>
        </div>
      </div>

      <section className="filters" aria-label="Filtros do catálogo">
        <div className="field">
          <label className="field__label" htmlFor="filter-genre">
            Gênero
          </label>
          <select
            id="filter-genre"
            className="select"
            value={params.genero ?? ''}
            onChange={(event) => update({ genero: event.target.value })}
          >
            <option value="">Todos os gêneros</option>
            {genres.data
              ?.map((genre) => ({ ...genre, label: genreLabel(genre.nome_genero) }))
              .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
              .map((genre) => (
                <option key={genre.sk_genre_id} value={genre.sk_genre_id}>
                  {genre.label}
                </option>
              ))}
          </select>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="filter-sort">
            Ordenar por
          </label>
          <select
            id="filter-sort"
            className="select"
            value={params.ordenar ?? 'popularidade'}
            onChange={(event) =>
              update({ ordenar: event.target.value === 'popularidade' ? '' : event.target.value })
            }
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
        <YearInput
          id="filter-year-from"
          label="De"
          value={params.ano_de}
          onCommit={(value) => update({ ano_de: value })}
        />
        <YearInput
          id="filter-year-to"
          label="Até"
          value={params.ano_ate}
          onCommit={(value) => update({ ano_ate: value })}
        />
        {hasFilters && (
          <button
            type="button"
            className="btn btn--ghost filters__reset"
            onClick={() => update({ q: '', genero: '', ano_de: '', ano_ate: '' })}
          >
            Limpar filtros
          </button>
        )}
      </section>

      {params.ordenar === 'nota' && (
        <p className="results-summary">Mostrando apenas filmes que já receberam avaliações.</p>
      )}

      {catalog.isPending ? (
        <GridSkeleton count={PAGE_SIZE} />
      ) : catalog.isError ? (
        <ErrorState error={catalog.error} onRetry={() => catalog.refetch()} />
      ) : data && data.items.length === 0 ? (
        <EmptyState
          title="Nenhum filme encontrado"
          action={
            <Link to="/filmes/novo" className="btn btn--primary">
              <PlusIcon size={16} /> Cadastrar um filme
            </Link>
          }
        >
          {hasFilters
            ? 'Tente outros termos de busca ou remova alguns filtros.'
            : 'O catálogo ainda está vazio.'}
        </EmptyState>
      ) : (
        data && (
          <>
            <div className="movie-grid" aria-busy={catalog.isPlaceholderData}>
              {data.items.map((movie, index) => (
                <MovieCard key={movie.sk_movie_id} movie={movie} eager={index < 6} />
              ))}
            </div>
            <Pagination page={data.page} pages={data.pages} onChange={goToPage} />
          </>
        )
      )}
    </div>
  )
}
