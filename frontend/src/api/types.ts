// Espelha os schemas Pydantic de backend/app/movies/schemas.py.

export type MovieStatus = 'Lançado' | 'Pós-Produção' | 'Em Produção' | 'Planejado'

export const MOVIE_STATUSES: MovieStatus[] = ['Lançado', 'Pós-Produção', 'Em Produção', 'Planejado']

export type MovieSort = 'popularidade' | 'nota' | 'titulo' | 'recentes' | 'antigos'

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  pages: number
}

export interface RatingSummary {
  quantidade: number
  /** Média na escala 0–10. */
  media_nota: number | null
  /** Média na escala de 5 estrelas. */
  media_estrelas: number | null
}

export interface Genre {
  sk_genre_id: string
  nome_genero: string
}

export interface Person {
  sk_person_id: string
  nome_pessoa: string
}

export interface Company {
  sk_company_id: string
  nome_produtora: string
}

export interface Performance {
  orcamento_usd: number | null
  receita_usd: number | null
  lucro_usd: number | null
  popularidade: number | null
  nota_tmdb: number | null
  qtd_tmdb: number | null
  nota_imdb: number | null
  qtd_imdb: number | null
}

export interface MovieListItem {
  sk_movie_id: string
  titulo: string
  ano_lancamento: number | null
  duracao_minutos: number | null
  url_poster: string | null
  popularidade: number | null
  nota_imdb?: number | null
  generos: string[]
  avaliacoes: RatingSummary
}

export interface MovieDetail {
  sk_movie_id: string
  id_filme: string
  titulo: string
  data_lancamento: string | null
  ano_lancamento: number | null
  duracao_minutos: number | null
  status_filme: MovieStatus | null
  sinopse: string | null
  url_poster: string | null
  url_backdrop: string | null
  generos: Genre[]
  diretores: Person[]
  roteiristas: Person[]
  elenco: Person[]
  produtoras: Company[]
  desempenho: Performance | null
  avaliacoes: RatingSummary
  /** Chaves "1" a "5" (estrela arredondada) -> quantidade. */
  distribuicao_estrelas: Record<string, number>
}

export interface MovieInput {
  titulo: string
  ano_lancamento: number
  data_lancamento: string | null
  duracao_minutos: number | null
  status_filme: MovieStatus
  sinopse: string | null
  url_poster: string | null
  url_backdrop: string | null
  diretores: string[]
  /** Identificadores `sk_genre_id`. */
  generos: string[]
}

export interface Review {
  sk_movie_review_id: string
  sk_movie_id: string
  nome: string
  nota: number
  estrelas: number
  comentario: string
  created_at: string
}

export interface ReviewInput {
  nome: string
  estrelas: number
  comentario: string
}

export interface ReviewCreated {
  review: Review
  avaliacoes: RatingSummary
}

export interface CatalogParams {
  page: number
  page_size?: number
  q?: string
  genero?: string
  ano_de?: number
  ano_ate?: number
  ordenar?: MovieSort
}

export interface RouletteParams {
  generos: string[]
  duracao_max?: number
  apenas_conhecidos: boolean
  nota_imdb_min?: number
}

export interface Achievement {
  id: string
  titulo: string
  descricao: string
  icone: string
  atual: number
  meta: number
  conquistada: boolean
}

export interface ReviewedMovie {
  sk_movie_id: string
  titulo: string
  ano_lancamento: number | null
  url_poster: string | null
  nota: number
  estrelas: number
  comentario: string
}

export interface ReviewerProfile {
  nome: string
  quantidade: number
  media_nota: number
  media_estrelas: number
  minutos_assistidos: number
  duracao_media_minutos: number | null
  genero_favorito: string | null
  diretor_favorito: string | null
  melhor_filme: ReviewedMovie
  pior_filme: ReviewedMovie | null
  conquistas: Achievement[]
  filmes: ReviewedMovie[]
}
