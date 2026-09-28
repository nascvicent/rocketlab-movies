from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.movies import reviewers, service
from app.movies.schemas import (
    MAX_YEAR,
    MIN_YEAR,
    GenreOut,
    MovieCreate,
    MovieDetail,
    MovieListItem,
    MovieSort,
    MovieUpdate,
    Page,
    RatingSummary,
    ReviewCreate,
    ReviewCreated,
    ReviewerProfile,
    ReviewOut,
)

DbSession = Annotated[AsyncSession, Depends(get_db)]
PageNumber = Annotated[int, Query(ge=1, description="Página a partir de 1.")]

movies_router = APIRouter()
genres_router = APIRouter()
reviews_router = APIRouter()
reviewers_router = APIRouter()


def _not_found(exc: service.NotFoundError) -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


def _unprocessable(exc: service.ValidationError) -> HTTPException:
    return HTTPException(status_code=422, detail=str(exc))


@movies_router.get("", response_model=Page[MovieListItem], summary="Lista o catálogo paginado")
async def list_movies(
    session: DbSession,
    page: PageNumber = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 24,
    q: Annotated[
        str | None,
        Query(max_length=200, description="Busca no título (sem diferenciar acentos)."),
    ] = None,
    genero: Annotated[str | None, Query(description="`sk_genre_id` do gênero.")] = None,
    ano_de: Annotated[int | None, Query(ge=MIN_YEAR, le=MAX_YEAR)] = None,
    ano_ate: Annotated[int | None, Query(ge=MIN_YEAR, le=MAX_YEAR)] = None,
    ordenar: MovieSort = MovieSort.POPULARITY,
) -> Page[MovieListItem]:
    return await service.list_movies(
        session,
        page=page,
        page_size=page_size,
        q=q.strip() if q else None,
        genre_id=genero,
        year_from=ano_de,
        year_to=ano_ate,
        sort=ordenar,
    )


@movies_router.get(
    "/sortear",
    response_model=MovieListItem,
    summary="Sorteia um filme (roleta do que assistir)",
)
async def pick_random_movie(
    session: DbSession,
    generos: Annotated[
        list[str], Query(description="`sk_genre_id`; basta o filme ter um deles.")
    ] = [],  # noqa: B006 - FastAPI copia o valor padrão a cada requisição
    duracao_max: Annotated[int | None, Query(ge=1, le=1000)] = None,
    ano_de: Annotated[int | None, Query(ge=MIN_YEAR, le=MAX_YEAR)] = None,
    ano_ate: Annotated[int | None, Query(ge=MIN_YEAR, le=MAX_YEAR)] = None,
    apenas_conhecidos: Annotated[
        bool, Query(description="Só filmes com ao menos 50 votos no TMDB.")
    ] = True,
    nota_imdb_min: Annotated[
        float | None, Query(ge=0, le=10, description="Nota IMDb mínima.")
    ] = None,
) -> MovieListItem:
    try:
        return await service.pick_random_movie(
            session,
            genre_ids=generos,
            max_runtime=duracao_max,
            year_from=ano_de,
            year_to=ano_ate,
            only_known=apenas_conhecidos,
            min_imdb=nota_imdb_min,
        )
    except service.NotFoundError as exc:
        raise _not_found(exc) from exc


@movies_router.post(
    "",
    response_model=MovieDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Cadastra um filme",
)
async def create_movie(data: MovieCreate, session: DbSession) -> MovieDetail:
    try:
        movie_id = await service.create_movie(session, data)
    except service.ValidationError as exc:
        raise _unprocessable(exc) from exc
    return await service.get_movie_detail(session, movie_id)


@movies_router.get("/{movie_id}", response_model=MovieDetail, summary="Detalha um filme")
async def get_movie(movie_id: str, session: DbSession) -> MovieDetail:
    try:
        return await service.get_movie_detail(session, movie_id)
    except service.NotFoundError as exc:
        raise _not_found(exc) from exc


@movies_router.patch("/{movie_id}", response_model=MovieDetail, summary="Atualiza um filme")
async def update_movie(movie_id: str, data: MovieUpdate, session: DbSession) -> MovieDetail:
    try:
        await service.update_movie(session, movie_id, data)
    except service.NotFoundError as exc:
        raise _not_found(exc) from exc
    except service.ValidationError as exc:
        raise _unprocessable(exc) from exc
    return await service.get_movie_detail(session, movie_id)


@movies_router.delete(
    "/{movie_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Remove um filme"
)
async def delete_movie(movie_id: str, session: DbSession) -> Response:
    try:
        await service.delete_movie(session, movie_id)
    except service.NotFoundError as exc:
        raise _not_found(exc) from exc
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@movies_router.get(
    "/{movie_id}/reviews",
    response_model=Page[ReviewOut],
    summary="Lista as avaliações de um filme (mais recentes primeiro)",
)
async def list_reviews(
    movie_id: str,
    session: DbSession,
    page: PageNumber = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 10,
) -> Page[ReviewOut]:
    try:
        return await service.list_reviews(session, movie_id, page=page, page_size=page_size)
    except service.NotFoundError as exc:
        raise _not_found(exc) from exc


@movies_router.post(
    "/{movie_id}/reviews",
    response_model=ReviewCreated,
    status_code=status.HTTP_201_CREATED,
    summary="Adiciona uma avaliação (1 a 5 estrelas) a um filme",
)
async def create_review(movie_id: str, data: ReviewCreate, session: DbSession) -> ReviewCreated:
    try:
        review, summary = await service.create_review(session, movie_id, data)
    except service.NotFoundError as exc:
        raise _not_found(exc) from exc
    return ReviewCreated(review=ReviewOut.model_validate(review), avaliacoes=summary)


@reviews_router.delete("/{review_id}", response_model=RatingSummary, summary="Remove uma avaliação")
async def delete_review(review_id: str, session: DbSession) -> RatingSummary:
    try:
        return await service.delete_review(session, review_id)
    except service.NotFoundError as exc:
        raise _not_found(exc) from exc


@genres_router.get("", response_model=list[GenreOut], summary="Lista os gêneros")
async def list_genres(session: DbSession) -> list[GenreOut]:
    return [GenreOut.model_validate(genre) for genre in await service.list_genres(session)]


@reviewers_router.get(
    "/{nome}",
    response_model=ReviewerProfile,
    summary="Estatísticas e conquistas de um avaliador",
)
async def get_reviewer(nome: str, session: DbSession) -> ReviewerProfile:
    try:
        return await reviewers.get_reviewer_profile(session, nome)
    except service.NotFoundError as exc:
        raise _not_found(exc) from exc
