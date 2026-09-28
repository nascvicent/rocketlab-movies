import { pageSlots } from '../lib/pagination'
import { ChevronLeftIcon, ChevronRightIcon } from './Icons'

interface PaginationProps {
  page: number
  pages: number
  onChange: (page: number) => void
  label?: string
}

export function Pagination({ page, pages, onChange, label = 'Paginação' }: PaginationProps) {
  if (pages <= 1) return null

  return (
    <nav className="pagination" aria-label={label}>
      <button
        type="button"
        className="pagination__page"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        aria-label="Página anterior"
      >
        <ChevronLeftIcon size={16} />
      </button>
      {pageSlots(page, pages).map((slot, index) =>
        slot === 'gap' ? (
          <span key={`gap-${index}`} className="pagination__gap" aria-hidden="true">
            …
          </span>
        ) : (
          <button
            key={slot}
            type="button"
            className="pagination__page"
            onClick={() => onChange(slot)}
            aria-current={slot === page ? 'page' : undefined}
            disabled={slot === page}
            aria-label={`Página ${slot}`}
          >
            {slot.toLocaleString('pt-BR')}
          </button>
        ),
      )}
      <button
        type="button"
        className="pagination__page"
        onClick={() => onChange(page + 1)}
        disabled={page >= pages}
        aria-label="Próxima página"
      >
        <ChevronRightIcon size={16} />
      </button>
    </nav>
  )
}
