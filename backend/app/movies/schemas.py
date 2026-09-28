"""Contratos de entrada e saída da API de filmes.

As avaliações são armazenadas na escala 0–10 (`nota`), mas o administrador
avalia filmes em estrelas de 1 a 5, com meias estrelas. A conversão é sempre
`nota = estrelas * 2`.
"""

from datetime import date, datetime
from enum import StrEnum
from typing import Annotated, Generic, Literal, TypeVar

from pydantic import (
    AfterValidator,
    BaseModel,
    ConfigDict,
    Field,
    HttpUrl,
    StringConstraints,
    computed_field,
    field_validator,
    model_validator,
)

MovieStatus = Literal["Lançado", "Pós-Produção", "Em Produção", "Planejado"]
MIN_YEAR = 1870
MAX_YEAR = 2100

NonEmptyStr = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]


def _nota_to_stars(nota: float | None) -> float | None:
    return None if nota is None else round(nota / 2, 2)


def _validate_half_step(value: float) -> float:
    if (value * 2) % 1 != 0:
        raise ValueError("a nota deve variar em passos de meia estrela (ex.: 3 ou 3.5)")
    return value


Stars = Annotated[float, Field(ge=1, le=5), AfterValidator(_validate_half_step)]


class MovieSort(StrEnum):
    POPULARITY = "popularidade"
    RATING = "nota"
    TITLE = "titulo"
    NEWEST = "recentes"
    OLDEST = "antigos"


# --------------------------------------------------------------------------- #
# Blocos reutilizáveis
# --------------------------------------------------------------------------- #


class GenreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_genre_id: str
    nome_genero: str


class PersonOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_person_id: str
    nome_pessoa: str


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_company_id: str
    nome_produtora: str


class RatingSummary(BaseModel):
    """Média geral das avaliações de um filme."""

    quantidade: int = 0
    media_nota: float | None = Field(default=None, description="Média na escala 0–10.")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def media_estrelas(self) -> float | None:
        """Média convertida para a escala de 5 estrelas."""

        return _nota_to_stars(self.media_nota)


class PerformanceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    orcamento_usd: float | None
    receita_usd: float | None
    lucro_usd: float | None
    popularidade: float | None
    nota_tmdb: float | None
    qtd_tmdb: int | None
    nota_imdb: float | None
    qtd_imdb: int | None


# --------------------------------------------------------------------------- #
# Filmes
# --------------------------------------------------------------------------- #


class MovieBase(BaseModel):
    titulo: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
    ano_lancamento: int = Field(ge=MIN_YEAR, le=MAX_YEAR)
    data_lancamento: date | None = None
    duracao_minutos: int | None = Field(default=None, ge=1, le=1000)
    status_filme: MovieStatus = "Lançado"
    sinopse: Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] | None = None
    url_poster: HttpUrl | None = None
    url_backdrop: HttpUrl | None = None
    diretores: list[NonEmptyStr] = Field(default_factory=list, max_length=10)
    generos: list[str] = Field(
        default_factory=list, max_length=19, description="Identificadores `sk_genre_id`."
    )

    @field_validator("diretores")
    @classmethod
    def _unique_directors(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))

    @field_validator("generos")
    @classmethod
    def _unique_genres(cls, value: list[str]) -> list[str]:
        return list(dict.fromkeys(value))


class MovieCreate(MovieBase):
    @model_validator(mode="after")
    def _year_matches_date(self) -> "MovieCreate":
        if self.data_lancamento and self.data_lancamento.year != self.ano_lancamento:
            raise ValueError("ano_lancamento deve coincidir com o ano de data_lancamento")
        return self


