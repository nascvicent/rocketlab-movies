import { type MovieInput, type MovieStatus } from '../api/types'

/** Estado do formulário: tudo como texto, convertido para `MovieInput` no envio. */
export interface MovieFormValues {
  titulo: string
  ano_lancamento: string
  data_lancamento: string
  duracao_minutos: string
  status_filme: MovieStatus
  sinopse: string
  url_poster: string
  url_backdrop: string
  diretores: string[]
  generos: string[]
}

export const EMPTY_MOVIE_FORM: MovieFormValues = {
  titulo: '',
  ano_lancamento: '',
  data_lancamento: '',
  duracao_minutos: '',
  status_filme: 'Lançado',
  sinopse: '',
  url_poster: '',
  url_backdrop: '',
  diretores: [],
  generos: [],
}

export type MovieFormErrors = Partial<Record<keyof MovieFormValues | 'form', string>>

export const CURRENT_YEAR = new Date().getFullYear()

export function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function validateMovie(values: MovieFormValues): MovieFormErrors {
  const errors: MovieFormErrors = {}
  const year = Number(values.ano_lancamento)
  if (!values.titulo.trim()) errors.titulo = 'Informe o título.'
  if (!values.ano_lancamento) errors.ano_lancamento = 'Informe o ano de lançamento.'
  else if (!Number.isInteger(year) || year < 1870 || year > 2100)
    errors.ano_lancamento = 'Use um ano entre 1870 e 2100.'
  if (values.data_lancamento && !errors.ano_lancamento) {
    if (Number(values.data_lancamento.slice(0, 4)) !== year)
      errors.data_lancamento = 'A data deve ser do mesmo ano de lançamento.'
  }
  if (values.duracao_minutos) {
    const minutes = Number(values.duracao_minutos)
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 1000)
      errors.duracao_minutos = 'Use um valor entre 1 e 1000 minutos.'
  }
  for (const field of ['url_poster', 'url_backdrop'] as const) {
    if (values[field].trim() && !isHttpUrl(values[field].trim()))
      errors[field] = 'Informe uma URL começando com http:// ou https://.'
  }
  return errors
}

export function toMovieInput(values: MovieFormValues): MovieInput {
  const optional = (value: string) => value.trim() || null
  return {
    titulo: values.titulo.trim(),
    ano_lancamento: Number(values.ano_lancamento),
    data_lancamento: optional(values.data_lancamento),
    duracao_minutos: values.duracao_minutos ? Number(values.duracao_minutos) : null,
    status_filme: values.status_filme,
    sinopse: optional(values.sinopse),
    url_poster: optional(values.url_poster),
    url_backdrop: optional(values.url_backdrop),
    diretores: values.diretores,
    generos: values.generos,
  }
}
