/** Minúsculas e sem acentos ("Amélie" -> "amelie"), como a busca do backend. */
export function foldText(value: string): string {
  return value.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
}
