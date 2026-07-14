import { describe, expect, it } from 'vitest'

import { normalizeInactiveReasons } from '@/service/user/inativacao-service'

describe('normalizeInactiveReasons', () => {
  it('aceita lista direta', () => {
    const reasons = normalizeInactiveReasons([
      { id: '1', label: 'Pausa', isCustomAllowed: false },
      { id: '2', label: 'Outro', isCustomAllowed: true, description: 'Texto' },
    ])

    expect(reasons).toHaveLength(2)
    expect(reasons[1]?.isCustomAllowed).toBe(true)
  })

  it('aceita objeto com reasons', () => {
    const reasons = normalizeInactiveReasons({
      reasons: [{ id: 'a', label: 'Motivo', isCustomAllowed: false }],
    })

    expect(reasons[0]?.id).toBe('a')
  })

  it('ignora itens inválidos', () => {
    expect(normalizeInactiveReasons([{ label: 'sem id' }, null])).toEqual([])
  })
})
