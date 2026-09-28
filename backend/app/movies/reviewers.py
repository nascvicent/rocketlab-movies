"""Perfil de um avaliador: estatísticas e conquistas a partir das suas avaliações.

Não há contas de usuário; o avaliador é identificado pelo nome gravado em
`movie_reviews.nome`, como nas resenhas exibidas no site.
"""

from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass

from sqlalchemy import Row, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.movies.models import (
    DimGenre,
    DimMovie,
    DimPerson,
    FactMoviePerformance,
    MovieReview,
    bridge_movie_genre,
    bridge_movie_person,
)
from app.movies.schemas import Achievement, ReviewedMovie, ReviewerProfile
from app.movies.service import DIRECTOR, NotFoundError

CULT_MAX_VOTES = 1_000
LONG_MOVIE_MINUTES = 150
SHORT_MOVIE_MINUTES = 90
MAX_LISTED_MOVIES = 60


@dataclass(frozen=True)
class _Stats:
    reviews: int
    genres: int
    cult_movies: int
    long_movies: int
    short_movies: int
    high_ratings: int
    low_ratings: int


@dataclass(frozen=True)
class _AchievementRule:
    id: str
    titulo: str
    descricao: str
    icone: str
    meta: int
    progress: Callable[[_Stats], int]


ACHIEVEMENTS: tuple[_AchievementRule, ...] = (
    _AchievementRule(
        "primeira-critica",
        "Primeira crítica",
        "Publicou a primeira avaliação.",
        "🎬",
        1,
        lambda s: s.reviews,
    ),
    _AchievementRule("cinefilo", "Cinéfilo", "Avaliou 10 filmes.", "🍿", 10, lambda s: s.reviews),
    _AchievementRule(
        "maratonista", "Maratonista", "Avaliou 50 filmes.", "🏃", 50, lambda s: s.reviews
    ),
    _AchievementRule(
        "garimpeiro-cult",
        "Garimpeiro Cult",
        f"Avaliou 5 filmes com menos de {CULT_MAX_VOTES:,} votos no TMDB.".replace(",", "."),
        "💎",
        5,
        lambda s: s.cult_movies,
    ),
    _AchievementRule(
        "explorador-de-generos",
        "Explorador de Gêneros",
        "Avaliou filmes de 8 gêneros diferentes.",
        "🧭",
        8,
        lambda s: s.genres,
    ),
    _AchievementRule(
        "resistencia-de-poltrona",
        "Resistência de Poltrona",
        "Encarou 3 filmes com mais de 2h30.",
        "🪑",
        3,
        lambda s: s.long_movies,
    ),
    _AchievementRule(
        "sessao-relampago",
        "Sessão Relâmpago",
        "Avaliou 5 filmes com menos de 1h30.",
        "⚡",
        5,
        lambda s: s.short_movies,
    ),
    _AchievementRule(
        "coracao-mole",
        "Coração Mole",
        "Deu 5 notas de 4 estrelas ou mais.",
        "💖",
        5,
        lambda s: s.high_ratings,
    ),
    _AchievementRule(
        "critico-implacavel",
        "Crítico Implacável",
        "Deu 5 notas de 1,5 estrela ou menos.",
        "🔥",
        5,
        lambda s: s.low_ratings,
    ),
)


def _top(counter: Counter[str]) -> str | None:
    """Mais frequente; empates são resolvidos em ordem alfabética."""

    if not counter:
        return None
    return min(counter.items(), key=lambda item: (-item[1], item[0]))[0]


async def get_reviewer_profile(session: AsyncSession, name: str) -> ReviewerProfile:
    rows = (
        await session.execute(
            select(
                MovieReview.nota,
                MovieReview.comentario,
                DimMovie.sk_movie_id,
                DimMovie.titulo,
                DimMovie.ano_lancamento,
                DimMovie.duracao_minutos,
                DimMovie.url_poster,
                FactMoviePerformance.qtd_tmdb,
            )
            .join(DimMovie, DimMovie.sk_movie_id == MovieReview.sk_movie_id)
            .outerjoin(
                FactMoviePerformance, FactMoviePerformance.sk_movie_id == DimMovie.sk_movie_id
            )
            .where(MovieReview.nome == name)
            .order_by(MovieReview.nota.desc(), DimMovie.titulo)
        )
    ).all()
    if not rows:
        raise NotFoundError("Nenhuma avaliação encontrada para este nome")

    movie_ids = list({row.sk_movie_id for row in rows})
    genre_counts = Counter(
        dict(
            (
                await session.execute(
                    select(DimGenre.nome_genero, func.count())
                    .join(
                        bridge_movie_genre, bridge_movie_genre.c.sk_genre_id == DimGenre.sk_genre_id
                    )
                    .where(bridge_movie_genre.c.sk_movie_id.in_(movie_ids))
                    .group_by(DimGenre.nome_genero)
                )
            ).all()
        )
    )
    director_counts = Counter(
        dict(
            (
                await session.execute(
                    select(DimPerson.nome_pessoa, func.count())
                    .join(
                        bridge_movie_person,
                        bridge_movie_person.c.sk_person_id == DimPerson.sk_person_id,
                    )
                    .where(
                        DimPerson.tipo_pessoa == DIRECTOR,
                        bridge_movie_person.c.sk_movie_id.in_(movie_ids),
                    )
                    .group_by(DimPerson.nome_pessoa)
                )
            ).all()
        )
    )

    # Cada filme conta uma vez nas métricas de "consumo", mesmo se avaliado de novo.
    movies = {row.sk_movie_id: row for row in rows}.values()
    runtimes = [movie.duracao_minutos for movie in movies if movie.duracao_minutos]
    stats = _Stats(
        reviews=len(rows),
        genres=len(genre_counts),
        cult_movies=sum(
            1 for m in movies if m.qtd_tmdb is not None and m.qtd_tmdb < CULT_MAX_VOTES
        ),
        long_movies=sum(1 for minutes in runtimes if minutes > LONG_MOVIE_MINUTES),
        short_movies=sum(1 for minutes in runtimes if minutes < SHORT_MOVIE_MINUTES),
        high_ratings=sum(1 for row in rows if row.nota >= 8),
        low_ratings=sum(1 for row in rows if row.nota <= 3),
    )

    return ReviewerProfile(
        nome=name,
        quantidade=stats.reviews,
        media_nota=sum(row.nota for row in rows) / len(rows),
        minutos_assistidos=sum(runtimes),
        duracao_media_minutos=round(sum(runtimes) / len(runtimes)) if runtimes else None,
        genero_favorito=_top(genre_counts),
        diretor_favorito=_top(director_counts),
        melhor_filme=_reviewed(rows[0]),
        pior_filme=_reviewed(rows[-1]) if len(rows) > 1 else None,
        conquistas=[
            Achievement(
                id=rule.id,
                titulo=rule.titulo,
                descricao=rule.descricao,
                icone=rule.icone,
                meta=rule.meta,
                atual=min(rule.progress(stats), rule.meta),
            )
            for rule in ACHIEVEMENTS
        ],
        filmes=[_reviewed(row) for row in rows[:MAX_LISTED_MOVIES]],
    )


def _reviewed(row: Row) -> ReviewedMovie:
    return ReviewedMovie(
        sk_movie_id=row.sk_movie_id,
        titulo=row.titulo,
        ano_lancamento=row.ano_lancamento,
        url_poster=row.url_poster,
        nota=row.nota,
        comentario=row.comentario,
    )
