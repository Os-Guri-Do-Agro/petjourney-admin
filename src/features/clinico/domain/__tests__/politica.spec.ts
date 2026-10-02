/**
 * As regras de prazo que o app obedece e o portal mostra, e a ponte da pré-consulta para a
 * anamnese. São as regras que, divergindo entre os dois lados, fazem o botão aparecer e a API
 * recusar.
 */
import { describe, expect, it } from 'vitest'

import type { PoliticaDaClinica } from '../../contrato/responsavel'
import type { Appointment } from '../../data/types'
import {
  cancelarAte,
  janelaDaPreConsulta,
  podeCancelarPeloApp,
  podeConfirmarPresenca,
  situacaoDaPreConsulta,
  vagaLivre,
} from '../politica'
import {
  apetiteDaAnamnese,
  evacuacaoDaAnamnese,
  evolucaoDaAnamnese,
  miccaoDaAnamnese,
} from '../pre-consulta'

const OFFSET = '-04:00'

const POLITICA: PoliticaDaClinica = {
  cancelarAteHorasAntes: 2,
  reservaMinutos: 5,
  preConsultaAbreHorasAntes: 72,
  ofertaDeVagaMinutos: 30,
}

function atendimento(extra: Partial<Appointment> = {}): Appointment {
  return {
    id: 'apt-1',
    petId: 'pet-1',
    tutorId: 'tutor-1',
    professionalId: 'prof-1',
    roomIds: [],
    typeId: 'tipo-consulta',
    inicio: '2026-09-25T10:00:00-04:00',
    fim: '2026-09-25T10:30:00-04:00',
    status: 'agendado',
    origem: 'app',
    encaixe: false,
    observacao: '',
    chegadaEm: null,
    iniciadoEm: null,
    finalizadoEm: null,
    canceladoEm: null,
    motivoCancelamento: null,
    justificativaDeFalta: null,
    encounterId: null,
    linkedGroupId: null,
    criadoEm: '2026-09-20T10:00:00-04:00',
    atualizadoEm: '2026-09-20T10:00:00-04:00',
    ...extra,
  }
}

describe('prazo de cancelamento pelo app', () => {
  it('é o início menos as horas da política, no fuso da clínica', () => {
    expect(cancelarAte(atendimento(), POLITICA, OFFSET)).toBe('2026-09-25T08:00:00-04:00')
  })

  it('vale até o prazo, e não depois', () => {
    expect(podeCancelarPeloApp(atendimento(), POLITICA, '2026-09-25T07:59:00-04:00', OFFSET)).toBe(
      true,
    )
    expect(podeCancelarPeloApp(atendimento(), POLITICA, '2026-09-25T08:00:00-04:00', OFFSET)).toBe(
      false,
    )
  })

  it.each(['finalizado', 'falta', 'cancelado', 'em-atendimento'] as const)(
    'não se aplica a horário %s',
    (status) => {
      expect(cancelarAte(atendimento({ status }), POLITICA, OFFSET)).toBeNull()
    },
  )
})

describe('confirmação de presença', () => {
  it('abre nas 48 horas antes, só para horário ainda não confirmado', () => {
    expect(podeConfirmarPresenca(atendimento(), '2026-09-22T10:00:00-04:00')).toBe(false)
    expect(podeConfirmarPresenca(atendimento(), '2026-09-24T10:00:00-04:00')).toBe(true)
    expect(
      podeConfirmarPresenca(atendimento({ status: 'confirmado' }), '2026-09-24T10:00:00-04:00'),
    ).toBe(false)
  })
})

describe('janela da pré-consulta', () => {
  it('abre 72 horas antes e fecha no início da consulta', () => {
    expect(janelaDaPreConsulta(atendimento(), POLITICA, OFFSET)).toEqual({
      abreEm: '2026-09-22T10:00:00-04:00',
      fechaEm: '2026-09-25T10:00:00-04:00',
    })
  })

  it('anda por ainda não abriu, aberta, respondida e fechada', () => {
    const situacao = (agora: string, respondida = false) =>
      situacaoDaPreConsulta(
        atendimento(),
        respondida ? ({} as never) : null,
        POLITICA,
        agora,
        OFFSET,
      )

    expect(situacao('2026-09-21T10:00:00-04:00')).toBe('AINDA_NAO_ABRIU')
    expect(situacao('2026-09-24T10:00:00-04:00')).toBe('ABERTA')
    expect(situacao('2026-09-24T10:00:00-04:00', true)).toBe('RESPONDIDA')
    /* Depois que a consulta começa, a resposta continua existindo, mas não se edita mais. */
    expect(situacao('2026-09-25T10:00:00-04:00', true)).toBe('FECHADA')
  })
})

describe('vaga livre para o aceite da fila', () => {
  const vaga = {
    professionalId: 'prof-1',
    petId: 'pet-2',
    inicio: '2026-09-25T10:15:00-04:00',
    fim: '2026-09-25T10:45:00-04:00',
  }

  it('não serve quando o profissional já está ocupado no intervalo', () => {
    expect(vagaLivre([atendimento()], vaga)).toBe(false)
  })

  it('cancelado e falta não ocupam o horário', () => {
    expect(vagaLivre([atendimento({ status: 'cancelado' })], vaga)).toBe(true)
    expect(vagaLivre([atendimento({ status: 'falta' })], vaga)).toBe(true)
  })

  it('o mesmo pet não fica em dois lugares, mesmo com outro profissional', () => {
    expect(vagaLivre([atendimento({ petId: 'pet-2', professionalId: 'prof-9' })], vaga)).toBe(false)
  })
})

describe('da pré-consulta para a anamnese', () => {
  it('traduz o que tem grau clínico', () => {
    expect(apetiteDaAnamnese('POUCO')).toBe('reduzido')
    expect(apetiteDaAnamnese('RECUSOU')).toBe('ausente')
    expect(evacuacaoDaAnamnese('PASTOSA')).toBe('diarreia')
    expect(miccaoDaAnamnese('COM_DIFICULDADE')).toBe('disuria')
    expect(evolucaoDaAnamnese('VAI_E_VOLTA')).toBe('intermitente')
  })

  it('deixa o achado para o vet ler, em vez de converter à força', () => {
    expect(evacuacaoDaAnamnese('COM_SANGUE')).toBe('')
    expect(miccaoDaAnamnese('ESCURA')).toBe('')
    expect(apetiteDaAnamnese('VOMITOU_APOS')).toBe('')
    expect(apetiteDaAnamnese(null)).toBe('')
  })
})
