import { describe, expect, it } from 'vitest'

import { linksDaPaginaPublica, SITE_PUBLICO } from '../pagina-publica'

const nenhum = { modulo: 'CLINICA' as const, status: null }
const hotelNuncaPedido = { modulo: 'HOTEL' as const, status: null }

describe('linksDaPaginaPublica', () => {
  it('clínica: /agendar no site, pelo módulo ou pela categoria', () => {
    expect(linksDaPaginaPublica('bem-estar', [], ['CLINICA'])).toEqual([
      { tipo: 'clinica', url: `${SITE_PUBLICO}/agendar/bem-estar` },
    ])
    expect(
      linksDaPaginaPublica(
        'bem-estar',
        [{ modulo: 'CLINICA', status: 'TESTE' }, hotelNuncaPedido],
        [],
      ),
    ).toEqual([{ tipo: 'clinica', url: `${SITE_PUBLICO}/agendar/bem-estar` }])
  })

  it('hotel: /reservar no site', () => {
    expect(linksDaPaginaPublica('recanto', [nenhum, hotelNuncaPedido], ['HOTEL'])).toEqual([
      { tipo: 'hotel', url: `${SITE_PUBLICO}/reservar/recanto` },
    ])
  })

  it('clínica com hotel: as duas páginas no mesmo slug', () => {
    const links = linksDaPaginaPublica(
      'aurora',
      [{ modulo: 'HOTEL', status: 'ATIVO' }],
      ['CLINICA'],
    )

    expect(links.map((link) => link.tipo)).toEqual(['clinica', 'hotel'])
  })

  it('sem módulo e sem sugestão (um pet shop): a página do estabelecimento em /agendar', () => {
    expect(linksDaPaginaPublica('amigo-fiel', [nenhum, hotelNuncaPedido], [])).toEqual([
      { tipo: 'clinica', url: `${SITE_PUBLICO}/agendar/amigo-fiel` },
    ])
  })

  it('na raiz do site, nunca num subdomínio do portal', () => {
    expect(SITE_PUBLICO).toBe('https://petjourney.health')
  })
})
