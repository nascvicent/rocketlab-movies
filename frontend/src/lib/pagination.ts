export type Slot = number | 'gap'

/** Páginas visíveis: primeira, última e vizinhas da atual, com reticências entre elas. */
export function pageSlots(current: number, total: number, siblings = 1): Slot[] {
  const pages = new Set([1, total])
  for (let page = current - siblings; page <= current + siblings; page++) {
    if (page >= 1 && page <= total) pages.add(page)
  }
  const sorted = [...pages].sort((a, b) => a - b)
  const slots: Slot[] = []
  sorted.forEach((page, index) => {
    const previous = sorted[index - 1]
    if (previous !== undefined && page - previous === 2) slots.push(previous + 1)
    else if (previous !== undefined && page - previous > 2) slots.push('gap')
    slots.push(page)
  })
  return slots
}
