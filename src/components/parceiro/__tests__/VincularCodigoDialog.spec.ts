/**
 * O modal de vincular aberto pelo link do acesso.
 *
 * O "Entrar no portal" da página do acesso, no site, traz o código até a tela de acessos
 * (`?vincular=`). A promessa é que a pessoa só confirme: as seis caixas chegam preenchidas e o
 * botão já está liberado. Sem código — o "Vincular código" de sempre — as caixas abrem vazias.
 *
 * Com o cadastro em análise, o mesmo modal guarda o código (`reivindicar`) em vez de vincular: o
 * acesso só entra na lista na aprovação. Chamar a rota errada é o defeito caro aqui, porque é
 * silencioso: `vincular` em análise volta 403, e `reivindicar` com o cadastro aprovado vincularia
 * sem o modal saber que precisa abrir o acesso.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'
import type { CompartilhamentoDetalhe, PortalStatus } from '@/service/parceiro/types'
import { useParceiroStore } from '@/stores/parceiro'

import VincularCodigoDialog from '../VincularCodigoDialog.vue'

type Servico = typeof import('@/service/parceiro/compartilhamentos-service')

const servico = vi.hoisted(() => ({
  vincularCompartilhamento: vi.fn<Servico['vincularCompartilhamento']>(),
  reivindicarCompartilhamento: vi.fn<Servico['reivindicarCompartilhamento']>(),
}))

/* Só as duas idas à rede viram dublê; normalizar e validar o código continuam os de verdade. */
vi.mock('@/service/parceiro/compartilhamentos-service', async (importOriginal) => ({
  ...(await importOriginal<Servico>()),
  ...servico,
}))

i18n.global.locale.value = 'pt'

const COM_I18N = { plugins: [i18n, PrimeVue] }

const montados: VueWrapper[] = []

beforeEach(() => {
  setActivePinia(createPinia())
  window.localStorage.clear()
  servico.vincularCompartilhamento.mockReset()
  servico.reivindicarCompartilhamento.mockReset()

  /* Rede de segurança: nada destes testes pode sair para uma API de verdade. */
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('rede desligada no teste'))),
  )

  /* O diálogo é teleportado para o `body`; sem limpar, o de um teste sobra no seguinte. */
  document.body.innerHTML = ''
})

afterEach(() => {
  /* Desmontar limpa o relógio do bloqueio do 429. */
  while (montados.length) {
    montados.pop()?.unmount()
  }

  vi.unstubAllGlobals()
})

/** Monta fechado e abre depois: é a abertura que lê o código, como na tela de acessos. */
async function abrir(codigoInicial?: string) {
  const wrapper = mount(VincularCodigoDialog, {
    props: { visible: false, codigoInicial },
    global: COM_I18N,
    attachTo: document.body,
  })

  montados.push(wrapper)

  await wrapper.setProps({ visible: true })
  await nextTick()

  return wrapper
}

function digitos() {
  return [...document.body.querySelectorAll<HTMLInputElement>('.vincular-dialog__digit')].map(
    (campo) => campo.value,
  )
}

function botaoDeVincular() {
  return document.body.querySelector<HTMLButtonElement>('.vincular-dialog__enviar')
}

function mensagemDeErro() {
  return document.body.querySelector('.vincular-dialog__error')?.textContent?.trim() ?? ''
}

const BLOCO = { status: 'NAO_SOLICITADO', motivo: null, decididoEm: null, podeSolicitar: true }

/** O cadastro do parceiro do contexto, como o `GET /status` devolve. */
function cadastro(statusAuditoria: PortalStatus['statusAuditoria'], podeOperar: boolean) {
  const store = useParceiroStore()

  store.setParceiroId('parceiro-1')
  store.status = {
    statusAuditoria,
    podeOperar,
    afiliado: BLOCO,
    participativo: BLOCO,
    statusAfiliado: 'NAO_SOLICITADO',
    statusParticipativo: 'NAO_SOLICITADO',
  } as PortalStatus

  return store
}

const DETALHE = { id: 'acesso-1', petNome: 'Thor' } as CompartilhamentoDetalhe

async function confirmar() {
  botaoDeVincular()?.click()
  await flushPromises()
}

describe('código que chega pelo link', () => {
  it('abre com as seis caixas preenchidas e o botão liberado', async () => {
    await abrir('123456')

    expect(digitos()).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(botaoDeVincular()?.disabled).toBe(false)
  })

  it('aceita o código com hífen, do jeito que o prestador o vê', async () => {
    await abrir('123-456')

    expect(digitos()).toEqual(['1', '2', '3', '4', '5', '6'])
  })

  it('código fora do formato não entra nas caixas', async () => {
    await abrir('12a')

    expect(digitos().every((valor) => !valor)).toBe(true)
    expect(botaoDeVincular()?.disabled).toBe(true)
  })
})

describe('abertura de sempre', () => {
  it('sem código, as caixas abrem vazias e o botão espera', async () => {
    await abrir()

    expect(digitos()).toHaveLength(6)
    expect(digitos().every((valor) => !valor)).toBe(true)
    expect(botaoDeVincular()?.disabled).toBe(true)
  })
})

