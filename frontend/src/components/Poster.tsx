import { useState } from 'react'

import { FilmIcon } from './Icons'

interface PosterProps {
  src: string | null
  title: string
  eager?: boolean
}

/** Pôster 2:3 com fallback quando a URL falta ou a imagem não carrega. */
export function Poster({ src, title, eager = false }: PosterProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = src && failedSrc !== src

  return (
    <div className="poster">
      {showImage ? (
        <img
          src={src}
          alt={`Pôster de ${title}`}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setFailedSrc(src)}
        />
      ) : (
        <div className="poster__fallback" role="img" aria-label={`${title} (sem pôster)`}>
          <FilmIcon size={28} />
          <span aria-hidden="true">{title}</span>
        </div>
      )}
    </div>
  )
}
