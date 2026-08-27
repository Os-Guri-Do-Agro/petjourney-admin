/**
 * Contrato de completude do dataset de demonstração.
 *
 * A regra é simples e vale para o módulo inteiro: **nenhuma lista da interface pode nascer
 * vazia**. Estado sem exemplo é estado que ninguém revisa — e o que ninguém revisa chega quebrado
 * no primeiro cliente que o encontra.
 *
 * Cada expectativa aqui corresponde a algo que a interface mostra. Se uma falhar, alguma tela
 * está exibindo um "nada por aqui" que deveria ser conteúdo.
 *
 * Os testes rodam em três horários do mesmo dia, porque metade destes estados nasce do relógio:
 * às oito da manhã nada terminou ainda, às dez da noite ninguém está em atendimento. O dataset
 * precisa mostrar tudo em qualquer um dos três.
 */

import { afterEach, describe, expect, it } from 'vitest'

import { createClinicClock, setClockSkew } from '../../domain/clinic-time'
import { retornosVencidos } from '../../domain/follow-up'
import { CLINIC_UTC_OFFSET, petsFixture } from '../fixtures'
import { gerarDataset, type SeedResult } from '../seed'
import type {
  AppointmentStatus,
  BlockReason,
  DiagnosisKind,
  PetAlertKind,
  PetSpecies,
  TimelineEventKind,
  WaitlistStatus,
} from '../types'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

/** Manhã, meio da tarde e depois do expediente: as três horas em que a demonstração é aberta. */
const HORAS = [8, 15, 22]

function paraHora(hora: number) {
  setClockSkew(0)

  return (hora * 60 - clock.now().minutes) * 60_000
}

function emCadaHora(assercao: (dataset: SeedResult, hora: number) => void) {
  for (const hora of HORAS) {
    setClockSkew(paraHora(hora))
    assercao(gerarDataset(), hora)
  }
}

afterEach(() => {
  setClockSkew(0)
})