class MovieUpdate(BaseModel):
    """Atualização parcial: apenas os campos enviados são alterados."""

    titulo: (
        Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=500)]
        | None
    ) = None
    ano_lancamento: int | None = Field(default=None, ge=MIN_YEAR, le=MAX_YEAR)
    data_lancamento: date | None = None
    duracao_minutos: int | None = Field(default=None, ge=1, le=1000)
    status_filme: MovieStatus | None = None
    sinopse: Annotated[str, StringConstraints(strip_whitespace=True, max_length=4000)] | None = None
    url_poster: HttpUrl | None = None
    url_backdrop: HttpUrl | None = None
    diretores: list[NonEmptyStr] | None = Field(default=None, max_length=10)
    generos: list[str] | None = Field(default=None, max_length=19)

    @model_validator(mode="after")
    def _required_fields_not_null(self) -> "MovieUpdate":
        for name in ("titulo", "ano_lancamento", "status_filme"):
            if name in self.model_fields_set and getattr(self, name) is None:
                raise ValueError(f"{name} não pode ser nulo")
        return self


class MovieListItem(BaseModel):
    sk_movie_id: str
    titulo: str
    ano_lancamento: int | None
    duracao_minutos: int | None
    url_poster: str | None
    popularidade: float | None
    generos: list[str]
    avaliacoes: RatingSummary


class MovieDetail(BaseModel):
    sk_movie_id: str
    id_filme: str
    titulo: str
    data_lancamento: date | None
    ano_lancamento: int | None
    duracao_minutos: int | None
    status_filme: str | None
    sinopse: str | None
    url_poster: str | None
    url_backdrop: str | None
    generos: list[GenreOut]
    diretores: list[PersonOut]
    roteiristas: list[PersonOut]
    elenco: list[PersonOut]
    produtoras: list[CompanyOut]
    desempenho: PerformanceOut | None
    avaliacoes: RatingSummary
    distribuicao_estrelas: dict[int, int] = Field(
        description="Quantidade de avaliações por estrela arredondada (1 a 5)."
    )


T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def pages(self) -> int:
        return max(1, -(-self.total // self.page_size))


# --------------------------------------------------------------------------- #
# Avaliações
# --------------------------------------------------------------------------- #


class ReviewCreate(BaseModel):
    nome: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
    estrelas: Stars
    comentario: Annotated[
        str, StringConstraints(strip_whitespace=True, min_length=1, max_length=4000)
    ]


class ReviewOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    sk_movie_review_id: str
    sk_movie_id: str
    nome: str
    nota: float
    comentario: str
    created_at: datetime

    @computed_field  # type: ignore[prop-decorator]
    @property
    def estrelas(self) -> float:
        return round(self.nota / 2, 2)


class ReviewCreated(BaseModel):
    review: ReviewOut
    avaliacoes: RatingSummary


# --------------------------------------------------------------------------- #
# Perfil do avaliador
# --------------------------------------------------------------------------- #


class Achievement(BaseModel):
    id: str
    titulo: str
    descricao: str
    icone: str
    atual: int
    meta: int

    @computed_field  # type: ignore[prop-decorator]
    @property
    def conquistada(self) -> bool:
        return self.atual >= self.meta


class ReviewedMovie(BaseModel):
    sk_movie_id: str
    titulo: str
    ano_lancamento: int | None
    url_poster: str | None
    nota: float
    comentario: str

    @computed_field  # type: ignore[prop-decorator]
    @property
    def estrelas(self) -> float:
        return round(self.nota / 2, 2)


class ReviewerProfile(BaseModel):
    nome: str
    quantidade: int
    media_nota: float
    minutos_assistidos: int = Field(description="Soma da duração dos filmes avaliados.")
    duracao_media_minutos: int | None
    genero_favorito: str | None
    diretor_favorito: str | None
    melhor_filme: ReviewedMovie
    pior_filme: ReviewedMovie | None
    conquistas: list[Achievement]
    filmes: list[ReviewedMovie] = Field(description="Até 60 filmes, das maiores notas às menores.")

    @computed_field  # type: ignore[prop-decorator]
    @property
    def media_estrelas(self) -> float:
        return round(self.media_nota / 2, 2)
