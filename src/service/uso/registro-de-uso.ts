import type { RouteLocationNormalized, Router } from 'vue-router'

import { getApiUrl } from '@/service/api'
import { getAccessToken, getAuthUser } from '@/service/auth/auth-session'
import { VERSAO_DO_PORTAL } from '@/utils/versao'

import { TELAS_FORA_DO_REGISTRO, tituloDaTela } from './titulos-das-telas'

/**
 * Registro de uso: cada tela que a pessoa abre no portal vai para a API, em lote, para a equipe
 * PetJourney acompanhar no CMS (Uso da plataforma). Plano em `docs/monitoramento-de-uso/`.
 *
 * O login, a saída e a troca de senha a API grava sozinha; daqui só sai `TELA_ABERTA`, e só com o
 * molde da rota (`/clinica/paciente/:petId/resumo`): nunca ID, query, hash ou o que a tela mostra.
 *
 * Nada aqui pode atrapalhar quem usa: nenhum erro chega à tela, nenhum envio derruba a sessão e a
 * navegação nunca espera. Por isso o envio usa `fetch` direto, e não o `apiFetch` (que limpa a
 * sessão no 401 e só existe para quem espera resposta), com `keepalive` quando a aba some.
 */

export const CAMINHO_DO_REGISTRO = '/uso/eventos'
/** De quanto em quanto tempo a fila sai, se tiver alguma coisa. */
export const INTERVALO_DE_ENVIO_MS = 10_000
/** Com isso na fila, sai na hora, sem esperar o intervalo. */
export const ENVIAR_COM = 20
/** O teto do lote que a API aceita. */
export const MAXIMO_POR_LOTE = 50
/** Sem API (rede caída), a fila guarda os mais recentes até aqui. */
export const MAXIMO_NA_FILA = 200
/** Teto da espera pedida pela API no 429 (`tenteDeNovoEmSegundos` ou `Retry-After`). */
export const ESPERA_MAXIMA_NO_429_MS = 60 * 60 * 1000

const CHAVE_DA_SESSAO = 'pj.uso.sessao'

export type EventoDeTela = {
  /** Gerado aqui: a API não grava duas vezes o mesmo evento reenviado. */
  idCliente: string
  tipo: 'TELA_ABERTA'
  superficie: 'PORTAL'
  rota: string
  titulo: string
  /** A aba, enquanto ela vive: agrupa uma visita. */
  sessaoId: string
  ocorreuEm: string
  parceiroId?: string
}

type NaFila = { usuarioId: string; evento: EventoDeTela }

export type OpcoesDoRegistro = {
  /** A empresa escolhida no seletor do portal, se houver. */
  parceiroAtual?: () => string | null | undefined
  /** Demonstração com dados locais: o uso não é de verdade, nada é registrado. */
  emDemonstracao?: () => boolean
  /** Para os testes. */
  fetch?: typeof fetch
  agora?: () => Date
  novoId?: () => string
}

export type EnvioDoRegistro = { aoSair?: boolean }

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** O id da aba sobrevive à recarga (sessionStorage); sem storage, vale enquanto a página vive. */
function sessaoDaAba(novoId: () => string): string {
  try {
    const guardada = window.sessionStorage.getItem(CHAVE_DA_SESSAO)

    if (guardada) {
      return guardada
    }

    const nova = novoId()
    window.sessionStorage.setItem(CHAVE_DA_SESSAO, nova)
    return nova
  } catch {
    return novoId()
  }
}

/**
 * Quanto a API pediu para esperar num 429: `tenteDeNovoEmSegundos` do corpo ou, sem ele, o
 * `Retry-After`. Sem nenhum dos dois, `null` (o lote sai no próximo ciclo, como antes).
 */
async function esperaPedidaNo429(resposta: Response): Promise<number | null> {
  let segundos = Number.NaN

  try {
    const corpo: unknown = await resposta.clone().json()

    if (corpo && typeof corpo === 'object' && 'tenteDeNovoEmSegundos' in corpo) {
      segundos = Number(corpo.tenteDeNovoEmSegundos)
    }
  } catch {
    /* Corpo que não é JSON: fica o cabeçalho. */
  }

  if (!Number.isFinite(segundos) || segundos <= 0) {
    segundos = Number(resposta.headers.get('Retry-After'))
  }

  if (!Number.isFinite(segundos) || segundos <= 0) {
    return null
  }

  return Math.min(segundos * 1000, ESPERA_MAXIMA_NO_429_MS)
}

/** O molde da rota, como o `file-routes.ts` gerou: `/clinica/paciente/:petId/resumo`. */
export function moldeDaRota(rota: RouteLocationNormalized): string | null {
  return rota.matched[rota.matched.length - 1]?.path ?? null
}

