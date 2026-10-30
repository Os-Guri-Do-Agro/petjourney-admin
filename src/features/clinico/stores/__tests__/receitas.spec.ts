/**
 * Store de receitas.
 *
 * As duas regras que estes testes guardam falham em silêncio e caro:
 *
 * 1. **A receita congela.** Se ela apontasse para a conduta viva, mudar a dose no prontuário
 *    depois de assinar alteraria um papel que já está na mão da farmácia — sem aviso, sem
 *    rastro, e com a assinatura anterior ainda no rodapé.
 * 2. **Repetir copia.** Se a repetição reaproveitasse os mesmos objetos, editar a dose de hoje
 *    reescreveria a receita do mês passado.
 */

import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it } from 'vitest'

import { resetDataset } from '../../data/store'
import type { Encounter, Prescription } from '../../data/types'
import { useClinicoStore } from '../clinico'
import { useReceitasStore } from '../receitas'

function prescricao(patch: Partial<Prescription> = {}): Prescription {
  return {
    id: 'presc-1',
    medicamentoId: 'med-amoxicilina',
    via: 'oral',
    calculo: {
      medicamentoId: 'med-amoxicilina',
      mgPorKg: 10,
      pesoKg: 12.4,
      mgPorAdministracao: 124,
      quantidadeApresentacao: 2.48,
      frequenciaHoras: 12,
      duracaoDias: 7,
      totalAdministracoes: 14,
    },
    observacao: '',
    /*
     * A Luna (dona do primeiro atendimento do dataset) tem alergia registrada a amoxicilina: os
     * itens destes testes já vêm com o aceite da consulta, senão a receita nem sairia.
     */
    alergiaConfirmada: true,
    ...patch,
  }
}

function encounter(): Encounter {
  const dataset = resetDataset()

  return dataset.encounters[0] as Encounter
}

describe('emitir', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    await useClinicoStore().carregar(true)
  })

  it('assina com nome e conselho do profissional', () => {
    const store = useReceitasStore()
    const atual = encounter()
    const receita = store.emitir(atual, [prescricao()])

    expect(receita?.status).toBe('assinada')
    expect(receita?.assinatura?.nome).toBeTruthy()
    expect(receita?.assinatura?.conselho).toBeTruthy()
    expect(receita?.assinatura?.codigo).toMatch(/^[0-9A-Z]{4}(-[0-9A-Z]{4}){3}$/)
  })

  it('congela a prescrição: editar a conduta depois não muda a receita', () => {
    const store = useReceitasStore()
    const atual = encounter()
    const original = prescricao()
    const receita = store.emitir(atual, [original])

    /* Simula o vet mexendo na dose no prontuário **depois** de assinar. */
    original.calculo.mgPorKg = 999
    original.calculo.mgPorAdministracao = 99_999

    expect(receita?.prescricoes[0]?.calculo.mgPorKg).toBe(10)
    expect(receita?.prescricoes[0]?.calculo.mgPorAdministracao).toBe(124)
  })

  it('não emite receita sem prescrição', () => {
    expect(useReceitasStore().emitir(encounter(), [])).toBeNull()
  })

  /*
   * Assinar congela; a tela precisa saber quando a conduta andou depois, senão "Enviar ao
   * responsável" manda a versão de 24 h com a de 12 h na tela.
   */
  it('sabe quando a conduta mudou depois da assinatura', () => {
    const store = useReceitasStore()
    const atual = encounter()
    const receita = store.emitir(atual, [prescricao()])!

    expect(store.divergeDaConduta(receita, [prescricao()])).toBe(false)
    expect(store.divergeDaConduta(receita, [prescricao({ observacao: 'Após a refeição.' })])).toBe(
      false,
    )

    const de12Para8 = prescricao()
    de12Para8.calculo = { ...de12Para8.calculo, frequenciaHoras: 8 }

    expect(store.divergeDaConduta(receita, [de12Para8])).toBe(true)
    expect(store.divergeDaConduta(receita, [prescricao({ medicamentoId: 'med-cefalexina' })])).toBe(
      true,
    )
    expect(store.divergeDaConduta(receita, [prescricao(), prescricao({ id: 'presc-2' })])).toBe(
      true,
    )
  })

  /*
   * A Nina tem alergia registrada a dipirona. A prescrição pede o "Confirmo" explícito; assinar
   * não pode passar por cima dele (passava, e a receita saía assinada com a caixa desmarcada).
   */
  it('não assina item em conflito com alergia sem o aceite da consulta', () => {
    const store = useReceitasStore()
    const daNina = useClinicoStore().pet('pet-nina')
    const atual = { ...encounter(), petId: 'pet-nina' }

    expect(daNina?.alertas.some((alerta) => alerta.kind === 'alergia')).toBe(true)
    expect(
      store.emitir(atual, [
        prescricao({ medicamentoId: 'med-dipirona', alergiaConfirmada: false }),
      ]),
    ).toBeNull()
    expect(
      store.emitir(atual, [prescricao({ medicamentoId: 'med-dipirona', alergiaConfirmada: true })])
        ?.status,
    ).toBe('assinada')
  })

  it('marca como controlada quando algum item é de controle especial', () => {
    const store = useReceitasStore()
    const clinico = useClinicoStore()
    const controlado = clinico.medicamentos.find((item) => item.controlado)

    expect(controlado, 'o dataset precisa ter ao menos um controlado').toBeDefined()

    const receita = store.emitir(encounter(), [
      prescricao({ medicamentoId: controlado!.id }),
    ])

    expect(receita?.controlada).toBe(true)
  })
})

describe('enviar', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    await useClinicoStore().carregar(true)
  })

  it('registra a entrega ao responsável', () => {
    const store = useReceitasStore()
    const receita = store.emitir(encounter(), [prescricao()])!
    const enviada = store.enviar(receita.id)

    expect(enviada?.status).toBe('enviada')
    expect(enviada?.enviadaEm).toBeTruthy()
  })
})

describe('ultimaAssinada', () => {
  beforeEach(async () => {
    setActivePinia(createPinia())
    window.localStorage.clear()
    await useClinicoStore().carregar(true)
  })

  it('devolve a receita do paciente para repetir', () => {
    const store = useReceitasStore()
    const atual = encounter()

    store.emitir(atual, [prescricao()])

    expect(store.ultimaAssinada(atual.petId)?.petId).toBe(atual.petId)
  })

  it('não devolve receita de outro paciente', () => {
    const store = useReceitasStore()
    const atual = encounter()

    store.emitir(atual, [prescricao()])

    expect(store.ultimaAssinada('pet-que-nao-existe')).toBeNull()
  })
})
