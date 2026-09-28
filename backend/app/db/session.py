from collections.abc import AsyncIterator

from sqlalchemy import event
from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)

from app.core.config import get_settings

settings = get_settings()


def enable_sqlite_foreign_keys(async_engine: AsyncEngine) -> None:
    """Habilita chaves estrangeiras e ajusta o cache em cada conexão SQLite."""

    @event.listens_for(async_engine.sync_engine, "connect")
    def _set_sqlite_pragma(dbapi_connection: object, connection_record: object) -> None:
        del connection_record
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        # As chaves são hashes de 64 caracteres: os índices não cabem no cache
        # padrão de 2 MiB e cada consulta voltaria ao disco.
        cursor.execute("PRAGMA cache_size=-65536")  # 64 MiB
        cursor.execute("PRAGMA mmap_size=268435456")  # 256 MiB
        cursor.execute("PRAGMA temp_store=MEMORY")
        cursor.close()


engine = create_async_engine(settings.database_url, echo=settings.environment == "local")
enable_sqlite_foreign_keys(engine)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


async def get_db() -> AsyncIterator[AsyncSession]:
    """Fornece uma sessão assíncrona por requisição."""

    async with AsyncSessionLocal() as session:
        yield session
