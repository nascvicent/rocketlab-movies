# RocketLab Movies — Sistema de Avaliação de Filmes

Módulo **frontend + backend** de um sistema de avaliação de filmes inspirado no
Letterboxd, desenvolvido para a atividade DEV do **Visagio Rocket Lab 2026.2**.
O administrador navega por um catálogo de ~95 mil filmes, busca, filtra, vê os
detalhes e o histórico de avaliações de cada filme, gerencia o catálogo e
publica notas (1 a 5 estrelas) com resenhas.

| Camada | Tecnologias |
| --- | --- |
| Frontend | Vite, React 19, TypeScript, React Router, TanStack Query, Vitest + Testing Library |
| Backend | FastAPI, SQLAlchemy 2.0 (async), Pydantic 2, Alembic, pytest |
| Banco | SQLite |

## Requisitos atendidos

| Requisito | Onde |
| --- | --- |
| Cadastrar filmes (título, diretor, ano, gênero, sinopse…) | Botão **Adicionar filme** · `POST /api/v1/movies` |
| Catálogo paginado | Página inicial (24 por página) · `GET /api/v1/movies?page=` |
| Detalhes completos + lista de avaliações | `/filmes/:id` · `GET /api/v1/movies/{id}` e `/reviews` |
| Barra de pesquisa | Cabeçalho (busca ao digitar, sem diferenciar acentos/maiúsculas) · `?q=` |
| Remover e atualizar filmes | **Editar** / **Excluir** no detalhe · `PATCH` e `DELETE /api/v1/movies/{id}` |
| Nova avaliação (1–5 estrelas + resenha) | Formulário no detalhe · `POST /api/v1/movies/{id}/reviews` |
| Média geral das avaliações | Card do catálogo e painel com distribuição por estrela no detalhe |

**Extras:** filtros por gênero e intervalo de anos, 5 ordenações (popularidade,
mais bem avaliados, título, lançamento), remoção de avaliações, meia estrela,
cache de consultas (TanStack Query), estado da busca na URL (links
compartilháveis, voltar/avançar), layout responsivo, acessibilidade (slider de
estrelas por teclado, diálogos nativos, rótulos para leitores de tela) e testes
automatizados nas duas camadas.

### Extras divertidos

- **Roleta do que assistir** (`/sortear`): escolha um humor ("Quero chorar",
  "Tensão pura", "Sessão em família"…), a duração máxima, a nota mínima no
  IMDb e gire; o site
  sorteia um filme lançado, com pôster e, por padrão, conhecido (≥ 50 votos no
  TMDB).
- **Perfil do avaliador** (clique no nome de quem avaliou): "sua vida em horas
  de cinema" (tempo de tela, nota média, duração média, gênero do coração,
  diretor "oficial"), uma persona baseada no gênero favorito e **9 conquistas**
  com barra de progresso (Cinéfilo, Garimpeiro Cult, Crítico Implacável…).
- **Easter eggs**: avaliar *Barbie* deixa o site cor-de-rosa com corações
  caindo; *Matrix* faz chover código verde; *Oppenheimer* dispara um clarão.
  Respeitam a preferência do sistema por menos animações.

Ideias como watchlist compartilhada, mapa de países e estatísticas por horário
ficaram de fora: a base não tem contas de usuário, país dos filmes nem data
real das avaliações importadas.

## Como executar

Pré-requisitos: **Python 3.11+** e **Node.js 20.19+** (ou 22.12+).

### 1. Dados

Os CSVs não são versionados. Extraia os arquivos de `bases-1.zip` e
`bases-2.zip` diretamente em `data/`, na raiz do repositório:

```text
data/
├── bridge_movie_company.csv   ├── dim_movies.csv
├── bridge_movie_genre.csv     ├── dim_people.csv
├── bridge_movie_person.csv    ├── dim_reviews.csv
├── dim_companies.csv          ├── fact_movies_performance.csv
├── dim_genres.csv             └── movies_reviews.csv
```

### 2. Backend (porta 8000)

```bash
cd backend
python -m venv .venv
# Linux/macOS: source .venv/bin/activate    |    Windows: .venv\Scripts\activate
pip install -e ".[dev]"
cp .env.example .env                           # Windows: copy .env.example .env
alembic upgrade head                           # cria as tabelas
python -m app.scripts.load_data --data-dir ../data   # carga dos CSVs (~1 min)
uvicorn app.main:app --reload
```

- Documentação interativa da API: <http://localhost:8000/docs>
- Para recarregar do zero: `python -m app.scripts.load_data --data-dir ../data --force`

### 3. Frontend (porta 5173)

Em outro terminal:

```bash
cd frontend
npm install
npm run dev
```

Acesse <http://localhost:5173>. Em desenvolvimento, o Vite repassa `/api/*`
para `http://localhost:8000`; para apontar para outra API, defina
`VITE_API_URL` (veja `frontend/.env.example`).

### Testes e verificações

