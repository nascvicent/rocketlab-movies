from urllib.parse import quote

import httpx

from tests.conftest import GENRE_DRAMA


async def test_roulette_respects_filters(client: httpx.AsyncClient) -> None:
    # Dramas: Amélie (122 min) e Matrix (136 min); só Amélie cabe em 130 min.
    params = {"generos": [GENRE_DRAMA], "duracao_max": 130, "apenas_conhecidos": False}

    response = await client.get("/movies/sortear", params=params)

    assert response.status_code == 200
    assert response.json()["titulo"] == "O Fabuloso Destino de Amélie Poulain"


async def test_reviewer_profile_stats_and_achievements(client: httpx.AsyncClient) -> None:
    await client.post(
        "/movies/m-amelie/reviews", json={"nome": "Ana", "estrelas": 5, "comentario": "Texto"}
    )

    response = await client.get(f"/reviewers/{quote('Ana')}")

    body = response.json()
    assert body["quantidade"] == 2  # 1 da base + 1 nova
    assert body["genero_favorito"] == "Drama"
    achievements = {item["id"]: item for item in body["conquistas"]}
    assert achievements["primeira-critica"]["conquistada"] is True
    assert achievements["cinefilo"]["atual"] == 2
