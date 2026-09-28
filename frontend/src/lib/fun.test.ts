import { describe, expect, it } from 'vitest'

import { easterEggFor, screenTime } from './fun'

describe('extras', () => {
  it('reconhece os filmes com easter egg', () => {
    expect(easterEggFor('Barbie')).toBe('barbie')
    expect(easterEggFor('The Matrix Resurrections')).toBe('matrix')
    expect(easterEggFor('Barbieri')).toBeNull()
  })

  it('descreve o tempo de tela de forma amigável', () => {
    expect(screenTime(10632)).toBe('7 dias e 9 horas')
  })
})