```bash
# backend
cd backend
pytest              # testes da API, regras de negócio e carga de dados
ruff check . && ruff format --check .

# frontend
cd frontend
npm test            # testes de componentes, páginas e utilitários
npm run typecheck && npm run lint && npm run build
```

## API

Prefixo `/api/v1`. Contratos completos em `/docs`.

| Método | Rota | Descrição |
| --- | --- | --- |
| GET | `/movies` | Catálogo paginado. Parâmetros: `page`, `page_size` (≤100), `q`, `genero`, `ano_de`, `ano_ate`, `ordenar` (`popularidade`, `nota`, `titulo`, `recentes`, `antigos`) |
| POST | `/movies` | Cadastra um filme |
| GET | `/movies/{id}` | Detalhes: gêneros, direção, roteiro, elenco, produtoras, desempenho, média e distribuição das notas |
| PATCH | `/movies/{id}` | Atualização parcial (só os campos enviados) |
| DELETE | `/movies/{id}` | Remove o filme e, em cascata, suas avaliações e relações |
| GET | `/movies/{id}/reviews` | Avaliações do filme, mais recentes primeiro (paginado) |
| POST | `/movies/{id}/reviews` | Nova avaliação: `{ nome, estrelas (1–5, passos de 0,5), comentario }` |
| DELETE | `/reviews/{id}` | Remove uma avaliação e devolve a nova média |
| GET | `/movies/sortear` | Roleta: sorteia um filme. Parâmetros: `generos` (vários), `duracao_max`, `nota_imdb_min`, `ano_de`, `ano_ate`, `apenas_conhecidos` |
| GET | `/reviewers/{nome}` | Estatísticas e conquistas de um avaliador |
| GET | `/genres` | Lista de gêneros |

## Decisões técnicas

### Qualidade dos dados

Antes da carga, os CSVs foram perfilados. A integridade referencial está
perfeita (nenhum órfão ou duplicata nas 10 tabelas), mas dois problemas foram
tratados em `backend/app/scripts/load_data.py`:

- **`dim_reviews.csv` está inconsistente com `movies_reviews.csv`**: 8.594
  filmes têm quantidade/média divergentes, e 40.267 filmes têm avaliações
  individuais contra apenas 26.604 resumos. As avaliações individuais são
  tratadas como fonte da verdade: o resumo é **recalculado na carga** e
  **mantido pela API** a cada avaliação criada ou removida.
- **Aspas escapadas duas vezes** em ~4.800 sinopses e 55 títulos (por exemplo,
  `"texto com ""citação"""`) são normalizadas para o texto original.

### Escala das notas

O banco guarda `nota` na escala 0–10 (formato do CSV). A interface e a API
trabalham com **estrelas de 1 a 5, com meia estrela**, e a conversão é sempre
`nota = estrelas × 2`. As respostas trazem os dois valores (`media_nota` e
`media_estrelas`).

### Desempenho com ~95 mil filmes

As chaves são hashes SHA-256 de 64 caracteres e a tabela de filmes carrega
sinopses longas, o que tornava páginas profundas e buscas lentas (até 5 s).
Medindo os planos de execução, a listagem passou a:

- **"deferred join"**: ordenação e `OFFSET` operam só sobre IDs e índices; as
  linhas completas são lidas apenas para os 24 filmes da página;
- **partir da tabela cujo índice atende a ordenação** (popularidade → tabela
  fato, nota → resumo de avaliações), com desempate por `rowid` para não anular
  o índice;
- **buscar em `titulo_busca`**, coluna com o título em minúsculas e sem acentos
  mantida automaticamente pelo modelo, varrendo apenas o índice dela;
- usar **cache de páginas de 64 MiB** no SQLite (o padrão de 2 MiB não comporta
  os índices sobre as chaves longas).

Resultado: mediana de ~80 ms por página do catálogo e pior caso de ~260 ms,
contra até 5 s antes. A carga dos CSVs caiu de 4 min para ~1 min, inserindo as
linhas já ordenadas pela chave primária.

### Migrações

As tabelas continuam sendo criadas exclusivamente pelo Alembic:

- `0001` — esquema estrela original;
- `0002` — índices usados pelas ordenações e filtros do catálogo;
- `0003` — coluna `titulo_busca` para a busca sem acentos (com preenchimento
  dos filmes já existentes).

## Estrutura

```text
.
├── backend/
│   ├── app/
│   │   ├── api/v1/          # composição dos routers
│   │   ├── core/            # configurações, logging e normalização de texto
│   │   ├── db/              # Base ORM, engine e sessões
│   │   ├── movies/          # modelos, schemas, regras de negócio e rotas
│   │   └── scripts/         # carga dos CSVs
│   ├── migrations/          # revisões Alembic
│   └── tests/
├── frontend/
│   └── src/
│       ├── api/             # cliente HTTP, tipos e hooks do TanStack Query
│       ├── components/      # layout, cards, estrelas, formulários, diálogos
│       ├── lib/             # formatação, validação e utilitários
│       ├── pages/           # catálogo, detalhe, cadastro e edição
│       └── test/            # configuração e utilitários de teste
└── data/                    # CSVs (não versionados)
```
