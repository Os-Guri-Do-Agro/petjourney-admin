import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'
import {
  obterEuNoParceiro,
  type EuNoParceiro,
  type ModuloDoPortal,
  type NomeDoModulo,
  type Permissao,
} from '@/service/parceiro/acesso-service'
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
import { decidirAcessoPortal } from '@/utils/parceiro/acesso-portal'

const PARCEIRO_ID_STORAGE_KEY = 'petjourney-parceiro-id'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

export const useParceiroStore = defineStore('parceiro', () => {
  const parceiroId = ref<string | null>(readStoredParceiroId())
  const dashboard = ref<PortalDashboard | null>(null)
  const status = ref<PortalStatus | null>(null)
  /**
   * Módulos, papéis e permissões desta conta neste parceiro (`GET /parceiro/portal/eu`).
   *
   * Nulo quando a rota falha: o portal comercial segue funcionando e Clínica e Hotel somem do
   * menu, em vez de a falha de uma rota nova derrubar a tela inteira.
   */
  const eu = ref<EuNoParceiro | null>(null)
  const loadState = ref<LoadState>('idle')
  const errorMessage = ref('')
  const needsParceiroSelection = ref(false)
  /** Conta autenticada sem acesso a nenhum Parceiro (API 403). */
  const semAcessoParceiro = ref(false)
  /** O acesso existia nesta sessão e caiu: parceiro excluído pelo admin enquanto o portal estava aberto. */
  const acessoEncerrado = ref(false)

  const papel = computed<PapelParceiro | null>(() => dashboard.value?.papel ?? null)
  const isDono = computed(() => papel.value === 'DONO')
  const podeOperar = computed(() => status.value?.podeOperar ?? false)
  const statusAuditoria = computed(() => status.value?.statusAuditoria ?? null)
  /** Cadastro suspenso pelo admin: portal parceiro fica totalmente inacessível. */
  const cadastroSuspenso = computed(() => statusAuditoria.value === 'SUSPENSO')
  const statusAfiliadoAtivo = computed(() => status.value?.afiliado.status === 'ATIVO')
  const parceiroNome = computed(() => dashboard.value?.parceiro.nome ?? 'Parceiro')

  const permissoes = computed(() => new Set<Permissao>(eu.value?.permissoes ?? []))
  const permissoesAguardandoCrmv = computed(
    () => new Set<Permissao>(eu.value?.aguardandoCrmv ?? []),
  )

  function temPermissao(permissao: Permissao) {
    return permissoes.value.has(permissao)
  }

  /** A permissão existe para o papel, mas a API ainda recusa com `CRMV_OBRIGATORIO`. */
  function aguardaCrmv(permissao: Permissao) {
    return permissoesAguardandoCrmv.value.has(permissao)
  }

  function modulo(nome: NomeDoModulo): ModuloDoPortal | null {
    return eu.value?.modulos.find((item) => item.modulo === nome) ?? null
  }

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
    acessoEncerrado.value = false

    await carregarContexto(parceiroId.value, false)
  }

  async function carregarContexto(idAlvo: string | null, jaRetentou: boolean): Promise<void> {
    const tinhaContexto = dashboard.value != null

    try {
      const query = idAlvo ? { parceiroId: idAlvo } : undefined
      const [dashboardData, statusData, euData] = await Promise.all([
        getPortalDashboard(query),
        getPortalStatus(query),
        obterEuNoParceiro(query).catch(() => null),
      ])

      dashboard.value = dashboardData
      status.value = statusData
      eu.value = euData
      setParceiroId(dashboardData.parceiro.id)
      loadState.value = 'ready'
    } catch (error) {
      const decisao = decidirAcessoPortal(error, {
        parceiroIdEnviado: idAlvo,
        tinhaContexto,
        jaRetentou,
      })

      /** O id guardado morreu com a exclusão; a API reresolve o parceiro ativo sozinha. */
      if (decisao === 'retentar-sem-parceiro') {
        setParceiroId(null)
        return carregarContexto(null, true)
      }

      if (decisao === 'selecionar-parceiro') {
        needsParceiroSelection.value = true
        errorMessage.value = String(i18n.global.t('parceiro.store.errorNeedsSelection'))
      } else if (decisao === 'acesso-encerrado' || decisao === 'sem-acesso') {
        semAcessoParceiro.value = true
        acessoEncerrado.value = decisao === 'acesso-encerrado'
        dashboard.value = null
        status.value = null
        eu.value = null
        setParceiroId(null)
        errorMessage.value = String(
          i18n.global.t(
            acessoEncerrado.value
              ? 'parceiro.store.errorAccessRevoked'
              : 'parceiro.store.errorNoAccess',
          ),
        )
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

  /**
   * 403 num painel é ambíguo: pode ser OPERADOR sem permissão de DONO ou o parceiro excluído.
   * Só o contexto decide, então revalidamos. Retorna true quando o acesso caiu de vez e a
   * tela de saída assume — aí o painel não deve mostrar erro nenhum.
   */
  async function revalidarAcesso(error: unknown): Promise<boolean> {
    if (!(error instanceof ApiError) || error.statusCode !== 403) {
      return false
    }

    try {
      await bootstrap(true)
      return false
    } catch {
      return semAcessoParceiro.value
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
    eu.value = null
    loadState.value = 'idle'
    errorMessage.value = ''
    needsParceiroSelection.value = false
    semAcessoParceiro.value = false
    acessoEncerrado.value = false
    setParceiroId(null)
  }

  return {
    parceiroId,
    dashboard,
    status,
    eu,
    loadState,
    errorMessage,
    needsParceiroSelection,
    semAcessoParceiro,
    acessoEncerrado,
    papel,
    isDono,
    podeOperar,
    statusAuditoria,
    cadastroSuspenso,
    statusAfiliadoAtivo,
    parceiroNome,
    temPermissao,
    aguardaCrmv,
    modulo,
    modoBloco,
    setParceiroId,
    bootstrap,
    revalidarAcesso,
    refreshStatus,
    patchModoStatus,
    reset,
  }
})
