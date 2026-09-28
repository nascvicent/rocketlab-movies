import httpx
import pytest

from tests.conftest import GENRE_COMEDY, GENRE_DRAMA


def _titles(response: httpx.Response) -> list[str]:
    return [item["titulo"] for item in response.json()["items"]]


# --------------------------------------------------------------------------- #
# Catálogo
# --------------------------------------------------------------------------- #


async def test_catalog_is_paginated_and_sorted_by_popularity(client: httpx.AsyncClient) -> None:
    first = await client.get("/movies", params={"page_size": 2})
    second = await client.get("/movies", params={"page_size": 2, "page": 2})

    assert first.status_code == 200
    body = first.json()
    assert (body["total"], body["pages"], body["page"]) == (4, 2, 1)
    assert _titles(first) == ["The Matrix", "Alien"]
    # Filmes sem popularidade ficam por último.
    assert _titles(second) == ["O Fabuloso Destino de Amélie Poulain", "Obscure Short"]


async def test_catalog_item_exposes_average_rating(client: httpx.AsyncClient) -> None:
    response = await client.get("/movies", params={"q": "matrix"})

    [item] = response.json()["items"]
    assert item["avaliacoes"] == {"quantidade": 2, "media_nota": 9.0, "media_estrelas": 4.5}
    assert item["generos"] == ["Drama"]


@pytest.mark.parametrize(
    ("query", "expected"),
    [
        ("amelie", ["O Fabuloso Destino de Amélie Poulain"]),  # ignora acentos
        ("AMÉLIE destino", ["O Fabuloso Destino de Amélie Poulain"]),  # várias palavras
        ("the", ["The Matrix"]),
        ("inexistente", []),
        ("100%", []),  # curingas do LIKE são tratados como texto
    ],
)
async def test_search_by_title(client: httpx.AsyncClient, query: str, expected: list[str]) -> None:
    response = await client.get("/movies", params={"q": query})

    assert response.status_code == 200
    assert _titles(response) == expected
    assert response.json()["total"] == len(expected)


async def test_filters_by_genre_and_year(client: httpx.AsyncClient) -> None:
    by_genre = await client.get("/movies", params={"genero": GENRE_DRAMA})
    by_year = await client.get("/movies", params={"ano_de": 1990, "ano_ate": 2005})

    assert _titles(by_genre) == ["The Matrix", "O Fabuloso Destino de Amélie Poulain"]
    assert _titles(by_year) == ["The Matrix", "O Fabuloso Destino de Amélie Poulain"]


@pytest.mark.parametrize(
    ("sort", "expected"),
    [
        ("nota", ["The Matrix", "Alien"]),  # apenas filmes avaliados
        (
            "titulo",
            ["Alien", "O Fabuloso Destino de Amélie Poulain", "Obscure Short", "The Matrix"],
        ),
        (
            "recentes",
            ["Obscure Short", "O Fabuloso Destino de Amélie Poulain", "The Matrix", "Alien"],
        ),
        (
            "antigos",
            ["Alien", "The Matrix", "O Fabuloso Destino de Amélie Poulain", "Obscure Short"],
        ),
    ],
)
async def test_sort_options(client: httpx.AsyncClient, sort: str, expected: list[str]) -> None:
    response = await client.get("/movies", params={"ordenar": sort})

    assert _titles(response) == expected
    assert response.json()["total"] == len(expected)


async def test_rejects_invalid_pagination(client: httpx.AsyncClient) -> None:
    assert (await client.get("/movies", params={"page": 0})).status_code == 422
    assert (await client.get("/movies", params={"page_size": 101})).status_code == 422


async def test_lists_genres(client: httpx.AsyncClient) -> None:
    response = await client.get("/genres")

    assert [genre["nome_genero"] for genre in response.json()] == ["Comedy", "Drama"]


# --------------------------------------------------------------------------- #
# Detalhe, cadastro, edição e remoção
# --------------------------------------------------------------------------- #


