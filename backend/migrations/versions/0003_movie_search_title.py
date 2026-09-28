"""Adiciona o título normalizado usado na busca do catálogo.

`titulo_busca` guarda o título em minúsculas e sem acentos, permitindo que a
busca encontre "Amélie" digitando "amelie" com um LIKE nativo do SQLite.

Revision ID: 0003_movie_search_title
Revises: 0002_catalog_query_indexes
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

from app.core.text import fold_text

revision: str = "0003_movie_search_title"
down_revision: str | Sequence[str] | None = "0002_catalog_query_indexes"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("dim_movies") as batch_op:
        batch_op.add_column(
            sa.Column("titulo_busca", sa.String(500), nullable=False, server_default="")
        )

    # Preenche filmes já existentes (bancos carregados antes desta revisão).
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT sk_movie_id, titulo FROM dim_movies")).all()
    if rows:
        bind.execute(
            sa.text("UPDATE dim_movies SET titulo_busca = :busca WHERE sk_movie_id = :id"),
            [{"id": movie_id, "busca": fold_text(titulo) or ""} for movie_id, titulo in rows],
        )
    # Índice menor que a tabela: o LIKE '%termo%' varre o índice em vez das linhas completas.
    op.create_index("ix_dim_movies_titulo_busca", "dim_movies", ["titulo_busca"])


def downgrade() -> None:
    op.drop_index("ix_dim_movies_titulo_busca", table_name="dim_movies")
    with op.batch_alter_table("dim_movies") as batch_op:
        batch_op.drop_column("titulo_busca")
