import csv
import sqlite3
from pathlib import Path

import pytest
from sqlalchemy import create_engine

from app.db.base import Base
from app.movies import models  # noqa: F401  Registra os modelos ORM.
from app.scripts.load_data import CSV_SPECS, clean_text, load


@pytest.mark.parametrize(
    ("raw", "expected"),
    [
        ('"Julia sees a ""movie within the movie""."', 'Julia sees a "movie within the movie".'),
        ('"Weird Al" Yankovic Live', '"Weird Al" Yankovic Live'),
        ("  Plain text ", "Plain text"),
        ("", None),
    ],
)
def test_clean_text_unwraps_double_escaped_quotes(raw: str, expected: str | None) -> None:
    assert clean_text(raw) == expected


def _write_csvs(folder: Path) -> None:
    movie = "m1"
    # A sinopse reproduz o defeito dos dados reais: envolta em aspas e com aspas
    # internas duplicadas mesmo depois da leitura do CSV.
    tables = {
        "dim_movies.csv": [
            [
                "sk_movie_id",
                "id_filme",
                "titulo",
                "data_lancamento",
                "ano_lancamento",
                "duracao_minutos",
                "status_filme",
                "sinopse",
                "url_poster",
                "url_backdrop",
            ],
            [
                movie,
                "10",
                "Amélie",
                "2001-04-25",
                "2001",
                "122",
                "Lançado",
                '"Uma ""garçonete"""',
                "",
                "",
            ],
        ],
        "dim_genres.csv": [["nome_genero", "sk_genre_id"], ["Drama", "g1"]],
        "dim_companies.csv": [["nome_produtora", "sk_company_id"], ["UGC", "c1"]],
        "dim_people.csv": [
            ["nome_pessoa", "tipo_pessoa", "sk_person_id"],
            ["Jeunet", "Diretor", "p1"],
        ],
        "bridge_movie_genre.csv": [["sk_movie_id", "sk_genre_id"], [movie, "g1"]],
        "bridge_movie_company.csv": [["sk_movie_id", "sk_company_id"], [movie, "c1"]],
        "bridge_movie_person.csv": [["sk_movie_id", "sk_person_id"], [movie, "p1"]],
        "fact_movies_performance.csv": [
            [
                "sk_movie_id",
                "orcamento_usd",
                "receita_usd",
                "lucro_usd",
                "orcamento_brl",
                "receita_brl",
                "lucro_brl",
                "popularidade",
                "nota_tmdb",
                "qtd_tmdb",
                "nota_imdb",
                "qtd_imdb",
            ],
            [movie, "10.0", "", "0.0", "", "", "0.0", "1.5", "7.1", "118.0", "", ""],
        ],
        "movies_reviews.csv": [
            ["sk_movie_review_id", "sk_movie_id", "nome", "nota", "comentario"],
            ["r1", movie, "Ana", "8.0", "Ótimo"],
            ["r2", movie, "Bia", "6.5", "Bom"],
        ],
    }
    assert set(tables) == {name for name, _, _ in CSV_SPECS}
    for name, rows in tables.items():
        with (folder / name).open("w", encoding="utf-8", newline="") as file:
            csv.writer(file).writerows(rows)


def test_load_imports_csvs_and_rebuilds_review_summary(tmp_path: Path) -> None:
    db_path = tmp_path / "load.db"
    engine = create_engine(f"sqlite:///{db_path}")
    Base.metadata.create_all(engine)
    engine.dispose()
    _write_csvs(tmp_path)

    load(tmp_path, db_path, force=False)

    conn = sqlite3.connect(db_path)
    titulo, busca, sinopse = conn.execute(
        "SELECT titulo, titulo_busca, sinopse FROM dim_movies"
    ).fetchone()
    assert (titulo, busca, sinopse) == ("Amélie", "amelie", 'Uma "garçonete"')
    assert conn.execute(
        "SELECT qtd_avaliacoes_usuarios, nota_media_usuarios FROM dim_reviews"
    ).fetchone() == (2, 7.25)
    assert conn.execute("SELECT qtd_tmdb, receita_usd FROM fact_movies_performance").fetchone() == (
        118,
        None,
    )
    conn.close()

    with pytest.raises(SystemExit, match="--force"):
        load(tmp_path, db_path, force=False)
    load(tmp_path, db_path, force=True)  # recarga idempotente
