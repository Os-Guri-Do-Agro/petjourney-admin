import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import type { NomeDoModulo, Permissao } from '@/service/parceiro/acesso-service'
import { routes } from '@/router/file-routes'

import {
  podeAbrirCaminho,
  podeAbrirRotaDeModulo,
  rotaDoModulo,
  ROTAS_DOS_MODULOS,
  type AcessoDaConta,
} from '../rotas-dos-modulos'

function acesso(
  modulos: NomeDoModulo[],
  permissoes: Permissao[],
  demonstracao = false,
): AcessoDaConta {
  return {
    demonstracao,
    podeLer: (modulo) => modulos.includes(modulo),
    temPermissao: (permissao) => permissoes.includes(permissao),
  }
}

const integrada = (prefixo: string) => ({
  ...rotaDoModulo(prefixo)!,
  integrada: true,
})

describe('rotaDoModulo', () => {
  it('o prefixo mais longo vence', () => {
    expect(rotaDoModulo('/clinica/paciente/importar')?.permissao).toBe('importacao.executar')
    expect(rotaDoModulo('/clinica/paciente/p1/vacinas')?.permissao).toBe('paciente.ler')
  })

  it('rota fora dos módulos não tem entrada', () => {
    expect(rotaDoModulo('/parceiro/equipe')).toBeNull()
    expect(podeAbrirCaminho('/parceiro/equipe', acesso([], []))).toBe(true)
  })

  it('tela de módulo sem entrada própria só abre na demonstração', () => {
    const rota = rotaDoModulo('/hotel/tela-nova')

    expect(rota?.modulo).toBe('HOTEL')
    expect(
      podeAbrirRotaDeModulo({ ...rota!, soDemonstracao: true }, acesso(['HOTEL'], ['hotel.ler'])),
    ).toBe(false)
  })

  it('toda tela de /clinica e /hotel que existe no roteador tem entrada', () => {
    const router = createRouter({ history: createMemoryHistory(), routes })
    const caminhos = router
      .getRoutes()
      .map((rota) => rota.path)
      .filter((caminho) => caminho.startsWith('/clinica/') || caminho.startsWith('/hotel/'))

    const semEntrada = caminhos.filter((caminho) => {
      const concreto = caminho.replace(/:[^/]+/g, 'x')

      return !ROTAS_DOS_MODULOS.some(
        (rota) => concreto === rota.prefixo || concreto.startsWith(`${rota.prefixo}/`),
      )
    })

    expect(caminhos.length).toBeGreaterThan(0)
    expect(semEntrada).toEqual([])
  })
})

describe('podeAbrirRotaDeModulo', () => {
  it('na demonstração tudo abre', () => {
    expect(podeAbrirCaminho('/clinica/agenda', acesso([], [], true))).toBe(true)
  })

  it('tela ainda não integrada não abre fora da demonstração, mesmo com módulo e permissão', () => {
    expect(podeAbrirCaminho('/clinica/paciente/abc', acesso(['CLINICA'], ['paciente.ler']))).toBe(
      false,
    )
  })

  it('integrada: precisa do módulo e da permissão', () => {
    const agenda = integrada('/clinica/agenda')

    expect(podeAbrirRotaDeModulo(agenda, acesso(['CLINICA'], ['agenda.ler']))).toBe(true)
    expect(podeAbrirRotaDeModulo(agenda, acesso([], ['agenda.ler']))).toBe(false)
    expect(podeAbrirRotaDeModulo(agenda, acesso(['CLINICA'], []))).toBe(false)
  })

  it('o cadastro de pacientes abre com qualquer um dos dois módulos', () => {
    const pacientes = integrada('/clinica/pacientes')

    expect(podeAbrirRotaDeModulo(pacientes, acesso(['HOTEL'], ['paciente.ler']))).toBe(true)
    expect(podeAbrirRotaDeModulo(pacientes, acesso([], ['paciente.ler']))).toBe(false)
  })

  it('o resumo do hotel abre para quem lê a casa e para o financeiro, que só vê o faturamento', () => {
    const resumo = rotaDoModulo('/hotel/resumo')!

    expect(podeAbrirRotaDeModulo(resumo, acesso(['HOTEL'], ['hotel.ler']))).toBe(true)
    expect(podeAbrirRotaDeModulo(resumo, acesso(['HOTEL'], ['hotel.faturamento']))).toBe(true)
    expect(podeAbrirRotaDeModulo(resumo, acesso(['HOTEL'], ['hotel.valores']))).toBe(false)
    expect(podeAbrirRotaDeModulo(resumo, acesso([], ['hotel.faturamento']))).toBe(false)
  })

  it('a prancheta e a rotina da casa do hotel abrem pela API para quem lê a casa', () => {
    for (const caminho of ['/hotel/rotina', '/hotel/rotina-padrao']) {
      const rota = rotaDoModulo(caminho)!

      expect(rota.integrada).toBe(true)
      expect(podeAbrirRotaDeModulo(rota, acesso(['HOTEL'], ['hotel.ler']))).toBe(true)
      expect(podeAbrirRotaDeModulo(rota, acesso([], ['hotel.ler']))).toBe(false)
    }

    /* O painel do dia continua só na demonstração. */
    expect(rotaDoModulo('/hotel/painel')!.integrada).toBe(false)
  })
})
