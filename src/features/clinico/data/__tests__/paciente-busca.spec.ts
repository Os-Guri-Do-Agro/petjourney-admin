/**
 * A busca de pacientes filtra — e é isso que precisa de teste.
 *
 * Ela não filtrava. A comparação por telefone era
 * `telefone.replace(/\D/g, '').includes(termo.replace(/\D/g, ''))`, e um termo sem nenhum dígito
 * vira string vazia, que **qualquer** texto contém: buscar "Rita" casava com o telefone de todo
 * mundo e devolvia o cadastro inteiro.
 *
 * O defeito era invisível na tela justamente porque não perdia nada: o paciente procurado estava
 * sempre na lista, junto de outros vinte e três, ordenados por nome. Quem usava concluía que a
 * busca era ruim, não que estava quebrada.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import { setMockConfig } from '../mock-runtime'
import { patientRepository } from '../repositories'
import { getDataset, resetDataset } from '../store'

beforeEach(() => {
  resetDataset()
  setMockConfig({ latenciaMs: 0, jitterMs: 0 })
})

describe('busca de pacientes', () => {
  it('um termo sem dígito nenhum não casa com todo telefone do cadastro', async () => {
    const total = getDataset().pets.length
    const encontrados = await patientRepository.buscar('zzzzqq')

    expect(total).toBeGreaterThan(5)
    expect(encontrados).toHaveLength(0)
  })

  it('acha pelo nome de quem responde pelo paciente', async () => {
    const tutor = getDataset().tutores[0]!
    const primeiroNome = tutor.nome.split(' ')[0]!

    const encontrados = await patientRepository.buscar(primeiroNome)

    expect(encontrados.length).toBeGreaterThan(0)
    expect(encontrados.every((linha) => linha.tutor?.nome.includes(primeiroNome))).toBe(true)
  })

  /* Acento não é barreira: quem digita "acai" no balcão está procurando a Açaí. */
  it('ignora acento', async () => {
    const comAcento = await patientRepository.buscar('Açaí')
    const semAcento = await patientRepository.buscar('acai')

    expect(comAcento.length).toBeGreaterThan(0)
    expect(semAcento.map((linha) => linha.pet.id)).toEqual(
      comAcento.map((linha) => linha.pet.id),
    )
  })

  it('acha pelo telefone, com ou sem pontuação', async () => {
    const tutor = getDataset().tutores.find((item) => item.telefone.length > 0)!
    const digitos = tutor.telefone.replace(/\D/g, '')

    const porDigitos = await patientRepository.buscar(digitos)
    const comPontuacao = await patientRepository.buscar(tutor.telefone)

    expect(porDigitos.length).toBeGreaterThan(0)
    expect(porDigitos.every((linha) => linha.tutor?.id === tutor.id)).toBe(true)
    expect(comPontuacao.map((linha) => linha.pet.id)).toEqual(
      porDigitos.map((linha) => linha.pet.id),
    )
  })

  it('sem termo, devolve todo mundo — é a lista da tela de Pacientes', async () => {
    const encontrados = await patientRepository.buscar('')

    expect(encontrados).toHaveLength(getDataset().pets.length)
  })

  it('respeita o limite pedido', async () => {
    const encontrados = await patientRepository.buscar('', 3)

    expect(encontrados).toHaveLength(3)
  })
})
