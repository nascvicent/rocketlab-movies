// Guarda a última busca/filtro/página do catálogo para que "voltar ao catálogo"
// a partir de outras telas restaure exatamente a listagem de onde o usuário veio.
let lastCatalogSearch = ''

export function rememberCatalogSearch(search: string): void {
  lastCatalogSearch = search
}

export function catalogHref(): string {
  return `/${lastCatalogSearch}`
}
