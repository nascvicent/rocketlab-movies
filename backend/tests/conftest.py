from collections.abc import AsyncIterator
from pathlib import Path

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import enable_sqlite_foreign_keys, get_db
from app.main import app
from app.movies.models import (
    DimGenre,
    DimMovie,
    DimPerson,
    FactMoviePerformance,
    MovieReview,
)
from app.movies.service import refresh_rating_summary

GENRE_DRAMA = "g-drama"
GENRE_COMEDY = "g-comedy"


@pytest.fixture
async def session_factory(tmp_path: Path) -> AsyncIterator[async_sessionmaker[AsyncSession]]:
    engine = create_async_engine(f"sqlite+aiosqlite:///{tmp_path / 'test.db'}")
    enable_sqlite_foreign_keys(engine)
    async with engine.begin() as connection:
        await connection.run_sync(Base.metadata.create_all)

    factory = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)
    async with factory() as session:
        await _seed(session)

    yield factory
    await engine.dispose()


@pytest.fixture
async def client(
    session_factory: async_sessionmaker[AsyncSession],
) -> AsyncIterator[httpx.AsyncClient]:
    async def override_get_db() -> AsyncIterator[AsyncSession]:
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test/api/v1") as http:
        yield http
    app.dependency_overrides.clear()


def _movie(
    movie_id: str, titulo: str, ano: int, popularidade: float | None, **extra: object
) -> DimMovie:
    movie = DimMovie(
        sk_movie_id=movie_id,
        id_filme=f"tmdb-{movie_id}",
        titulo=titulo,
        ano_lancamento=ano,
        status_filme="Lançado",
        **extra,
    )
    movie.performance = FactMoviePerformance(
        lucro_usd=0, lucro_brl=0, popularidade=popularidade, orcamento_usd=1000
    )
    return movie


async def _seed(session: AsyncSession) -> None:
    drama = DimGenre(sk_genre_id=GENRE_DRAMA, nome_genero="Drama")
    comedy = DimGenre(sk_genre_id=GENRE_COMEDY, nome_genero="Comedy")
    director = DimPerson(
        sk_person_id="p-jeunet", nome_pessoa="Jean-Pierre Jeunet", tipo_pessoa="Diretor"
    )
    actor = DimPerson(sk_person_id="p-tautou", nome_pessoa="Audrey Tautou", tipo_pessoa="Ator")

    amelie = _movie("m-amelie", "O Fabuloso Destino de Amélie Poulain", 2001, 50.0)
    amelie.genres = [comedy, drama]
    amelie.people = [director, actor]
    amelie.sinopse = "Uma garçonete em Paris."

    movies = [
        amelie,
        _movie("m-matrix", "The Matrix", 1999, 90.0),
        _movie("m-alien", "Alien", 1979, 70.0),
        _movie("m-obscure", "Obscure Short", 2020, None),
    ]
    movies[1].genres = [drama]
    session.add_all(movies)
    await session.flush()

    session.add_all(
        [
            MovieReview(sk_movie_id="m-matrix", nome="Ana", nota=10, comentario="Clássico."),
            MovieReview(sk_movie_id="m-matrix", nome="Bruno", nota=8, comentario="Muito bom."),
            MovieReview(sk_movie_id="m-alien", nome="Carla", nota=6, comentario="Assustador."),
        ]
    )
    await session.flush()
    for movie_id in ("m-matrix", "m-alien"):
        await refresh_rating_summary(session, movie_id)
    await session.commit()
