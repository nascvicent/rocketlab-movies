import { useEffect, useEffectEvent, useRef, useState, type FormEvent } from 'react'
import { Link, Outlet, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { useDebouncedValue } from '../lib/useDebouncedValue'
import { CloseIcon, PlusIcon, SearchIcon } from './Icons'

/**
 * Busca global. No catálogo ela filtra enquanto se digita (com debounce e
 * atualizando a URL); nas outras páginas, Enter leva ao catálogo filtrado.
 */
function SearchBar() {
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const onCatalog = location.pathname === '/'
  const urlTerm = onCatalog ? (searchParams.get('q') ?? '') : ''

  const [term, setTerm] = useState(urlTerm)
  const debouncedTerm = useDebouncedValue(term, 350)
  const inputRef = useRef<HTMLInputElement>(null)

  // Acompanha mudanças externas da URL (voltar/avançar, links, limpar filtros).
  const [lastUrlTerm, setLastUrlTerm] = useState(urlTerm)
  if (urlTerm !== lastUrlTerm) {
    setLastUrlTerm(urlTerm)
    // Não sobrescreve o que está sendo digitado ("abc " vira q=abc na URL).
    if (term.trim() !== urlTerm) setTerm(urlTerm)
  }

  const applyTerm = useEffectEvent((typed: string) => {
    if (!onCatalog) return
    const next = typed.trim()
    if (next === (searchParams.get('q') ?? '')) return
    setSearchParams(
      (params) => {
        if (next) params.set('q', next)
        else params.delete('q')
        params.delete('page')
        return params
      },
      { replace: true },
    )
  })

  // Só reage ao termo digitado; URL e rota atuais são lidas no momento da atualização.
  useEffect(() => applyTerm(debouncedTerm), [debouncedTerm])

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const next = term.trim()
    navigate(next ? `/?q=${encodeURIComponent(next)}` : '/')
  }

  return (
    <form className="search" role="search" onSubmit={handleSubmit}>
      <label htmlFor="global-search" className="visually-hidden">
        Buscar filmes pelo título
      </label>
      <SearchIcon />
      <input
        ref={inputRef}
        id="global-search"
        type="search"
        placeholder="Buscar filmes…"
        autoComplete="off"
        value={term}
        onChange={(event) => setTerm(event.target.value)}
      />
      {term && (
        <button
          type="button"
          className="search__clear"
          aria-label="Limpar busca"
          onClick={() => {
            setTerm('')
            inputRef.current?.focus()
          }}
        >
          <CloseIcon size={16} />
        </button>
      )}
    </form>
  )
}

export function Layout() {
  const { pathname } = useLocation()

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <>
      <a href="#conteudo" className="skip-link">
        Pular para o conteúdo
      </a>
      <header className="site-header">
        <div className="container site-header__inner">
          <Link to="/" className="brand" aria-label="RocketLab Movies — página inicial">
            <span className="brand__dots" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
            RocketLab Movies
          </Link>
          <SearchBar />
          <Link to="/filmes/novo" className="btn btn--primary header-add">
            <PlusIcon size={16} />
            <span>Adicionar filme</span>
          </Link>
        </div>
      </header>
      <main id="conteudo" className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="container">RocketLab 2026.2 · Sistema de avaliação de filmes</div>
      </footer>
    </>
  )
}
