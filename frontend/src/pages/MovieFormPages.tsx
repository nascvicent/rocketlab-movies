import { Link, useNavigate, useParams } from 'react-router-dom'

import { useCreateMovie, useMovie, useUpdateMovie } from '../api/movies'
import type { MovieDetail } from '../api/types'
import { ArrowLeftIcon } from '../components/Icons'
import { MovieForm } from '../components/MovieForm'
import { EmptyState, ErrorState } from '../components/States'
import { useToast } from '../lib/toast'
import { catalogHref } from '../lib/catalogLocation'
import { EMPTY_MOVIE_FORM, type MovieFormValues } from '../lib/movieForm'

function toFormValues(movie: MovieDetail): MovieFormValues {
  return {
    titulo: movie.titulo,
    ano_lancamento: movie.ano_lancamento?.toString() ?? '',
    data_lancamento: movie.data_lancamento ?? '',
    duracao_minutos: movie.duracao_minutos?.toString() ?? '',
    status_filme: movie.status_filme ?? 'Lançado',
    sinopse: movie.sinopse ?? '',
    url_poster: movie.url_poster ?? '',
    url_backdrop: movie.url_backdrop ?? '',
    diretores: movie.diretores.map((person) => person.nome_pessoa),
    generos: movie.generos.map((genre) => genre.sk_genre_id),
  }
}

export function MovieCreatePage() {
  const navigate = useNavigate()
  const notify = useToast()
  const createMovie = useCreateMovie()

  return (
    <div className="container">
      <Link to={catalogHref()} className="back-link">
        <ArrowLeftIcon size={16} /> Catálogo
      </Link>
      <div className="page-heading">
        <div>
          <h1>Adicionar filme</h1>
          <p>Campos marcados com * são obrigatórios.</p>
        </div>
      </div>
      <MovieForm
        initialValues={EMPTY_MOVIE_FORM}
        submitLabel="Cadastrar filme"
        pending={createMovie.isPending}
        onCancel={() => navigate(-1)}
        onSubmit={async (input) => {
          const movie = await createMovie.mutateAsync(input)
          notify(`“${movie.titulo}” foi adicionado ao catálogo.`)
          navigate(`/filmes/${movie.sk_movie_id}`, { replace: true })
        }}
      />
    </div>
  )
}

export function MovieEditPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate()
  const notify = useToast()
  const movie = useMovie(id)
  const updateMovie = useUpdateMovie(id)

  if (movie.isPending) return <div className="container muted">Carregando filme…</div>
  if (movie.isError) {
    return (
      <div className="container">
        <ErrorState error={movie.error} onRetry={() => movie.refetch()} />
      </div>
    )
  }

  const detailHref = `/filmes/${id}`

  return (
    <div className="container">
      <Link to={detailHref} className="back-link">
        <ArrowLeftIcon size={16} /> {movie.data.titulo}
      </Link>
      <div className="page-heading">
        <div>
          <h1>Editar filme</h1>
          <p>As alterações são aplicadas imediatamente ao catálogo.</p>
        </div>
      </div>
      <MovieForm
        initialValues={toFormValues(movie.data)}
        submitLabel="Salvar alterações"
        pending={updateMovie.isPending}
        onCancel={() => navigate(detailHref)}
        onSubmit={async (input) => {
          await updateMovie.mutateAsync(input)
          notify('Alterações salvas.')
          navigate(detailHref, { replace: true })
        }}
      />
    </div>
  )
}

export function NotFoundPage() {
  return (
    <div className="container">
      <EmptyState
        title="Página não encontrada"
        action={
          <Link to="/" className="btn">
            Ir para o catálogo
          </Link>
        }
      >
        O endereço acessado não existe.
      </EmptyState>
    </div>
  )
}