describe('qual rota o modal chama', () => {
  it('cadastro aprovado vincula na hora e abre o acesso', async () => {
    cadastro('APROVADO', true)
    servico.vincularCompartilhamento.mockResolvedValue(DETALHE)

    const wrapper = await abrir('123456')
    await confirmar()

    expect(servico.vincularCompartilhamento).toHaveBeenCalledWith('123456', {
      parceiroId: 'parceiro-1',
    })
    expect(servico.reivindicarCompartilhamento).not.toHaveBeenCalled()
    expect(wrapper.emitted('vinculado')).toEqual([[DETALHE]])
    expect(wrapper.emitted('guardado')).toBeUndefined()
  })

  it('cadastro em análise guarda o código, fecha e avisa a tela', async () => {
    cadastro('PENDENTE', false)
    servico.reivindicarCompartilhamento.mockResolvedValue({
      reivindicado: true,
      vinculado: false,
      vinculaNaAprovacao: true,
    })

    const wrapper = await abrir('123456')
    await confirmar()

    expect(servico.reivindicarCompartilhamento).toHaveBeenCalledWith('123456', {
      parceiroId: 'parceiro-1',
    })
    expect(servico.vincularCompartilhamento).not.toHaveBeenCalled()
    expect(wrapper.emitted('guardado')).toHaveLength(1)
    expect(wrapper.emitted('vinculado')).toBeUndefined()
    expect(wrapper.emitted('update:visible')).toContainEqual([false])
  })

  it('em análise, o modal diz que guarda o código em vez de vincular', async () => {
    cadastro('PENDENTE', false)

    await abrir('123456')

    expect(botaoDeVincular()?.textContent).toContain('Guardar código')
    expect(document.body.querySelector('.vincular-dialog__lede')?.textContent).toContain(
      'o código fica guardado',
    )
  })

  it('aprovado no meio do caminho: a API vincula, o modal abre o acesso e relê o status', async () => {
    const store = cadastro('PENDENTE', false)
    const refreshStatus = vi.spyOn(store, 'refreshStatus').mockResolvedValue()
    servico.reivindicarCompartilhamento.mockResolvedValue({
      reivindicado: true,
      vinculado: true,
      vinculaNaAprovacao: false,
      compartilhamento: DETALHE,
    })

    const wrapper = await abrir('123456')
    await confirmar()

    expect(wrapper.emitted('vinculado')).toEqual([[DETALHE]])
    expect(wrapper.emitted('guardado')).toBeUndefined()
    expect(refreshStatus).toHaveBeenCalledOnce()
  })
})

describe('429', () => {
  const MUITAS_TENTATIVAS = 'Muitas tentativas. Tente de novo em alguns minutos.'

  it('guardar código: limite por origem pede alguns minutos e segura o botão', async () => {
    cadastro('PENDENTE', false)
    servico.reivindicarCompartilhamento.mockRejectedValue(
      new ApiError('ThrottlerException: Too Many Requests', 429),
    )

    const wrapper = await abrir('123456')
    await confirmar()

    expect(mensagemDeErro()).toBe(MUITAS_TENTATIVAS)
    expect(botaoDeVincular()?.disabled).toBe(true)
    expect(wrapper.emitted('update:visible')).toBeUndefined()
  })

  it('fechar e reabrir durante o descanso não deixa o botão travado sem explicação', async () => {
    cadastro('PENDENTE', false)
    servico.reivindicarCompartilhamento.mockRejectedValue(new ApiError('Too Many Requests', 429))

    const wrapper = await abrir('123456')
    await confirmar()

    await wrapper.setProps({ visible: false })
    await wrapper.setProps({ visible: true })
    await nextTick()

    expect(botaoDeVincular()?.disabled).toBe(true)
    expect(mensagemDeErro()).toBe(MUITAS_TENTATIVAS)
  })

  it('vincular: o mesmo limite, a mesma mensagem', async () => {
    cadastro('APROVADO', true)
    servico.vincularCompartilhamento.mockRejectedValue(new ApiError('Too Many Requests', 429))

    await abrir('123456')
    await confirmar()

    expect(mensagemDeErro()).toBe(MUITAS_TENTATIVAS)
    expect(botaoDeVincular()?.disabled).toBe(true)
  })

  it('teto de códigos guardados não manda esperar minutos: manda esperar a análise', async () => {
    cadastro('PENDENTE', false)
    servico.reivindicarCompartilhamento.mockRejectedValue(
      new ApiError(
        'Você já guardou muitos códigos para vincular na aprovação.',
        429,
        undefined,
        'COMPARTILHAMENTO_REIVINDICACOES_LIMITE',
      ),
    )

    await abrir('123456')
    await confirmar()

    expect(mensagemDeErro()).toBe(
      'Você já guardou muitos códigos. Aguarde a análise do seu cadastro.',
    )
    // Esperar não resolve este: o botão não fica preso num bloqueio de tempo.
    expect(botaoDeVincular()?.disabled).toBe(false)
  })
})
