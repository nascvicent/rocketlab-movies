"""Regras de negócio e consultas do catálogo de filmes.

`movie_reviews` é a fonte da verdade das avaliações; `dim_reviews` guarda um
resumo materializado (quantidade e média) que é recalculado sempre que uma
avaliação é criada ou removida, permitindo ordenar o catálogo por nota sem
agregar todas as avaliações a cada requisição.
"""

import random
from collections import Counter
from uuid import uuid4

from sqlalchemy import ColumnElement, Select, delete, func, literal_column, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import InstrumentedAttribute, selectinload

from app.core.text import fold_text
from app.movies.models import (
    DimGenre,
    DimMovie,
    DimPerson,
    DimReview,
    FactMoviePerformance,
    MovieReview,
    bridge_movie_genre,
)
from app.movies.schemas import (
    MovieCreate,
    MovieDetail,
    MovieListItem,
    MovieSort,
    MovieUpdate,
    Page,
    RatingSummary,
    ReviewCreate,
    ReviewOut,
)

DIRECTOR = "Diretor"
WRITER = "Roteirista"
ACTOR = "Ator"
MAX_CAST = 40
# Na roleta, "conhecido" = ao menos esta quantidade de votos no TMDB (~6,6 mil filmes).
KNOWN_MOVIE_MIN_VOTES = 50


class NotFoundError(Exception):
    """Recurso inexistente."""


class ValidationError(Exception):
    """Dados válidos no formato, mas inconsistentes com o estado do banco."""


# --------------------------------------------------------------------------- #
# Consultas auxiliares
# --------------------------------------------------------------------------- #


def _escape_like(term: str) -> str:
    return term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def _rowid(table: str) -> ColumnElement:
    # Desempate estável que não anula o índice de ordenação: todo índice do
    # SQLite termina no rowid, então "ORDER BY coluna, rowid" usa o índice.
    return literal_column(f"{table}.rowid")


def _page_ids_query(
    sort: MovieSort, *, searching: bool
) -> tuple[Select, InstrumentedAttribute[str]]:
    """Consulta enxuta dos IDs da página.

    Sem busca textual, a consulta parte da tabela cujo índice já entrega a
    ordenação pedida (popularidade -> fato, nota -> resumo de avaliações), e o
    SQLite só lê as linhas da página. Com busca, parte de `dim_movies`: o índice
    de `titulo_busca` restringe o conjunto, que então é ordenado.
    """

    movies_rowid = _rowid("dim_movies")
    match sort:
        case MovieSort.RATING:
            # Só entram filmes com ao menos uma avaliação.
            if searching:
                stmt = select(DimMovie.sk_movie_id).join(
                    DimReview, DimReview.sk_movie_id == DimMovie.sk_movie_id
                )
                id_column, tiebreak = DimMovie.sk_movie_id, movies_rowid
            else:
                stmt = select(DimReview.sk_movie_id)
                id_column, tiebreak = DimReview.sk_movie_id, _rowid("dim_reviews")
            stmt = stmt.where(DimReview.qtd_avaliacoes_usuarios > 0).order_by(
                DimReview.nota_media_usuarios.desc(),
                DimReview.qtd_avaliacoes_usuarios.desc(),
                tiebreak.desc(),
            )
            return stmt, id_column
        case MovieSort.POPULARITY if not searching:
            stmt = select(FactMoviePerformance.sk_movie_id).order_by(
                FactMoviePerformance.popularidade.desc(),
                _rowid("fact_movies_performance").desc(),
            )
            return stmt, FactMoviePerformance.sk_movie_id
        case MovieSort.POPULARITY:
            stmt = (
                select(DimMovie.sk_movie_id)
                .outerjoin(
                    FactMoviePerformance,
                    FactMoviePerformance.sk_movie_id == DimMovie.sk_movie_id,
                )
                .order_by(FactMoviePerformance.popularidade.desc(), movies_rowid.desc())
            )
            return stmt, DimMovie.sk_movie_id
        case MovieSort.TITLE:
            order = [DimMovie.titulo, movies_rowid]
        case MovieSort.NEWEST:
            order = [
                DimMovie.ano_lancamento.desc(),
                DimMovie.data_lancamento.desc(),
                DimMovie.sk_movie_id.desc(),
            ]
        case MovieSort.OLDEST:
            order = [DimMovie.ano_lancamento, DimMovie.data_lancamento, DimMovie.sk_movie_id]
    return select(DimMovie.sk_movie_id).order_by(*order), DimMovie.sk_movie_id


