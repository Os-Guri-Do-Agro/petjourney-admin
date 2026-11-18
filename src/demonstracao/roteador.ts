/**
 * As rotas da API de mentira.
 *
 * Cada área registra as suas com `rota(metodo, padrao, manipulador)`. O padrão é o caminho da API
 * sem a base, com `:nome` nos pedaços variáveis (`/parceiro/portal/pacientes/:id/alertas`). O
 * pedaço fixo vence o variável: `/fila/vagas` ganha de `/fila/:id`.
 *
 * O manipulador recebe o pedido já lido e devolve a resposta inteira, como a API mandaria:
 * - `ok(dados)` → 200 com o envelope `{ statusCode, message, data }`, que quase toda rota usa;
 * - `cru(status, corpo)` → o corpo como está, para a rota que não usa o envelope;
 * - `erro(status, codigo, mensagem)` → o corpo de erro do `HttpExceptionFilter` com `codigo`;
 * - `vazio()` → 204.
 *
 * Rota que ninguém registrou responde 404 `DEMONSTRACAO_SEM_ROTA` e aparece no console e em
 * `window.__demonstracao.semRota`, para achar o que falta.
 */

export type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'

export type Pedido = {
  metodo: Metodo
  /** O caminho sem a query: `/parceiro/portal/pacientes/pac-0001`. */
  caminho: string
  /** Os pedaços `:nome` do padrão, já decodificados. */
  params: Record<string, string>
  query: URLSearchParams
  /** O corpo já lido: JSON vira objeto; `FormData` chega como está; sem corpo, `null`. */
  corpo: unknown
  headers: Headers
}

export type Resposta = { status: number; corpo: unknown }

export type Manipulador = (pedido: Pedido) => Resposta | Promise<Resposta>

type Registro = {
  metodo: Metodo
  padrao: string
  pedacos: string[]
  fixos: number
  manipulador: Manipulador
}

const registros: Registro[] = []

function pedacosDe(caminho: string) {
  return caminho.split('/').filter(Boolean)
}

/** Registra uma rota. Registrar o mesmo método e padrão de novo troca o manipulador. */
export function rota(metodo: Metodo, padrao: string, manipulador: Manipulador) {
  const pedacos = pedacosDe(padrao)
  const existente = registros.findIndex((r) => r.metodo === metodo && r.padrao === padrao)
  const registro: Registro = {
    metodo,
    padrao,
    pedacos,
    fixos: pedacos.filter((p) => !p.startsWith(':')).length,
    manipulador,
  }
  if (existente >= 0) registros[existente] = registro
  else registros.push(registro)
}

/* ------------------------------------------------------------------------------ respostas */

export function ok<T>(data: T, status = 200): Resposta {
  return { status, corpo: { statusCode: status, message: 'OK', data } }
}

export function cru(status: number, corpo: unknown): Resposta {
  return { status, corpo }
}

export function vazio(): Resposta {
  return { status: 204, corpo: null }
}

const NOME_DO_STATUS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  410: 'Gone',
  422: 'Unprocessable Entity',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
}

export function erro(
  status: number,
  codigo: string,
  message: string,
  extra: Record<string, unknown> = {},
): Resposta {
  return {
    status,
    corpo: {
      statusCode: status,
      message,
      error: NOME_DO_STATUS[status] ?? 'Bad Request',
      codigo,
      ...extra,
    },
  }
}

/* ---------------------------------------------------------------------------- o despacho */

function casar(registro: Registro, pedacos: string[]): Record<string, string> | null {
  if (registro.pedacos.length !== pedacos.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < pedacos.length; i++) {
    const esperado = registro.pedacos[i] as string
    const veio = pedacos[i] as string
    if (esperado.startsWith(':')) {
      params[esperado.slice(1)] = decodeURIComponent(veio)
    } else if (esperado !== veio) {
      return null
    }
  }
  return params
}

