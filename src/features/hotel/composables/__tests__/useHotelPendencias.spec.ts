/**
 * O contador do hotel precisa bater com as telas para onde ele aponta — e dizer quando não
 * conseguiu olhar.
 *
 * Um número na visão geral que diverge da prancheta é pior que número nenhum: a recepção clica em
 * "3 tarefas atrasadas", encontra duas, e aprende a não confiar no contador. Por isso os testes
 * recalculam cada número pela mesma régua da tela de destino e comparam.
 *
 * E uma conferência que falhou não pode virar calma: fonte que não respondeu é "não se sabe",
 * nunca zero.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'

import { resetMockConfig, setMockConfig } from '@/features/clinico/data/mock-runtime'

import { definirFalha, limparFalhas } from '../../data/mock-runtime'
import { hospedagemRepository, reservaRepository, situacaoDaTarefa } from '../../data/repositories'
import { agoraIso, resetDataset } from '../../data/store'
import {
  apurarPendenciasDoHotel,
  DIAS_DE_VESPERA,
  limparPendenciasDoHotel,
  useHotelPendencias,
} from '../useHotelPendencias'

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
  limparPendenciasDoHotel()
})

afterEach(() => {
  resetMockConfig()
  limparFalhas()
})

describe('apurarPendenciasDoHotel', () => {
  it('conta como rotina atrasada exatamente o que a prancheta mostra como atrasado', async () => {
    const [resultado, prancheta] = await Promise.all([
      apurarPendenciasDoHotel(),
      hospedagemRepository.rotina(),
    ])

    const agora = agoraIso()
    const atrasadas = prancheta.filter(
      (linha) => situacaoDaTarefa(linha.tarefa, agora) === 'atrasada',
    )

    expect(resultado.situacao).toBe('ok')
    expect(resultado.rotina?.total).toBe(atrasadas.length)
  })

  it('só chama de risco a rotina que tem medicação atrasada', async () => {
    const [resultado, prancheta] = await Promise.all([
      apurarPendenciasDoHotel(),
      hospedagemRepository.rotina(),
    ])

    const agora = agoraIso()
    const atrasadas = prancheta.filter(
      (linha) => situacaoDaTarefa(linha.tarefa, agora) === 'atrasada',
    )
    const temMedicacao = atrasadas.some((linha) => linha.tarefa.kind === 'medicacao')
    const esperado = temMedicacao ? 'risco' : atrasadas.length > 0 ? 'atencao' : 'neutro'

    expect(resultado.rotina?.tom).toBe(esperado)
  })

  it('conta a véspera travada com o mesmo recorte da faixa de Reservas', async () => {
    const [resultado, reservas] = await Promise.all([
      apurarPendenciasDoHotel(),
      reservaRepository.listar(),
    ])

    const vespera = reservas.filter(
      (linha) =>
        linha.diasAteEntrada >= 0 &&
        linha.diasAteEntrada <= DIAS_DE_VESPERA &&
        (linha.reserva.status === 'confirmada' || linha.reserva.status === 'pendente') &&
        (linha.admissao === 'ausente' || linha.admissao === 'vencido'),
    )

    expect(resultado.vespera?.total).toBe(vespera.length)
    expect(resultado.vespera?.tom).toBe(vespera.length > 0 ? 'atencao' : 'neutro')
  })

  it('não trata chegadas e saídas do dia como pendência', async () => {
    const resultado = await apurarPendenciasDoHotel()

    expect(resultado.chegadas).toEqual(expect.any(Number))
    expect(resultado.saidas).toEqual(expect.any(Number))
    expect(resultado).not.toHaveProperty('hoje')
  })

  it('uma fonte que falha deixa a conferência parcial e não inventa zero', async () => {
    definirFalha('reserva.listar', 1)

    const resultado = await apurarPendenciasDoHotel()

    expect(resultado.situacao).toBe('parcial')
    expect(resultado.rotina).not.toBeNull()
    expect(resultado.vespera).toBeNull()
    expect(resultado.chegadas).toBeNull()
  })

  it('sem nenhuma fonte, a conferência falha inteira', async () => {
    setMockConfig({ offline: true })

    const resultado = await apurarPendenciasDoHotel()

    expect(resultado.situacao).toBe('falhou')
    expect(resultado.rotina).toBeNull()
    expect(resultado.vespera).toBeNull()
    expect(resultado.chegadas).toBeNull()
    expect(resultado.saidas).toBeNull()
  })
})

describe('useHotelPendencias', () => {
  it('com o módulo desligado, tudo é zero e nada é carregado', async () => {
    const pendencias = useHotelPendencias(() => false)
    await nextTick()

    expect(pendencias.rotina.value.total).toBe(0)
    expect(pendencias.vespera.value.total).toBe(0)
    expect(pendencias.hoje.value).toEqual({ chegadas: null, saidas: null })
    expect(pendencias.situacao.value).toBeNull()
    expect(pendencias.carregado.value).toBe(false)
    expect(pendencias.conferidoEm.value).toBeNull()
  })

  it('com o módulo ligado, carrega uma vez e registra quando conferiu', async () => {
    const pendencias = useHotelPendencias(() => true)
    await pendencias.recarregar()

    expect(pendencias.carregado.value).toBe(true)
    expect(pendencias.situacao.value).toBe('ok')
    expect(pendencias.conferidoEm.value).toBeInstanceOf(Date)
  })

  it('a primeira conferência que falha não registra hora nem inventa o dia', async () => {
    setMockConfig({ offline: true })

    const pendencias = useHotelPendencias(() => true)
    await pendencias.recarregar()

    expect(pendencias.carregado.value).toBe(true)
    expect(pendencias.situacao.value).toBe('falhou')
    expect(pendencias.conferidoEm.value).toBeNull()
    expect(pendencias.hoje.value).toEqual({ chegadas: null, saidas: null })
  })

  it('uma reconferência que falha mantém os números e a hora da anterior', async () => {
    const pendencias = useHotelPendencias(() => true)
    await pendencias.recarregar()

    const rotinaAntes = pendencias.rotina.value
    const hojeAntes = pendencias.hoje.value
    const conferidoAntes = pendencias.conferidoEm.value

    setMockConfig({ offline: true })
    await pendencias.recarregar()

    expect(pendencias.situacao.value).toBe('falhou')
    expect(pendencias.rotina.value).toEqual(rotinaAntes)
    expect(pendencias.hoje.value).toEqual(hojeAntes)
    expect(pendencias.conferidoEm.value).toBe(conferidoAntes)
  })
})
