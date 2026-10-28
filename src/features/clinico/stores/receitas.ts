/**
 * Receitas emitidas.
 *
 * A receita é o artefato do módulo que mais circula fora dele — vai para a farmácia, para o
 * responsável e, se houver fiscalização, para o CRMV. Por isso ela **não é** a conduta do
 * prontuário: é uma cópia congelada dela, com assinatura e validade próprias.
 *
 * A distinção parece burocrática e não é. Se a receita apontasse para a conduta viva, editar a
 * dose no prontuário depois de assinar mudaria em silêncio um documento que já está na mão da
 * farmácia. Congelar é o que torna a assinatura verdadeira.
 *
 * **Persistência.** Enquanto a API não existe, as receitas vivem em `localStorage` com a mesma
 * forma que o backend terá. Só em memória, "repetir receita anterior" — que é entregável do
 * requisito — não sobreviveria a um F5.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import type { Encounter, Prescription, Receita } from '../data/types'
import { alergiaAoPrincipio } from '../domain/bulario'
import { addDays } from '../domain/clinic-time'
import { gerarCodigoVerificador, VALIDADE_EM_DIAS } from '../domain/receita'

import { clinicClock, useClinicoStore } from './clinico'

const CHAVE = 'clinic.receitas'
const LIMITE = 200

function ler(): Receita[] {
  if (typeof window === 'undefined') {
    return []
  }

  try {
    const bruto = window.localStorage.getItem(CHAVE)

    return bruto ? (JSON.parse(bruto) as Receita[]) : []
  } catch {
    window.localStorage.removeItem(CHAVE)

    return []
  }
}

export const useReceitasStore = defineStore('clinico-receitas', () => {
  const clinico = useClinicoStore()

  const receitas = ref<Receita[]>(ler())
  const salvando = ref(false)

  function gravar() {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(CHAVE, JSON.stringify(receitas.value.slice(0, LIMITE)))
  }

  function doPaciente(petId: string): Receita[] {
    return receitas.value
      .filter((receita) => receita.petId === petId)
      .sort((a, b) => b.emitidaEm.localeCompare(a.emitidaEm))
  }

  function doAtendimento(encounterId: string): Receita[] {
    return receitas.value.filter((receita) => receita.encounterId === encounterId)
  }

  /**
   * A última receita **assinada** do paciente — é o que "repetir receita" oferece.
   *
   * Rascunho não entra: repetir algo que nunca foi assinado é repetir uma intenção, não uma
   * prescrição.
   */
  function ultimaAssinada(petId: string): Receita | null {
    return (
      doPaciente(petId).find((receita) => receita.status !== 'rascunho') ?? null
    )
  }

  /**
   * Emite e assina numa operação só.
   *
   * Separar "emitir" de "assinar" criaria um estado em que existe receita sem assinatura na
   * mão do responsável — e receita sem assinatura não vale nada na farmácia, então o estado
   * intermediário só produziria confusão.
   */
  /**
   * Algum item conflita com alergia registrada do paciente e a consulta ainda não aceitou o
   * risco. Papel assinado não sai assim: a confirmação existe na prescrição, e assinar não pode
   * passar por cima dela (passava: a Dipirona da Nina saía assinada com a caixa desmarcada).
   */
  function alergiaSemAceite(encounter: Encounter, prescricoes: Prescription[]): boolean {
    const pet = clinico.pet(encounter.petId)

    if (!pet) {
      return false
    }

    return prescricoes.some((prescricao) => {
      const medicamento = clinico.medicamento(prescricao.medicamentoId)

      return (
        !prescricao.alergiaConfirmada &&
        medicamento !== null &&
        alergiaAoPrincipio(pet, medicamento) !== null
      )
    })
  }

  function emitir(encounter: Encounter, prescricoes: Prescription[]): Receita | null {
    const profissional = clinico.profissional(encounter.professionalId)

    if (!profissional || prescricoes.length === 0 || alergiaSemAceite(encounter, prescricoes)) {
      return null
    }

    salvando.value = true

    try {
      const agora = clinicClock.nowIso()
      const id = `rec-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
      const controlada = prescricoes.some(
        (prescricao) => clinico.medicamento(prescricao.medicamentoId)?.controlado ?? false,
      )

      const receita: Receita = {
        id,
        encounterId: encounter.id,
        petId: encounter.petId,
        tutorId: encounter.tutorId,
        /* Cópia profunda: a receita não pode mudar quando a conduta mudar. */
        prescricoes: prescricoes.map((prescricao) => ({
          ...prescricao,
          calculo: { ...prescricao.calculo },
        })),
        status: 'assinada',
        emitidaEm: agora,
        validaAte: addDays(clinicClock.dateOf(agora), VALIDADE_EM_DIAS),
        controlada,
        assinatura: {
          professionalId: profissional.id,
          /* Congelados: quem assinou hoje continua sendo quem assinou, mude o cadastro ou não. */
          nome: profissional.nome,
          conselho: profissional.conselho,
          assinadoEm: agora,
          codigo: gerarCodigoVerificador(
            `${id}|${encounter.petId}|${prescricoes.map((p) => p.medicamentoId).join(',')}`,
          ),
        },
        enviadaEm: null,
      }

      receitas.value = [receita, ...receitas.value].slice(0, LIMITE)
      gravar()

      return receita
    } finally {
      salvando.value = false
    }
  }

  /** Entrega ao responsável no app. Só receita assinada é enviável. */
  function enviar(receitaId: string): Receita | null {
    const receita = receitas.value.find((item) => item.id === receitaId)

    if (!receita || receita.status === 'rascunho') {
      return null
    }

    const atualizada: Receita = {
      ...receita,
      status: 'enviada',
      enviadaEm: clinicClock.nowIso(),
    }

    receitas.value = receitas.value.map((item) => (item.id === receitaId ? atualizada : item))
    gravar()

    return atualizada
  }

  const total = computed(() => receitas.value.length)

  return {
    receitas,
    salvando,
    total,
    doPaciente,
    doAtendimento,
    ultimaAssinada,
    alergiaSemAceite,
    emitir,
    enviar,
  }
})
