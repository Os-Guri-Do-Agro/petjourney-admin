/**
 * Adesão ao tratamento, de ponta a ponta no dado: prescrever, lembrar, confirmar e ver no retorno.
 *
 * É o critério de pronto do requisito — a história inteira numa demonstração — conferido onde
 * ela pode quebrar: a dose que alguém da casa marca no celular precisa aparecer na ficha da
 * clínica, com quem deu; a segunda pessoa não pode dar de novo; e o alerta precisa tocar no
 * tratamento crítico que perdeu o ritmo, e só nele.
 *
 * O relógio fica parado às 15h de hoje. O cenário depende da hora — a dose da vez é a que acabou
 * de chegar —, e um teste que passa de manhã e falha à noite não diz nada.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { TEXTO_PT_DO_AVISO_DE_DOSE } from '../../contrato/responsavel'
import { horarioDestoante } from '../../domain/adesao'
import { addDays, createClinicClock, setClockSkew } from '../../domain/clinic-time'
import { montarResumoDoPaciente } from '../../domain/resumo-do-paciente'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { setMockConfig } from '../mock-runtime'
import { projetarAtendimento, projetarAvisosDeDose } from '../projecao-do-responsavel'
import { DoseRecusadaError, patientRepository, tratamentoRepository } from '../repositories'
import {
  FAMILIAR_DA_DEMONSTRACAO,
  PET_CARDIOPATA,
  TRATAMENTO_CRITICO,
  TRATAMENTO_DA_DEMONSTRACAO,
  TRATAMENTO_VARIAS_VEZES_AO_DIA,
} from '../seed-adesao'
import { agoraIso, getDataset, resetDataset } from '../store'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

beforeEach(() => {
  setClockSkew(0)
  setClockSkew((15 * 60 - clock.now().minutes) * 60_000)
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

afterEach(() => {
  setClockSkew(0)
})

async function daFicha(petId: string, tratamentoId: string) {
  const adesao = await tratamentoRepository.doPaciente(petId)
  const lido = adesao.tratamentos.find((item) => item.tratamento.id === tratamentoId)

  expect(lido).toBeDefined()

  return { adesao, lido: lido! }
}

/** A dose que o celular oferece agora — a que dá para marcar. */
async function doseDaVez(petId: string, cuidadorId: string, tratamentoId: string) {
  const noApp = await tratamentoRepository.noApp(petId, cuidadorId)
  const tratamento = noApp.contrato.tratamentos.find((item) => item.id === tratamentoId)!

  return tratamento.doses.find((dose) => dose.situacao === 'ABERTA')!
}

describe('o retorno da Pérola: o vet vê o que a casa registrou', () => {
  it('desde a consulta de 42 dias atrás: 39 dadas, 1 pulada porque acabou, 1 sem registro', async () => {
    const { adesao, lido } = await daFicha('pet-perola', TRATAMENTO_DA_DEMONSTRACAO)

    expect(adesao.ultimaConsultaEm).not.toBeNull()
    expect(lido.periodo.desde).toBe(adesao.ultimaConsultaEm)
    expect(lido.periodo).toMatchObject({ dadas: 39, puladas: 1, semRegistro: 1, abertas: 1 })
    expect(lido.periodo.motivos).toEqual([{ motivo: 'acabou', vezes: 1 }])
  })

  it('duas pessoas cuidando: os registros dizem quem deu', async () => {
    const { lido } = await daFicha('pet-perola', TRATAMENTO_DA_DEMONSTRACAO)
    const quem = lido.periodo.porCuidador.map((item) => item.cuidadorId)

    expect(quem).toEqual(expect.arrayContaining(['tutor-fatima', FAMILIAR_DA_DEMONSTRACAO]))
  })

  it('os domingos sem registro do começo ficam no total, e nenhum vira alerta — nem com crítico', async () => {
    await tratamentoRepository.marcarCritico(TRATAMENTO_DA_DEMONSTRACAO, true)

    const { lido } = await daFicha('pet-perola', TRATAMENTO_DA_DEMONSTRACAO)

    expect(lido.total.semRegistro).toBeGreaterThan(lido.periodo.semRegistro)
    expect(lido.alerta).toBeNull()
  })

  it('o omeprazol terminou: está na ficha como encerrado, sem dose da vez', async () => {
    const { lido } = await daFicha('pet-perola', 'trat-perola-omeprazol')

    expect(lido.emCurso).toBe(false)
    expect(lido.total).toMatchObject({ dadas: 13, puladas: 1, abertas: 0 })
  })
})

