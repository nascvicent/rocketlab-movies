import { foldText } from './text'

// ------------------------------------------------------------------ //
// Filtro de humor (roleta)                                            //
// ------------------------------------------------------------------ //

export interface Mood {
  id: string
  emoji: string
  label: string
  /** Nomes de gênero da base (em inglês); basta o filme ter um deles. */
  genres: string[]
}

export const MOODS: Mood[] = [
  { id: 'tanto-faz', emoji: '🎲', label: 'Tanto faz', genres: [] },
  { id: 'chorar', emoji: '😭', label: 'Quero chorar', genres: ['Drama', 'Romance'] },
  { id: 'rir', emoji: '😂', label: 'Quero rir', genres: ['Comedy'] },
  { id: 'tensao', emoji: '😱', label: 'Tensão pura', genres: ['Thriller', 'Horror', 'Mystery'] },
  {
    id: 'viajar',
    emoji: '🚀',
    label: 'Viajar para longe',
    genres: ['Adventure', 'Fantasy', 'Science Fiction'],
  },
  { id: 'adrenalina', emoji: '💥', label: 'Adrenalina', genres: ['Action', 'War', 'Western'] },
  { id: 'aprender', emoji: '🧠', label: 'Aprender algo', genres: ['Documentary', 'History'] },
  { id: 'familia', emoji: '🧸', label: 'Sessão em família', genres: ['Family', 'Animation'] },
]

// ------------------------------------------------------------------ //
// Persona do avaliador                                                //
// ------------------------------------------------------------------ //

const PERSONAS: Record<string, string> = {
  Action: 'Caçador de adrenalina 💥',
  Adventure: 'Alma aventureira 🗺️',
  Animation: 'Criança por dentro 🧸',
  Comedy: 'Rei das gargalhadas 😂',
  Crime: 'Detetive de poltrona 🕵️',
  Documentary: 'Curioso incorrigível 🧠',
  Drama: 'Alma dramática 🎭',
  Family: 'Sessão pipoca em família 🍿',
  Fantasy: 'Sonhador de outros mundos 🐉',
  History: 'Viajante do tempo ⏳',
  Horror: 'Coração de pedra 👻',
  Music: 'Ouvido afinado 🎵',
  Mystery: 'Decifrador de enigmas 🔍',
  Romance: 'Romântico incurável 💘',
  'Science Fiction': 'Explorador do futuro 🚀',
  Thriller: 'Viciado em suspense 😱',
  'Tv Movie': 'Maratonista do sofá 📺',
  War: 'Estrategista de trincheira 🎖️',
  Western: 'Cowboy de fim de semana 🤠',
}

export function personaFor(favoriteGenre: string | null): string {
  return (favoriteGenre && PERSONAS[favoriteGenre]) || 'Cinéfilo em formação 🎬'
}

/** "Tempo de tela" em linguagem divertida: 10.632 min -> "7 dias e 9 horas". */
export function screenTime(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)
  if (days >= 1) {
    const rest = hours % 24
    return `${days} ${days === 1 ? 'dia' : 'dias'}${rest ? ` e ${rest} ${rest === 1 ? 'hora' : 'horas'}` : ''}`
  }
  if (hours >= 1) return `${hours} ${hours === 1 ? 'hora' : 'horas'}`
  return `${minutes} min`
}

// ------------------------------------------------------------------ //
// Easter eggs                                                         //
// ------------------------------------------------------------------ //

export type EasterEgg = 'barbie' | 'matrix' | 'oppenheimer'

export const EASTER_EGG_MESSAGES: Record<EasterEgg, string> = {
  barbie: 'Tudo fica cor-de-rosa por um instante 💖',
  matrix: 'Siga o coelho branco 🐇',
  oppenheimer: 'Crítica explosiva! 💥',
}

/** Easter egg disparado ao avaliar certos filmes (pelo título, sem acentos). */
export function easterEggFor(title: string): EasterEgg | null {
  const folded = foldText(title)
  if (/\bbarbie\b/.test(folded)) return 'barbie'
  if (/\bmatrix\b/.test(folded)) return 'matrix'
  if (/\boppenheimer\b/.test(folded)) return 'oppenheimer'
  return null
}