def _apply_filters(
    stmt: Select,
    movie_id: InstrumentedAttribute[str],
    *,
    q: str | None,
    genre_id: str | None,
    year_from: int | None,
    year_to: int | None,
) -> Select:
    """Aplica os filtros; `movie_id` é a coluna de ID da tabela que conduz a consulta."""

    terms = (fold_text(q) or "").split() if q else []
    if (terms or year_from is not None or year_to is not None) and movie_id is not (
        DimMovie.sk_movie_id
    ):
        stmt = stmt.join(DimMovie, DimMovie.sk_movie_id == movie_id)

    if terms:
        # Cada palavra precisa aparecer no título, ignorando maiúsculas e acentos.
        # A subconsulta por rowid obriga o SQLite a varrer apenas o índice de
        # `titulo_busca` (pequeno) em vez das linhas completas dos filmes.
        search = DimMovie.__table__.alias("busca")
        matches = select(_rowid("busca")).where(
            *(search.c.titulo_busca.like(f"%{_escape_like(term)}%", escape="\\") for term in terms)
        )
        stmt = stmt.where(_rowid("dim_movies").in_(matches))
    if genre_id:
        stmt = stmt.where(
            movie_id.in_(
                select(bridge_movie_genre.c.sk_movie_id).where(
                    bridge_movie_genre.c.sk_genre_id == genre_id
                )
            )
        )
    if year_from is not None:
        stmt = stmt.where(DimMovie.ano_lancamento >= year_from)
    if year_to is not None:
        stmt = stmt.where(DimMovie.ano_lancamento <= year_to)
    return stmt


def _summary(review: DimReview | None) -> RatingSummary:
    if review is None:
        return RatingSummary()
    return RatingSummary(
        quantidade=review.qtd_avaliacoes_usuarios, media_nota=review.nota_media_usuarios
    )


async def _get_movie(
    session: AsyncSession, movie_id: str, *, with_relations: bool = False
) -> DimMovie:
    stmt = select(DimMovie).where(DimMovie.sk_movie_id == movie_id)
    if with_relations:
        stmt = stmt.options(
            selectinload(DimMovie.genres),
            selectinload(DimMovie.companies),
            selectinload(DimMovie.people),
            selectinload(DimMovie.performance),
            selectinload(DimMovie.reviews_summary),
        )
    movie = (await session.scalars(stmt)).one_or_none()
    if movie is None:
        raise NotFoundError("Filme não encontrado")
    return movie


async def _resolve_genres(session: AsyncSession, genre_ids: list[str]) -> list[DimGenre]:
    if not genre_ids:
        return []
    genres = list(
        await session.scalars(select(DimGenre).where(DimGenre.sk_genre_id.in_(genre_ids)))
    )
    missing = set(genre_ids) - {genre.sk_genre_id for genre in genres}
    if missing:
        raise ValidationError(f"Gênero(s) inexistente(s): {', '.join(sorted(missing))}")
    return genres


async def _resolve_directors(session: AsyncSession, names: list[str]) -> list[DimPerson]:
    """Reaproveita diretores existentes pelo nome e cria os que ainda não existem."""

    if not names:
        return []
    existing = {
        person.nome_pessoa: person
        for person in await session.scalars(
            select(DimPerson).where(
                DimPerson.tipo_pessoa == DIRECTOR, DimPerson.nome_pessoa.in_(names)
            )
        )
    }
    directors = []
    for name in names:
        person = existing.get(name)
        if person is None:
            person = DimPerson(nome_pessoa=name, tipo_pessoa=DIRECTOR)
            session.add(person)
        directors.append(person)
    return directors


