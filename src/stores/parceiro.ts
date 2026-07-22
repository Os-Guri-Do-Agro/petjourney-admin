import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'
import {
  getPortalDashboard,
  getPortalStatus,
} from '@/service/parceiro/parceiro-portal-service'
import type {
  ModoParticipacao,
  ModoStatusBloco,
  PapelParceiro,
  PortalDashboard,
  PortalStatus,
  StatusModoParceiro,
} from '@/service/parceiro/types'

const PARCEIRO_ID_STORAGE_KEY = 'petjourney-parceiro-id'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export const useParceiroStore = defineStore('parceiro', () => {
  const parceiroId = ref<string | null>(readStoredParceiroId())
  const dashboard = ref<PortalDashboard | null>(null)
  const status = ref<PortalStatus | null>(null)
  const loadState = ref<LoadState>('idle')
  const errorMessage = ref('')
  const needsParceiroSelection = ref(false)
  /** Conta autenticada sem membership em nenhum Parceiro (API 403). */
  const semAcessoParceiro = ref(false)

  const papel = computed<PapelParceiro | null>(() => dashboard.value?.papel ?? null)
  const isDono = computed(() => papel.value === 'DONO')
  const podeOperar = computed(() => status.value?.podeOperar ?? false)
  const statusAuditoria = computed(() => status.value?.statusAuditoria ?? null)
  /** Cadastro suspenso pelo admin: portal parceiro fica totalmente inacessível. */
  const cadastroSuspenso = computed(() => statusAuditoria.value === 'SUSPENSO')
  const statusAfiliadoAtivo = computed(() => status.value?.afiliado.status === 'ATIVO')
  const parceiroNome = computed(() => dashboard.value?.parceiro.nome ?? 'Parceiro')

  function modoBloco(modo: ModoParticipacao): ModoStatusBloco {
    const bloco = modo === 'afiliado' ? status.value?.afiliado : status.value?.participativo

    return (
      bloco ?? { status: 'NAO_SOLICITADO', motivo: null, decididoEm: null, podeSolicitar: false }
    )
  }

  function readStoredParceiroId() {
    if (typeof window === 'undefined') {
      return null
    }

    return window.localStorage.getItem(PARCEIRO_ID_STORAGE_KEY)
  }

  function setParceiroId(id: string | null) {
    parceiroId.value = id

    if (typeof window === 'undefined') {
      return
    }

    if (id) {
      window.localStorage.setItem(PARCEIRO_ID_STORAGE_KEY, id)
    } else {
      window.localStorage.removeItem(PARCEIRO_ID_STORAGE_KEY)
    }
  }

  async function bootstrap(force = false) {
    if (!force && loadState.value === 'ready' && dashboard.value) {
      return
    }

    loadState.value = 'loading'
    errorMessage.value = ''
    needsParceiroSelection.value = false
    semAcessoParceiro.value = false

    try {
      const query = parceiroId.value ? { parceiroId: parceiroId.value } : undefined
      const [dashboardData, statusData] = await Promise.all([
        getPortalDashboard(query),
        getPortalStatus(query),
      ])

      dashboard.value = dashboardData
      status.value = statusData
      setParceiroId(dashboardData.parceiro.id)
      loadState.value = 'ready'
    } catch (error) {
      if (error instanceof ApiError && error.statusCode === 400) {
        needsParceiroSelection.value = true
        errorMessage.value = String(i18n.global.t('parceiro.store.errorNeedsSelection'))
      } else if (error instanceof ApiError && error.statusCode === 403) {
        semAcessoParceiro.value = true
        errorMessage.value = String(i18n.global.t('parceiro.store.errorNoAccess'))
      } else {
        errorMessage.value =
          error instanceof Error
            ? error.message
            : String(i18n.global.t('parceiro.store.errorGeneric'))
      }

      loadState.value = 'error'
      throw error
    }
  }

  async function refreshStatus() {
    const statusData = await getPortalStatus(
      parceiroId.value ? { parceiroId: parceiroId.value } : undefined,
    )

    status.value = statusData
  }

  function patchModoStatus(modo: ModoParticipacao, modoStatus: StatusModoParceiro) {
    /** Patch otimista: motivo antigo some e a re-solicitação fecha até o refresh trazer a verdade. */
    const patchedBloco: ModoStatusBloco = {
      status: modoStatus,
      motivo: null,
      decididoEm: null,
      podeSolicitar: false,
    }
    const idleBloco: ModoStatusBloco = {
      status: 'NAO_SOLICITADO',
      motivo: null,
      decididoEm: null,
      podeSolicitar: true,
    }

    if (!status.value) {
      status.value = {
        statusAuditoria: 'PENDENTE',
        podeOperar: false,
        afiliado: modo === 'afiliado' ? patchedBloco : idleBloco,
        participativo: modo === 'participativo' ? patchedBloco : idleBloco,
        statusAfiliado: modo === 'afiliado' ? modoStatus : 'NAO_SOLICITADO',
        statusParticipativo: modo === 'participativo' ? modoStatus : 'NAO_SOLICITADO',
      }
      return
    }

    status.value =
      modo === 'afiliado'
        ? { ...status.value, afiliado: patchedBloco, statusAfiliado: modoStatus }
        : { ...status.value, participativo: patchedBloco, statusParticipativo: modoStatus }
  }

  function reset() {
    dashboard.value = null
    status.value = null
    loadState.value = 'idle'
    errorMessage.value = ''
    needsParceiroSelection.value = false
    semAcessoParceiro.value = false
    setParceiroId(null)
  }

  return {
    parceiroId,
    dashboard,
    status,
    loadState,
    errorMessage,
    needsParceiroSelection,
    semAcessoParceiro,
    papel,
    isDono,
    podeOperar,
    statusAuditoria,
    cadastroSuspenso,
    statusAfiliadoAtivo,
    parceiroNome,
    modoBloco,
    setParceiroId,
    bootstrap,
    refreshStatus,
    patchModoStatus,
    reset,
  }
})
