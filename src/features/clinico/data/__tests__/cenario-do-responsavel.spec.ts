/**
 * O cenário do lado do responsável, conferido no dataset.
 *
 * É o roteiro que o doc de passagem para o app (`docs/clinico/09-*.md`) descreve e que o mock
 * do app monta do lado de lá. Se ele deixar de valer aqui, a demonstração que passa do portal
 * para o celular troca de história no meio — e ninguém avisa.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { setClockSkew } from '../../domain/clinic-time'
import { montarPlanoVacinal } from '../../domain/protocolo-vacinal'
import { reforcosDoPaciente } from '../../domain/vacinacao'
import { vacinasFixture } from '../fixtures/vacinas'
import { setMockConfig } from '../mock-runtime'
import { OfertaExpiradaError, VagaJaPreenchidaError, waitlistRepository } from '../repositories'
import { PET_DA_FILA, RESPONSAVEL_DA_DEMONSTRACAO } from '../seed-responsavel'
import { PET_EM_PROTOCOLO } from '../seed-vacinacao'
import { getDataset, resetDataset } from '../store'

beforeEach(() => {
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
  resetDataset()
})

afterEach(() => {
  setClockSkew(0)
})

describe('a Fátima e os quatro pets', () => {
  it('a Pérola tem consulta hoje, marcada e confirmada pelo app, sem pré-consulta respondida', () => {
    const dataset = getDataset()
    const hoje = dataset.appointments.find((item) => item.id === 'apt-resumo-perola')
    const encounter = dataset.encounters.find((item) => item.appointmentId === 'apt-resumo-perola')

    expect(hoje?.tutorId).toBe(RESPONSAVEL_DA_DEMONSTRACAO)
    expect(hoje?.origem).toBe('app')
    expect(hoje?.status).toBe('confirmado')
    expect(hoje?.confirmacao?.por).toBe('app')
    expect(encounter?.preConsulta ?? null).toBeNull()
  })

  it('a V4 da Pérola vence em 25 dias, e a antirrábica já passou da carência', () => {
    /*
     * As duas pontas do reforço na mesma paciente: a V4 é a da semana (próximo), a antirrábica é
     * a de hoje (vencido) — e a consulta dela é hoje, que é quando a clínica resolve as duas.
     */
    const dataset = getDataset()
    const reforcos = reforcosDoPaciente(
      dataset.aplicacoesDeVacina.filter((item) => item.petId === 'pet-perola'),
      vacinasFixture,
      dataset.ancora,
    )

    expect(reforcos).toEqual([
      expect.objectContaining({ vacinaId: 'vac-antirrabica-canina', situacao: 'vencido' }),
      expect.objectContaining({ vacinaId: 'vac-v4-felina', situacao: 'proximo' }),
    ])
  })

  it('o Biscoito está no meio da série de filhote: a V10 de fora conta, a segunda é hoje', () => {
    const dataset = getDataset()
    const biscoito = dataset.pets.find((pet) => pet.id === PET_EM_PROTOCOLO)!
    const plano = montarPlanoVacinal({
      pet: biscoito,
      vacinas: vacinasFixture,
      aplicacoes: dataset.aplicacoesDeVacina,
      agendamentos: [],
      hoje: dataset.ancora,
    })
    const v10 = plano.vacinas.find((item) => item.vacina.id === 'vac-v10')!
    const antirrabica = plano.vacinas.find((item) => item.vacina.id === 'vac-antirrabica-canina')!

    expect(biscoito.tutorId).toBe(RESPONSAVEL_DA_DEMONSTRACAO)
    expect(v10.tipoDeSerie).toBe('filhote')
    expect(v10.aplicadasNaSerie).toBe(1)
    expect(v10.doses[0]?.aplicacao?.origem).toBe('externa')
    expect(v10.proxima).toMatchObject({ numero: 2, total: 3, estado: 'devida' })
    /* Onze semanas: a antirrábica ainda não cabe. É "a partir de", nunca "atrasada". */
    expect(antirrabica.situacao).toBe('aguarda-idade')
  })

  it('a Pipoca está internada, com boletins enviados e ao menos um com foto', () => {
    const { internacao } = getDataset()
    const pipoca = internacao.internacoes.find((item) => item.petId === 'pet-pipoca')
    const enviados = internacao.boletins.filter(
      (item) => item.internacaoId === pipoca?.id && item.status === 'enviado',
    )

    expect(pipoca?.status).toBe('internado')
    expect(enviados.length).toBeGreaterThan(0)
    expect(enviados.some((item) => item.foto !== null)).toBe(true)
  })

  it('a Brunilda faltou a um retorno sem justificar, e tem uma oferta de vaga aberta', () => {
    const dataset = getDataset()
    const falta = dataset.appointments.find((item) => item.id === 'apt-falta-brunilda')
    const fila = dataset.waitlist.find((item) => item.id === 'fila-brunilda')

    expect(falta?.status).toBe('falta')
    expect(falta?.justificativaDeFalta).toBeNull()
    expect(fila?.petId).toBe(PET_DA_FILA)
    expect(fila?.status).toBe('ofertado')
    expect(fila?.ofertaProfessionalId).toBeTruthy()
  })
})

