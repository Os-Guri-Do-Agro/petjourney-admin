/**
 * O estado do lembrete na lista de chamada (N42): limpa o que ficou no navegador uma vez, liga e
 * desliga com o parceiro do contexto, e monta o que o cartão e a gaveta mostram (entrega, motivo
 * quando não saiu, "Sem novo envio previsto").
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { LembreteDaVacinaDto } from '@/service/contrato/openapi'

const ligar = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const desligar = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock('@/composables/useParceiroPortal', () => ({
  useParceiroPortal: () => ({ parceiroQuery: () => ({ parceiroId: 'p1' }) }),
}))

/* O texto é a chave e os parâmetros: o teste confere o que vai para a tela, não a tradução. */
vi.mock('vue-i18n', async (original) => ({
  ...(await original<typeof import('vue-i18n')>()),
  useI18n: () => ({
    t: (chave: string, params?: Record<string, unknown>) =>
      params ? `${chave}(${Object.values(params).join('|')})` : chave,
    locale: { value: 'pt' },
  }),
}))

vi.mock('@/service/parceiro/lembrete-de-vacina-service', async (original) => ({
  ...(await original<typeof import('@/service/parceiro/lembrete-de-vacina-service')>()),
  ligarLembreteDaVacina: (...args: unknown[]) => ligar(...args),
  desligarLembreteDaVacina: (...args: unknown[]) => desligar(...args),
}))

const LEMBRETE: LembreteDaVacinaDto = {
  aplicacaoId: 'ap1',
  ligadoEm: '2026-11-17T11:05:31-03:00',
  ligadoPorId: 'u1',
  ultimoEnvioEm: '2026-11-17T11:05:40-03:00',
  proximoEnvioEm: '2026-12-06T09:00:00-03:00',
  envios: 1,
  entrega: 'ENTREGUE',
  motivoSemEnvio: null,
}

async function usar() {
  vi.resetModules()
  const { useLembretesDaChamada } = await import('../useLembretesDaChamada')
  return useLembretesDaChamada
}

beforeEach(() => {
  localStorage.clear()
  ligar.mockReset()
  desligar.mockReset()
})

afterEach(() => localStorage.clear())

describe('useLembretesDaChamada', () => {
  it('apaga o que ficou neste navegador na primeira vez, e só nela', async () => {
    localStorage.setItem('pj.lembretes-de-vacina.p1', '{"ap1":{}}')
    const useLembretes = await usar()

    useLembretes()
    expect(localStorage.getItem('pj.lembretes-de-vacina.p1')).toBeNull()

    localStorage.setItem('pj.lembretes-de-vacina.p1', '{}')
    useLembretes()
    expect(localStorage.getItem('pj.lembretes-de-vacina.p1')).toBe('{}')
  })

  it('liga e desliga pela API, com o parceiro do contexto', async () => {
    ligar.mockResolvedValue(LEMBRETE)
    desligar.mockResolvedValue(undefined)
    const lembretes = (await usar())()

    await expect(lembretes.ligar('ap1')).resolves.toEqual(LEMBRETE)
    await lembretes.desligar('ap1')

    expect(ligar).toHaveBeenCalledWith('ap1', { parceiroId: 'p1' })
    expect(desligar).toHaveBeenCalledWith('ap1', { parceiroId: 'p1' })
  })

  it('o cartão: entregue e o próximo previsto mostram só a entrega, no verde', async () => {
    const lembretes = (await usar())()
    expect(lembretes.resumo(LEMBRETE)).toEqual({
      icone: 'ph ph-check-circle',
      texto: 'vacinas.lembrete.entrega.ENTREGUE',
      tom: 'ok',
    })
  })

  it('o cartão: não saiu pelo teto, com o motivo e sem novo envio', async () => {
    const lembretes = (await usar())()
    expect(
      lembretes.resumo({
        ...LEMBRETE,
        entrega: 'FALHOU',
        motivoSemEnvio: 'TETO_DO_DIA',
        proximoEnvioEm: null,
      }),
    ).toEqual({
      icone: 'ph ph-warning-circle',
      texto: [
        'vacinas.lembrete.entrega.FALHOU',
        'vacinas.lembrete.motivo.TETO_DO_DIA',
        'vacinas.lembrete.semNovoEnvio',
      ].join(' · '),
      tom: 'atencao',
    })
  })

  it('o cartão: na fila, antes do primeiro envio, e nada a dizer sem entrega nem fim', async () => {
    const lembretes = (await usar())()
    expect(lembretes.resumo({ ...LEMBRETE, entrega: 'PENDENTE', ultimoEnvioEm: null })?.texto).toBe(
      'vacinas.lembrete.entrega.PENDENTE',
    )
    expect(lembretes.resumo({ ...LEMBRETE, entrega: null, ultimoEnvioEm: null })).toBeNull()
  })

  it('a gaveta: desde quando, o último envio, o motivo e o fim, nessa ordem', async () => {
    const lembretes = (await usar())()
    const linhas = lembretes.linhas({
      ...LEMBRETE,
      entrega: 'FALHOU',
      motivoSemEnvio: 'SEM_CANAL_NO_APP',
      proximoEnvioEm: null,
    })

    expect(linhas.map((l) => l.chave)).toEqual(['ligado', 'entrega', 'motivo', 'proximo'])
    expect(linhas[1]?.texto).toMatch(
      /^vacinas\.lembrete\.ultimoEnvioEm\(.+\|vacinas\.lembrete\.entrega\.FALHOU\)$/,
    )
    expect(linhas[1]?.tom).toBe('atencao')
    expect(linhas[2]?.texto).toBe('vacinas.lembrete.motivo.SEM_CANAL_NO_APP')
    expect(linhas[3]?.texto).toBe('vacinas.lembrete.semNovoEnvio')
  })

  it('a gaveta: com o próximo previsto, a data dele no lugar do "sem novo envio"', async () => {
    const lembretes = (await usar())()
    const linhas = lembretes.linhas(LEMBRETE)

    expect(linhas.map((l) => l.chave)).toEqual(['ligado', 'entrega', 'proximo'])
    expect(linhas[2]?.texto).toMatch(/^vacinas\.lembrete\.proximoEnvioEm\(/)
  })

  it('as horas são as da clínica (o offset da API), não as de quem olha', async () => {
    const lembretes = (await usar())()
    const linhas = lembretes.linhas(LEMBRETE)

    expect(linhas[0]?.texto).toBe('vacinas.lembrete.ligadoEm(17/11, 11:05)')
    expect(linhas[1]?.texto).toBe(
      'vacinas.lembrete.ultimoEnvioEm(17/11, 11:05|vacinas.lembrete.entrega.ENTREGUE)',
    )
    expect(linhas[2]?.texto).toBe('vacinas.lembrete.proximoEnvioEm(06/12, 09:00)')
  })
})
