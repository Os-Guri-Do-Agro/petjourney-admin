/**
 * Justificativa de falta: o contrato do repositório e o que o dataset entrega.
 *
 * O modo de falhar daqui é silencioso e comercial. Uma falta sem motivo não quebra tela
 * nenhuma — ela só faz a clínica ligar para quem já foi procurado, deixar de ligar para quem
 * não foi, e chegar ao fim do mês com "vinte faltas" e nenhuma ideia do que fazer a respeito.
 *
 * As três regras que estes testes prendem:
 *
 * **Nulo é um estado, não um dado faltando.** A falta é marcada quando o horário passa; o motivo
 * aparece quando alguém liga. O repositório precisa aceitar as duas ordens.
 *
 * **Justificar não desfaz a falta.** O horário continua tendo sido queimado, e a conta da
 * clínica continua contando. Confundir as duas coisas apagaria a métrica.
 *
 * **Uma mutação, um desfazer.** Marcar falta com motivo é uma ação só na faixa de 8 s: se
 * fossem duas, o Z da recepção desfaria metade e deixaria uma falta sem motivo para trás.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { createClinicClock } from '../../domain/clinic-time'
import { aceitaReagendamento, motivoEncerraOCaso } from '../../domain/faltas'
import { resumirFaltas } from '../../domain/load'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { setMockConfig } from '../mock-runtime'
import { agendaRepository, LIMITE_REINCIDENCIA, patientRepository } from '../repositories'
import type { JustificativaDeFalta } from '../types'
import { getDataset, resetDataset } from '../store'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

const ENTRADA = {
  motivo: 'transporte' as const,
  canal: 'whatsapp' as const,
  observacao: '  Sem carro no dia.  ',
  professionalId: 'prof-ana',
}

function acharApt(id: string) {
  return getDataset().appointments.find((item) => item.id === id)
}

/** Um atendimento futuro qualquer, para virar falta durante o teste. */
function algumAgendado() {
  const alvo = getDataset().appointments.find((item) => item.status === 'agendado')

  expect(alvo, 'o dataset precisa ter um atendimento agendado').toBeDefined()

  return alvo!
}

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

describe('marcar falta com motivo', () => {
  it('grava status e justificativa na mesma chamada', async () => {
    const alvo = algumAgendado()

    await agendaRepository.alterarStatus(alvo.id, 'falta', ENTRADA)

    const depois = acharApt(alvo.id)!

    expect(depois.status).toBe('falta')
    expect(depois.justificativaDeFalta?.motivo).toBe('transporte')
    expect(depois.justificativaDeFalta?.canal).toBe('whatsapp')
  })

  it('uma mutação só, para o desfazer não deixar a falta sem motivo pela metade', async () => {
    const alvo = algumAgendado()
    /*
     * Copiado por valor: `alvo` aponta para dentro do dataset e a mutação o altera no lugar.
     * Comparar com ele depois seria comparar o resultado consigo mesmo.
     */
    const statusOriginal = alvo.status

    const { undoToken } = await agendaRepository.alterarStatus(alvo.id, 'falta', ENTRADA)

    await agendaRepository.desfazer(undoToken)

    const depois = acharApt(alvo.id)!

    expect(depois.status).toBe(statusOriginal)
    expect(depois.justificativaDeFalta).toBeNull()
  })

  it('sem justificativa, a falta nasce pendente', async () => {
    /* É o caminho comum: o horário passa de manhã e a ligação sai à tarde. */
    const alvo = algumAgendado()

    await agendaRepository.alterarStatus(alvo.id, 'falta')

    expect(acharApt(alvo.id)!.justificativaDeFalta).toBeNull()
  })

  it('não gruda justificativa em status que não é falta', async () => {
    const alvo = algumAgendado()

    await agendaRepository.alterarStatus(alvo.id, 'confirmado', ENTRADA)

    expect(acharApt(alvo.id)!.justificativaDeFalta).toBeNull()
  })
})

