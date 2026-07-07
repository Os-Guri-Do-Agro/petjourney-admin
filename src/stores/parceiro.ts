import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { ApiError } from '@/service/api'
import {
  getPortalDashboard,
  getPortalStatus,
} from '@/service/parceiro/parceiro-portal-service'
import type {
  ModoParticipacao,
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

  const papel = computed<PapelParceiro | null>(() => dashboard.value?.papel ?? null)
  const isDono = computed(() => papel.value === 'DONO')
  const podeOperar = computed(() => status.value?.podeOperar ?? false)
  const statusAfiliadoAtivo = computed(() => status.value?.statusAfiliado === 'ATIVO')
  const parceiroNome = computed(() => dashboard.value?.parceiro.nome ?? 'Parceiro')

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
        errorMessage.value =
          'Selecione qual empresa parceira você deseja operar. Informe o identificador do parceiro.'
      } else if (error instanceof ApiError && error.statusCode === 403) {
        errorMessage.value = 'Sua conta não possui acesso ao portal do parceiro.'
      } else {
        errorMessage.value =
          error instanceof Error ? error.message : 'Não foi possível carregar o contexto do parceiro.'
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
    if (!status.value) {
      return
    }

    status.value =
      modo === 'afiliado'
        ? { ...status.value, statusAfiliado: modoStatus }
        : { ...status.value, statusParticipativo: modoStatus }
  }

  function reset() {
    dashboard.value = null
    status.value = null
    loadState.value = 'idle'
    errorMessage.value = ''
    needsParceiroSelection.value = false
    setParceiroId(null)
  }

  return {
    parceiroId,
    dashboard,
    status,
    loadState,
    errorMessage,
    needsParceiroSelection,
    papel,
    isDono,
    podeOperar,
    statusAfiliadoAtivo,
    parceiroNome,
    setParceiroId,
    bootstrap,
    refreshStatus,
    patchModoStatus,
    reset,
  }
})
