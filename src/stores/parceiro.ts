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
import { decidirAcessoPortal } from '@/utils/parceiro/acesso-portal'

const PARCEIRO_ID_STORAGE_KEY = 'petjourney-parceiro-id'
/**
 * O nome da empresa da última sessão: o topo da barra mostra a empresa já no primeiro quadro, em
 * vez de um "Parceiro" provisório que trocava diante de quem olhava enquanto o dashboard chegava.
 */
const PARCEIRO_NOME_STORAGE_KEY = 'petjourney-parceiro-nome'
/**
 * O último estado do credenciamento que esta sessão viu. A aprovação acontece no CMS, sem aviso no
 * portal: comparando com o que se viu antes, a moldura anuncia a aprovação uma vez só.
 */
const PARCEIRO_AUDITORIA_STORAGE_KEY = 'petjourney-parceiro-auditoria'
/**
 * A forma do menu do Portal na última sessão: se a conta é dona (Indicados) e se o Programa de
 * Afiliados estava ativo (Carteira). Sem ela, os dois itens entravam no menu de um a três
 * segundos depois dos outros, a cada recarga, e o menu "pulava" diante de quem olhava.
 */
const PARCEIRO_MENU_STORAGE_KEY = 'petjourney-parceiro-menu'

type LoadState = 'idle' | 'loading' | 'ready' | 'error'

interface FormaDoMenu {
  dono: boolean
  afiliadoAtivo: boolean
}

function lerDoArmazenamento(chave: string) {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage.getItem(chave)
  } catch {
    return null
  }
}

function lerFormaDoMenu(): FormaDoMenu | null {
  try {
    const guardada = JSON.parse(lerDoArmazenamento(PARCEIRO_MENU_STORAGE_KEY) ?? 'null')

    return typeof guardada?.dono === 'boolean' && typeof guardada?.afiliadoAtivo === 'boolean'
      ? { dono: guardada.dono, afiliadoAtivo: guardada.afiliadoAtivo }
      : null
  } catch {
    return null
  }
}