describe('dataset de demonstração: nada vazio', () => {
  const TODOS_OS_STATUS: AppointmentStatus[] = [
    'agendado',
    'confirmado',
    'aguardando',
    'em-atendimento',
    'finalizado',
    'falta',
    'cancelado',
  ]

  /**
   * Dentro do expediente, o dia âncora carrega os sete estados — é a tela que a demonstração
   * abre primeiro, e ela precisa mostrar tudo sem navegar.
   */
  it('mostra os sete estados no dia âncora durante o expediente', () => {
    for (const hora of [8, 15]) {
      setClockSkew(paraHora(hora))

      const dataset = gerarDataset()
      const presentes = new Set(
        dataset.appointments
          .filter((item) => clock.dateOf(item.inicio) === dataset.ancora)
          .map((item) => item.status),
      )

      for (const status of TODOS_OS_STATUS) {
        expect(presentes, `status ${status} às ${hora}h`).toContain(status)
      }
    }
  })

  /**
   * Fora do expediente, "agendado" e "confirmado" não podem existir no dia âncora — às dez da
   * noite tudo do dia já aconteceu, e fingir o contrário seria dado falso. Eles continuam a um
   * clique de distância, no dia seguinte, que é onde a agenda os mostra de verdade.
   */
  it('mantém os sete estados alcançáveis mesmo fora do expediente', () => {
    emCadaHora((dataset, hora) => {
      const presentes = new Set(dataset.appointments.map((item) => item.status))

      for (const status of TODOS_OS_STATUS) {
        expect(presentes, `status ${status} às ${hora}h`).toContain(status)
      }
    })
  })

  it('tem os seis motivos de bloqueio', () => {
    const dataset = gerarDataset()
    const presentes = new Set(dataset.blocks.map((bloqueio) => bloqueio.motivo))
    const esperados: BlockReason[] = [
      'almoco',
      'reuniao',
      'manutencao',
      'bloqueio-pessoal',
      'ferias',
    ]

    for (const motivo of esperados) {
      expect(presentes, `bloqueio ${motivo}`).toContain(motivo)
    }
  })

  it('tem fila com aguardando, ofertado, aceito e expirado', () => {
    const dataset = gerarDataset()
    const presentes = new Set(dataset.waitlist.map((entrada) => entrada.status))
    const esperados: WaitlistStatus[] = ['aguardando', 'ofertado', 'aceito', 'expirado']

    for (const status of esperados) {
      expect(presentes, `fila ${status}`).toContain(status)
    }
  })

  it('tem prontuário com prescrição, exame solicitado e retorno indicado', () => {
    const dataset = gerarDataset()
    const finalizados = dataset.encounters.filter((item) => item.status === 'finalizado')

    expect(finalizados.some((item) => item.conduta.prescricoes.length > 0)).toBe(true)
    expect(finalizados.some((item) => item.conduta.examesSolicitados.length > 0)).toBe(true)
    expect(finalizados.some((item) => item.conduta.retorno.emDias !== null)).toBe(true)
    /** Duas prescrições no mesmo prontuário: a lista numerada precisa de mais de um item. */
    expect(finalizados.some((item) => item.conduta.prescricoes.length > 1)).toBe(true)
  })

  it('tem o caso da alergia materializado, e não só alcançável', () => {
    const dataset = gerarDataset()
    const rascunho = dataset.encounters.find((item) => item.id === 'enc-apt-alergia')
    const prescricao = rascunho?.conduta.prescricoes[0]

    expect(rascunho?.status).toBe('rascunho')
    expect(prescricao).toBeDefined()
    /** O conflito só cobra decisão enquanto está por confirmar. */
    expect(prescricao?.alergiaConfirmada).toBe(false)
    expect(prescricao?.calculo.mgPorAdministracao).toBeGreaterThan(0)
  })

  /**
   * A caixa de pendências tem dois modos de falhar, e o teto importa tanto quanto o piso:
   * vazia não mostra o recurso, e com oitenta linhas ninguém lê nenhuma. O retorno que já foi
   * remarcado sai da conta — clínica que esquece oitenta retornos não é o cenário a demonstrar.
   */
  it('tem um punhado de retornos vencidos, nem lista vazia nem enxurrada', () => {
    emCadaHora((dataset, hora) => {
      const pendentes = dataset.encounters.filter(
        (encounter) =>
          encounter.status === 'finalizado' &&
          encounter.conduta.retorno.emDias !== null &&
          encounter.conduta.retorno.appointmentId === null,
      )

      const vencidos = retornosVencidos(pendentes, clock, dataset.ancora)

      expect(vencidos.length, `retornos vencidos às ${hora}h`).toBeGreaterThanOrEqual(4)
      expect(vencidos.length, `retornos vencidos às ${hora}h`).toBeLessThanOrEqual(20)
    })
  })

  it('tem paciente com e sem horário futuro, para os dois filtros valerem', () => {
    const dataset = gerarDataset()
    const agora = clock.nowIso()

    const comFuturo = new Set(
      dataset.appointments
        .filter((item) => item.inicio > agora && item.status !== 'cancelado')
        .map((item) => item.petId),
    )

    expect(comFuturo.size).toBeGreaterThan(0)
    expect(petsFixture.some((pet) => !comFuturo.has(pet.id))).toBe(true)
  })

  it('tem os seis tipos de alerta entre os pacientes', () => {
    const presentes = new Set(
      petsFixture.flatMap((pet) => pet.alertas.map((alerta) => alerta.kind)),
    )

    const esperados: PetAlertKind[] = [
      'alergia',
      'agressivo',
      'cronico',
      'imunossuprimido',
      'gestante',
      'inadimplente',
    ]

    for (const kind of esperados) {
      expect(presentes, `alerta ${kind}`).toContain(kind)
    }
  })

  it('tem as seis espécies entre os pacientes', () => {
    const presentes = new Set(petsFixture.map((pet) => pet.especie))
    const esperadas: PetSpecies[] = ['canina', 'felina', 'ave', 'roedor', 'reptil', 'equina']

    for (const especie of esperadas) {
      expect(presentes, `espécie ${especie}`).toContain(especie)
    }
  })

  it('tem os três tipos de diagnóstico e mais de um diagnóstico em algum prontuário', () => {
    const dataset = gerarDataset()
    const presentes = new Set(
      dataset.encounters.flatMap((item) => item.diagnosticos.map((d) => d.kind)),
    )
    const esperados: DiagnosisKind[] = ['presuntivo', 'definitivo', 'diferencial']

    for (const kind of esperados) {
      expect(presentes, `diagnóstico ${kind}`).toContain(kind)
    }

    expect(dataset.encounters.some((item) => item.diagnosticos.length > 1)).toBe(true)
  })

  it('tem linha do tempo com consulta, vacina, exame, cirurgia e falta', () => {
    const dataset = gerarDataset()
    const presentes = new Set(dataset.timeline.map((evento) => evento.kind))
    const esperados: TimelineEventKind[] = ['consulta', 'vacina', 'exame', 'cirurgia', 'falta']

    for (const kind of esperados) {
      expect(presentes, `evento ${kind}`).toContain(kind)
    }
  })

  it('tem as seis origens de agendamento e mais de um motivo de cancelamento', () => {
    const dataset = gerarDataset()
    const origens = new Set(dataset.appointments.map((item) => item.origem))

    for (const origem of ['recepcao', 'app', 'telefone', 'encaixe', 'retorno', 'fila'] as const) {
      expect(origens, `origem ${origem}`).toContain(origem)
    }

    const motivos = new Set(
      dataset.appointments
        .filter((item) => item.status === 'cancelado' && item.motivoCancelamento)
        .map((item) => item.motivoCancelamento),
    )

    expect(motivos.size).toBeGreaterThanOrEqual(2)
  })

  it('tem prontuário em rascunho para a caixa de pendências', () => {
    const dataset = gerarDataset()

    expect(dataset.encounters.some((item) => item.status === 'rascunho')).toBe(true)
  })

  it('tem sinais vitais fora da faixa e marcados como não aferidos', () => {
    const dataset = gerarDataset()
    const finalizados = dataset.encounters.filter((item) => item.status === 'finalizado')

    expect(
      finalizados.some((item) =>
        Object.values(item.exameFisico.vitais).some((vital) => vital.naoAferido),
      ),
    ).toBe(true)

    /** Temperatura acima da faixa canina: o realce de "fora da faixa" precisa de um exemplo. */
    expect(
      finalizados.some((item) => (item.exameFisico.vitais.temperatura.valor ?? 0) > 39.5),
    ).toBe(true)
  })

  it('tem sistema alterado com nota escrita', () => {
    const dataset = gerarDataset()

    expect(
      dataset.encounters.some((item) =>
        Object.values(item.exameFisico.sistemas).some(
          (sistema) => sistema.status === 'alterado' && sistema.nota.length > 0,
        ),
      ),
    ).toBe(true)
  })
})
