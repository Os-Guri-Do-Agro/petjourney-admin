import { describe, expect, it } from 'vitest'

import { imagemDoQr, nomeDoArquivo, svgDoQr } from '../qr-da-pagina'

const link = { tipo: 'clinica' as const, url: 'https://petjourney.health/agendar/bem-estar-cuiaba' }

describe('qr da página', () => {
  it('dá ao arquivo o endereço e o tipo da página', () => {
    expect(nomeDoArquivo('bem-estar-cuiaba', link, 'png')).toBe(
      'petjourney-bem-estar-cuiaba-clinica.png',
    )
    expect(nomeDoArquivo('bem-estar-cuiaba', { ...link, tipo: 'hotel' }, 'svg')).toBe(
      'petjourney-bem-estar-cuiaba-hotel.svg',
    )
  })

  it('gera o vetor para a gráfica na tinta da casa', async () => {
    const svg = await svgDoQr(link.url)

    expect(svg.startsWith('<svg')).toBe(true)
    expect(svg.toLowerCase()).toContain('#10302a')
  })

  it('gera a imagem em PNG', async () => {
    expect(await imagemDoQr(link.url, 280)).toMatch(/^data:image\/png;base64,/)
  })
})