/** O registro que atende, o mais específico primeiro (mais pedaços fixos, e fixos mais cedo). */
function achar(metodo: Metodo, caminho: string) {
  const pedacos = pedacosDe(caminho)
  let melhor: { registro: Registro; params: Record<string, string>; peso: string } | null = null

  for (const registro of registros) {
    if (registro.metodo !== metodo) continue
    const params = casar(registro, pedacos)
    if (!params) continue
    const peso = registro.pedacos.map((p) => (p.startsWith(':') ? '0' : '1')).join('')
    if (!melhor || peso > melhor.peso) melhor = { registro, params, peso }
  }

  return melhor
}

type Diagnostico = { semRota: string[]; chamadas: string[] }

function diagnostico(): Diagnostico {
  const alvo = globalThis as { __demonstracao?: Diagnostico }
  alvo.__demonstracao ??= { semRota: [], chamadas: [] }
  return alvo.__demonstracao
}

async function lerCorpo(init: RequestInit): Promise<unknown> {
  const corpo = init.body
  if (corpo == null || corpo === '') return null
  if (typeof corpo === 'string') {
    try {
      return JSON.parse(corpo)
    } catch {
      return corpo
    }
  }
  return corpo
}

const ATRASO_MS = 90

/** Responde a chamada como a API responderia, com um `Response` de verdade. */
export async function despachar(endpoint: string, init: RequestInit): Promise<Response> {
  const metodo = (init.method ?? 'GET').toUpperCase() as Metodo
  const url = new URL(endpoint, 'https://demonstracao.local')
  const encontrado = achar(metodo, url.pathname)
  const registro = `${metodo} ${url.pathname}`

  diagnostico().chamadas.push(registro)

  let resposta: Resposta

  if (!encontrado) {
    diagnostico().semRota.push(registro)
    console.warn('[demonstração] rota sem resposta:', registro)
    resposta = erro(404, 'DEMONSTRACAO_SEM_ROTA', 'Esta parte não tem dados na demonstração.')
  } else {
    try {
      resposta = await encontrado.registro.manipulador({
        metodo,
        caminho: url.pathname,
        params: encontrado.params,
        query: url.searchParams,
        corpo: await lerCorpo(init),
        headers: new Headers(init.headers),
      })
    } catch (falha) {
      console.error('[demonstração] a rota quebrou:', registro, falha)
      resposta = erro(500, 'DEMONSTRACAO_FALHOU', 'A demonstração não conseguiu responder.')
    }
  }

  await new Promise((r) => setTimeout(r, ATRASO_MS))

  if (resposta.status === 204 || resposta.corpo === null) {
    return new Response(null, { status: resposta.status === 200 ? 204 : resposta.status })
  }

  return new Response(JSON.stringify(resposta.corpo), {
    status: resposta.status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

/* --------------------------------------------------------------------- ajuda às áreas */

/** A query `limit` com teto, ou o padrão. */
export function limiteDe(query: URLSearchParams, padrao = 20, teto = 100): number {
  const n = Number(query.get('limit'))
  return Number.isFinite(n) && n > 0 ? Math.min(n, teto) : padrao
}

/**
 * Pagina por cursor: o cursor é a posição na lista, em texto. Devolve a fatia e o próximo cursor
 * (`null` no fim), para a área montar o envelope que a rota dela usa.
 */
export function paginar<T>(
  lista: readonly T[],
  query: URLSearchParams,
  padrao = 20,
): { itens: T[]; proximoCursor: string | null } {
  const inicio = Number(query.get('cursor') ?? 0) || 0
  const limite = limiteDe(query, padrao)
  const itens = lista.slice(inicio, inicio + limite)
  const fim = inicio + limite
  return { itens, proximoCursor: fim < lista.length ? String(fim) : null }
}

/** Texto sem acento e em minúsculas, para busca. */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

/** O corpo como objeto (vazio quando não veio JSON). */
export function corpoDe<T extends object = Record<string, unknown>>(pedido: Pedido): Partial<T> {
  return pedido.corpo && typeof pedido.corpo === 'object' && !(pedido.corpo instanceof FormData)
    ? (pedido.corpo as Partial<T>)
    : {}
}