describe('o que o portal precisa para conversar com o app', () => {
  it('existe uma falta justificada pelo próprio responsável, pelo app', () => {
    const pelaApp = getDataset().appointments.filter(
      (item) => item.justificativaDeFalta?.canal === 'app',
    )

    expect(pelaApp).toHaveLength(1)
  })

  it('só um responsável não liberou o diário, de propósito', () => {
    const naoLiberaram = getDataset().consentimentos.filter((item) => !item.diarioCompleto)

    expect(naoLiberaram.map((item) => item.tutorId)).toEqual(['tutor-sergio'])
  })

  it('o que terminou antes de hoje tem o resumo liberado; o de hoje ainda não', () => {
    const dataset = getDataset()
    const finalizados = dataset.encounters.filter((item) => item.status === 'finalizado')

    expect(finalizados.some((item) => item.resumoLiberadoEm)).toBe(true)
    expect(
      finalizados
        .filter((item) => item.resumoLiberadoEm)
        .every((item) => Date.parse(item.resumoLiberadoEm!) > Date.parse(item.finalizadoEm!)),
    ).toBe(true)
  })
})

describe('aceite da oferta de vaga', () => {
  it('aceitar cria o horário, confirmado e com origem na fila', async () => {
    const { entrada, atendimento } = await waitlistRepository.responder(
      'fila-brunilda',
      true,
      'app',
    )

    expect(entrada.status).toBe('aceito')
    expect(atendimento).toMatchObject({
      petId: PET_DA_FILA,
      origem: 'fila',
      status: 'confirmado',
      confirmacao: expect.objectContaining({ por: 'app' }),
    })
    expect(getDataset().appointments.some((item) => item.id === atendimento?.id)).toBe(true)
  })

  it('oferta vencida não vira horário', async () => {
    /* Uma hora depois: os 25 minutos da oferta já passaram. */
    setClockSkew(60 * 60_000)

    await expect(waitlistRepository.responder('fila-brunilda', true)).rejects.toBeInstanceOf(
      OfertaExpiradaError,
    )
  })

  it('vaga ocupada no meio-tempo devolve a entrada à fila, sem criar conflito', async () => {
    const dataset = getDataset()
    const entrada = dataset.waitlist.find((item) => item.id === 'fila-brunilda')!
    /* O encaixe do balcão: outro pet, mesmo profissional, um minuto em cima do início da vaga. */
    dataset.appointments.push({
      ...dataset.appointments[0]!,
      id: 'apt-encaixe-no-balcao',
      petId: 'pet-luna',
      professionalId: entrada.ofertaProfessionalId!,
      inicio: entrada.ofertaSlotInicio!,
      fim: new Date(Date.parse(entrada.ofertaSlotInicio!) + 60_000).toISOString(),
      status: 'agendado',
    })

    await expect(waitlistRepository.responder('fila-brunilda', true)).rejects.toBeInstanceOf(
      VagaJaPreenchidaError,
    )
    expect(entrada.status).toBe('aguardando')
  })
})