async def test_movie_detail_groups_people_by_role(client: httpx.AsyncClient) -> None:
    response = await client.get("/movies/m-amelie")

    assert response.status_code == 200
    body = response.json()
    assert [p["nome_pessoa"] for p in body["diretores"]] == ["Jean-Pierre Jeunet"]
    assert [p["nome_pessoa"] for p in body["elenco"]] == ["Audrey Tautou"]
    assert [g["nome_genero"] for g in body["generos"]] == ["Comedy", "Drama"]
    assert body["avaliacoes"]["quantidade"] == 0
    assert body["desempenho"]["orcamento_usd"] == 1000


async def test_movie_detail_returns_404_for_unknown_movie(client: httpx.AsyncClient) -> None:
    response = await client.get("/movies/nao-existe")

    assert response.status_code == 404
    assert response.json()["detail"] == "Filme não encontrado"


async def test_create_movie_reuses_existing_director(client: httpx.AsyncClient) -> None:
    payload = {
        "titulo": "  Micmacs  ",
        "ano_lancamento": 2009,
        "data_lancamento": "2009-10-28",
        "duracao_minutos": 105,
        "sinopse": "Uma trupe de catadores.",
        "diretores": ["Jean-Pierre Jeunet", "Nova Diretora"],
        "generos": [GENRE_COMEDY],
        "url_poster": "https://example.com/poster.jpg",
    }

    response = await client.post("/movies", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["titulo"] == "Micmacs"
    assert body["id_filme"].startswith("local-")
    assert [p["nome_pessoa"] for p in body["diretores"]] == ["Jean-Pierre Jeunet", "Nova Diretora"]
    assert body["diretores"][0]["sk_person_id"] == "p-jeunet"
    assert body["desempenho"] is not None  # mantém a relação 1:1 com a tabela fato

    search = await client.get("/movies", params={"q": "micmacs"})
    assert _titles(search) == ["Micmacs"]


@pytest.mark.parametrize(
    ("change", "message"),
    [
        ({"titulo": "   "}, "string_too_short"),
        ({"ano_lancamento": 1500}, "greater_than_equal"),
        ({"data_lancamento": "2010-01-01"}, "ano_lancamento deve coincidir"),
        ({"url_poster": "not-a-url"}, "url_parsing"),
        ({"status_filme": "Cancelado"}, "literal_error"),
    ],
)
async def test_create_movie_validates_payload(
    client: httpx.AsyncClient, change: dict, message: str
) -> None:
    payload = {"titulo": "Filme", "ano_lancamento": 2009, **change}

    response = await client.post("/movies", json=payload)

    assert response.status_code == 422
    assert message in response.text


async def test_create_movie_rejects_unknown_genre(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/movies", json={"titulo": "Filme", "ano_lancamento": 2009, "generos": ["g-nope"]}
    )

    assert response.status_code == 422
    assert "g-nope" in response.json()["detail"]


async def test_update_movie_changes_only_sent_fields(client: httpx.AsyncClient) -> None:
    response = await client.patch(
        "/movies/m-amelie",
        json={"titulo": "Amélie", "generos": [GENRE_DRAMA], "diretores": ["Outra Pessoa"]},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["titulo"] == "Amélie"
    assert body["sinopse"] == "Uma garçonete em Paris."  # não enviado, preservado
    assert [g["nome_genero"] for g in body["generos"]] == ["Drama"]
    assert [p["nome_pessoa"] for p in body["diretores"]] == ["Outra Pessoa"]
    assert [p["nome_pessoa"] for p in body["elenco"]] == ["Audrey Tautou"]  # elenco intacto

    # O título normalizado da busca acompanha a edição.
    assert _titles(await client.get("/movies", params={"q": "fabuloso"})) == []
    assert _titles(await client.get("/movies", params={"q": "amelie"})) == ["Amélie"]


async def test_update_movie_syncs_year_with_release_date(client: httpx.AsyncClient) -> None:
    ok = await client.patch("/movies/m-alien", json={"data_lancamento": "1980-05-25"})
    conflict = await client.patch(
        "/movies/m-alien", json={"data_lancamento": "1981-01-01", "ano_lancamento": 1979}
    )

    assert ok.json()["ano_lancamento"] == 1980
    assert conflict.status_code == 422


async def test_update_movie_rejects_null_required_field(client: httpx.AsyncClient) -> None:
    response = await client.patch("/movies/m-alien", json={"titulo": None})

    assert response.status_code == 422


async def test_delete_movie_cascades_reviews(client: httpx.AsyncClient) -> None:
    response = await client.delete("/movies/m-matrix")

    assert response.status_code == 204
    assert (await client.get("/movies/m-matrix")).status_code == 404
    assert (await client.get("/movies/m-matrix/reviews")).status_code == 404
    assert (await client.delete("/movies/m-matrix")).status_code == 404
    assert _titles(await client.get("/movies", params={"ordenar": "nota"})) == ["Alien"]


# --------------------------------------------------------------------------- #
# Avaliações
# --------------------------------------------------------------------------- #


async def test_add_review_converts_stars_and_updates_average(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/movies/m-alien/reviews",
        json={"nome": "Diego", "estrelas": 4.5, "comentario": "  Tenso do início ao fim. "},
    )

    assert response.status_code == 201
    body = response.json()
    assert body["review"]["nota"] == 9
    assert body["review"]["estrelas"] == 4.5
    assert body["review"]["comentario"] == "Tenso do início ao fim."
    assert body["avaliacoes"] == {"quantidade": 2, "media_nota": 7.5, "media_estrelas": 3.75}

    detail = (await client.get("/movies/m-alien")).json()
    assert detail["avaliacoes"]["media_nota"] == 7.5
    assert detail["distribuicao_estrelas"] == {"1": 0, "2": 0, "3": 1, "4": 0, "5": 1}


async def test_first_review_creates_summary(client: httpx.AsyncClient) -> None:
    await client.post(
        "/movies/m-obscure/reviews", json={"nome": "Eva", "estrelas": 3, "comentario": "Ok."}
    )

    rated = await client.get("/movies", params={"ordenar": "nota"})
    assert "Obscure Short" in _titles(rated)


@pytest.mark.parametrize(
    "payload",
    [
        {"nome": "X", "estrelas": 0.5, "comentario": "abaixo do mínimo"},
        {"nome": "X", "estrelas": 5.5, "comentario": "acima do máximo"},
        {"nome": "X", "estrelas": 3.3, "comentario": "fora do passo de meia estrela"},
        {"nome": " ", "estrelas": 3, "comentario": "nome vazio"},
        {"nome": "X", "estrelas": 3, "comentario": ""},
    ],
)
async def test_add_review_validates_payload(client: httpx.AsyncClient, payload: dict) -> None:
    response = await client.post("/movies/m-alien/reviews", json=payload)

    assert response.status_code == 422


async def test_add_review_to_unknown_movie(client: httpx.AsyncClient) -> None:
    response = await client.post(
        "/movies/nao-existe/reviews", json={"nome": "X", "estrelas": 3, "comentario": "Oi"}
    )

    assert response.status_code == 404


async def test_list_reviews_newest_first(client: httpx.AsyncClient) -> None:
    await client.post(
        "/movies/m-matrix/reviews", json={"nome": "Novo", "estrelas": 1, "comentario": "Não gostei"}
    )

    response = await client.get("/movies/m-matrix/reviews", params={"page_size": 2})

    body = response.json()
    assert body["total"] == 3
    assert body["pages"] == 2
    assert body["items"][0]["nome"] == "Novo"


async def test_delete_review_updates_summary(client: httpx.AsyncClient) -> None:
    reviews = (await client.get("/movies/m-alien/reviews")).json()["items"]

    response = await client.delete(f"/reviews/{reviews[0]['sk_movie_review_id']}")

    assert response.status_code == 200
    assert response.json() == {"quantidade": 0, "media_nota": None, "media_estrelas": None}
    assert (await client.delete(f"/reviews/{reviews[0]['sk_movie_review_id']}")).status_code == 404
    # Sem avaliações, o filme sai da ordenação por nota.
    assert _titles(await client.get("/movies", params={"ordenar": "nota"})) == ["The Matrix"]
