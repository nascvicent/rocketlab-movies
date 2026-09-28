"""Carrega os CSVs da camada Diamond no banco SQLite.

Uso (a partir de `backend/`, depois de `alembic upgrade head`):

    python -m app.scripts.load_data --data-dir ../data
    python -m app.scripts.load_data --data-dir ../data --force   # recarrega do zero

Decisões de limpeza:

* Sinopses e títulos que chegaram com aspas escapadas duas vezes (envoltos
  em aspas e com aspas internas duplicadas) são normalizados para o texto
  original, com aspas internas simples.
* `dim_reviews.csv` não é importado: ele diverge de `movies_reviews.csv`
  (quantidades e médias desatualizadas). O resumo é recalculado a partir das
  avaliações individuais, que são a fonte da verdade.
"""

import argparse
import csv
import logging
import sqlite3
import time
from collections.abc import Callable, Iterator
from pathlib import Path
from typing import Any

from app.core.config import get_settings
from app.core.text import fold_text

logger = logging.getLogger("load_data")

csv.field_size_limit(2**31 - 1)  # sinopses longas; limite compatível com Windows

BATCH_SIZE = 20_000

# Ordem de remoção respeita as dependências entre as tabelas.
TABLES_CHILD_FIRST = (
    "movie_reviews",
    "dim_reviews",
    "fact_movies_performance",
    "bridge_movie_person",
    "bridge_movie_company",
    "bridge_movie_genre",
    "dim_people",
    "dim_companies",
    "dim_genres",
    "dim_movies",
)


def clean_text(value: str) -> str | None:
    value = value.strip()
    if len(value) >= 2 and value.startswith('"') and value.endswith('"'):
        value = value[1:-1].replace('""', '"').strip()
    return value or None


def nullable(value: str) -> str | None:
    return value or None


def to_int(value: str) -> int | None:
    return int(float(value)) if value else None


def to_float(value: str) -> float | None:
    return float(value) if value else None


def to_money(value: str) -> float:
    return round(float(value), 2) if value else 0.0


def to_optional_money(value: str) -> float | None:
    return round(float(value), 2) if value else None


Converter = Callable[[str], Any]

# arquivo -> (tabela, [(coluna, conversor)])
CSV_SPECS: tuple[tuple[str, str, list[tuple[str, Converter]]], ...] = (
    (
        "dim_movies.csv",
        "dim_movies",
        [
            ("sk_movie_id", str),
            ("id_filme", str),
            ("titulo", clean_text),
            ("data_lancamento", nullable),
            ("ano_lancamento", to_int),
            ("duracao_minutos", to_int),
            ("status_filme", nullable),
            ("sinopse", clean_text),
            ("url_poster", nullable),
            ("url_backdrop", nullable),
        ],
    ),
    ("dim_genres.csv", "dim_genres", [("sk_genre_id", str), ("nome_genero", str)]),
    ("dim_companies.csv", "dim_companies", [("sk_company_id", str), ("nome_produtora", str)]),
    (
        "dim_people.csv",
        "dim_people",
        [("sk_person_id", str), ("nome_pessoa", str), ("tipo_pessoa", str)],
    ),
    ("bridge_movie_genre.csv", "bridge_movie_genre", [("sk_movie_id", str), ("sk_genre_id", str)]),
    (
        "bridge_movie_company.csv",
        "bridge_movie_company",
        [("sk_movie_id", str), ("sk_company_id", str)],
    ),
    (
        "bridge_movie_person.csv",
        "bridge_movie_person",
        [("sk_movie_id", str), ("sk_person_id", str)],
    ),
    (
        "fact_movies_performance.csv",
        "fact_movies_performance",
        [
            ("sk_movie_id", str),
            ("orcamento_usd", to_optional_money),
            ("receita_usd", to_optional_money),
            ("lucro_usd", to_money),
            ("orcamento_brl", to_optional_money),
            ("receita_brl", to_optional_money),
            ("lucro_brl", to_money),
            ("popularidade", to_float),
            ("nota_tmdb", to_float),
            ("qtd_tmdb", to_int),
            ("nota_imdb", to_float),
            ("qtd_imdb", to_int),
        ],
    ),
    (
        "movies_reviews.csv",
        "movie_reviews",
        [
            ("sk_movie_review_id", str),
            ("sk_movie_id", str),
            ("nome", str),
            ("nota", float),
            ("comentario", str),
        ],
    ),
)


def sqlite_path_from_url(url: str) -> Path:
    prefix = url.split(":///", 1)
    if len(prefix) != 2 or not prefix[0].startswith("sqlite"):
        raise SystemExit(f"DATABASE_URL não aponta para um arquivo SQLite: {url}")
    return Path(prefix[1])


