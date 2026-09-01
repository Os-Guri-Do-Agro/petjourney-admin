/**
 * Contrato de `agendaRepository.mover`.
 *
 * A remarcação é a mutação mais perigosa do módulo: ela reescreve o horário de alguém que
 * reservou a manhã para vir à clínica. Estes testes fixam as duas coisas que ela precisa
 * acertar e que já erraram na prática.
 *
 * **A troca de sala.** A grade agrupa por profissional *ou* por sala, e o arraste entrega o id
 * da coluna de destino. Enquanto `mover` só sabia gravar `professionalId`, arrastar no
 * agrupamento por sala escrevia um id de sala dentro de `professionalId`: o atendimento
 * desaparecia de todas as colunas de profissional, sem erro, sem log, e só reaparecia quando
 * alguém reabria o dia e reparava na falta. Corrupção silenciosa é a que volta.
 *
 * **O par ligado.** Cirurgia e recuperação andam juntas no tempo e separadas no espaço.
 * Mover uma precisa arrastar o horário da outra e **não** a sala — é justamente por estarem em
 * salas diferentes que as duas existem.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { agendaRepository } from '../repositories'
import { getDataset, resetDataset } from '../store'

/** Meia hora à frente, no mesmo dia: distância que não esbarra no fim do expediente. */
function meiaHoraDepois(iso: string): string {
  const deslocado = new Date(Date.parse(iso) + 30 * 60_000)

  return deslocado.toISOString().replace(/\.\d{3}Z$/, 'Z')
}

describe('agendaRepository.mover', () => {
  beforeEach(() => {
    resetDataset()
  })

  it('troca a sala sem tocar em quem atende', async () => {
    const antes = getDataset().appointments.find((item) => item.id === 'apt-cirurgia-centro')

    expect(antes).toBeDefined()

    const profissionalOriginal = antes!.professionalId

    await agendaRepository.mover('apt-cirurgia-centro', {
      inicio: antes!.inicio,
      fim: antes!.fim,
      professionalId: profissionalOriginal,
      roomIds: ['sala-2'],
    })

    const depois = getDataset().appointments.find((item) => item.id === 'apt-cirurgia-centro')

    expect(depois?.roomIds).toEqual(['sala-2'])
    /** O ponto do teste: a sala mudou e o profissional continuou sendo um profissional. */
    expect(depois?.professionalId).toBe(profissionalOriginal)
  })

  it('mantém as salas quando o destino não as informa', async () => {
    const antes = getDataset().appointments.find((item) => item.id === 'apt-cirurgia-centro')
    const salasOriginais = [...antes!.roomIds]

    await agendaRepository.mover('apt-cirurgia-centro', {
      inicio: meiaHoraDepois(antes!.inicio),
      fim: meiaHoraDepois(antes!.fim),
    })

    const depois = getDataset().appointments.find((item) => item.id === 'apt-cirurgia-centro')

    expect(depois?.roomIds).toEqual(salasOriginais)
  })

  it('desloca o par ligado no tempo e deixa a sala dele em paz', async () => {
    const centro = getDataset().appointments.find((item) => item.id === 'apt-cirurgia-centro')
    const parAntes = getDataset().appointments.find(
      (item) => item.id === 'apt-cirurgia-recuperacao',
    )

    expect(centro?.linkedGroupId).toBeTruthy()
    expect(parAntes).toBeDefined()

    const salaDoPar = [...parAntes!.roomIds]
    const inicioDoPar = Date.parse(parAntes!.inicio)

    await agendaRepository.mover('apt-cirurgia-centro', {
      inicio: meiaHoraDepois(centro!.inicio),
      fim: meiaHoraDepois(centro!.fim),
      roomIds: ['sala-2'],
    })

    const parDepois = getDataset().appointments.find(
      (item) => item.id === 'apt-cirurgia-recuperacao',
    )

    expect(Date.parse(parDepois!.inicio) - inicioDoPar).toBe(30 * 60_000)
    /** A recuperação segue na recuperação: a troca de sala é só do alvo. */
    expect(parDepois?.roomIds).toEqual(salaDoPar)
  })
})
