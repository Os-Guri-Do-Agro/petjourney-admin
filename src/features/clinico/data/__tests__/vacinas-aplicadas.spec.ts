/**
 * A lista do que a clínica aplicou.
 *
 * É a outra pergunta da tela de vacinas, e ela não se responde com a lista de chamada: chamada
 * é quem **falta**, aplicadas é o que **foi feito**. Confundir as duas é o que faz um registro
 * de lote sumir da tela no dia em que o paciente fica em dia — exatamente quando a
 * farmacovigilância pergunta por ele.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { setMockConfig } from '../mock-runtime'
import { vacinaRepository } from '../repositories'
import { getDataset, resetDataset } from '../store'

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

describe('vacinas aplicadas', () => {
  it('devolve uma linha por aplicação do dataset', async () => {
    const lista = await vacinaRepository.aplicadas()

    expect(lista.length).toBe(getDataset().aplicacoesDeVacina.length)
  })

  it('ordena da mais recente para a mais antiga', async () => {
    const lista = await vacinaRepository.aplicadas()
    const instantes = lista.map((item) => item.aplicadaEm)

    expect([...instantes].sort((a, b) => b.localeCompare(a))).toEqual(instantes)
  })

  it('resolve paciente, responsável e vacina na própria linha', async () => {
    /*
     * A tabela não pode ficar buscando três vezes por linha a cada renderização — e uma célula
     * vazia no lugar do nome do paciente parece defeito de carga, não dado ausente.
     */
    const lista = await vacinaRepository.aplicadas()

    expect(lista.every((item) => item.petNome !== '')).toBe(true)
    expect(lista.every((item) => item.vacinaNome !== '')).toBe(true)
    expect(lista.every((item) => item.dosesNaSerie > 0)).toBe(true)
  })

  it('carrega lote e validade, que é o par que a rastreabilidade pede', async () => {
    const lista = await vacinaRepository.aplicadas()

    expect(lista.every((item) => Boolean(item.lote) && Boolean(item.validadeLote))).toBe(true)
  })

  it('descarta aplicação de paciente que não está mais no cadastro', async () => {
    const dataset = getDataset()
    const antes = (await vacinaRepository.aplicadas()).length

    dataset.aplicacoesDeVacina.push({
      ...dataset.aplicacoesDeVacina[0]!,
      id: 'apl-orfa',
      petId: 'pet-que-nao-existe',
    })

    expect(await vacinaRepository.aplicadas()).toHaveLength(antes)
  })

  it('mostra o que foi aplicado mesmo quando não há ninguém para chamar', async () => {
    /*
     * A regra que separa as duas listas. Uma clínica em dia com os reforços é a melhor notícia
     * possível — e não pode fazer a carteira do que ela aplicou desaparecer da tela junto.
     */
    const dataset = getDataset()

    /* Joga todo reforço para o futuro distante: ninguém vencido, ninguém a vencer. */
    for (const aplicacao of dataset.aplicacoesDeVacina) {
      aplicacao.proximaDoseEm = '2099-01-01'
      aplicacao.dose = 9
    }

    expect(await vacinaRepository.listaDeChamada()).toEqual([])
    expect((await vacinaRepository.aplicadas()).length).toBeGreaterThan(0)
  })

  it('a aplicação registrada agora entra na lista', async () => {
    const criada = await vacinaRepository.registrar({
      petId: 'pet-luna',
      vacinaId: 'vac-v10',
      professionalId: 'prof-ana',
      lote: 'L-2026-01',
      validadeLote: '2027-06-30',
      dose: 1,
      via: 'subcutanea',
      observacao: '',
    })

    const lista = await vacinaRepository.aplicadas()

    expect(lista[0]!.id).toBe(criada.id)
    expect(lista[0]!.lote).toBe('L-2026-01')
  })
})
