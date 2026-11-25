/**
 * O selo da reavaliação do uso contínuo na adesão (PJ-HC2AKL, guia 9). O que mais custa errar:
 * esconder a reavaliação vencida (a deixa para a clínica chamar o paciente), mostrar a data um dia
 * antes por causa do fuso, ou dizer "Responsável continuou sem data" quando ele marcou outra.
 */
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import i18n from '@/i18n'

import { useFrasesDaAdesao, type ReavaliacaoDaAdesao } from '../useFrasesDaAdesao'

i18n.global.locale.value = 'pt'

function frases() {
  let resultado: ReturnType<typeof useFrasesDaAdesao> | null = null
  mount(
    defineComponent({
      setup() {
        resultado = useFrasesDaAdesao()
        return () => h('div')
      },
    }),
    { global: { plugins: [i18n] } },
  )
  return resultado!
}

const sem: ReavaliacaoDaAdesao = {
  reavaliarEm: null,
  reavaliacaoPendente: false,
  ultimaReavaliacao: null,
}

describe('selo da reavaliação', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-11-24T15:00:00-03:00'))
  })
  afterEach(() => vi.useRealTimers())

  it('sem data, sem resposta ou sem compartilhar: nenhum selo', () => {
    expect(frases().reavaliacao(sem)).toBeNull()
  })

  it('com data: o dia como está, sem passar pelo fuso; o ano só quando não é o de hoje', () => {
    const f = frases()

    expect(f.reavaliacao({ ...sem, reavaliarEm: '2026-12-01' })).toEqual({
      texto: 'Reavaliar em 01/12',
      vencida: false,
    })
    expect(f.reavaliacao({ ...sem, reavaliarEm: '2027-02-22' })?.texto).toBe(
      'Reavaliar em 22/02/2027',
    )
  })

  it('vencida vem primeiro e em destaque', () => {
    expect(
      frases().reavaliacao({
        reavaliarEm: '2026-11-20',
        reavaliacaoPendente: true,
        ultimaReavaliacao: { decisao: 'NOVA_DATA', em: '2026-08-10T12:00:00.000Z' },
      }),
    ).toEqual({ texto: 'Reavaliação vencida', vencida: true })
  })

  it('as três respostas do responsável', () => {
    const f = frases()
    const em = '2026-11-12T13:00:00.000Z'

    expect(
      f.reavaliacao({ ...sem, ultimaReavaliacao: { decisao: 'CONTINUAR_SEM_DATA', em } })?.texto,
    ).toBe('Responsável continuou sem data (12/11)')
    expect(
      f.reavaliacao({
        ...sem,
        reavaliarEm: '2027-06-10',
        ultimaReavaliacao: { decisao: 'NOVA_DATA', em },
      })?.texto,
    ).toBe('Nova data: 10/06/2027')
    expect(f.reavaliacao({ ...sem, ultimaReavaliacao: { decisao: 'ENCERRAR', em } })?.texto).toBe(
      'Encerrado pelo responsável (12/11)',
    )
  })

  it('continuou sem data e depois ganhou outra data: mostra a data, não a resposta antiga', () => {
    expect(
      frases().reavaliacao({
        ...sem,
        reavaliarEm: '2027-01-15',
        ultimaReavaliacao: { decisao: 'CONTINUAR_SEM_DATA', em: '2026-11-12T13:00:00.000Z' },
      })?.texto,
    ).toBe('Reavaliar em 15/01/2027')
  })
})
