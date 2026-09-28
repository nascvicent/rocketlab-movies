import { useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'

import { formatStars } from '../lib/format'
import { StarShape } from './Icons'

const STAR_COUNT = 5

interface StarRatingProps {
  /** Valor de 0 a 5 (aceita frações). */
  value: number | null
  size?: number
  label?: string
}

/** Exibe uma nota em estrelas, preenchendo frações proporcionalmente. */
export function StarRating({ value, size = 16, label }: StarRatingProps) {
  const percent = value === null ? 0 : Math.max(0, Math.min(1, value / STAR_COUNT)) * 100
  const text = label ?? (value === null ? 'Sem avaliações' : `${formatStars(value)} de 5 estrelas`)
  const row = Array.from({ length: STAR_COUNT }, (_, index) => <StarShape key={index} size={size} />)

  return (
    <span className="stars" role="img" aria-label={text}>
      {row}
      <span className="stars__fill" style={{ width: `${percent}%` }}>
        {row}
      </span>
    </span>
  )
}

interface StarInputProps {
  value: number
  onChange: (value: number) => void
  id?: string
  invalid?: boolean
  labelledBy?: string
}

const MIN = 1
const STEP = 0.5

function clamp(value: number): number {
  return Math.max(MIN, Math.min(STAR_COUNT, value))
}

/**
 * Seleção de 1 a 5 estrelas em passos de meia estrela.
 * Mouse/toque: a metade esquerda de cada estrela vale meia estrela.
 * Teclado: setas, Home/End e números 1–5 (slider acessível).
 */
export function StarInput({ value, onChange, id, invalid, labelledBy }: StarInputProps) {
  const [hover, setHover] = useState<number | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const starsRef = useRef<HTMLDivElement>(null)
  const shown = hover ?? value

  function valueAt(clientX: number): number {
    const box = starsRef.current?.getBoundingClientRect()
    if (!box || box.width === 0) return value
    const raw = ((clientX - box.left) / box.width) * STAR_COUNT
    return clamp(Math.ceil(raw / STEP) * STEP)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = value || 0
    const keys: Record<string, number> = {
      ArrowRight: current + STEP,
      ArrowUp: current + STEP,
      ArrowLeft: current - STEP,
      ArrowDown: current - STEP,
      Home: MIN,
      End: STAR_COUNT,
    }
    let next = keys[event.key]
    if (next === undefined && /^[1-5]$/.test(event.key)) next = Number(event.key)
    if (next === undefined) return
    event.preventDefault()
    onChange(clamp(next))
  }

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === 'mouse') setHover(valueAt(event.clientX))
  }

  return (
    <div
      ref={rootRef}
      id={id}
      className="star-input"
      role="slider"
      tabIndex={0}
      aria-valuemin={MIN}
      aria-valuemax={STAR_COUNT}
      aria-valuenow={value || undefined}
      aria-valuetext={value ? `${formatStars(value)} de 5 estrelas` : 'Nenhuma nota selecionada'}
      aria-labelledby={labelledBy}
      aria-invalid={invalid || undefined}
      onKeyDown={handleKeyDown}
    >
      <div
        ref={starsRef}
        className="star-input__stars"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHover(null)}
        onPointerDown={(event) => {
          onChange(valueAt(event.clientX))
          // Mantém o foco no slider para ajuste fino pelas setas depois do clique.
          rootRef.current?.focus()
        }}
      >
        {Array.from({ length: STAR_COUNT }, (_, index) => {
          const fill = Math.max(0, Math.min(1, shown - index))
          return (
            <span key={index} className="star-input__star">
              <StarShape size={36} />
              <span className="star-input__half" style={{ width: `${fill * 100}%` }}>
                <StarShape size={36} />
              </span>
            </span>
          )
        })}
      </div>
      <span className="star-input__value" aria-hidden="true">
        {shown ? formatStars(shown) : '–'}
      </span>
    </div>
  )
}
