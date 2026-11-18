/**
 * A sessão da demonstração.
 *
 * Ao ligar, a sessão de verdade sai da frente (guardada no navegador) e entra uma sessão falsa da
 * dona da clínica de exemplo: o menu da conta mostra a pessoa da demonstração, não quem está
 * apresentando. Ao desligar, a sessão de verdade volta; se ela venceu nesse meio-tempo, a pessoa
 * cai na entrada e entra de novo.
 *
 * O token falso é um JWT sem assinatura (`alg: none`) que nunca vai ao servidor: com a
 * demonstração ligada, toda chamada à API é respondida aqui no navegador.
 */
import { EQUIPE, PARCEIRO_ID, USUARIO_ID } from './base/clinica'

const CHAVE_SESSAO_REAL = 'pj.demonstracao.sessao-real'
const EMISSOR = 'petjourney-demonstracao'

/** Os caches que a moldura guarda da empresa da última sessão. */
const CACHES_DA_EMPRESA = [
  'petjourney-parceiro-id',
  'petjourney-parceiro-nome',
  'petjourney-parceiro-auditoria',
  'petjourney-parceiro-menu',
]

function base64Url(objeto: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(objeto))
  let binario = ''
  bytes.forEach((b) => (binario += String.fromCharCode(b)))
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** Um par de tokens da dona da clínica de exemplo, válido por 30 dias. */
export function tokensDaDemonstracao() {
  const dona = EQUIPE.find((p) => p.usuarioId === USUARIO_ID)
  const agora = Math.floor(Date.now() / 1000)
  const corpo = {
    iss: EMISSOR,
    userId: USUARIO_ID,
    email: dona?.email ?? '',
    nome: dona?.nome ?? '',
    perfilAtivo: 'PARCEIRO',
    parceiroAtivoId: PARCEIRO_ID,
    iat: agora,
    exp: agora + 30 * 24 * 60 * 60,
  }
  const cabeca = base64Url({ alg: 'none', typ: 'JWT' })
  return {
    access_token: `${cabeca}.${base64Url(corpo)}.demonstracao`,
    refresh_token: `${cabeca}.${base64Url({ ...corpo, refresh: true })}.demonstracao`,
  }
}

export function ehTokenDaDemonstracao(token: string | null | undefined) {
  return Boolean(token?.endsWith('.demonstracao'))
}

function armazens(): Storage[] {
  try {
    return [window.sessionStorage, window.localStorage]
  } catch {
    return []
  }
}

function limparCaches() {
  for (const chave of CACHES_DA_EMPRESA) {
    try {
      window.localStorage.removeItem(chave)
    } catch {
      /* armazenamento bloqueado */
    }
  }
}

/** Guarda a sessão real e põe a da demonstração no lugar. */
export function entrarNaSessaoDaDemonstracao() {
  try {
    const local = window.localStorage
    const jaGuardada = local.getItem(CHAVE_SESSAO_REAL)
    const access =
      armazens()
        .map((a) => a.getItem('access_token'))
        .find(Boolean) ?? null
    const refresh =
      armazens()
        .map((a) => a.getItem('refresh_token'))
        .find(Boolean) ?? null

    if (!jaGuardada && access && !ehTokenDaDemonstracao(access)) {
      const naSessao = Boolean(window.sessionStorage.getItem('access_token'))
      local.setItem(CHAVE_SESSAO_REAL, JSON.stringify({ access, refresh, naSessao }))
    }

    for (const a of armazens()) {
      a.removeItem('access_token')
      a.removeItem('refresh_token')
    }
    const tokens = tokensDaDemonstracao()
    local.setItem('access_token', tokens.access_token)
    local.setItem('refresh_token', tokens.refresh_token)
  } catch {
    /* armazenamento bloqueado: a demonstração não tem como entrar */
  }
  limparCaches()
}

/** Tira a sessão da demonstração e devolve a real, se havia. */
export function sairDaSessaoDaDemonstracao() {
  try {
    const local = window.localStorage
    for (const a of armazens()) {
      const token = a.getItem('access_token')
      if (!token || ehTokenDaDemonstracao(token)) {
        a.removeItem('access_token')
        a.removeItem('refresh_token')
      }
    }

    const guardada = local.getItem(CHAVE_SESSAO_REAL)
    local.removeItem(CHAVE_SESSAO_REAL)

    if (guardada) {
      const { access, refresh, naSessao } = JSON.parse(guardada) as {
        access: string | null
        refresh: string | null
        naSessao: boolean
      }
      const destino = naSessao ? window.sessionStorage : local
      if (access) destino.setItem('access_token', access)
      if (refresh) destino.setItem('refresh_token', refresh)
    }
  } catch {
    /* armazenamento bloqueado */
  }
  limparCaches()
}

/** Com a demonstração ligada e uma sessão que não é dela (entrou de novo pela tela de entrada). */
export function garantirSessaoDaDemonstracao() {
  const access =
    armazens()
      .map((a) => a.getItem('access_token'))
      .find(Boolean) ?? null
  if (access && !ehTokenDaDemonstracao(access)) entrarNaSessaoDaDemonstracao()
}
