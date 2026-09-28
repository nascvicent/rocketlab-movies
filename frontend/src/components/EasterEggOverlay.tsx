import { useEffect, useRef } from 'react'

import type { EasterEgg } from '../lib/fun'

const DURATION_MS: Record<EasterEgg, number> = {
  barbie: 4500,
  matrix: 4500,
  oppenheimer: 2600,
}

const MATRIX_GLYPHS = 'アカサタナハマヤラワ0123456789ABCDEFｱｲｳｴｵ'

function prefersReducedMotion(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

/** Chuva de código verde desenhada num canvas em tela cheia. */
function MatrixRain() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    canvas.width = window.innerWidth
    canvas.height = window.innerHeight
    const fontSize = 16
    const drops = Array.from({ length: Math.ceil(canvas.width / fontSize) }, () =>
      Math.floor((Math.random() * -canvas.height) / fontSize),
    )

    let frame = 0
    const draw = () => {
      context.fillStyle = 'rgb(0 0 0 / 0.08)'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.fillStyle = '#00ff41'
      context.font = `${fontSize}px monospace`
      drops.forEach((y, column) => {
        const glyph = MATRIX_GLYPHS[Math.floor(Math.random() * MATRIX_GLYPHS.length)]
        context.fillText(glyph, column * fontSize, y * fontSize)
        drops[column] = y * fontSize > canvas.height && Math.random() > 0.975 ? 0 : y + 1
      })
      frame = window.requestAnimationFrame(draw)
    }
    frame = window.requestAnimationFrame(draw)
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return <canvas ref={canvasRef} className="egg egg--matrix" aria-hidden="true" />
}

function BarbieHearts() {
  return (
    <div className="egg egg--barbie" aria-hidden="true">
      {Array.from({ length: 28 }, (_, index) => (
        <span
          key={index}
          style={{
            left: `${(index * 37) % 100}%`,
            animationDelay: `${(index % 7) * 0.35}s`,
            fontSize: `${16 + ((index * 13) % 22)}px`,
          }}
        >
          {index % 3 === 0 ? '✨' : '💖'}
        </span>
      ))}
    </div>
  )
}

interface EasterEggOverlayProps {
  kind: EasterEgg
  onDone: () => void
}

/** Efeito visual passageiro, disparado ao avaliar filmes específicos. */
export function EasterEggOverlay({ kind, onDone }: EasterEggOverlayProps) {
  const reduced = prefersReducedMotion()

  useEffect(() => {
    // O tema rosa não tem movimento, então vale mesmo com animações reduzidas.
    if (kind === 'barbie') document.documentElement.classList.add('theme-barbie')
    const timer = window.setTimeout(onDone, DURATION_MS[kind])
    return () => {
      window.clearTimeout(timer)
      document.documentElement.classList.remove('theme-barbie')
    }
  }, [kind, onDone])

  if (reduced) return null
  if (kind === 'matrix') return <MatrixRain />
  if (kind === 'barbie') return <BarbieHearts />
  return <div className="egg egg--flash" aria-hidden="true" />
}
