/**
 * Toda tela do portal tem nome no registro de uso, ou está de fora de propósito.
 *
 * O mapa é escrito à mão, ao lado das páginas. Sem esta prova, uma tela nova entraria no CMS como
 * `/clinica/alguma-coisa/:id`, e ninguém perceberia até a equipe estranhar a lista.
 */

import { describe, expect, it } from 'vitest'

import { routes } from '@/router/file-routes'

import { TELAS_FORA_DO_REGISTRO, TITULOS_DAS_TELAS, tituloDaTela } from '../titulos-das-telas'

describe('nomes das telas no registro de uso', () => {
  it('dá nome a toda tela que entra no registro', () => {
    const semNome = routes
      .map((rota) => rota.path)
      .filter((molde) => !TELAS_FORA_DO_REGISTRO.has(molde) && !(molde in TITULOS_DAS_TELAS))

    expect(semNome).toEqual([])
  })

  it('não guarda nome de tela que não existe mais', () => {
    const moldes = new Set(routes.map((rota) => rota.path))
    const sobrando = Object.keys(TITULOS_DAS_TELAS).filter((molde) => !moldes.has(molde))

    expect(sobrando).toEqual([])
  })

  it('cabe no limite da API (80 caracteres)', () => {
    const compridos = Object.values(TITULOS_DAS_TELAS).filter((titulo) => titulo.length > 80)

    expect(compridos).toEqual([])
  })

  it('usa o próprio molde quando a tela não tem nome', () => {
    expect(tituloDaTela('/clinica/agenda')).toBe('Agenda')
    expect(tituloDaTela('/nova/:id')).toBe('/nova/:id')
  })
})
