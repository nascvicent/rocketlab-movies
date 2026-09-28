import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'

import type { MovieListItem, Page } from '../api/types'
import { mockFetch, renderWithProviders } from '../test/utils'
import { CatalogPage } from './CatalogPage'

afterEach(() => vi.unstubAllGlobals())

function movie(id: string, titulo: string, media: number | null = null): MovieListItem {
  return {
    sk_movie_id: id,
    titulo,
    ano_lancamento: 2023,
    duracao_minutos: 100,
    url_poster: null,
    popularidade: 10,
    generos: ['Drama'],
    avaliacoes: {
      quantidade: media === null ? 0 : 2,
      media_nota: media === null ? null : media * 2,
      media_estrelas: media,
    },
  }
}

function page(items: MovieListItem[], total = items.length, current = 1): Page<MovieListItem> {
  return { items, total, page: current, page_size: 24, pages: Math.max(1, Math.ceil(total / 24)) }
}

function renderCatalog(route = '/') {
  return renderWithProviders(
    <Routes>
      <Route path="/" element={<CatalogPage />} />
    </Routes>,
    { route },
  )
}

describe('CatalogPage', () => {
  it('lista os filmes com a nota média', async () => {
    mockFetch((url) =>
      url.pathname.endsWith('/genres')
        ? { body: [{ sk_genre_id: 'g1', nome_genero: 'Drama' }] }
        : { body: page([movie('m1', 'Barbie', 3.5), movie('m2', 'Oppenheimer')], 2) },
    )

    renderCatalog()

    const barbie = await screen.findByRole('link', { name: /Barbie \(2023\), nota média 3,5 de 5/ })
    expect(barbie).toHaveAttribute('href', '/filmes/m1')
    expect(screen.getByRole('link', { name: /Oppenheimer \(2023\), sem avaliações/ })).toBeInTheDocument()
    expect(screen.getByText('2 filmes encontrados')).toBeInTheDocument()
    expect(await screen.findByRole('option', { name: 'Drama' })).toBeInTheDocument()
  })

  it('repassa busca, filtros e página da URL para a API', async () => {
    const fetchMock = mockFetch((url) =>
      url.pathname.endsWith('/genres') ? { body: [] } : { body: page([], 0) },
    )

    renderCatalog('/?q=amelie&genero=g1&ordenar=nota&page=3&ano_de=2020')

    expect(await screen.findByText('Nenhum filme encontrado')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Resultados para “amelie”' })).toBeInTheDocument()
    const catalogCall = fetchMock.mock.calls
      .map(([input]) => new URL(input.toString(), 'http://localhost'))
      .find((url) => url.pathname === '/api/v1/movies')!
    expect(Object.fromEntries(catalogCall.searchParams)).toEqual({
      page: '3',
      page_size: '24',
      q: 'amelie',
      genero: 'g1',
      ordenar: 'nota',
      ano_de: '2020',
    })
  })

  it('pagina o catálogo', async () => {
    const fetchMock = mockFetch((url) => {
      if (url.pathname.endsWith('/genres')) return { body: [] }
      const current = Number(url.searchParams.get('page'))
      return { body: page([movie(`m${current}`, `Filme da página ${current}`)], 100, current) }
    })
    const user = userEvent.setup()

    renderCatalog()
    const nav = await screen.findByRole('navigation', { name: 'Paginação' })
    await user.click(within(nav).getByRole('button', { name: 'Página 2' }))

    expect(await screen.findByRole('heading', { name: 'Filme da página 2' })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      expect.objectContaining({ search: expect.stringContaining('page=2') }),
      expect.anything(),
    )
  })

  it('mostra o erro da API com opção de tentar novamente', async () => {
    mockFetch(() => ({ status: 500, body: { detail: 'boom' } }))

    renderCatalog()

    expect(await screen.findByRole('alert')).toHaveTextContent('boom')
    expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
  })
})
