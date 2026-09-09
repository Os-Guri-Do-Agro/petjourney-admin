/**
 * O dataset de internação, conferido nos pontos em que ele pode evaporar sem avisar.
 *
 * A promessa do requisito é que **um plantão inteiro possa ser encenado** — e o protótipo é
 * demonstrado tanto às 9 da manhã quanto às 11 da noite. Um dataset ancorado no dia âncora
 * passaria no teste rodado à tarde e mostraria um plantão vazio na apresentação da manhã. Por
 * isso quase todo teste aqui roda o dataset em quatro horários do dia.
 */

import { afterEach, describe, expect, it } from 'vitest'

import { setClockSkew } from '../../domain/clinic-time'
import {
  atravessaAPassagem,
  limitesDoPlantao,
  plantaoDe,
  situacaoDaAdministracao,
} from '../../domain/internacao'
import { createClinicClock } from '../../domain/clinic-time'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { leitosFixture } from '../fixtures/internacao'
import { gerarDataset } from '../seed'
import { resetDataset } from '../store'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

/**
 * Empurra o relógio da clínica para uma hora cheia de hoje e devolve um dataset novo.
 *
 * O deslocamento é calculado sobre a hora corrente da parede da clínica, e não sobre a do
 * processo: rodando a suíte em outro fuso, um `setClockSkew` absoluto cairia num horário
 * diferente e o teste passaria a depender de onde a máquina está.
 */
function datasetAs(hora: number) {
  setClockSkew(0)

  const agora = clock.now()

  setClockSkew((hora * 60 - agora.minutes) * 60_000)

  return gerarDataset()
}

const HORAS_DE_DEMONSTRACAO = [9, 15, 21, 3]

afterEach(() => {
  setClockSkew(0)
  resetDataset()
})

describe('dataset de internação', () => {
  it('ocupa cinco dos oito leitos e deixa a UTI tomada', () => {
    const { internacao } = gerarDataset()

    expect(internacao.leitos).toHaveLength(leitosFixture.length)
    expect(internacao.internacoes).toHaveLength(5)
    expect(internacao.internacoes.every((item) => item.status === 'internado')).toBe(true)

    const uti = internacao.internacoes.find((item) => item.leitoId === 'leito-uti')

    expect(uti?.id).toBe('int-tofu')
  })

  it('nenhum leito recebe dois pacientes', () => {
    const { internacao } = gerarDataset()
    const ocupados = internacao.internacoes
      .filter((item) => item.status === 'internado')
      .map((item) => item.leitoId)

    expect(new Set(ocupados).size).toBe(ocupados.length)
  })

  it('não interna ninguém em leito fora de operação', () => {
    const { internacao } = gerarDataset()
    const inativos = new Set(
      internacao.leitos.filter((leito) => !leito.ativo).map((leito) => leito.id),
    )

    expect(internacao.internacoes.some((item) => inativos.has(item.leitoId))).toBe(false)
  })

  it('toda administração aponta para uma prescrição que existe', () => {
    const { internacao } = gerarDataset()
    const ids = new Set(internacao.prescricoes.map((item) => item.id))

    expect(internacao.administracoes.every((item) => ids.has(item.prescricaoId))).toBe(true)
    expect(internacao.administracoes.length).toBeGreaterThan(60)
  })

  it('toda administração executada registra quem executou', () => {
    const { internacao } = gerarDataset()
    const feitas = internacao.administracoes.filter((item) => item.status === 'feita')

    expect(feitas.length).toBeGreaterThan(10)
    expect(feitas.every((item) => item.executadaPor && item.executadaEm && item.plantaoId)).toBe(
      true,
    )
  })

  it('não deixa nada por fazer no passado sem ser uma pendência declarada', () => {
    const { internacao } = gerarDataset()
    const agora = clock.nowIso()
    const futurasResolvidas = internacao.administracoes.filter(
      (item) => item.status === 'feita' && item.previstaPara > agora,
    )

    expect(futurasResolvidas).toHaveLength(0)
  })
})

describe('o plantão corrente, a qualquer hora do dia', () => {
  it.each(HORAS_DE_DEMONSTRACAO)('às %i h existe um plantão aberto', (hora) => {
    const { internacao } = datasetAs(hora)
    const atual = internacao.plantoes.find((item) => item.id === internacao.plantaoAtualId)

    expect(atual).toBeDefined()
    expect(atual?.entregueEm).toBeNull()
    expect(atual?.kind).toBe(plantaoDe(clock.nowIso(), clock).kind)
  })

  it.each(HORAS_DE_DEMONSTRACAO)('às %i h os dois turnos anteriores estão entregues', (hora) => {
    const { internacao } = datasetAs(hora)
    const fechados = internacao.plantoes.filter((item) => item.id !== internacao.plantaoAtualId)

    expect(fechados).toHaveLength(2)
    expect(fechados.every((item) => item.entregueEm && item.recebidoPor)).toBe(true)
    expect(fechados.every((item) => item.notaDePassagem.length > 0)).toBe(true)
  })

  it.each(HORAS_DE_DEMONSTRACAO)('às %i h o checklist do turno tem o que fazer', (hora) => {
    const { internacao } = datasetAs(hora)
    const agora = clock.nowIso()
    const cobram = internacao.administracoes.filter((item) => {
      const situacao = situacaoDaAdministracao(item, agora)

      return situacao === 'na-janela' || situacao === 'atrasada'
    })

    expect(cobram.length).toBeGreaterThan(0)
  })
})

/**
 * Os casos difíceis. Um caso que **deixa de ser difícil** não avisa — foi o que já aconteceu com
 * o encaixe de emergência da agenda, e é o que estes testes existem para impedir aqui.
 */