def read_rows(path: Path, columns: list[tuple[str, Converter]]) -> Iterator[tuple]:
    with path.open(encoding="utf-8", newline="") as file:
        reader = csv.DictReader(file)
        missing = {name for name, _ in columns} - set(reader.fieldnames or ())
        if missing:
            raise SystemExit(f"{path.name}: colunas ausentes {sorted(missing)}")
        for row in reader:
            yield tuple(convert(row[name]) for name, convert in columns)


def insert_csv(
    conn: sqlite3.Connection,
    path: Path,
    table: str,
    columns: list[tuple[str, Converter]],
    pk_size: int,
) -> int:
    names = ", ".join(name for name, _ in columns)
    placeholders = ", ".join("?" for _ in columns)
    sql = f"INSERT INTO {table} ({names}) VALUES ({placeholders})"
    # As chaves são hashes SHA-256 (ordem aleatória); inserir já ordenado pela
    # chave primária evita reescrever páginas da B-tree a cada linha.
    rows = sorted(read_rows(path, columns), key=lambda row: row[:pk_size])
    for start in range(0, len(rows), BATCH_SIZE):
        conn.executemany(sql, rows[start : start + BATCH_SIZE])
    return len(rows)


def rebuild_review_summary(conn: sqlite3.Connection) -> int:
    conn.execute("DELETE FROM dim_reviews")
    cursor = conn.execute(
        """
        INSERT INTO dim_reviews (
            sk_review_id, sk_movie_id, qtd_avaliacoes_usuarios, nota_media_usuarios
        )
        SELECT sk_movie_id, sk_movie_id, COUNT(*), AVG(nota)
        FROM movie_reviews
        GROUP BY sk_movie_id
        """
    )
    return cursor.rowcount


def load(data_dir: Path, db_path: Path, *, force: bool) -> None:
    missing_files = [name for name, _, _ in CSV_SPECS if not (data_dir / name).is_file()]
    if missing_files:
        raise SystemExit(f"Arquivos não encontrados em {data_dir}: {', '.join(missing_files)}")
    if not db_path.is_file():
        raise SystemExit(f"Banco {db_path} não existe. Rode `alembic upgrade head` antes.")

    conn = sqlite3.connect(db_path)
    try:
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master")}
        if not set(TABLES_CHILD_FIRST) <= tables:
            raise SystemExit("Schema incompleto. Rode `alembic upgrade head` antes da carga.")

        existing = conn.execute("SELECT COUNT(*) FROM dim_movies").fetchone()[0]
        if existing and not force:
            raise SystemExit(
                f"dim_movies já possui {existing} filmes. "
                "Use --force para apagar tudo e recarregar."
            )

        # Carga em massa: sem checagem de FK por linha; a integridade é validada ao final.
        conn.execute("PRAGMA foreign_keys=OFF")
        conn.execute("PRAGMA synchronous=OFF")
        conn.execute("PRAGMA journal_mode=MEMORY")
        conn.execute("PRAGMA cache_size=-262144")  # 256 MiB
        conn.execute("PRAGMA temp_store=MEMORY")
        conn.create_function("fold_text", 1, fold_text, deterministic=True)

        with conn:
            for table in TABLES_CHILD_FIRST:
                conn.execute(f"DELETE FROM {table}")

            for file_name, table, columns in CSV_SPECS:
                started = time.perf_counter()
                pk_size = 2 if table.startswith("bridge_") else 1
                count = insert_csv(conn, data_dir / file_name, table, columns, pk_size)
                logger.info(
                    "%-26s -> %-24s %9d linhas (%.1fs)",
                    file_name,
                    table,
                    count,
                    time.perf_counter() - started,
                )

            conn.execute("UPDATE dim_movies SET titulo_busca = fold_text(titulo)")

            summaries = rebuild_review_summary(conn)
            logger.info("dim_reviews recalculado a partir de movie_reviews: %d filmes", summaries)

            violations = conn.execute("PRAGMA foreign_key_check").fetchall()
            if violations:
                raise SystemExit(
                    f"Carga abortada: {len(violations)} violações de chave estrangeira"
                )

        conn.execute("ANALYZE")
        logger.info("Carga concluída em %s", db_path)
    finally:
        conn.close()


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(message)s")
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument(
        "--data-dir", type=Path, default=Path("../data"), help="Pasta com os arquivos CSV."
    )
    parser.add_argument(
        "--force", action="store_true", help="Apaga os dados existentes antes de carregar."
    )
    args = parser.parse_args()

    load(args.data_dir, sqlite_path_from_url(get_settings().database_url), force=args.force)


if __name__ == "__main__":
    main()