describe('justificar depois', () => {
  async function faltaPendente() {
    const alvo = algumAgendado()

    await agendaRepository.alterarStatus(alvo.id, 'falta')

    return alvo
  }

  it('registra o motivo sem mexer no status', async () => {
    /* Justificar não perdoa a falta: o horário continua tendo sido queimado. */
    const alvo = await faltaPendente()

    await agendaRepository.justificarFalta(alvo.id, ENTRADA)

    const depois = acharApt(alvo.id)!

    expect(depois.status).toBe('falta')
    expect(depois.justificativaDeFalta?.motivo).toBe('transporte')
  })

  it('carimba quem registrou e quando', async () => {
    /* É o que transforma a justificativa em prova de que a clínica procurou o responsável. */
    const alvo = await faltaPendente()

    await agendaRepository.justificarFalta(alvo.id, ENTRADA)

    const registro = acharApt(alvo.id)!.justificativaDeFalta!

    expect(registro.professionalId).toBe('prof-ana')
    expect(registro.registradaEm).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  it('apara a observação', async () => {
    const alvo = await faltaPendente()

    await agendaRepository.justificarFalta(alvo.id, ENTRADA)

    expect(acharApt(alvo.id)!.justificativaDeFalta!.observacao).toBe('Sem carro no dia.')
  })

  it('registrar de novo sobrescreve — a segunda ligação sabe mais que a primeira', async () => {
    const alvo = await faltaPendente()

    await agendaRepository.justificarFalta(alvo.id, ENTRADA)
    await agendaRepository.justificarFalta(alvo.id, {
      ...ENTRADA,
      motivo: 'custo',
      canal: 'telefone',
      observacao: '',
    })

    const registro = acharApt(alvo.id)!.justificativaDeFalta!

    expect(registro.motivo).toBe('custo')
    expect(registro.canal).toBe('telefone')
  })

  it('recusa justificar atendimento que não está em falta', async () => {
    /*
     * A guarda existe contra a tela que erra o id: gravar motivo de falta num atendimento
     * finalizado não quebraria nada visível, e apareceria semanas depois como um relatório que
     * não bate com a agenda.
     */
    const alvo = algumAgendado()

    await expect(agendaRepository.justificarFalta(alvo.id, ENTRADA)).rejects.toThrow(
      'não está em falta',
    )
  })

  it('recusa atendimento inexistente', async () => {
    await expect(agendaRepository.justificarFalta('apt-fantasma', ENTRADA)).rejects.toThrow(
      'inexistente',
    )
  })
})

describe('a fila de pendências do painel', () => {
  it('conta as faltas sem motivo por responsável', () => {
    const resumo = resumirFaltas(getDataset().appointments, clock, LIMITE_REINCIDENCIA)

    for (const linha of resumo) {
      const faltas = getDataset().appointments.filter(
        (item) =>
          item.status === 'falta' && item.tutorId === linha.tutorId && item.petId === linha.petId,
      )
      const pendentes = faltas.filter((item) => !item.justificativaDeFalta).length

      expect(linha.semJustificativa, `${linha.tutorId}/${linha.petId}`).toBe(pendentes)
      expect(linha.semJustificativa).toBeLessThanOrEqual(linha.faltas)
    }
  })

  it('justificar tira a falta da fila', async () => {
    const antes = resumirFaltas(getDataset().appointments, clock, LIMITE_REINCIDENCIA)
    const comPendencia = antes.find((linha) => linha.semJustificativa > 0)

    expect(comPendencia, 'o dataset precisa abrir com pendência').toBeDefined()

    /*
     * Por responsável **e** paciente: o resumo é por par, e um tutor com dois bichos tem duas
     * linhas. Filtrar só pelo tutor justificaria a falta do outro pet e deixaria esta linha
     * intacta — que foi exatamente o que aconteceu na primeira versão deste teste.
     */
    const pendente = getDataset().appointments.find(
      (item) =>
        item.status === 'falta' &&
        item.tutorId === comPendencia!.tutorId &&
        item.petId === comPendencia!.petId &&
        !item.justificativaDeFalta,
    )!

    await agendaRepository.justificarFalta(pendente.id, ENTRADA)

    const depois = resumirFaltas(getDataset().appointments, clock, LIMITE_REINCIDENCIA).find(
      (linha) => linha.tutorId === comPendencia!.tutorId && linha.petId === comPendencia!.petId,
    )!

    expect(depois.semJustificativa).toBe(comPendencia!.semJustificativa - 1)
    /* A falta continua contando: justificar não perdoa o horário queimado. */
    expect(depois.faltas).toBe(comPendencia!.faltas)
    expect(depois.minutosPerdidos).toBe(comPendencia!.minutosPerdidos)
  })
})

describe('óbito encerra o caso', () => {
  it('só o óbito encerra — nenhum outro motivo tira a remarcação da mesa', () => {
    /*
     * A lista inteira é percorrida de propósito. O dia em que alguém acrescentar um motivo novo,
     * este teste obriga a decidir conscientemente de que lado ele fica, em vez de deixar o
     * padrão decidir sozinho.
     */
    const todos: Array<JustificativaDeFalta['motivo']> = [
      'esqueceu',
      'imprevisto',
      'transporte',
      'paciente-melhorou',
      'emergencia',
      'custo',
      'insatisfacao',
      'obito',
      'outro',
    ]

    for (const motivo of todos) {
      expect(motivoEncerraOCaso(motivo), motivo).toBe(motivo === 'obito')
    }
  })

  it('a falta sem motivo ainda aceita remarcação', () => {
    /* Ninguém sabe o que houve: remarcar é exatamente o que se oferece ao ligar. */
    const pendente = getDataset().appointments.find(
      (item) => item.status === 'falta' && !item.justificativaDeFalta,
    )!

    expect(aceitaReagendamento(pendente)).toBe(true)
  })

  it('a falta com óbito não aceita', async () => {
    const alvo = algumAgendado()

    await agendaRepository.alterarStatus(alvo.id, 'falta', { ...ENTRADA, motivo: 'obito' })

    expect(aceitaReagendamento(acharApt(alvo.id)!)).toBe(false)
  })

  it('a falta continua contando, mesmo encerrada', async () => {
    /*
     * Registrar o óbito não apaga o horário queimado. A clínica para de **cobrar**, não de
     * contar: a hora perdida naquele dia aconteceu, e some da conta se alguém confundir as duas
     * coisas por compaixão mal colocada.
     */
    const alvo = algumAgendado()
    const antes = resumirFaltas(getDataset().appointments, clock, LIMITE_REINCIDENCIA).find(
      (linha) => linha.petId === alvo.petId && linha.tutorId === alvo.tutorId,
    )

    await agendaRepository.alterarStatus(alvo.id, 'falta', { ...ENTRADA, motivo: 'obito' })

    const depois = resumirFaltas(getDataset().appointments, clock, LIMITE_REINCIDENCIA).find(
      (linha) => linha.petId === alvo.petId && linha.tutorId === alvo.tutorId,
    )!

    expect(depois.faltas).toBe((antes?.faltas ?? 0) + 1)
    expect(depois.minutosPerdidos).toBeGreaterThan(antes?.minutosPerdidos ?? 0)
    /* E sai da fila de pendências: ela foi apurada. */
    expect(depois.semJustificativa).toBe(antes?.semJustificativa ?? 0)
  })

  it('o dataset traz o caso encerrado', () => {
    /* Sem ele, o estado "caso encerrado" da tela é código que ninguém vê rodar. */
    const obito = getDataset().appointments.find((item) => item.id === 'apt-falta-obito')

    expect(obito, 'a falta com óbito precisa estar plantada').toBeDefined()
    expect(obito!.status).toBe('falta')
    expect(obito!.justificativaDeFalta?.motivo).toBe('obito')
    expect(aceitaReagendamento(obito!)).toBe(false)
  })

  it('o paciente que morreu não tem nada na agenda depois do dia do óbito', () => {
    /*
     * O corte é na data do óbito, e não em hoje — e a diferença apareceu na tela. Cortando só o
     * futuro, sobrou uma consulta quatro dias **depois** da morte: passada, portanto sobrevivente
     * ao filtro, e o painel exibia "reagendado para 18/09" embaixo de um óbito de 14/09.
     */
    const dataset = getDataset()
    const obito = dataset.appointments.find((item) => item.id === 'apt-falta-obito')!
    const diaDoObito = clock.dateOf(obito.inicio)

    const depois = dataset.appointments.filter(
      (item) =>
        item.id !== obito.id &&
        item.petId === obito.petId &&
        clock.dateOf(item.inicio) > diaDoObito,
    )

    expect(depois.map((item) => item.id)).toEqual([])
  })

  it('a falta com óbito não aparece como reagendada', async () => {
    /* É a consequência visível do teste acima: a linha do painel não pode convidar a remarcar. */
    const obito = getDataset().appointments.find((item) => item.id === 'apt-falta-obito')!
    const detalhe = await patientRepository.faltasDoResponsavel(obito.tutorId)
    const linha = detalhe.find((item) => item.appointment.id === obito.id)!

    expect(linha.reagendadoPara).toBeNull()
  })
})

describe('o dataset abre com os dois estados', () => {
  it('tem falta já justificada e falta pendente', async () => {
    /*
     * Sem as duas, a tela não demonstra o que foi pedido: só justificadas esconde a fila de
     * trabalho, só pendentes esconde o que a justificativa mostra.
     */
    const faltas = getDataset().appointments.filter((item) => item.status === 'falta')

    expect(
      faltas.some((item) => item.justificativaDeFalta),
      'alguma justificada',
    ).toBe(true)
    expect(
      faltas.some((item) => !item.justificativaDeFalta),
      'alguma pendente',
    ).toBe(true)
  })

  it('o responsável reincidente abre com histórico misto', async () => {
    /*
     * As quatro faltas plantadas do mesmo responsável são o caso que o painel existe para
     * discutir, e o que as torna discutíveis é a mistura: duas apuradas contando a mesma
     * história — transporte —, duas ainda esperando ligação.
     *
     * A asserção olha só as quatro plantadas, e não tudo o que o responsável tem: ele também
     * pega faltas sorteadas, com motivos próprios, e cobrar "todas por transporte" ali seria
     * prender o teste a um sorteio.
     */
    const reincidentes = [1, 2, 3, 4].map(
      (numero) =>
        getDataset().appointments.find((item) => item.id === `apt-falta-reincidente-${numero}`)!,
    )

    const justificadas = reincidentes.filter((item) => item.justificativaDeFalta)

    expect(justificadas).toHaveLength(2)
    expect(justificadas.every((item) => item.justificativaDeFalta?.motivo === 'transporte')).toBe(
      true,
    )

    /* As apuradas são as mais antigas: é assim que a fila anda, do fundo para a frente. */
    expect(reincidentes[0]!.justificativaDeFalta).toBeNull()
    expect(reincidentes[1]!.justificativaDeFalta).toBeNull()
  })

  it('toda justificativa plantada tem motivo e canal de verdade', () => {
    /*
     * Prende um defeito que só aparecia na tela, e de canto: o índice do canal vinha de um
     * deslocamento **com sinal** sobre um hash sem sinal, e para hash acima de 2³¹ dava índice
     * negativo. O canal saía `undefined`, a tela escrevia "Foi para emergência ·" com o ponto
     * solto no fim, e nada disso quebrava — nem o tipo, que o `!` já tinha silenciado.
     */
    const motivosValidos = new Set([
      'esqueceu',
      'imprevisto',
      'transporte',
      'paciente-melhorou',
      'emergencia',
      'custo',
      'insatisfacao',
      'obito',
      'outro',
    ])
    const canaisValidos = new Set(['telefone', 'whatsapp', 'presencial', 'sem-resposta'])

    const justificadas = getDataset()
      .appointments.filter((item) => item.status === 'falta' && item.justificativaDeFalta)
      .map((item) => item.justificativaDeFalta!)

    expect(justificadas.length).toBeGreaterThan(0)

    for (const registro of justificadas) {
      expect(motivosValidos.has(registro.motivo), `motivo ${registro.motivo}`).toBe(true)
      expect(canaisValidos.has(registro.canal), `canal ${registro.canal}`).toBe(true)
      expect(registro.professionalId).not.toBe('')
      expect(registro.registradaEm).toMatch(/^\d{4}-\d{2}-\d{2}T/)
    }
  })

  it('a justificativa plantada é estável entre gerações do dataset', async () => {
    /*
     * Ela sai de um hash do id, e não do sorteio de status: puxar um número a mais do
     * `rngStatus` deslocaria a sequência e o dia âncora deixaria de ter sempre os mesmos
     * quarenta atendimentos.
     */
    const antes = getDataset().appointments.map(
      (item) => `${item.id}|${item.justificativaDeFalta?.motivo ?? ''}`,
    )

    resetDataset()

    const depois = getDataset().appointments.map(
      (item) => `${item.id}|${item.justificativaDeFalta?.motivo ?? ''}`,
    )

    expect(depois).toEqual(antes)
  })
})
