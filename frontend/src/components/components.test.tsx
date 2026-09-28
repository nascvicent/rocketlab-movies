import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { mockFetch, renderWithProviders } from '../test/utils'
import { ReviewForm } from './ReviewForm'
import { StarInput, StarRating } from './Stars'

afterEach(() => vi.unstubAllGlobals())

function ControlledStars() {
  const [value, setValue] = useState(0)
  return <StarInput value={value} onChange={setValue} />
}

describe('StarRating', () => {
  it('descreve a nota para leitores de tela', () => {
    render(<StarRating value={3.5} />)
    expect(screen.getByRole('img', { name: '3,5 de 5 estrelas' })).toBeInTheDocument()
  })
})

describe('StarInput', () => {
  it('ajusta a nota pelo teclado em passos de meia estrela, entre 1 e 5', async () => {
    const user = userEvent.setup()
    render(<ControlledStars />)
    const slider = screen.getByRole('slider')

    await user.click(slider)
    await user.keyboard('3')
    expect(slider).toHaveAttribute('aria-valuenow', '3')

    await user.keyboard('{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuenow', '3.5')

    await user.keyboard('{End}{ArrowRight}')
    expect(slider).toHaveAttribute('aria-valuenow', '5')

    await user.keyboard('{Home}{ArrowLeft}')
    expect(slider).toHaveAttribute('aria-valuenow', '1')
  })
})

describe('ReviewForm', () => {
  it('valida os campos antes de enviar', async () => {
    const fetchMock = mockFetch(() => ({ body: {} }))
    const user = userEvent.setup()
    renderWithProviders(<ReviewForm movieId="m1" />)

    await user.click(screen.getByRole('button', { name: 'Publicar avaliação' }))

    expect(screen.getByText('Informe seu nome.')).toBeInTheDocument()
    expect(screen.getByText('Escolha uma nota de 1 a 5 estrelas.')).toBeInTheDocument()
    expect(screen.getByText('Escreva uma resenha.')).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('envia a nota em estrelas e limpa a resenha', async () => {
    const fetchMock = mockFetch(() => ({
      status: 201,
      body: {
        review: { sk_movie_review_id: 'r1', nome: 'Ana', nota: 9, estrelas: 4.5, comentario: 'Ótimo' },
        avaliacoes: { quantidade: 1, media_nota: 9, media_estrelas: 4.5 },
      },
    }))
    const onCreated = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(<ReviewForm movieId="m1" onCreated={onCreated} />)

    await user.type(screen.getByLabelText('Seu nome'), 'Ana')
    await user.click(screen.getByRole('slider'))
    await user.keyboard('4{ArrowRight}')
    await user.type(screen.getByLabelText('Resenha'), '  Ótimo  ')
    await user.click(screen.getByRole('button', { name: 'Publicar avaliação' }))

    await waitFor(() => expect(onCreated).toHaveBeenCalled())
    const [url, init] = fetchMock.mock.calls[0]
    expect(url.toString()).toContain('/api/v1/movies/m1/reviews')
    expect(JSON.parse(init!.body as string)).toEqual({
      nome: 'Ana',
      estrelas: 4.5,
      comentario: 'Ótimo',
    })
    expect(screen.getByLabelText('Resenha')).toHaveValue('')
    expect(await screen.findByText('Avaliação publicada!')).toBeInTheDocument()
  })

  it('mostra erros de validação devolvidos pela API no campo certo', async () => {
    mockFetch(() => ({
      status: 422,
      body: { detail: [{ loc: ['body', 'comentario'], msg: 'Resenha muito longa' }] },
    }))
    const user = userEvent.setup()
    renderWithProviders(<ReviewForm movieId="m1" />)

    await user.type(screen.getByLabelText('Seu nome'), 'Ana')
    await user.click(screen.getByRole('slider'))
    await user.keyboard('5')
    await user.type(screen.getByLabelText('Resenha'), 'Texto')
    await user.click(screen.getByRole('button', { name: 'Publicar avaliação' }))

    expect(await screen.findByText('Resenha muito longa')).toBeInTheDocument()
  })
})
