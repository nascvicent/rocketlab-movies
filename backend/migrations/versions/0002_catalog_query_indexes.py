"""Adiciona índices usados pela listagem do catálogo.

Cada ordenação do catálogo tem um índice que já entrega as linhas na ordem
certa, evitando ordenar os ~95 mil filmes a cada página:

* popularidade -> `fact_movies_performance (popularidade)`;
* mais bem avaliados -> `dim_reviews (nota_media_usuarios, qtd_avaliacoes_usuarios)`;
* lançamento -> `dim_movies (ano_lancamento, data_lancamento, sk_movie_id)`,
  que também cobre o filtro por ano sem ler as linhas completas;
* filtro por gênero -> `bridge_movie_genre (sk_genre_id)`;
* filtro por ano a partir de outra tabela -> `dim_movies (sk_movie_id, ano_lancamento)`,
  que evita ler a linha completa do filme (com a sinopse) só para checar o ano.

Revision ID: 0002_catalog_query_indexes
Revises: 0001_initial_movie_schema
Create Date: 2026-09-28
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0002_catalog_query_indexes"
down_revision: str | Sequence[str] | None = "0001_initial_movie_schema"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_index(
        "ix_fact_movies_performance_popularidade", "fact_movies_performance", ["popularidade"]
    )
    op.create_index(
        "ix_dim_reviews_ranking",
        "dim_reviews",
        ["nota_media_usuarios", "qtd_avaliacoes_usuarios"],
    )
    op.create_index(
        "ix_dim_movies_lancamento",
        "dim_movies",
        ["ano_lancamento", "data_lancamento", "sk_movie_id"],
    )
    op.create_index("ix_dim_movies_id_ano", "dim_movies", ["sk_movie_id", "ano_lancamento"])
    op.create_index("ix_bridge_movie_genre_sk_genre_id", "bridge_movie_genre", ["sk_genre_id"])


def downgrade() -> None:
    op.drop_index("ix_bridge_movie_genre_sk_genre_id", table_name="bridge_movie_genre")
    op.drop_index("ix_dim_movies_id_ano", table_name="dim_movies")
    op.drop_index("ix_dim_movies_lancamento", table_name="dim_movies")
    op.drop_index("ix_dim_reviews_ranking", table_name="dim_reviews")
    op.drop_index("ix_fact_movies_performance_popularidade", table_name="fact_movies_performance")