describe('confirmar no celular muda a ficha, com quem deu', () => {
  it('o Rafael toca "Dei": a ficha ganha a dose, e o celular da Fátima diz que ele deu', async () => {
    const dose = await doseDaVez('pet-perola', FAMILIAR_DA_DEMONSTRACAO, TRATAMENTO_DA_DEMONSTRACAO)

    expect(dose.podeRegistrar).toBe(true)

    await tratamentoRepository.registrarDose({
      tratamentoId: TRATAMENTO_DA_DEMONSTRACAO,
      numero: dose.numero,
      situacao: 'dada',
      motivo: null,
      cuidadorId: FAMILIAR_DA_DEMONSTRACAO,
    })

    const { lido } = await daFicha('pet-perola', TRATAMENTO_DA_DEMONSTRACAO)

    expect(lido.periodo).toMatchObject({ dadas: 40, abertas: 0 })

    const daFatima = await tratamentoRepository.noApp('pet-perola', 'tutor-fatima')
    const naTela = daFatima.contrato.tratamentos
      .find((item) => item.id === TRATAMENTO_DA_DEMONSTRACAO)!
      .doses.find((item) => item.numero === dose.numero)!

    expect(naTela).toMatchObject({
      situacao: 'DADA',
      podeRegistrar: false,
      podeDesfazer: false,
      registradaPor: { id: FAMILIAR_DA_DEMONSTRACAO, eu: false },
    })
  })

  it('a Fátima tenta dar de novo: recusado, com o registro do Rafael — é o que evita a dose dobrada', async () => {
    const dose = await doseDaVez('pet-perola', 'tutor-fatima', TRATAMENTO_DA_DEMONSTRACAO)
    const registrar = (cuidadorId: string) =>
      tratamentoRepository.registrarDose({
        tratamentoId: TRATAMENTO_DA_DEMONSTRACAO,
        numero: dose.numero,
        situacao: 'dada',
        motivo: null,
        cuidadorId,
      })

    await registrar(FAMILIAR_DA_DEMONSTRACAO)

    const recusa = await registrar('tutor-fatima').catch((erro: unknown) => erro)

    expect(recusa).toBeInstanceOf(DoseRecusadaError)
    expect((recusa as DoseRecusadaError).kind).toBe('dose-ja-registrada')
    expect((recusa as DoseRecusadaError).registro?.cuidadorId).toBe(FAMILIAR_DA_DEMONSTRACAO)
  })

  it('só quem tocou desfaz; o outro não apaga o que alguém viu acontecer', async () => {
    const dose = await doseDaVez('pet-perola', 'tutor-fatima', TRATAMENTO_DA_DEMONSTRACAO)

    await tratamentoRepository.registrarDose({
      tratamentoId: TRATAMENTO_DA_DEMONSTRACAO,
      numero: dose.numero,
      situacao: 'dada',
      motivo: null,
      cuidadorId: FAMILIAR_DA_DEMONSTRACAO,
    })

    await expect(
      tratamentoRepository.desfazerDose({
        tratamentoId: TRATAMENTO_DA_DEMONSTRACAO,
        numero: dose.numero,
        cuidadorId: 'tutor-fatima',
      }),
    ).rejects.toBeInstanceOf(DoseRecusadaError)

    await tratamentoRepository.desfazerDose({
      tratamentoId: TRATAMENTO_DA_DEMONSTRACAO,
      numero: dose.numero,
      cuidadorId: FAMILIAR_DA_DEMONSTRACAO,
    })

    const { lido } = await daFicha('pet-perola', TRATAMENTO_DA_DEMONSTRACAO)

    expect(lido.periodo.abertas).toBe(1)
  })

  it('pular pede um motivo, e o motivo chega à clínica e ao contrato', async () => {
    const dose = await doseDaVez('pet-perola', 'tutor-fatima', TRATAMENTO_DA_DEMONSTRACAO)

    await expect(
      tratamentoRepository.registrarDose({
        tratamentoId: TRATAMENTO_DA_DEMONSTRACAO,
        numero: dose.numero,
        situacao: 'pulada',
        motivo: null,
        cuidadorId: 'tutor-fatima',
      }),
    ).rejects.toThrow('pulada sem motivo')

    await tratamentoRepository.registrarDose({
      tratamentoId: TRATAMENTO_DA_DEMONSTRACAO,
      numero: dose.numero,
      situacao: 'pulada',
      motivo: 'cuspiu',
      cuidadorId: 'tutor-fatima',
    })

    const noApp = await tratamentoRepository.noApp('pet-perola', 'tutor-fatima')
    const naTela = noApp.contrato.tratamentos
      .find((item) => item.id === TRATAMENTO_DA_DEMONSTRACAO)!
      .doses.find((item) => item.numero === dose.numero)!

    expect(naTela).toMatchObject({ situacao: 'PULADA', motivo: 'CUSPIU', podeDesfazer: true })
  })

  it('quem só tem leitura vê os remédios e não registra', async () => {
    const noApp = await tratamentoRepository.noApp('pet-perola', 'membro-clara')

    expect(noApp.contrato.eu.acesso).toBe('LEITURA')
    expect(
      noApp.contrato.tratamentos.every((item) => item.doses.every((dose) => !dose.podeRegistrar)),
    ).toBe(true)
    expect(noApp.receitasSemLembrete).toEqual([])

    const dose = await doseDaVez('pet-perola', 'membro-clara', TRATAMENTO_DA_DEMONSTRACAO)

    await expect(
      tratamentoRepository.registrarDose({
        tratamentoId: TRATAMENTO_DA_DEMONSTRACAO,
        numero: dose.numero,
        situacao: 'dada',
        motivo: null,
        cuidadorId: 'membro-clara',
      }),
    ).rejects.toMatchObject({ kind: 'somente-leitura' })
  })
})

