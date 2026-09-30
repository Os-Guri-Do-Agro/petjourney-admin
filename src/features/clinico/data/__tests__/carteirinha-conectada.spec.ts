/**
 * Carteirinha conectada: aplicar na clínica e ver a carteirinha do responsável mudar.
 *
 * É o critério de pronto do requisito, conferido no dado: a mesma aplicação, lida pelos dois
 * lados — o plano da clínica e o contrato que o app recebe — logo depois de gravada. Se um lado
 * mudar e o outro não, a demonstração lado a lado mente, e é isso que esta suíte existe para
 * pegar antes da plateia.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { createClinicClock, diffDays } from '../../domain/clinic-time'
import { CLINIC_UTC_OFFSET } from '../fixtures'
import { setMockConfig } from '../mock-runtime'
import { projetarVacina } from '../projecao-do-responsavel'
import {
  agendaRepository,
  AplicacaoRecusadaError,
  encounterRepository,
  vacinaRepository,
} from '../repositories'
import { PET_EM_PROTOCOLO } from '../seed-vacinacao'
import { agoraIso, getDataset, resetDataset } from '../store'

const clock = createClinicClock(CLINIC_UTC_OFFSET)

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

/** Aplica a segunda V10 do Biscoito com o lote que o diálogo sugeriria. */
async function aplicarSegundaV10(proximaNaAgenda = false) {
  const [lote] = (await vacinaRepository.lotesParaAplicar('vac-v10')).filter(
    (item) => item.sugerido,
  )
  const hoje = clock.today()
  const [horario] = proximaNaAgenda
    ? await agendaRepository.sugerirRetorno({
        petId: PET_EM_PROTOCOLO,
        professionalId: 'prof-ana',
        typeId: 'tipo-vacina',
        aPartirDe: hoje,
        emDias: 28,
        tolerancia: 6,
        limite: 1,
      })
    : []

  return vacinaRepository.aplicar({
    petId: PET_EM_PROTOCOLO,
    vacinaId: 'vac-v10',
    professionalId: 'prof-ana',
    lote: lote!.codigo,
    validadeLote: lote!.validade,
    dose: 2,
    dosesNaSerie: 3,
    via: 'subcutanea',
    observacao: '',
    encounterId: null,
    proximaNaAgenda: horario
      ? { professionalId: horario.professionalId, inicio: horario.inicio, fim: horario.fim }
      : null,
  })
}