export function criarRegistroDeUso(opcoes: OpcoesDoRegistro = {}) {
  const enviarPelaRede = opcoes.fetch ?? ((...args: Parameters<typeof fetch>) => fetch(...args))
  const agora = opcoes.agora ?? (() => new Date())
  const novoId = opcoes.novoId ?? uuid

  let fila: NaFila[] = []
  const emVoo = new Set<NaFila>()
  let desligado = false
  /** Depois de um 429: nada sai antes disso (as telas continuam entrando na fila). */
  let esperarAte = 0
  let ultimaTela: string | null = null
  let sessaoId: string | null = null

  function registrarTela(rota: RouteLocationNormalized) {
    if (desligado || opcoes.emDemonstracao?.()) {
      return
    }

    const molde = moldeDaRota(rota)

    if (!molde || TELAS_FORA_DO_REGISTRO.has(molde)) {
      return
    }

    const usuarioId = getAuthUser()?.userId

    if (!usuarioId) {
      return
    }

    /* Só a query ou o hash mudou (aba, filtro): é a mesma tela. Outro paciente é outra visita. */
    const chave = `${usuarioId}|${molde}|${JSON.stringify(rota.params)}`

    if (chave === ultimaTela) {
      return
    }

    ultimaTela = chave
    sessaoId ??= sessaoDaAba(novoId)

    const parceiroId = opcoes.parceiroAtual?.() || undefined

    fila.push({
      usuarioId,
      evento: {
        idCliente: novoId(),
        tipo: 'TELA_ABERTA',
        superficie: 'PORTAL',
        rota: molde,
        titulo: tituloDaTela(molde),
        sessaoId,
        ocorreuEm: agora().toISOString(),
        ...(parceiroId ? { parceiroId } : {}),
      },
    })

    /* Fila cheia (API fora do ar): sai a tela mais antiga que não está sendo enviada. */
    while (fila.length > MAXIMO_NA_FILA) {
      const maisAntiga = fila.findIndex((item) => !emVoo.has(item))

      if (maisAntiga < 0) {
        break
      }

      fila.splice(maisAntiga, 1)
    }

    if (fila.length - emVoo.size >= ENVIAR_COM) {
      void enviar()
    }
  }

  function desligar() {
    desligado = true
    fila = []
    emVoo.clear()
  }

  function tirarDaFila(lote: NaFila[]) {
    fila = fila.filter((item) => !lote.includes(item))
  }

  /**
   * Manda o que está na fila. Um envio por vez; quando a aba some (`aoSair`), sai o resto em
   * paralelo, com `keepalive`, para não perder as últimas telas.
   */
  async function enviar({ aoSair = false }: EnvioDoRegistro = {}): Promise<void> {
    if (desligado || fila.length === 0 || (emVoo.size > 0 && !aoSair)) {
      return
    }

    /* A API pediu para esperar: nem a saída da aba manda antes da hora (levaria outro 429). */
    if (agora().getTime() < esperarAte) {
      return
    }

    const base = getApiUrl()

    if (!base) {
      desligar()
      return
    }

    const token = getAccessToken()
    const usuarioId = token ? getAuthUser()?.userId : undefined

    /* Sem sessão agora: a fila espera o refresh. Se for logout, a próxima pessoa não leva nada. */
    if (!token || !usuarioId) {
      return
    }

    fila = fila.filter((item) => item.usuarioId === usuarioId || emVoo.has(item))

    const lote = fila.filter((item) => !emVoo.has(item)).slice(0, MAXIMO_POR_LOTE)

    if (lote.length === 0) {
      return
    }

    lote.forEach((item) => emVoo.add(item))

    try {
      const resposta = await enviarPelaRede(`${base}${CAMINHO_DO_REGISTRO}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          versao: VERSAO_DO_PORTAL,
          eventos: lote.map((item) => item.evento),
        }),
        keepalive: aoSair,
      })

      if (resposta.ok) {
        tirarDaFila(lote)
        return
      }

      /* A API ainda não tem a rota: para de tentar até a página recarregar. */
      if ([404, 405, 501].includes(resposta.status)) {
        desligar()
        return
      }

      /*
       * Lote recusado (400, 413, 422) ou sessão que caiu (401, 403): reenviar não muda nada. A
       * sessão não é derrubada aqui; quem decide isso é a tela, pelo `apiFetch`.
       */
      if (resposta.status >= 400 && resposta.status < 500 && resposta.status !== 429) {
        tirarDaFila(lote)
      }

      /* 429: o lote fica e a fila espera o que a API pediu (no máximo 1 hora). */
      if (resposta.status === 429) {
        const espera = await esperaPedidaNo429(resposta)

        if (espera !== null) {
          esperarAte = agora().getTime() + espera
        }
      }
      /* 5xx: o lote fica para o próximo ciclo. */
    } catch {
      /* Rede: o lote fica para o próximo ciclo. */
    } finally {
      lote.forEach((item) => emVoo.delete(item))
    }
  }

  return {
    registrarTela,
    enviar,
    /** Para os testes e para quem quiser conferir no console. */
    estado: () => ({
      desligado,
      naFila: fila.map((item) => item.evento),
    }),
  }
}

export type RegistroDeUso = ReturnType<typeof criarRegistroDeUso>

/**
 * Liga o registro ao roteador: cada navegação concluída vira uma tela na fila; a fila sai a cada
 * `INTERVALO_DE_ENVIO_MS` e quando a aba some. Chamar antes do `app.use(router)`, para a primeira
 * tela entrar também.
 */
export function instalarRegistroDeUso(router: Router, opcoes: OpcoesDoRegistro = {}) {
  const registro = criarRegistroDeUso(opcoes)

  const pararDeOuvirRotas = router.afterEach((to, _from, falha) => {
    if (!falha) {
      registro.registrarTela(to)
    }
  })

  const intervalo = window.setInterval(() => {
    void registro.enviar()
  }, INTERVALO_DE_ENVIO_MS)

  const aoEsconder = () => {
    if (document.visibilityState === 'hidden') {
      void registro.enviar({ aoSair: true })
    }
  }
  const aoSair = () => {
    void registro.enviar({ aoSair: true })
  }

  document.addEventListener('visibilitychange', aoEsconder)
  window.addEventListener('pagehide', aoSair)

  return {
    registro,
    desinstalar() {
      pararDeOuvirRotas()
      window.clearInterval(intervalo)
      document.removeEventListener('visibilitychange', aoEsconder)
      window.removeEventListener('pagehide', aoSair)
    },
  }
}