describe('o alerta da clínica: a Duna ficou sem furosemida', () => {
  it('duas doses puladas porque acabou: o tratamento crítico entra em alerta', async () => {
    const { lido } = await daFicha(PET_CARDIOPATA, TRATAMENTO_CRITICO)

    expect(lido.tratamento.critico).toBe(true)
    expect(lido.alerta).toMatchObject({
      motivo: 'puladas',
      janela: { puladas: 2, semRegistro: 1 },
      motivos: [{ motivo: 'acabou', vezes: 2 }],
      antes: { dadas: 14, fechadas: 14 },
    })
    /* "Desde" é a primeira pulada — ontem às 8h —, não a noite sem registro antes dela. */
    expect(lido.alerta?.desde).toBe(clock.toIso(addDays(clock.today(), -1), 8 * 60))
  })

  it('a conta do retorno começa na consulta de 60 dias atrás, e a receita dela é a crítica', async () => {
    const { adesao, lido } = await daFicha(PET_CARDIOPATA, TRATAMENTO_CRITICO)

    expect(clock.dateOf(adesao.ultimaConsultaEm!)).toBe(addDays(clock.today(), -60))
    expect(lido.tratamento.encounterId).not.toBeNull()
    expect(lido.periodo.dadas).toBeGreaterThan(100)
    expect(adesao.cuidadores.map((item) => item.id)).toEqual(['tutor-eduardo', 'membro-lucia'])
  })

  it('o celular só oferece a receita nova: as de consultas antigas ficam no resumo delas', async () => {
    const dataset = getDataset()
    const umDia = 24 * 3_600_000
    const agora = Date.parse(agoraIso())
    const comReceitaAntiga = dataset.pets.find((pet) =>
      dataset.encounters.some(
        (encounter) =>
          encounter.petId === pet.id &&
          encounter.resumoLiberadoEm &&
          agora - Date.parse(encounter.resumoLiberadoEm) > umDia &&
          encounter.conduta.prescricoes.length > 0 &&
          !dataset.tratamentos.some((item) => item.encounterId === encounter.id),
      ),
    )!
    const noApp = await tratamentoRepository.noApp(comReceitaAntiga.id, comReceitaAntiga.tutorId)

    expect(
      noApp.receitasSemLembrete.every((receita) => agora - Date.parse(receita.liberadaEm) <= umDia),
    ).toBe(true)
  })

  it('a lista da clínica e o selo contam o mesmo alerta — só o da Duna', async () => {
    const linhas = await tratamentoRepository.daClinica()
    const comAlerta = linhas.filter((linha) => linha.alerta !== null)

    expect(comAlerta.map((linha) => linha.tratamento.id)).toEqual([TRATAMENTO_CRITICO])
    expect(tratamentoRepository.contagem(PET_CARDIOPATA)).toEqual({ total: 1, alertas: 1 })
  })

  it('a ligação registrada apaga o alerta', async () => {
    await tratamentoRepository.registrarContato({
      tratamentoId: TRATAMENTO_CRITICO,
      professionalId: 'prof-helena',
      nota: 'Caixa acabou; receita nova enviada.',
    })

    const { lido } = await daFicha(PET_CARDIOPATA, TRATAMENTO_CRITICO)

    expect(lido.alerta).toBeNull()
    expect(lido.tratamento.contato).toMatchObject({ professionalId: 'prof-helena' })
  })

  it('no "Este pet em 30 segundos" da Duna, vira sinal de risco — no grupo que vem primeiro', async () => {
    const { pet } = (await patientRepository.obter(PET_CARDIOPATA))!
    const fonte = await patientRepository.paraOResumo(PET_CARDIOPATA)
    const resumo = montarResumoDoPaciente({ pet, ...fonte })
    const indice = resumo.sinais.findIndex((sinal) => sinal.tipo === 'adesao')

    expect(resumo.sinais[indice]).toMatchObject({ tipo: 'adesao', severidade: 'risco' })
    expect(resumo.sinais.slice(0, indice).every((sinal) => sinal.severidade === 'risco')).toBe(true)
    expect(resumo.tratamentos.map((item) => item.id)).toContain(TRATAMENTO_CRITICO)
  })
})

