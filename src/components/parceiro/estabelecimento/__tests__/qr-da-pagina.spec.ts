import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  baixarImagemDoQr,
  imagemDoQr,
  nomeDoArquivo,
  svgDoQr,
  TAMANHO_DO_QR,
  urlDoQr,
} from '../qr-da-pagina'

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

  it('pede o tamanho de cada uso ao WFQR e o vetor com format=svg', () => {
    const base = 'https://srhub.up.railway.app/q/image/Uq42EXm8'

    expect(urlDoQr(base, { size: TAMANHO_DO_QR.gaveta })).toBe(`${base}?size=1024`)
    expect(urlDoQr(base, { size: TAMANHO_DO_QR.folha })).toBe(`${base}?size=2000`)
    expect(urlDoQr(base, { svg: true })).toBe(`${base}?format=svg`)
  })

  describe('baixar a imagem do WFQR', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('devolve o arquivo quando o WFQR responde', async () => {
      const blob = new Blob(['png'], { type: 'image/png' })
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, blob: async () => blob }))

      expect(await baixarImagemDoQr('https://srhub.up.railway.app/q/image/x?size=1024')).toBe(blob)
    })

    it('falha com status ruim, para quem chama cair na reserva', async () => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))

      await expect(baixarImagemDoQr('https://srhub.up.railway.app/q/image/x')).rejects.toThrow(
        'HTTP 503',
      )
    })
  })
})
