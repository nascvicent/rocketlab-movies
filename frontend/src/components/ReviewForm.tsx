import { useId, useState, type FormEvent } from 'react'

import { ApiError } from '../api/client'
import { useCreateReview } from '../api/movies'
import { StarInput } from './Stars'
import { useToast } from '../lib/toast'

const MAX_COMMENT = 4000

interface Errors {
  nome?: string
  estrelas?: string
  comentario?: string
  form?: string
}

export function ReviewForm({ movieId, onCreated }: { movieId: string; onCreated?: () => void }) {
  const [nome, setNome] = useState('')
  const [estrelas, setEstrelas] = useState(0)
  const [comentario, setComentario] = useState('')
  const [errors, setErrors] = useState<Errors>({})
  const createReview = useCreateReview(movieId)
  const notify = useToast()
  const ids = { nome: useId(), stars: useId(), comentario: useId() }

  function validate(): Errors {
    const found: Errors = {}
    if (!nome.trim()) found.nome = 'Informe seu nome.'
    if (!estrelas) found.estrelas = 'Escolha uma nota de 1 a 5 estrelas.'
    if (!comentario.trim()) found.comentario = 'Escreva uma resenha.'
    return found
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length) return

    try {
      await createReview.mutateAsync({ nome: nome.trim(), estrelas, comentario: comentario.trim() })
      setEstrelas(0)
      setComentario('')
      notify('Avaliação publicada!')
      onCreated?.()
    } catch (error) {
      const fields: Errors = {}
      if (error instanceof ApiError) {
        for (const fieldError of error.fieldErrors) {
          fields[fieldError.field as keyof Errors] ??= fieldError.message
        }
        if (!error.fieldErrors.length) fields.form = error.message
      } else {
        fields.form = 'Não foi possível publicar a avaliação.'
      }
      setErrors(fields)
    }
  }

  return (
    <form className="review-form" onSubmit={handleSubmit} noValidate aria-label="Nova avaliação">
      <div className="review-form__row">
        <div className="field">
          <label className="field__label" htmlFor={ids.nome}>
            Seu nome
          </label>
          <input
            id={ids.nome}
            className="input"
            value={nome}
            maxLength={120}
            autoComplete="name"
            aria-invalid={Boolean(errors.nome)}
            aria-describedby={errors.nome ? `${ids.nome}-error` : undefined}
            onChange={(event) => setNome(event.target.value)}
          />
          {errors.nome && (
            <span id={`${ids.nome}-error`} className="field__error">
              {errors.nome}
            </span>
          )}
        </div>
        <div className="field">
          <span className="field__label" id={ids.stars}>
            Sua nota
          </span>
          <StarInput
            value={estrelas}
            onChange={(value) => {
              setEstrelas(value)
              setErrors((current) => ({ ...current, estrelas: undefined }))
            }}
            labelledBy={ids.stars}
            invalid={Boolean(errors.estrelas)}
          />
          {errors.estrelas && <span className="field__error">{errors.estrelas}</span>}
        </div>
      </div>
      <div className="field">
        <label className="field__label" htmlFor={ids.comentario}>
          Resenha
        </label>
        <textarea
          id={ids.comentario}
          className="textarea"
          value={comentario}
          maxLength={MAX_COMMENT}
          placeholder="O que você achou do filme?"
          aria-invalid={Boolean(errors.comentario)}
          aria-describedby={errors.comentario ? `${ids.comentario}-error` : undefined}
          onChange={(event) => setComentario(event.target.value)}
        />
        {errors.comentario && (
          <span id={`${ids.comentario}-error`} className="field__error">
            {errors.comentario}
          </span>
        )}
      </div>
      {errors.form && (
        <div className="form-alert" role="alert">
          {errors.form}
        </div>
      )}
      <div className="review-form__footer">
        <span className="field__hint">
          {comentario.length.toLocaleString('pt-BR')}/{MAX_COMMENT.toLocaleString('pt-BR')}
        </span>
        <button type="submit" className="btn btn--primary" disabled={createReview.isPending}>
          {createReview.isPending && <span className="spinner" aria-hidden="true" />}
          Publicar avaliação
        </button>
      </div>
    </form>
  )
}