async def refresh_rating_summary(session: AsyncSession, movie_id: str) -> RatingSummary:
    """Recalcula o resumo de avaliações do filme a partir de `movie_reviews`."""

    quantidade, media = (
        await session.execute(
            select(func.count(), func.avg(MovieReview.nota)).where(
                MovieReview.sk_movie_id == movie_id
            )
        )
    ).one()
    summary = await session.scalar(select(DimReview).where(DimReview.sk_movie_id == movie_id))
    if summary is None:
        summary = DimReview(sk_review_id=movie_id, sk_movie_id=movie_id)
        session.add(summary)
    summary.qtd_avaliacoes_usuarios = quantidade
    summary.nota_media_usuarios = media
    return RatingSummary(quantidade=quantidade, media_nota=media)


async def _list_items(session: AsyncSession, movie_ids: list[str]) -> list[MovieListItem]:
    """Carrega os cards dos filmes informados, preservando a ordem recebida."""

    stmt = (
        select(DimMovie, DimReview, FactMoviePerformance.popularidade)
        .outerjoin(DimReview, DimReview.sk_movie_id == DimMovie.sk_movie_id)
        .outerjoin(FactMoviePerformance, FactMoviePerformance.sk_movie_id == DimMovie.sk_movie_id)
        .options(selectinload(DimMovie.genres))
        .where(DimMovie.sk_movie_id.in_(movie_ids))
    )
    position = {movie_id: index for index, movie_id in enumerate(movie_ids)}
    rows = sorted((await session.execute(stmt)).all(), key=lambda row: position[row[0].sk_movie_id])

    items = [
        MovieListItem(
            sk_movie_id=movie.sk_movie_id,
            titulo=movie.titulo,
            ano_lancamento=movie.ano_lancamento,
            duracao_minutos=movie.duracao_minutos,
            url_poster=movie.url_poster,
            popularidade=popularidade,
            generos=[genre.nome_genero for genre in movie.genres],
            avaliacoes=_summary(review),
        )
        for movie, review, popularidade in rows
    ]
    return items


# --------------------------------------------------------------------------- #
# Filmes
# --------------------------------------------------------------------------- #


async def list_movies(
    session: AsyncSession,
    *,
    page: int,
    page_size: int,
    q: str | None = None,
    genre_id: str | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    sort: MovieSort = MovieSort.POPULARITY,
) -> Page[MovieListItem]:
    filters = {"q": q, "genre_id": genre_id, "year_from": year_from, "year_to": year_to}

    # A contagem só envolve as tabelas que definem o conjunto (todo filme tem
    # uma linha na tabela fato, então ela não altera o total).
    if sort is MovieSort.RATING:
        count_stmt = select(func.count()).where(DimReview.qtd_avaliacoes_usuarios > 0)
        count_stmt = _apply_filters(
            count_stmt.select_from(DimReview), DimReview.sk_movie_id, **filters
        )
    else:
        count_stmt = _apply_filters(
            select(func.count()).select_from(DimMovie), DimMovie.sk_movie_id, **filters
        )
    total = await session.scalar(count_stmt) or 0

    # "Deferred join": ordenação e OFFSET trabalham só com IDs e índices; as linhas
    # completas (com sinopse) são lidas apenas para os filmes da página.
    ids_stmt, id_column = _page_ids_query(sort, searching=bool(q and q.split()))
    ids_stmt = _apply_filters(ids_stmt, id_column, **filters)
    page_ids = list(await session.scalars(ids_stmt.limit(page_size).offset((page - 1) * page_size)))

    items = await _list_items(session, page_ids)
    return Page(items=items, total=total, page=page, page_size=page_size)


