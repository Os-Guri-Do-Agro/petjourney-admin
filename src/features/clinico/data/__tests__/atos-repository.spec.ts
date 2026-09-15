/**
 * O histórico de atos contra o dataset de verdade.
 *
 * `domain/atos.ts` já prova a regra de junção com fontes de mentira. O que este arquivo prova é
 * outra coisa: que o dataset **produz** as três fontes e que elas se encontram — que a internação
 * do dataset tem administrações feitas, que a carteira de vacinas tem aplicações, e que o que o
 * repositório grava aparece junto do que ele deriva.
 *
 * É o teste que pega o defeito de ligação: um seed que esquece de popular `atos`, ou um
 * repositório que lê `dataset.internacao.administracoes` do lugar errado, passa pelos tipos e
 * devolve uma lista silenciosamente pela metade.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { setMockConfig } from '../mock-runtime'
import { patientRepository } from '../repositories'
import { getDataset, resetDataset } from '../store'

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

/** Um paciente que o seed internou — é onde as três fontes têm chance de se encontrar. */
function petInternado(): string {
  const dataset = getDataset()
  const comDose = dataset.internacao.administracoes.find((item) => item.status === 'feita')

  const internacao = dataset.internacao.internacoes.find(
    (item) => item.id === comDose?.internacaoId,
  )

  if (!internacao) {
    throw new Error('o dataset não tem nenhuma dose administrada')
  }

  return internacao.petId
}

describe('histórico de atos', () => {
  it('traz o que o dataset já sabe, sem ninguém ter digitado nada', async () => {
    const lista = await patientRepository.historicoDeAtos(petInternado())

    expect(lista.some((ato) => ato.origem === 'internacao')).toBe(true)
  })

  it('junta vacina, internação e o ato gravado no mesmo paciente', async () => {
    /*
     * `pet-luna` é o caso montado no seed para isto: tem vacina em dia, ato de consulta e um
     * relato do responsável. Se as três origens não convivem aqui, a tela do paciente mostra
     * uma história com buraco.
     */
    const lista = await patientRepository.historicoDeAtos('pet-luna')
    const origens = new Set(lista.map((ato) => ato.origem))

    expect(origens.has('vacina')).toBe(true)
    expect(origens.has('clinica')).toBe(true)
    expect(origens.has('avulso')).toBe(true)
  })

  it('devolve do mais recente para o mais antigo', async () => {
    const lista = await patientRepository.historicoDeAtos('pet-luna')
    const instantes = lista.map((ato) => ato.realizadoEm)

    expect([...instantes].sort((a, b) => b.localeCompare(a))).toEqual(instantes)
  })

  it('não mistura pacientes', async () => {
    const lista = await patientRepository.historicoDeAtos('pet-luna')

    expect(lista.every((ato) => ato.petId === 'pet-luna')).toBe(true)
  })
})

describe('registro de ato', () => {
  const base = {
    petId: 'pet-luna',
    kind: 'medicamento' as const,
    medicamentoId: 'med-dipirona',
    descricao: 'Dipirona',
    via: 'intravenosa' as const,
    doseTexto: '310 mg',
    realizadoEm: '2026-09-10T10:00:00-03:00',
    professionalId: 'prof-ana',
    encounterId: null,
    observacao: '',
  }

  it('grava e aparece no histórico do paciente', async () => {
    const criado = await patientRepository.registrarAto(base)
    const lista = await patientRepository.historicoDeAtos('pet-luna')

    expect(criado.origem).toBe('clinica')
    expect(lista.some((ato) => ato.id === criado.id)).toBe(true)
  })

  it('sem profissional, o ato nasce relatado', async () => {
    /*
     * A diferença entre "a clínica aplicou" e "alguém disse que aplicaram" precisa sobreviver no
     * dado, e não só na tela — é ela que decide se o vet confia no que está lendo.
     */
    const criado = await patientRepository.registrarAto({ ...base, professionalId: '' })

    expect(criado.origem).toBe('avulso')
  })

  it('procedimento não carrega medicamento, mesmo se vier preenchido', async () => {
    /* Curativo com `medicamentoId` entraria na contagem de exposição a um princípio ativo. */
    const criado = await patientRepository.registrarAto({
      ...base,
      kind: 'procedimento',
      descricao: 'Troca de curativo',
    })

    expect(criado.medicamentoId).toBeNull()
  })

  it('recusa ato sem descrição e paciente que não existe', async () => {
    await expect(patientRepository.registrarAto({ ...base, descricao: '  ' })).rejects.toThrow()
    await expect(
      patientRepository.registrarAto({ ...base, petId: 'pet-inexistente' }),
    ).rejects.toThrow()
  })

  it('guarda a hora do ato, não a do lançamento', async () => {
    /*
     * O ato quase sempre é lançado depois de acontecer. Carimbar o instante do lançamento
     * gravaria quando alguém digitou — a única hora que ninguém vai querer saber.
     */
    const criado = await patientRepository.registrarAto({
      ...base,
      realizadoEm: '2024-02-03T15:30:00-03:00',
    })

    expect(criado.realizadoEm).toBe('2024-02-03T15:30:00-03:00')
  })
})