describe('casos difíceis da internação', () => {
  it.each(HORAS_DE_DEMONSTRACAO)('às %i h há uma dose em cima da troca de plantão', (hora) => {
    const { internacao } = datasetAs(hora)
    const atual = internacao.plantoes.find((item) => item.id === internacao.plantaoAtualId)!
    const naTroca = internacao.administracoes.find((item) => item.id === 'adm-troca-de-plantao')

    expect(naTroca).toBeDefined()
    expect(naTroca!.status).toBe('pendente')
    expect(atravessaAPassagem(naTroca!, atual.fim)).toBe(true)
  })

  it.each(HORAS_DE_DEMONSTRACAO)('às %i h há uma dose atrasada no plantão corrente', (hora) => {
    const { internacao } = datasetAs(hora)
    const atrasada = internacao.administracoes.find((item) => item.id === 'adm-atrasada')

    expect(atrasada).toBeDefined()
    expect(situacaoDaAdministracao(atrasada!, clock.nowIso())).toBe('atrasada')
  })

  it.each(HORAS_DE_DEMONSTRACAO)('às %i h o boletim da piora está retido', (hora) => {
    const { internacao } = datasetAs(hora)
    const tofu = internacao.internacoes.find((item) => item.id === 'int-tofu')
    const retido = internacao.boletins.find((item) => item.id === 'bol-piora-tofu')

    expect(tofu?.gravidade).toBe('critico')
    expect(retido?.status).toBe('retido')
    expect(retido?.exigeLigacao).toBe(true)
    expect(retido?.ligacaoEm).toBeNull()
    expect(retido?.enviadoEm).toBeNull()
  })

  it('o responsável de hora em hora existe e tem histórico à altura', () => {
    const { internacao } = datasetAs(15)
    const preferencia = internacao.preferencias.find((item) => item.internacaoId === 'int-cacau')

    expect(preferencia?.frequenciaHoras).toBe(1)

    const enviados = internacao.boletins.filter(
      (item) => item.internacaoId === 'int-cacau' && item.status === 'enviado',
    )

    /* Dezesseis horas de internação, menos a madrugada em silêncio: a coluna precisa ter peso. */
    expect(enviados.length).toBeGreaterThan(5)
  })

  it('o silêncio noturno não deixa boletim nascer de madrugada', () => {
    const { internacao } = datasetAs(15)
    const comSilencio = new Set(
      internacao.preferencias
        .filter((item) => item.silencioNoturno)
        .map((item) => item.internacaoId),
    )

    const naMadrugada = internacao.boletins.filter((item) => {
      if (!comSilencio.has(item.internacaoId) || item.status !== 'enviado') {
        return false
      }

      const minutos = clock.minutesOf(item.geradoEm)

      return minutos >= 22 * 60 || minutos < 7 * 60
    })

    expect(naMadrugada).toHaveLength(0)
  })

  /**
   * Boletim sem texto é boletim que não existe.
   *
   * O dataset já nasceu assim uma vez: os boletins plantados vinham com `texto: ''`, e a prévia do
   * celular — que é a peça de venda do requisito — desenhava balões vazios com o horário dentro.
   * Passou por tipos, build e testes, porque string vazia é uma string válida.
   */
  it('todo boletim plantado tem texto de verdade', () => {
    const { internacao } = datasetAs(15)

    expect(internacao.boletins.length).toBeGreaterThan(10)

    const mudos = internacao.boletins.filter((item) => item.texto.trim().length < 20)

    expect(mudos).toEqual([])
  })

  it('o boletim da piora fala do paciente pelo nome e anuncia a ligação', () => {
    const { internacao } = datasetAs(15)
    const retido = internacao.boletins.find((item) => item.id === 'bol-piora-tofu')!

    expect(retido.texto).toContain('Tofu')
    expect(retido.texto.toLowerCase()).toContain('telefone')
    /* A contagem de medicação não entra num boletim de piora: "0 de 2" lê como negligência. */
    expect(retido.texto).not.toContain('realizados no horário')
  })

  it('a recusa é registrada como recusa, e não como dose pulada', () => {
    const { internacao } = datasetAs(15)
    const recusada = internacao.administracoes.find((item) => item.status === 'recusada')

    expect(recusada).toBeDefined()
    expect(recusada!.observacao.length).toBeGreaterThan(0)
  })
})

describe('evoluções e passagem', () => {
  it('cada turno fechado deixou evolução dos pacientes que já estavam internados', () => {
    const { internacao } = datasetAs(15)

    for (const plantao of internacao.plantoes.filter((item) => item.entregueEm)) {
      const daPassagem = internacao.evolucoes.filter((item) => item.plantaoId === plantao.id)
      const internadosNoTurno = internacao.internacoes.filter(
        (item) => item.entradaEm < plantao.fim,
      )

      expect(daPassagem.length).toBe(internadosNoTurno.length)
    }
  })

  it('a evolução cai dentro do turno em que foi registrada', () => {
    const { internacao } = datasetAs(15)

    for (const evolucao of internacao.evolucoes) {
      const plantao = internacao.plantoes.find((item) => item.id === evolucao.plantaoId)!
      const limites = limitesDoPlantao(plantao.kind, clock.dateOf(plantao.inicio), clock)

      expect(evolucao.registradoEm >= limites.inicio).toBe(true)
      expect(evolucao.registradoEm < limites.fim).toBe(true)
    }
  })

  it('a internação em curso aparece na linha do tempo do paciente', () => {
    const dataset = datasetAs(15)
    const eventos = dataset.timeline.filter(
      (item) => item.kind === 'internacao' && item.petId === 'pet-bento',
    )

    expect(eventos.length).toBeGreaterThanOrEqual(2)
  })
})
