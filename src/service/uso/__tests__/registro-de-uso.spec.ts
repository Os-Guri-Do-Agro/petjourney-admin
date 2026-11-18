/**
 * O registro de uso do portal: o que entra na fila, o que sai para a API e o que acontece em cada
 * resposta. O contrato é o de `docs/monitoramento-de-uso/plano-backend.md` (seção 6.1).
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteLocationNormalized } from 'vue-router'

import { clearAuthSession, getAccessToken, setAuthSession } from '@/service/auth/auth-session'

import {
  CAMINHO_DO_REGISTRO,
  ENVIAR_COM,
  INTERVALO_DE_ENVIO_MS,
  MAXIMO_NA_FILA,
  criarRegistroDeUso,
  instalarRegistroDeUso,
  type EventoDeTela,
} from '../registro-de-uso'

vi.mock('@/service/api', () => ({ getApiUrl: () => 'https://api.teste' }))

const Vazio = { template: '<div />' }

type Rede = (...args: Parameters<typeof fetch>) => Promise<Response>

function criarRotas() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/inicio', component: Vazio },
      { path: '/clinica/agenda', component: Vazio },
      { path: '/clinica/paciente/:petId/resumo', component: Vazio },
      { path: '/auth/login', component: Vazio },
      { path: '/agendar/:clinica', component: Vazio },
    ],
  })
}

const rotas = criarRotas()

function rota(caminho: string) {
  return rotas.resolve(caminho) as unknown as RouteLocationNormalized
}

function base64Url(objeto: unknown) {
  return btoa(JSON.stringify(objeto)).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_')
}

function entrarComo(userId: string) {
  const agora = Math.floor(Date.now() / 1000)
  const token = `${base64Url({ alg: 'none' })}.${base64Url({
    userId,
    email: `${userId}@teste.co`,
    nome: 'Pessoa de teste',
    iat: agora,
    exp: agora + 3600,
  })}.assinatura`

  setAuthSession({ access_token: token, refresh_token: `refresh-${userId}` })
  return token
}

function resposta(status: number) {
  return new Response(status === 202 ? JSON.stringify({ data: { recebidos: 1 } }) : null, {
    status,
  })
}

function criar(opcoes: Parameters<typeof criarRegistroDeUso>[0] = {}) {
  let id = 0
  const enviarPelaRede = vi.fn<Rede>(async () => resposta(202))

  const registro = criarRegistroDeUso({
    fetch: enviarPelaRede as unknown as typeof fetch,
    agora: () => new Date('2026-11-18T14:03:11.120Z'),
    novoId: () => `id-${++id}`,
    ...opcoes,
  })

  return { registro, enviarPelaRede }
}

function corpoDe(chamada: unknown[]) {
  const init = chamada[1] as RequestInit
  return JSON.parse(String(init.body)) as { versao: string; eventos: EventoDeTela[] }
}

beforeEach(() => {
  clearAuthSession()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  clearAuthSession()
})

describe('o que entra na fila', () => {
  it('registra a tela com o molde, o nome, a aba, a hora e a empresa', () => {
    entrarComo('u1')
    const { registro } = criar({ parceiroAtual: () => 'parceiro-1' })

    registro.registrarTela(rota('/clinica/paciente/pet-luna/resumo?aba=vacinas#topo'))

    expect(registro.estado().naFila).toEqual([
      {
        idCliente: 'id-2',
        tipo: 'TELA_ABERTA',
        superficie: 'PORTAL',
        rota: '/clinica/paciente/:petId/resumo',
        titulo: 'Paciente · Resumo',
        sessaoId: 'id-1',
        ocorreuEm: '2026-11-18T14:03:11.120Z',
        parceiroId: 'parceiro-1',
      },
    ])
  })

  it('nunca leva o ID, a query ou o hash da tela', () => {
    entrarComo('u1')
    const { registro } = criar()

    registro.registrarTela(rota('/clinica/paciente/pet-luna/resumo?busca=Bolota'))

    const texto = JSON.stringify(registro.estado().naFila)
    expect(texto).not.toContain('pet-luna')
    expect(texto).not.toContain('Bolota')
  })

  it('sem empresa escolhida, não manda parceiroId', () => {
    entrarComo('u1')
    const { registro } = criar({ parceiroAtual: () => null })

    registro.registrarTela(rota('/inicio'))

    expect(registro.estado().naFila[0]).not.toHaveProperty('parceiroId')
  })

  it('não registra sem sessão, nas telas de fora nem na demonstração', () => {
    const { registro } = criar()
    registro.registrarTela(rota('/clinica/agenda'))
    expect(registro.estado().naFila).toHaveLength(0)

    entrarComo('u1')
    registro.registrarTela(rota('/auth/login'))
    registro.registrarTela(rota('/agendar/bem-estar'))
    expect(registro.estado().naFila).toHaveLength(0)

    const naDemonstracao = criar({ emDemonstracao: () => true }).registro
    naDemonstracao.registrarTela(rota('/clinica/agenda'))
    expect(naDemonstracao.estado().naFila).toHaveLength(0)
  })

  it('trocar só a query não é tela nova; outro paciente é', () => {
    entrarComo('u1')
    const { registro } = criar()

    registro.registrarTela(rota('/clinica/agenda?dia=2026-11-18'))
    registro.registrarTela(rota('/clinica/agenda?dia=2026-11-19'))
    registro.registrarTela(rota('/clinica/paciente/pet-luna/resumo'))
    registro.registrarTela(rota('/clinica/paciente/pet-thor/resumo'))

    expect(registro.estado().naFila.map((evento) => evento.rota)).toEqual([
      '/clinica/agenda',
      '/clinica/paciente/:petId/resumo',
      '/clinica/paciente/:petId/resumo',
    ])
  })

  it('a aba guarda o mesmo id depois de recarregar a página', () => {
    entrarComo('u1')
    const primeira = criar().registro
    primeira.registrarTela(rota('/inicio'))

    const depoisDaRecarga = criar({ novoId: () => 'outro' }).registro
    depoisDaRecarga.registrarTela(rota('/inicio'))

    expect(depoisDaRecarga.estado().naFila[0]?.sessaoId).toBe(primeira.estado().naFila[0]?.sessaoId)
  })

  it('com a fila cheia, guarda as telas mais recentes', () => {
    entrarComo('u1')
    const enviarPelaRede = vi.fn<Rede>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const { registro } = criar({ fetch: enviarPelaRede as unknown as typeof fetch })

    for (let i = 0; i < MAXIMO_NA_FILA + 30; i++) {
      registro.registrarTela(rota(`/clinica/paciente/pet-${i}/resumo`))
    }

    expect(registro.estado().naFila).toHaveLength(MAXIMO_NA_FILA)
  })
})

describe('o envio', () => {
  it('manda o lote com o token da sessão e tira da fila quando a API recebe', async () => {
    const token = entrarComo('u1')
    const { registro, enviarPelaRede } = criar()

    registro.registrarTela(rota('/inicio'))
    registro.registrarTela(rota('/clinica/agenda'))
    await registro.enviar()

    expect(enviarPelaRede).toHaveBeenCalledTimes(1)
    const [url, init] = enviarPelaRede.mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`https://api.teste${CAMINHO_DO_REGISTRO}`)
    expect(init.method).toBe('POST')
    expect(init.keepalive).toBe(false)
    expect(new Headers(init.headers).get('Authorization')).toBe(`Bearer ${token}`)

    const corpo = corpoDe(enviarPelaRede.mock.calls[0] as unknown[])
    expect(corpo.versao).toBeTypeOf('string')
    expect(corpo.eventos.map((evento) => evento.titulo)).toEqual(['Visão geral', 'Agenda'])
    expect(registro.estado().naFila).toHaveLength(0)
  })

  it('fila vazia não chama a API', async () => {
    entrarComo('u1')
    const { registro, enviarPelaRede } = criar()

    await registro.enviar()

    expect(enviarPelaRede).not.toHaveBeenCalled()
  })

  it(`com ${ENVIAR_COM} telas na fila, sai sem esperar o intervalo`, async () => {
    entrarComo('u1')
    const { registro, enviarPelaRede } = criar()

    for (let i = 0; i < ENVIAR_COM; i++) {
      registro.registrarTela(rota(`/clinica/paciente/pet-${i}/resumo`))
    }

    await vi.waitFor(() => expect(enviarPelaRede).toHaveBeenCalledTimes(1))
    expect(corpoDe(enviarPelaRede.mock.calls[0] as unknown[]).eventos).toHaveLength(ENVIAR_COM)
  })

  it('404 (rota ainda não publicada) desliga o registro até recarregar a página', async () => {
    entrarComo('u1')
    const enviarPelaRede = vi.fn<Rede>(async () => resposta(404))
    const { registro } = criar({ fetch: enviarPelaRede as unknown as typeof fetch })

    registro.registrarTela(rota('/inicio'))
    await registro.enviar()
    registro.registrarTela(rota('/clinica/agenda'))
    await registro.enviar()

    expect(enviarPelaRede).toHaveBeenCalledTimes(1)
    expect(registro.estado()).toEqual({ desligado: true, naFila: [] })
  })

  it.each([400, 401, 403])('%i descarta o lote sem derrubar a sessão', async (status) => {
    entrarComo('u1')
    const enviarPelaRede = vi.fn<Rede>(async () => resposta(status))
    const { registro } = criar({ fetch: enviarPelaRede as unknown as typeof fetch })

    registro.registrarTela(rota('/inicio'))
    await registro.enviar()

    expect(registro.estado()).toEqual({ desligado: false, naFila: [] })
    expect(getAccessToken()).not.toBeNull()
  })

  it.each([429, 500, 503])('%i guarda o lote para o próximo ciclo', async (status) => {
    entrarComo('u1')
    const enviarPelaRede = vi.fn<Rede>(async () => resposta(status))
    const { registro } = criar({ fetch: enviarPelaRede as unknown as typeof fetch })

    registro.registrarTela(rota('/inicio'))
    await registro.enviar()

    expect(registro.estado().naFila).toHaveLength(1)

    enviarPelaRede.mockResolvedValueOnce(resposta(202))
    await registro.enviar()

    expect(registro.estado().naFila).toHaveLength(0)
  })

  it('erro de rede guarda o lote', async () => {
    entrarComo('u1')
    const enviarPelaRede = vi.fn<Rede>(async () => {
      throw new TypeError('Failed to fetch')
    })
    const { registro } = criar({ fetch: enviarPelaRede as unknown as typeof fetch })

    registro.registrarTela(rota('/inicio'))
    await registro.enviar()

    expect(registro.estado().naFila).toHaveLength(1)
  })

  it('sem sessão na hora do envio, a fila espera', async () => {
    entrarComo('u1')
    const { registro, enviarPelaRede } = criar()

    registro.registrarTela(rota('/inicio'))
    clearAuthSession()
    await registro.enviar()

    expect(enviarPelaRede).not.toHaveBeenCalled()
    expect(registro.estado().naFila).toHaveLength(1)
  })

  it('tela de uma pessoa nunca sai com o token de outra', async () => {
    entrarComo('u1')
    const { registro, enviarPelaRede } = criar()

    registro.registrarTela(rota('/inicio'))
    clearAuthSession()
    entrarComo('u2')
    registro.registrarTela(rota('/clinica/agenda'))
    await registro.enviar()

    const eventos = corpoDe(enviarPelaRede.mock.calls[0] as unknown[]).eventos
    expect(eventos.map((evento) => evento.rota)).toEqual(['/clinica/agenda'])
    expect(registro.estado().naFila).toHaveLength(0)
  })

  it('um envio por vez; ao sair, o resto vai junto, com keepalive', async () => {
    entrarComo('u1')
    let soltar: (valor: Response) => void = () => undefined
    const enviarPelaRede = vi
      .fn<Rede>()
      .mockImplementationOnce(() => new Promise<Response>((resolve) => (soltar = resolve)))
      .mockResolvedValue(resposta(202))
    const { registro } = criar({ fetch: enviarPelaRede as unknown as typeof fetch })

    registro.registrarTela(rota('/inicio'))
    const primeiro = registro.enviar()
    registro.registrarTela(rota('/clinica/agenda'))

    await registro.enviar()
    expect(enviarPelaRede).toHaveBeenCalledTimes(1)

    await registro.enviar({ aoSair: true })
    expect(enviarPelaRede).toHaveBeenCalledTimes(2)
    const [, init] = enviarPelaRede.mock.calls[1] as [string, RequestInit]
    expect(init.keepalive).toBe(true)
    expect(corpoDe(enviarPelaRede.mock.calls[1] as unknown[]).eventos.map((e) => e.rota)).toEqual([
      '/clinica/agenda',
    ])

    soltar(resposta(202))
    await primeiro
    expect(registro.estado().naFila).toHaveLength(0)
  })
})

describe('ligado ao roteador', () => {
  it('registra a navegação concluída, envia no intervalo e quando a aba some', async () => {
    vi.useFakeTimers()
    entrarComo('u1')
    const enviarPelaRede = vi.fn<Rede>(async () => resposta(202))
    const router = criarRotas()
    const { registro, desinstalar } = instalarRegistroDeUso(router, {
      fetch: enviarPelaRede as unknown as typeof fetch,
    })

    await router.push('/clinica/agenda')
    expect(registro.estado().naFila.map((evento) => evento.rota)).toEqual(['/clinica/agenda'])

    await vi.advanceTimersByTimeAsync(INTERVALO_DE_ENVIO_MS)
    expect(enviarPelaRede).toHaveBeenCalledTimes(1)

    await router.push('/inicio')
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    await vi.waitFor(() => expect(enviarPelaRede).toHaveBeenCalledTimes(2))
    const [, aoEsconder] = enviarPelaRede.mock.calls[1] ?? []
    expect(aoEsconder?.keepalive).toBe(true)

    Reflect.deleteProperty(document, 'visibilityState')
    desinstalar()
  })

  it('navegação barrada pela guarda não entra', async () => {
    entrarComo('u1')
    const router = criarRotas()
    router.beforeEach((to) => to.path !== '/clinica/agenda')
    const { registro, desinstalar } = instalarRegistroDeUso(router, {
      fetch: vi.fn<Rede>() as unknown as typeof fetch,
    })

    await router.push('/clinica/agenda')

    expect(registro.estado().naFila).toHaveLength(0)
    desinstalar()
  })
})