async def pick_random_movie(
    session: AsyncSession,
    *,
    genre_ids: list[str],
    max_runtime: int | None = None,
    year_from: int | None = None,
    year_to: int | None = None,
    only_known: bool = True,
    min_stars: float | None = None,
    rng: random.Random | None = None,
) -> MovieListItem:
    """Sorteia um filme lançado, com pôster, que atenda aos filtros da roleta.

    Qualquer um dos gêneros serve (o "humor" combina vários). O sorteio é
    uniforme: conta os candidatos e escolhe um deslocamento aleatório.
    """

    stmt = select(DimMovie.sk_movie_id).where(
        DimMovie.url_poster.is_not(None), DimMovie.status_filme == "Lançado"
    )
    if genre_ids:
        stmt = stmt.where(
            DimMovie.sk_movie_id.in_(
                select(bridge_movie_genre.c.sk_movie_id).where(
                    bridge_movie_genre.c.sk_genre_id.in_(genre_ids)
                )
            )
        )
    if max_runtime is not None:
        stmt = stmt.where(DimMovie.duracao_minutos.between(1, max_runtime))
    fact_filters = []
    if only_known:
        fact_filters.append(FactMoviePerformance.qtd_tmdb >= KNOWN_MOVIE_MIN_VOTES)
    if fact_filters:
        stmt = stmt.where(
            DimMovie.sk_movie_id.in_(select(FactMoviePerformance.sk_movie_id).where(*fact_filters))
        )
    if min_stars is not None:
        # Média das avaliações do próprio site (escala 0–10 = estrelas × 2).
        stmt = stmt.where(
            DimMovie.sk_movie_id.in_(
                select(DimReview.sk_movie_id).where(
                    DimReview.qtd_avaliacoes_usuarios > 0,
                    DimReview.nota_media_usuarios >= min_stars * 2,
                )
            )
        )
    stmt = _apply_filters(
        stmt, DimMovie.sk_movie_id, q=None, genre_id=None, year_from=year_from, year_to=year_to
    )

    total = await session.scalar(select(func.count()).select_from(stmt.subquery()))
    if not total:
        raise NotFoundError("Nenhum filme combina com esses filtros. Tente afrouxá-los.")
    offset = (rng or random).randrange(total)
    movie_id = await session.scalar(stmt.order_by(_rowid("dim_movies")).offset(offset).limit(1))
    [item] = await _list_items(session, [movie_id])
    return item


async def get_movie_detail(session: AsyncSession, movie_id: str) -> MovieDetail:
    movie = await _get_movie(session, movie_id, with_relations=True)

    notas = await session.scalars(
        select(MovieReview.nota).where(MovieReview.sk_movie_id == movie_id)
    )
    # Estrela "cheia" mais próxima; meia estrela arredonda para cima (3.5 -> 4).
    buckets = Counter(min(5, max(1, int(nota / 2 + 0.5))) for nota in notas)

    people_by_role: dict[str, list[DimPerson]] = {DIRECTOR: [], WRITER: [], ACTOR: []}
    for person in sorted(movie.people, key=lambda p: p.nome_pessoa):
        people_by_role[person.tipo_pessoa].append(person)

    return MovieDetail(
        sk_movie_id=movie.sk_movie_id,
        id_filme=movie.id_filme,
        titulo=movie.titulo,
        data_lancamento=movie.data_lancamento,
        ano_lancamento=movie.ano_lancamento,
        duracao_minutos=movie.duracao_minutos,
        status_filme=movie.status_filme,
        sinopse=movie.sinopse,
        url_poster=movie.url_poster,
        url_backdrop=movie.url_backdrop,
        generos=movie.genres,
        diretores=people_by_role[DIRECTOR],
        roteiristas=people_by_role[WRITER],
        elenco=people_by_role[ACTOR][:MAX_CAST],
        produtoras=movie.companies,
        desempenho=movie.performance,
        avaliacoes=_summary(movie.reviews_summary),
        distribuicao_estrelas={star: buckets.get(star, 0) for star in range(1, 6)},
    )


