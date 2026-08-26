/**
 * Store do prontuário.
 *
 * Três coisas moram aqui e em nenhum outro lugar:
 *
 * 1. **Autosave.** Grava direto no registro em edição e **não invalida nada** — esta é a única
 *    exceção à regra do módulo. Invalidar a cada pausa de digitação faria a tela piscar
 *    enquanto o profissional escreve.
 * 2. **Rascunho local.** Espelho em `localStorage` sob `clinic.draft.<encounterId>`, para que
 *    fechar o navegador no meio da consulta não custe a anamnese inteira.
 * 3. **Um dispositivo edita por vez.** O segundo entra em leitura e só assume por
 *    transferência explícita, com comparação campo a campo.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import {
  EncounterLockedError,
  encounterRepository,
} from '../data/repositories'
import type {
  Encounter,
  EncounterDraft,
  EncounterLock,
  EncounterPatch,
  TimelineEvent,
} from '../data/types'

import { clinicClock, useClinicoStore } from './clinico'

const PREFIXO_RASCUNHO = 'clinic.draft.'
const CHAVE_DISPOSITIVO = 'clinic.deviceId'
/** Tempo de pausa na digitação que dispara a gravação. */
const ATRASO_AUTOSAVE_MS = 800

function identificarDispositivo(): EncounterLock {
  let id = ''

  if (typeof window !== 'undefined') {
    id = window.sessionStorage.getItem(CHAVE_DISPOSITIVO) ?? ''

    if (!id) {
      id = `dev-${Math.random().toString(36).slice(2, 8)}`
      window.sessionStorage.setItem(CHAVE_DISPOSITIVO, id)
    }
  }

  return {
    deviceId: id || 'dev-servidor',
    deviceLabel: typeof navigator === 'undefined' ? 'Servidor' : navigator.platform || 'Navegador',
    desde: clinicClock.nowIso(),
  }
}

