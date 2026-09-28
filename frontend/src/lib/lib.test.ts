import { describe, expect, it } from 'vitest'

import { formatDate, formatRuntime, formatStars, genreLabel, pluralize } from './format'
import { EMPTY_MOVIE_FORM, toMovieInput, validateMovie } from './movieForm'
import { pageSlots } from './pagination'

describe('pageSlots', () => {
  it('lista todas as páginas quando são poucas', () => {
    expect(pageSlots(2, 4)).toEqual([1, 2, 3, 4])
  })

  it('usa reticências longe da página atual', () => {
    expect(pageSlots(50, 3986)).toEqual([1, 'gap', 49, 50, 51, 'gap', 3986])
  })

  it('não usa reticências para esconder uma única página', () => {
    expect(pageSlots(4, 10)).toEqual([1, 2, 3, 4, 5, 'gap', 10])
  })
})

describe('format', () => {
  it('traduz gêneros e preserva os desconhecidos', () => {
    expect(genreLabel('Science Fiction')).toBe('Ficção científica')
    expect(genreLabel('Kaiju')).toBe('Kaiju')
  })

  it('formata duração', () => {
    expect(formatRuntime(128)).toBe('2h 8min')
    expect(formatRuntime(120)).toBe('2h')
    expect(formatRuntime(45)).toBe('45 min')
    expect(formatRuntime(null)).toBeNull()
  })

  it('formata datas sem deslocar o dia pelo fuso', () => {
    expect(formatDate('2023-08-16')).toBe('16 de agosto de 2023')
  })

  it('formata notas e plurais em português', () => {
    expect(formatStars(3.575)).toBe('3,6')
    expect(formatStars(null)).toBe('–')
    expect(pluralize(1, 'avaliação', 'avaliações')).toBe('1 avaliação')
    expect(pluralize(1200, 'avaliação', 'avaliações')).toBe('1.200 avaliações')
  })
})

describe('movieForm', () => {
  const valid = { ...EMPTY_MOVIE_FORM, titulo: 'Amélie', ano_lancamento: '2001' }

  it('exige título e ano', () => {
    expect(validateMovie(EMPTY_MOVIE_FORM)).toMatchObject({
      titulo: expect.any(String),
      ano_lancamento: expect.any(String),
    })
    expect(validateMovie(valid)).toEqual({})
  })

  it('valida coerência entre ano e data, duração e URLs', () => {
    const errors = validateMovie({
      ...valid,
      data_lancamento: '2002-01-01',
      duracao_minutos: '0',
      url_poster: 'javascript:alert(1)',
    })
    expect(Object.keys(errors).sort()).toEqual(['data_lancamento', 'duracao_minutos', 'url_poster'])
  })

  it('converte o formulário no payload da API', () => {
    expect(
      toMovieInput({ ...valid, titulo: '  Amélie ', duracao_minutos: '122', sinopse: '   ' }),
    ).toEqual({
      titulo: 'Amélie',
      ano_lancamento: 2001,
      data_lancamento: null,
      duracao_minutos: 122,
      status_filme: 'Lançado',
      sinopse: null,
      url_poster: null,
      url_backdrop: null,
      diretores: [],
      generos: [],
    })
  })
})