describe('aplicar na clínica muda a carteirinha do app', () => {
  it('a dose nova chega com o selo da clínica, lote e a série avançada', async () => {
    const antes = await vacinaRepository.naCarteirinha(PET_EM_PROTOCOLO)
    const aplicacao = await aplicarSegundaV10()
    const depois = await vacinaRepository.naCarteirinha(PET_EM_PROTOCOLO)

    expect(depois!.vacinas).toHaveLength(antes!.vacinas.length + 1)

    const nova = depois!.vacinas.find((item) => item.id === aplicacao.id)!

    expect(nova.origem).toBe('CLINICA')
    expect(nova.clinica.nome).toBe(getDataset().clinic.nome)
    expect(nova.profissional?.id).toBe('prof-ana')
    expect(nova.lote).toBe(aplicacao.lote)
    expect(nova).toMatchObject({ dose: 2, dosesNaSerie: 3, via: 'SUBCUTANEA' })

    const v10 = depois!.plano.vacinas.find((item) => item.vacina.nome.startsWith('V10'))!

    expect(v10.aplicadasNaSerie).toBe(2)
    expect(v10.doses.find((dose) => dose.estado !== 'APLICADA')).toMatchObject({
      numero: 3,
      estado: 'PREVISTA',
    })
  })

  it('o aviso sai na hora, e aponta para a dose nova', async () => {
    const aplicacao = await aplicarSegundaV10()
    const carteirinha = await vacinaRepository.naCarteirinha(PET_EM_PROTOCOLO)

    expect(carteirinha!.ultimaNotificacao?.dados.aplicacaoId).toBe(aplicacao.id)
    expect(carteirinha!.ultimaNotificacao?.titulo).toContain('V10')
  })

  it('a próxima dose sai marcada na agenda, e o app vê o horário', async () => {
    const aplicacao = await aplicarSegundaV10(true)
    const marcado = getDataset().appointments.find(
      (item) => item.id === aplicacao.agendamentoDaProximaId,
    )

    expect(marcado).toMatchObject({ petId: PET_EM_PROTOCOLO, typeId: 'tipo-vacina' })
    /* No dia do protocolo ou pouco depois — nunca antes do intervalo da série. */
    expect(diffDays(clock.today(), clock.dateOf(marcado!.inicio))).toBeGreaterThanOrEqual(28)

    const carteirinha = await vacinaRepository.naCarteirinha(PET_EM_PROTOCOLO)
    const nova = carteirinha!.vacinas.find((item) => item.id === aplicacao.id)!

    expect(nova.proximaDoseAgendada).toEqual({
      agendamentoId: marcado!.id,
      inicio: marcado!.inicio,
    })
    expect(carteirinha!.ultimaNotificacao?.corpo).toContain('marcada')
  })

  it('a dose anterior da série deixa de cobrar: a seguinte já foi dada', async () => {
    /*
     * Calculada aplicação por aplicação, a primeira dose do Biscoito passaria a "vencida" três
     * dias depois da data — com a segunda já dada. O app mostraria um atraso que ninguém deve.
     */
    await aplicarSegundaV10()
    const dataset = getDataset()
    const primeira = dataset.aplicacoesDeVacina.find((item) => item.id === 'aplic-biscoito-v10-1')!

    expect(projetarVacina(primeira, { dataset, agora: agoraIso() }).situacao).toBe('EM_DIA')
  })

  it('a antirrábica da Pérola sai do atraso nos dois lados ao mesmo tempo', async () => {
    const [lote] = (await vacinaRepository.lotesParaAplicar('vac-antirrabica-canina')).filter(
      (item) => item.sugerido,
    )

    expect(vacinaRepository.plano('pet-perola')?.atrasadas).toBe(1)
    expect((await vacinaRepository.naCarteirinha('pet-perola'))!.plano.atrasadas).toBe(1)

    await vacinaRepository.aplicar({
      petId: 'pet-perola',
      vacinaId: 'vac-antirrabica-canina',
      professionalId: 'prof-helena',
      lote: lote!.codigo,
      validadeLote: lote!.validade,
      dose: 1,
      dosesNaSerie: 1,
      via: 'subcutanea',
      observacao: '',
      encounterId: null,
      proximaNaAgenda: null,
    })

    expect(vacinaRepository.plano('pet-perola')?.atrasadas).toBe(0)
    expect((await vacinaRepository.naCarteirinha('pet-perola'))!.plano.atrasadas).toBe(0)
  })
})