export const useProntuarioStore = defineStore('clinico-prontuario', () => {
  const clinico = useClinicoStore()

  const encounter = ref<Encounter | null>(null)
  const consultaAnterior = ref<Encounter | null>(null)
  const timeline = ref<TimelineEvent[]>([])
  const carregando = ref(false)
  const salvando = ref(false)
  const salvoEm = ref<string | null>(null)
  const erro = ref('')
  const rascunhoPendente = ref<EncounterDraft | null>(null)
  const simulandoSegundoDispositivo = ref(false)

  const dispositivo = identificarDispositivo()

  let temporizador: ReturnType<typeof setTimeout> | null = null
  let patchAcumulado: EncounterPatch = {}

  /**
   * O quarto estado, que é do prontuário e não da página: leitura. Acontece quando outro
   * dispositivo detém a edição ou quando o atendimento já foi finalizado.
   */
  const somenteLeitura = computed(() => {
    if (!encounter.value) {
      return false
    }

    if (encounter.value.status === 'finalizado') {
      return true
    }

    const lock = encounter.value.lock

    return Boolean(lock && lock.deviceId !== dispositivo.deviceId)
  })

  const donoDaEdicao = computed(() => encounter.value?.lock ?? null)

  const pet = computed(() => (encounter.value ? clinico.pet(encounter.value.petId) : null))
  const tutor = computed(() => (encounter.value ? clinico.tutor(encounter.value.tutorId) : null))

  // ------------------------------------------------------------------ rascunho local

  function chaveDoRascunho(encounterId: string) {
    return `${PREFIXO_RASCUNHO}${encounterId}`
  }

  function lerRascunho(encounterId: string): EncounterDraft | null {
    if (typeof window === 'undefined') {
      return null
    }

    const bruto = window.localStorage.getItem(chaveDoRascunho(encounterId))

    if (!bruto) {
      return null
    }

    try {
      return JSON.parse(bruto) as EncounterDraft
    } catch {
      window.localStorage.removeItem(chaveDoRascunho(encounterId))

      return null
    }
  }

  function gravarRascunho(atual: Encounter) {
    if (typeof window === 'undefined') {
      return
    }

    const rascunho: EncounterDraft = {
      encounterId: atual.id,
      salvoEm: clinicClock.nowIso(),
      versaoBase: atual.versao,
      patch: {
        anamnese: atual.anamnese,
        exameFisico: atual.exameFisico,
        diagnosticos: atual.diagnosticos,
        conduta: atual.conduta,
      },
    }

    window.localStorage.setItem(chaveDoRascunho(atual.id), JSON.stringify(rascunho))
  }

  function descartarRascunho() {
    if (typeof window !== 'undefined' && encounter.value) {
      window.localStorage.removeItem(chaveDoRascunho(encounter.value.id))
    }

    rascunhoPendente.value = null
  }

  function restaurarRascunho() {
    const rascunho = rascunhoPendente.value

    if (!rascunho || !encounter.value) {
      return
    }

    encounter.value = { ...encounter.value, ...rascunho.patch }
    rascunhoPendente.value = null
    agendarGravacao(rascunho.patch)
  }

  // ------------------------------------------------------------------ carregamento

  async function abrirPorAppointment(appointmentId: string) {
    carregando.value = true
    erro.value = ''

    try {
      const aberto = await encounterRepository.abrir(appointmentId, {
        ...dispositivo,
        desde: clinicClock.nowIso(),
      })

      await aplicarCarregado(aberto)
    } catch {
      erro.value = 'clinico.erros.prontuario'
    } finally {
      carregando.value = false
    }
  }

  async function abrirPorId(encounterId: string) {
    carregando.value = true
    erro.value = ''

    try {
      await aplicarCarregado(await encounterRepository.obter(encounterId))
    } catch {
      erro.value = 'clinico.erros.prontuario'
    } finally {
      carregando.value = false
    }
  }

  async function aplicarCarregado(carregado: Encounter) {
    encounter.value = carregado
    salvoEm.value = null

    const rascunho = lerRascunho(carregado.id)

    /**
     * Rascunho mais novo que o servidor vira oferta, não sobrescrita: quem estava digitando
     * decide se quer o texto de volta.
     */
    rascunhoPendente.value = rascunho && rascunho.versaoBase <= carregado.versao ? rascunho : null

    const [anterior, historico] = await Promise.all([
      encounterRepository.consultaAnterior(carregado.petId, carregado.abertoEm),
      encounterRepository.historico(carregado.petId),
    ])

    consultaAnterior.value = anterior
    timeline.value = historico
  }

  // ------------------------------------------------------------------ autosave

  function agendarGravacao(patch: EncounterPatch) {
    patchAcumulado = { ...patchAcumulado, ...patch }

    if (temporizador) {
      clearTimeout(temporizador)
    }

    temporizador = setTimeout(() => void gravar(), ATRASO_AUTOSAVE_MS)
  }

  /**
   * Edição de campo. Atualiza a cópia local na hora — digitar não pode esperar rede — e agenda
   * a gravação. Nada de `invalidarTudo()` aqui.
   */
  function atualizar(patch: EncounterPatch) {
    if (!encounter.value || somenteLeitura.value) {
      return
    }

    encounter.value = { ...encounter.value, ...patch }
    gravarRascunho(encounter.value)
    agendarGravacao(patch)
  }

  async function gravar() {
    const atual = encounter.value

    if (!atual || Object.keys(patchAcumulado).length === 0) {
      return
    }

    const patch = patchAcumulado

    patchAcumulado = {}
    salvando.value = true

    try {
      const salvo = await encounterRepository.salvar(atual.id, patch, dispositivo.deviceId)

      encounter.value = { ...salvo }
      salvoEm.value = clinicClock.nowIso()
      descartarRascunho()
    } catch (falha) {
      if (falha instanceof EncounterLockedError) {
        /** Perdeu a edição no meio do caminho: mantém o texto na tela e passa para leitura. */
        encounter.value = atual.lock ? atual : { ...atual, lock: falha.lock }
        gravarRascunho(atual)
        erro.value = ''
      } else {
        erro.value = 'clinico.erros.mutacao'
      }
    } finally {
      salvando.value = false
    }
  }

  /** Chamado ao sair da tela: o que estava pendente não pode ficar só na memória. */
  async function descarregar() {
    if (temporizador) {
      clearTimeout(temporizador)
      temporizador = null
    }

    await gravar()

    if (encounter.value && !somenteLeitura.value) {
      await encounterRepository.liberarEdicao(encounter.value.id, dispositivo.deviceId)
    }
  }

  async function assumirEdicao() {
    if (!encounter.value) {
      return
    }

    encounter.value = await encounterRepository.assumirEdicao(encounter.value.id, {
      ...dispositivo,
      desde: clinicClock.nowIso(),
    })
  }

  async function finalizar() {
    if (!encounter.value) {
      return
    }

    await gravar()

    const finalizado = await encounterRepository.finalizar(encounter.value.id)

    encounter.value = finalizado
    descartarRascunho()

    /** Finalizar muda a grade do dia, a carga da semana e o painel de atividades. */
    clinico.invalidarTudo()
  }

  /**
   * Simulação de segundo dispositivo, para o painel de desenvolvimento: injeta um lock alheio
   * sem precisar de outra máquina aberta.
   */
  function alternarSegundoDispositivo() {
    simulandoSegundoDispositivo.value = !simulandoSegundoDispositivo.value

    if (!encounter.value) {
      return
    }

    encounter.value = {
      ...encounter.value,
      lock: simulandoSegundoDispositivo.value
        ? {
            deviceId: 'outro-dispositivo',
            deviceLabel: 'Recepção · Chrome',
            desde: clinicClock.nowIso(),
          }
        : null,
    }
  }

  function $limpar() {
    encounter.value = null
    consultaAnterior.value = null
    timeline.value = []
    rascunhoPendente.value = null
    salvoEm.value = null
    erro.value = ''
    patchAcumulado = {}
  }

  return {
    encounter,
    consultaAnterior,
    timeline,
    carregando,
    salvando,
    salvoEm,
    erro,
    rascunhoPendente,
    simulandoSegundoDispositivo,
    dispositivo,
    somenteLeitura,
    donoDaEdicao,
    pet,
    tutor,
    abrirPorAppointment,
    abrirPorId,
    atualizar,
    gravar,
    descarregar,
    assumirEdicao,
    finalizar,
    restaurarRascunho,
    descartarRascunho,
    alternarSegundoDispositivo,
    $limpar,
  }
})
