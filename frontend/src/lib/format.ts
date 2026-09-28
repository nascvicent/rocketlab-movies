// Os gêneros chegam em inglês da base TMDB; a interface os exibe em português.
const GENRE_LABELS: Record<string, string> = {
  Action: 'Ação',
  Adventure: 'Aventura',
  Animation: 'Animação',
  Comedy: 'Comédia',
  Crime: 'Crime',
  Documentary: 'Documentário',
  Drama: 'Drama',
  Family: 'Família',
  Fantasy: 'Fantasia',
  History: 'História',
  Horror: 'Terror',
  Music: 'Música',
  Mystery: 'Mistério',
  Romance: 'Romance',
  'Science Fiction': 'Ficção científica',
  Thriller: 'Suspense',
  'Tv Movie': 'Filme para TV',
  War: 'Guerra',
  Western: 'Faroeste',
}

export function genreLabel(name: string): string {
  return GENRE_LABELS[name] ?? name
}

export function formatRuntime(minutes: number | null): string | null {
  if (!minutes) return null
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  if (!hours) return `${rest} min`
  return rest ? `${hours}h ${rest}min` : `${hours}h`
}

const usd = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
})

export function formatMoney(value: number | null): string | null {
  return value ? usd.format(value) : null
}

const integer = new Intl.NumberFormat('pt-BR')

export function formatNumber(value: number): string {
  return integer.format(value)
}

export function formatDate(iso: string | null): string | null {
  if (!iso) return null
  // Datas "AAAA-MM-DD" sem fuso: evita que o fuso local volte um dia.
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function formatRelativeDate(iso: string): string {
  // O SQLite grava CURRENT_TIMESTAMP em UTC, sem indicar o fuso.
  const date = new Date(/[zZ]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`)
  return date.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function formatStars(value: number | null): string {
  return value === null ? '–' : value.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
}

export function pluralize(count: number, singular: string, plural: string): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`
}
