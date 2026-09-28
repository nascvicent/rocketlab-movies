const AVATAR_COLORS = ['#ff8000', '#00e054', '#40bcf4', '#f5c518', '#e07bff', '#ff6b8b']

/** Cor estável por nome, para o mesmo avaliador ter sempre o mesmo avatar. */
export function avatarColor(name: string): string {
  let hash = 0
  for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}