describe('o lote na hora da aplicação', () => {
  it('lote vencido é recusado, e nada é gravado', async () => {
    const antes = getDataset().aplicacoesDeVacina.length

    await expect(
      vacinaRepository.aplicar({
        petId: PET_EM_PROTOCOLO,
        vacinaId: 'vac-v10',
        professionalId: 'prof-ana',
        lote: 'V10-2409',
        validadeLote: '2020-01-01',
        dose: 2,
        dosesNaSerie: 3,
        via: 'subcutanea',
        observacao: '',
        encounterId: null,
        proximaNaAgenda: null,
      }),
    ).rejects.toBeInstanceOf(AplicacaoRecusadaError)

    expect(getDataset().aplicacoesDeVacina).toHaveLength(antes)
  })

  it('a geladeira tem um lote vencido com dose dentro, e ele aparece travado', async () => {
    /* É o caso difícil que a demonstração mostra: o frasco existe e não pode sair. */
    const lotes = await vacinaRepository.lotesParaAplicar('vac-v10')

    expect(lotes.some((item) => !item.avaliacao.pode)).toBe(true)
    expect(lotes.find((item) => item.sugerido)?.avaliacao.pode).toBe(true)
  })

  it('aplicar baixa o saldo do lote; a dose externa não mexe no estoque', async () => {
    const saldoDe = async (codigo: string) =>
      (await vacinaRepository.estoque()).lotes.find((item) => item.codigo === codigo)!.saldo

    const [lote] = (await vacinaRepository.lotesParaAplicar('vac-v10')).filter(
      (item) => item.sugerido,
    )
    const antes = await saldoDe(lote!.codigo)

    await aplicarSegundaV10()
    expect(await saldoDe(lote!.codigo)).toBe(antes - 1)

    const totalAntes = (await vacinaRepository.estoque()).indicadores.dosesEmEstoque

    await vacinaRepository.registrarExterna({
      petId: 'pet-pacoca',
      vacinaId: 'vac-v10',
      aplicadaEm: clock.today(),
      dose: 1,
      dosesNaSerie: 3,
      local: 'Pet Shop do Bairro',
      aplicador: '',
      procedencia: 'comprovante',
      registradaPor: 'prof-ana',
      observacao: '',
    })

    expect((await vacinaRepository.estoque()).indicadores.dosesEmEstoque).toBe(totalAntes)
  })
})

describe('a dose de outro lugar', () => {
  it('as doses de fora do Biscoito estão no histórico dele, mesmo sem consulta nenhuma', async () => {
    /*
     * O filhote chegou com a carteirinha do pet shop e ainda não passou por consulta. O histórico
     * dele dizia que não havia nada — com duas vacinas no registro.
     */
    const eventos = await encounterRepository.historico(PET_EM_PROTOCOLO)

    expect(eventos.filter((evento) => evento.kind === 'vacina')).toHaveLength(2)
    expect(eventos.every((evento) => evento.resumo.includes('sem lote'))).toBe(true)
  })

  it('entra sem lote, marcada, e o app diz onde foi e quem registrou', async () => {
    const hoje = clock.today()
    const aplicacao = await vacinaRepository.registrarExterna({
      petId: 'pet-pacoca',
      vacinaId: 'vac-v10',
      aplicadaEm: hoje,
      dose: 1,
      dosesNaSerie: 3,
      local: 'Pet Shop do Bairro',
      aplicador: '',
      procedencia: 'relato',
      registradaPor: 'prof-tiago',
      observacao: '',
    })

    expect(aplicacao).toMatchObject({ origem: 'externa', lote: null, validadeLote: null })

    const carteirinha = await vacinaRepository.naCarteirinha('pet-pacoca')
    const noApp = carteirinha!.vacinas.find((item) => item.id === aplicacao.id)!

    expect(noApp.origem).toBe('EXTERNA')
    expect(noApp.profissional).toBeNull()
    expect(noApp.externa).toMatchObject({
      local: 'Pet Shop do Bairro',
      aplicador: null,
      procedencia: 'RELATO',
      registradaPor: expect.objectContaining({ id: 'prof-tiago' }),
    })
    /* A posição na série conta do mesmo jeito: a próxima é a segunda. */
    expect(
      vacinaRepository.plano('pet-pacoca')?.vacinas.find((item) => item.vacina.id === 'vac-v10'),
    ).toMatchObject({ aplicadasNaSerie: 1 })
  })

  it('não aceita vacina de outra espécie', async () => {
    await expect(
      vacinaRepository.registrarExterna({
        petId: PET_EM_PROTOCOLO,
        vacinaId: 'vac-v4-felina',
        aplicadaEm: clock.today(),
        dose: 1,
        dosesNaSerie: 3,
        local: 'Lugar',
        aplicador: '',
        procedencia: 'comprovante',
        registradaPor: 'prof-ana',
        observacao: '',
      }),
    ).rejects.toBeInstanceOf(AplicacaoRecusadaError)
  })
})
