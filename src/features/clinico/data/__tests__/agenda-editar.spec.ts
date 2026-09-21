/**
 * Contrato de `agendaRepository.editar`.
 *
 * A edição nasceu depois de `mover` e `cancelar`, para cobrir o que nenhuma das duas cobria:
 * tipo, sala e observação de um atendimento que já existe. Antes dela, corrigir "Consulta" para
 * "Retorno" custava um cancelamento e um novo agendamento — aviso de cancelamento para quem não
 * teve nada cancelado, e o histórico do paciente partido em dois registros.
 *
 * O que estes testes fixam:
 *
 * **O paciente não se edita.** A assinatura não tem `petId` nem `tutorId`, e o teste guarda isso
 * contra a tentação futura de "só adicionar mais um campo": trocar quem é atendido é outro
 * atendimento, com outro tutor e outro telefone.
 *
 * **O par ligado acompanha o horário, e só o horário.** Mesma regra de `mover`, pela mesma razão:
 * cirurgia e recuperação andam juntas no tempo e separadas no espaço. Tipo, sala e observação
 * valem só para o alvo — é por serem diferentes que as duas pernas existem.
 *
 * **O desfazer restaura tudo.** A edição entra na faixa de 8 s como as outras mutações, e
 * desfazer precisa devolver o atendimento inteiro, não só o campo que mudou por último.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { agendaRepository } from '../repositories'
import { getDataset, resetDataset } from '../store'

function acharApt(id: string) {
  return getDataset().appointments.find((item) => item.id === id)
}

/** Meia hora à frente, no mesmo dia: distância que não esbarra no fim do expediente. */
function meiaHoraDepois(iso: string): string {
  const deslocado = new Date(Date.parse(iso) + 30 * 60_000)

  return deslocado.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

describe('agendaRepository.editar', () => {
  beforeEach(() => {
    resetDataset()
  })

  it('troca tipo, sala e observação sem mexer no paciente', async () => {
    const antes = acharApt('apt-cirurgia-centro')

    expect(antes).toBeDefined()

    const petOriginal = antes!.petId
    const tutorOriginal = antes!.tutorId
    const outroTipo = getDataset().appointments.find(
      (item) => item.typeId !== antes!.typeId,
    )?.typeId

    expect(outroTipo).toBeDefined()

    await agendaRepository.editar('apt-cirurgia-centro', {
      typeId: outroTipo!,
      professionalId: antes!.professionalId,
      roomIds: ['sala-2'],
      inicio: antes!.inicio,
      fim: antes!.fim,
      observacao: 'Tutor avisou que vai atrasar.',
    })

    const depois = acharApt('apt-cirurgia-centro')

    expect(depois?.typeId).toBe(outroTipo)
    expect(depois?.roomIds).toEqual(['sala-2'])
    expect(depois?.observacao).toBe('Tutor avisou que vai atrasar.')
    /** O ponto do teste: editar nunca reatribui o atendimento a outro bicho. */
    expect(depois?.petId).toBe(petOriginal)
    expect(depois?.tutorId).toBe(tutorOriginal)
  })

  it('desloca o par ligado no tempo e não contamina o tipo nem a sala dele', async () => {
    const centro = acharApt('apt-cirurgia-centro')
    const parAntes = acharApt('apt-cirurgia-recuperacao')

    expect(centro?.linkedGroupId).toBeTruthy()
    expect(parAntes).toBeDefined()

    const tipoDoPar = parAntes!.typeId
    const salaDoPar = [...parAntes!.roomIds]
    const inicioDoPar = Date.parse(parAntes!.inicio)
    const outroTipo = getDataset().appointments.find(
      (item) => item.typeId !== tipoDoPar,
    )?.typeId

    await agendaRepository.editar('apt-cirurgia-centro', {
      typeId: outroTipo!,
      professionalId: centro!.professionalId,
      roomIds: ['sala-2'],
      inicio: meiaHoraDepois(centro!.inicio),
      fim: meiaHoraDepois(centro!.fim),
      observacao: '',
    })

    const parDepois = acharApt('apt-cirurgia-recuperacao')

    expect(Date.parse(parDepois!.inicio) - inicioDoPar).toBe(30 * 60_000)
    expect(parDepois?.typeId).toBe(tipoDoPar)
    expect(parDepois?.roomIds).toEqual(salaDoPar)
  })

  it('desfazer devolve o atendimento inteiro, não só o último campo', async () => {
    const antes = acharApt('apt-cirurgia-centro')
    const original = { ...antes! }
    const outroTipo = getDataset().appointments.find(
      (item) => item.typeId !== original.typeId,
    )?.typeId

    const { undoToken } = await agendaRepository.editar('apt-cirurgia-centro', {
      typeId: outroTipo!,
      professionalId: original.professionalId,
      roomIds: ['sala-2'],
      inicio: meiaHoraDepois(original.inicio),
      fim: meiaHoraDepois(original.fim),
      observacao: 'rascunho',
    })

    expect(await agendaRepository.desfazer(undoToken)).toBe(true)

    const depois = acharApt('apt-cirurgia-centro')

    expect(depois?.typeId).toBe(original.typeId)
    expect(depois?.roomIds).toEqual(original.roomIds)
    expect(depois?.observacao).toBe(original.observacao)
    expect(depois?.inicio).toBe(original.inicio)
    expect(depois?.fim).toBe(original.fim)
  })
})