async def create_movie(session: AsyncSession, data: MovieCreate) -> str:
    movie = DimMovie(
        id_filme=f"local-{uuid4().hex[:12]}",
        titulo=data.titulo,
        ano_lancamento=data.ano_lancamento,
        data_lancamento=data.data_lancamento,
        duracao_minutos=data.duracao_minutos,
        status_filme=data.status_filme,
        sinopse=data.sinopse or None,
        url_poster=str(data.url_poster) if data.url_poster else None,
        url_backdrop=str(data.url_backdrop) if data.url_backdrop else None,
    )
    movie.genres = await _resolve_genres(session, data.generos)
    movie.people = await _resolve_directors(session, data.diretores)
    # Mantém a relação 1:1 do esquema estrela; as métricas ficam vazias até existirem.
    movie.performance = FactMoviePerformance(lucro_usd=0, lucro_brl=0)
    session.add(movie)
    await session.commit()
    return movie.sk_movie_id


async def update_movie(session: AsyncSession, movie_id: str, data: MovieUpdate) -> None:
    movie = await _get_movie(session, movie_id, with_relations=True)
    changes = data.model_dump(exclude_unset=True, exclude={"generos", "diretores"})

    for field in ("url_poster", "url_backdrop"):
        if changes.get(field) is not None:
            changes[field] = str(changes[field])
    if "sinopse" in changes:
        changes["sinopse"] = changes["sinopse"] or None

    release_date = changes.get("data_lancamento", movie.data_lancamento)
    year = changes.get("ano_lancamento", movie.ano_lancamento)
    if release_date is not None:
        if "ano_lancamento" not in changes:
            changes["ano_lancamento"] = year = release_date.year
        if release_date.year != year:
            raise ValidationError("ano_lancamento deve coincidir com o ano de data_lancamento")

    for field, value in changes.items():
        setattr(movie, field, value)

    if data.generos is not None:
        movie.genres = await _resolve_genres(session, data.generos)
    if data.diretores is not None:
        others = [person for person in movie.people if person.tipo_pessoa != DIRECTOR]
        movie.people = others + await _resolve_directors(session, data.diretores)

    await session.commit()


async def delete_movie(session: AsyncSession, movie_id: str) -> None:
    # As tabelas dependentes (pontes, fato, avaliações) são removidas via ON DELETE CASCADE.
    result = await session.execute(delete(DimMovie).where(DimMovie.sk_movie_id == movie_id))
    if result.rowcount == 0:
        raise NotFoundError("Filme não encontrado")
    await session.commit()


async def list_genres(session: AsyncSession) -> list[DimGenre]:
    return list(await session.scalars(select(DimGenre).order_by(DimGenre.nome_genero)))


# --------------------------------------------------------------------------- #
# Avaliações
# --------------------------------------------------------------------------- #


async def list_reviews(
    session: AsyncSession, movie_id: str, *, page: int, page_size: int
) -> Page[ReviewOut]:
    await _get_movie(session, movie_id)
    condition = MovieReview.sk_movie_id == movie_id
    total = await session.scalar(select(func.count()).select_from(MovieReview).where(condition))
    reviews = await session.scalars(
        select(MovieReview)
        .where(condition)
        # created_at tem resolução de segundos; o rowid preserva a ordem de inserção.
        .order_by(MovieReview.created_at.desc(), _rowid("movie_reviews").desc())
        .limit(page_size)
        .offset((page - 1) * page_size)
    )
    return Page(
        items=[ReviewOut.model_validate(review) for review in reviews],
        total=total or 0,
        page=page,
        page_size=page_size,
    )


async def create_review(
    session: AsyncSession, movie_id: str, data: ReviewCreate
) -> tuple[MovieReview, RatingSummary]:
    await _get_movie(session, movie_id)
    review = MovieReview(
        sk_movie_id=movie_id, nome=data.nome, nota=data.estrelas * 2, comentario=data.comentario
    )
    session.add(review)
    await session.flush()
    summary = await refresh_rating_summary(session, movie_id)
    await session.commit()
    await session.refresh(review)
    return review, summary


async def delete_review(session: AsyncSession, review_id: str) -> RatingSummary:
    review = await session.get(MovieReview, review_id)
    if review is None:
        raise NotFoundError("Avaliação não encontrada")
    movie_id = review.sk_movie_id
    await session.delete(review)
    await session.flush()
    summary = await refresh_rating_summary(session, movie_id)
    await session.commit()
    return summary
