import { useId, useState, type FormEvent, type KeyboardEvent } from 'react'

import { ApiError } from '../api/client'
import { useGenres } from '../api/movies'
import { MOVIE_STATUSES, type MovieInput, type MovieStatus } from '../api/types'
import { genreLabel } from '../lib/format'
import {
  CURRENT_YEAR,
  EMPTY_MOVIE_FORM,
  isHttpUrl,
  toMovieInput,
  validateMovie,
  type MovieFormErrors as Errors,
  type MovieFormValues,
} from '../lib/movieForm'
import { CloseIcon } from './Icons'
import { Poster } from './Poster'

/** Campo de múltiplos nomes: Enter ou vírgula adiciona; Backspace remove o último. */
function TagInput({
  id,
  values,
  onChange,
  placeholder,
}: {
  id: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder: string
}) {
  const [draft, setDraft] = useState('')

  function commit() {
    const name = draft.trim().replace(/,$/, '').trim()
    if (name && !values.some((value) => value.toLowerCase() === name.toLowerCase())) {
      onChange([...values, name])
    }
    setDraft('')
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault()
      commit()
    } else if (event.key === 'Backspace' && !draft && values.length) {
      onChange(values.slice(0, -1))
    }
  }

  return (
    <div className="tag-input" onClick={() => document.getElementById(id)?.focus()}>
      {values.map((value) => (
        <span key={value} className="tag">
          {value}
          <button
            type="button"
            aria-label={`Remover ${value}`}
            onClick={() => onChange(values.filter((item) => item !== value))}
          >
            <CloseIcon size={12} />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        placeholder={values.length ? '' : placeholder}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={commit}
      />
    </div>
  )
}

interface MovieFormProps {
  initialValues: MovieFormValues
  submitLabel: string
  pending: boolean
  onSubmit: (input: MovieInput) => Promise<unknown>
  onCancel: () => void
}

export function MovieForm({ initialValues, submitLabel, pending, onSubmit, onCancel }: MovieFormProps) {
  const [values, setValues] = useState(initialValues)
  const [errors, setErrors] = useState<Errors>({})
  const genres = useGenres()
  const uid = useId()
  const fieldId = (name: keyof MovieFormValues) => `${uid}-${name}`

  function set<K extends keyof MovieFormValues>(name: K, value: MovieFormValues[K]) {
    setValues((current) => ({ ...current, [name]: value }))
    if (errors[name]) setErrors((current) => ({ ...current, [name]: undefined }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validateMovie(values)
    setErrors(found)
    if (Object.keys(found).length) {
      document.getElementById(fieldId(Object.keys(found)[0] as keyof MovieFormValues))?.focus()
      return
    }
    try {
      await onSubmit(toMovieInput(values))
    } catch (error) {
      const serverErrors: Errors = {}
      if (error instanceof ApiError && error.fieldErrors.length) {
        for (const { field, message } of error.fieldErrors) {
          const key = (field.split('.')[0] || 'form') as keyof Errors
          serverErrors[key in EMPTY_MOVIE_FORM ? key : 'form'] ??= message
        }
      } else {
        serverErrors.form = error instanceof ApiError ? error.message : 'Não foi possível salvar.'
      }
      setErrors(serverErrors)
    }
  }

  const describedBy = (name: keyof MovieFormValues) =>
    errors[name] ? `${fieldId(name)}-error` : undefined

  const errorFor = (name: keyof MovieFormValues) =>
    errors[name] && (
      <span id={`${fieldId(name)}-error`} className="field__error">
        {errors[name]}
      </span>
    )

  const textField = (
    name: 'titulo' | 'ano_lancamento' | 'data_lancamento' | 'duracao_minutos' | 'url_poster' | 'url_backdrop',
    label: string,
    props: Record<string, unknown> = {},
    hint?: string,
  ) => (
    <div className="field">
      <label className="field__label" htmlFor={fieldId(name)}>
        {label}
      </label>
      <input
        id={fieldId(name)}
        className="input"
        value={values[name]}
        onChange={(event) => set(name, event.target.value)}
        aria-invalid={Boolean(errors[name])}
        aria-describedby={describedBy(name)}
        {...props}
      />
      {errorFor(name) || (hint && <span className="field__hint">{hint}</span>)}
    </div>
  )

  return (
    <div className="form-layout">
      <form className="form-card" onSubmit={handleSubmit} noValidate>
        {textField('titulo', 'Título *', { maxLength: 500, autoFocus: !initialValues.titulo })}

        <div className="form-grid">
          {textField('ano_lancamento', 'Ano de lançamento *', {
            type: 'number',
            inputMode: 'numeric',
            min: 1870,
            max: 2100,
            placeholder: String(CURRENT_YEAR),
          })}
          {textField('data_lancamento', 'Data de lançamento', { type: 'date' })}
          {textField('duracao_minutos', 'Duração (min)', {
            type: 'number',
            inputMode: 'numeric',
            min: 1,
            max: 1000,
          })}
        </div>

        <div className="form-grid form-grid--2">
          <div className="field">
            <label className="field__label" htmlFor={fieldId('diretores')}>
              Direção <small>(Enter para adicionar)</small>
            </label>
            <TagInput
              id={fieldId('diretores')}
              values={values.diretores}
              onChange={(diretores) => set('diretores', diretores)}
              placeholder="Nome do diretor"
            />
            {errorFor('diretores')}
          </div>
          <div className="field">
            <label className="field__label" htmlFor={fieldId('status_filme')}>
              Situação
            </label>
            <select
              id={fieldId('status_filme')}
              className="select"
              value={values.status_filme}
              onChange={(event) => set('status_filme', event.target.value as MovieStatus)}
            >
              {MOVIE_STATUSES.map((status) => (
                <option key={status}>{status}</option>
              ))}
            </select>
          </div>
        </div>

        <fieldset className="field" style={{ border: 0, padding: 0, margin: 0 }}>
          <legend className="field__label" style={{ marginBottom: 8 }}>
            Gêneros
          </legend>
          <div className="genre-picker">
            {genres.isPending && <span className="muted">Carregando gêneros…</span>}
            {genres.data
              ?.map((genre) => ({ ...genre, label: genreLabel(genre.nome_genero) }))
              .sort((a, b) => a.label.localeCompare(b.label, 'pt-BR'))
              .map((genre) => {
                const checked = values.generos.includes(genre.sk_genre_id)
                return (
                  <label key={genre.sk_genre_id} className="genre-toggle">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        set(
                          'generos',
                          checked
                            ? values.generos.filter((id) => id !== genre.sk_genre_id)
                            : [...values.generos, genre.sk_genre_id],
                        )
                      }
                    />
                    <span>{genre.label}</span>
                  </label>
                )
              })}
          </div>
          {errorFor('generos')}
        </fieldset>

        <div className="field">
          <label className="field__label" htmlFor={fieldId('sinopse')}>
            Sinopse
          </label>
          <textarea
            id={fieldId('sinopse')}
            className="textarea"
            rows={5}
            maxLength={4000}
            value={values.sinopse}
            onChange={(event) => set('sinopse', event.target.value)}
            aria-invalid={Boolean(errors.sinopse)}
            aria-describedby={describedBy('sinopse')}
          />
          {errorFor('sinopse')}
        </div>

        <div className="form-grid form-grid--2">
          {textField('url_poster', 'URL do pôster', { type: 'url', placeholder: 'https://…' })}
          {textField(
            'url_backdrop',
            'URL da imagem de fundo',
            { type: 'url', placeholder: 'https://…' },
            'Exibida no topo da página do filme.',
          )}
        </div>

        {errors.form && (
          <div className="form-alert" role="alert">
            {errors.form}
          </div>
        )}

        <div className="form-actions">
          <button type="button" className="btn btn--ghost" onClick={onCancel} disabled={pending}>
            Cancelar
          </button>
          <button type="submit" className="btn btn--primary" disabled={pending}>
            {pending && <span className="spinner" aria-hidden="true" />}
            {submitLabel}
          </button>
        </div>
      </form>

      <aside className="form-preview" aria-label="Pré-visualização">
        <span className="field__label">Pré-visualização</span>
        <div className="form-preview__poster">
          <Poster
            src={isHttpUrl(values.url_poster.trim()) ? values.url_poster.trim() : null}
            title={values.titulo.trim() || 'Sem título'}
          />
        </div>
        <strong>{values.titulo.trim() || 'Sem título'}</strong>
        <span className="muted">{values.ano_lancamento || '—'}</span>
      </aside>
    </div>
  )
}