describe('várias vezes ao dia: a Cacau e a dose das 23h', () => {
  it('a dose da noite é a que fica para trás, e a tela sabe dizer', async () => {
    const { lido } = await daFicha('pet-cacau', TRATAMENTO_VARIAS_VEZES_AO_DIA)

    expect(lido.tratamento.frequenciaHoras).toBe(8)
    expect(horarioDestoante(lido.total)?.horario).toBe('23:00')
  })

  it('sem segundo aviso de 8 em 8 horas; com ele só a partir de uma vez por dia', async () => {
    const cacau = await tratamentoRepository.noApp('pet-cacau', 'tutor-ana-lu')
    const perola = await tratamentoRepository.noApp('pet-perola', 'tutor-fatima')

    expect(cacau.contrato.tratamentos[0]!.avisos.comReaviso).toBe(false)
    expect(
      perola.contrato.tratamentos.find((item) => item.id === TRATAMENTO_DA_DEMONSTRACAO)!.avisos
        .comReaviso,
    ).toBe(true)
  })
})

describe('prescrever: a receita vira lembrete, e o lembrete, tratamento', () => {
  it('"Criar lembretes" cria o tratamento com o crítico da prescrição, e criar de novo devolve o mesmo', async () => {
    const dataset = getDataset()
    const comTratamento = new Set(dataset.tratamentos.map((item) => item.prescricaoId))
    const encounter = dataset.encounters.find(
      (item) =>
        item.resumoLiberadoEm &&
        item.conduta.prescricoes.some((prescricao) => !comTratamento.has(prescricao.id)),
    )!
    const prescricao = encounter.conduta.prescricoes.find((item) => !comTratamento.has(item.id))!

    prescricao.critico = true

    const pedido = {
      encounterId: encounter.id,
      itens: [{ prescricaoId: prescricao.id, primeiraDoseEm: agoraIso() }],
      cuidadorId: encounter.tutorId,
      compartilharComAClinica: true,
    }
    const [criado] = await tratamentoRepository.criarLembretes(pedido)
    const [deNovo] = await tratamentoRepository.criarLembretes(pedido)

    expect(criado).toMatchObject({ prescricaoId: prescricao.id, critico: true })
    expect(deNovo!.id).toBe(criado!.id)

    const atendimento = projetarAtendimento(encounter, {
      dataset,
      tutorId: encounter.tutorId,
      agora: agoraIso(),
      textos: {
        emInvestigacao: '',
        sinaisDeAlerta: '',
        tituloDoDocumento: { RECEITUARIO: '', ORIENTACOES: '', PEDIDO_EXAME: '' },
      },
    })

    expect(atendimento.receita?.itens.find((item) => item.id === prescricao.id)?.tratamentoId).toBe(
      criado!.id,
    )
  })

  it('o celular mostra a mesma faixa da clínica: 14 dias, hoje por último, com quem deu', async () => {
    const noApp = await tratamentoRepository.noApp('pet-perola', 'tutor-fatima')
    const meloxicam = noApp.contrato.tratamentos.find(
      (item) => item.id === TRATAMENTO_DA_DEMONSTRACAO,
    )!
    const ultimo = meloxicam.ultimosDias[meloxicam.ultimosDias.length - 1]!
    const quem = meloxicam.ultimosDias.flatMap((dia) =>
      dia.doses.map((dose) => dose.registradaPor?.id),
    )

    expect(meloxicam.ultimosDias).toHaveLength(14)
    expect(ultimo.dia).toBe(clock.today())
    expect(ultimo.doses[0]!.situacao).toBe('ABERTA')
    expect(quem).toContain(FAMILIAR_DA_DEMONSTRACAO)
  })

  it('o item de uso contínuo segue sem data de fim no contrato', async () => {
    const noApp = await tratamentoRepository.noApp('pet-perola', 'tutor-fatima')
    const meloxicam = noApp.contrato.tratamentos.find(
      (item) => item.id === TRATAMENTO_DA_DEMONSTRACAO,
    )!

    expect('duracaoDias' in meloxicam).toBe(false)
    expect('ultimaDoseEm' in meloxicam).toBe(false)
  })

  it('dois remédios no mesmo horário saem num aviso só', () => {
    const dataset = getDataset()
    const meloxicam = dataset.tratamentos.find((item) => item.id === TRATAMENTO_DA_DEMONSTRACAO)!
    const amanha = clock.toIso(clock.today(), 24 * 60 + 8 * 60 + 30)

    dataset.tratamentos.push({
      ...meloxicam,
      id: 'trat-teste-junto',
      prescricaoId: null,
      medicamentoId: 'med-omeprazol',
      medicamento: 'Omeprazol 10 mg',
      inicioEm: clock.toIso(clock.today(), 8 * 60 + 5),
    })

    const avisos = projetarAvisosDeDose(
      'tutor-fatima',
      { dataset, agora: agoraIso() },
      clock.toIso(clock.today(), 23 * 60),
      amanha,
    )
    const [aviso] = avisos

    expect(avisos).toHaveLength(1)
    expect(aviso!.doses).toHaveLength(2)
    expect(TEXTO_PT_DO_AVISO_DE_DOSE(aviso!).titulo).toBe('2 remédios de Pérola às 08:00')
  })
})