export const useParceiroStore = defineStore('parceiro', () => {
  const parceiroId = ref<string | null>(readStoredParceiroId())
  const dashboard = ref<PortalDashboard | null>(null)
  const status = ref<PortalStatus | null>(null)
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
  const nomeGuardado = ref<string | null>(lerDoArmazenamento(PARCEIRO_NOME_STORAGE_KEY))
  const formaGuardada = ref<FormaDoMenu | null>(lerFormaDoMenu())
  /**
   * O que o menu do Portal mostra antes de o contexto chegar: a forma da última sessão. Só o menu
   * lê isto; permissão e tela continuam decidindo por `isDono` e `statusAfiliadoAtivo`.
   */
  const menuComIndicados = computed(() =>
    dashboard.value ? isDono.value : (formaGuardada.value?.dono ?? false),
  )
  const menuComCarteira = computed(() =>
    status.value ? statusAfiliadoAtivo.value : (formaGuardada.value?.afiliadoAtivo ?? false),
  )
  /** Virou APROVADO desde a última vez que esta sessão olhou: a moldura avisa e zera. */
  const aprovacaoRecente = ref(false)
  const parceiroNome = computed(
    () =>
      dashboard.value?.parceiro.nome ??
      nomeGuardado.value ??
      String(i18n.global.t('shell.barra.empresaProvisoria')),
  )

  function modoBloco(modo: ModoParticipacao): ModoStatusBloco {
    const bloco = modo === 'afiliado' ? status.value?.afiliado : status.value?.participativo

    return (
      bloco ?? { status: 'NAO_SOLICITADO', motivo: null, decididoEm: null, podeSolicitar: false }
    )
  }

  function readStoredParceiroId() {
    return lerDoArmazenamento(PARCEIRO_ID_STORAGE_KEY)
  }

  /** Compara o credenciamento de agora com o último visto e guarda o de agora. */
  function anotarAuditoria(id: string, atual: PortalStatus['statusAuditoria'] | null) {
    /* Por empresa, e fica depois do logout: quem sai à noite e é aprovada de madrugada vê o
       aviso ao entrar de novo. */
    const chave = `${PARCEIRO_AUDITORIA_STORAGE_KEY}:${id}`
    const anterior = lerDoArmazenamento(chave)

    if (anterior === 'PENDENTE' && atual === 'APROVADO') {
      aprovacaoRecente.value = true
    }

    if (typeof window === 'undefined') {
      return
    }

    try {
      if (atual) {
        window.localStorage.setItem(chave, atual)
      } else {
        window.localStorage.removeItem(chave)
      }
    } catch {
      /* Sem armazenamento, só não há o aviso da aprovação. */
    }
  }

  function aprovacaoAvisada() {
    aprovacaoRecente.value = false
  }

  function guardarNome(nome: string | null) {
    nomeGuardado.value = nome

    if (typeof window === 'undefined') {
      return
    }

    if (nome) {
      window.localStorage.setItem(PARCEIRO_NOME_STORAGE_KEY, nome)
    } else {
      window.localStorage.removeItem(PARCEIRO_NOME_STORAGE_KEY)
    }
  }

  function guardarFormaDoMenu(forma: FormaDoMenu | null) {
    formaGuardada.value = forma

    if (typeof window === 'undefined') {
      return
    }

    try {
      if (forma) {
        window.localStorage.setItem(PARCEIRO_MENU_STORAGE_KEY, JSON.stringify(forma))
      } else {
        window.localStorage.removeItem(PARCEIRO_MENU_STORAGE_KEY)
      }
    } catch {
      /* Sem armazenamento, o menu só espera o contexto, como antes. */
    }
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

  /**
   * A carga em andamento. A moldura, o Início e os blocos dele pedem o contexto juntos ao abrir a
   * tela: sem isto, cada um disparava o próprio dashboard + status (quatro pares na mesma carga,
   * contra um limite de 60 pedidos por minuto da API).
   */
  let cargaEmAndamento: Promise<void> | null = null

  async function bootstrap(force = false) {
    if (!force && loadState.value === 'ready' && dashboard.value) {
      return
    }

    if (!force && cargaEmAndamento) {
      return cargaEmAndamento
    }

    loadState.value = 'loading'
    errorMessage.value = ''
    needsParceiroSelection.value = false
    semAcessoParceiro.value = false
    acessoEncerrado.value = false

    const carga = carregarContexto(parceiroId.value, false).finally(() => {
      if (cargaEmAndamento === carga) {
        cargaEmAndamento = null
      }
    })

    cargaEmAndamento = carga

    return carga
  }

  async function carregarContexto(idAlvo: string | null, jaRetentou: boolean): Promise<void> {
    const tinhaContexto = dashboard.value != null

    try {
      const query = idAlvo ? { parceiroId: idAlvo } : undefined
      const [dashboardData, statusData] = await Promise.all([
        getPortalDashboard(query),
        getPortalStatus(query),
      ])

      dashboard.value = dashboardData
      status.value = statusData
      setParceiroId(dashboardData.parceiro.id)
      guardarNome(dashboardData.parceiro.nome)
      guardarFormaDoMenu({
        dono: dashboardData.papel === 'DONO',
        afiliadoAtivo: statusData.afiliado?.status === 'ATIVO',
      })
      anotarAuditoria(dashboardData.parceiro.id, statusData.statusAuditoria)
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
        setParceiroId(null)
        guardarNome(null)
        guardarFormaDoMenu(null)
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

    if (dashboard.value) {
      anotarAuditoria(dashboard.value.parceiro.id, statusData.statusAuditoria)
      guardarFormaDoMenu({
        dono: isDono.value,
        afiliadoAtivo: statusData.afiliado?.status === 'ATIVO',
      })
    }
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
    acessoEncerrado.value = false
    setParceiroId(null)
    guardarNome(null)
    guardarFormaDoMenu(null)
  }

  return {
    parceiroId,
    dashboard,
    status,
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
    menuComIndicados,
    menuComCarteira,
    parceiroNome,
    modoBloco,
    setParceiroId,
    bootstrap,
    revalidarAcesso,
    refreshStatus,
    patchModoStatus,
    reset,
    aprovacaoRecente,
    aprovacaoAvisada,
  }
})
