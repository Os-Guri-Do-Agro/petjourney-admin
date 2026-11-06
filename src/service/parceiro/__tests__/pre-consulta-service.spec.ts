import { describe, expect, it } from 'vitest'

import { foiEditada, fotosVencidas } from '../pre-consulta-service'

describe('pré-consulta da clínica', () => {
  it('marca editada só quando a última mudança vem depois da primeira resposta', () => {
    expect(
      foiEditada({
        respondidaEm: '2026-11-06T15:13:12-04:00',
        atualizadaEm: '2026-11-06T15:15:40-04:00',
      }),
    ).toBe(true)
    expect(
      foiEditada({
        respondidaEm: '2026-11-06T15:13:12-04:00',
        atualizadaEm: '2026-11-06T15:13:12-04:00',
      }),
    ).toBe(false)
    expect(foiEditada({ respondidaEm: null, atualizadaEm: null })).toBe(false)
  })

  it('pede as fotos de novo quando a URL de 15 minutos vence (com 30 s de folga)', () => {
    const agora = new Date('2026-11-06T19:20:00Z').getTime()
    const foto = (expiraEm: string | null) => ({ fotoId: 'f', url: 'https://x', expiraEm })

    expect(fotosVencidas({ fotos: [foto('2026-11-06T19:30:00Z')] }, agora)).toBe(false)
    expect(fotosVencidas({ fotos: [foto('2026-11-06T19:20:20Z')] }, agora)).toBe(true)
    expect(fotosVencidas({ fotos: [foto(null)] }, agora)).toBe(false)
    expect(fotosVencidas({ fotos: undefined }, agora)).toBe(false)
  })
})
