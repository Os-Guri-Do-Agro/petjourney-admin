/**
 * O convite para o app (pedido 4 do guia de 17/11): na gaveta da ficha ele nasce ao abrir, com
 * `canal: 'LINK'` e os pacientes do cliente; no fim do cadastro, só na primeira ação. As ações usam
 * o que a API devolve (WhatsApp, mensagem, link), e o erro mostra a `message` da API.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'
import type { Paciente } from '@/service/parceiro/pacientes-service'
import type { PropostaCriada } from '@/service/parceiro/vinculo-service'

import ConviteParaOApp from '../ConviteParaOApp.vue'

type Servico = typeof import('@/service/parceiro/vinculo-service')

const servico = vi.hoisted(() => ({
  proporVinculo: vi.fn<Servico['proporVinculo']>(),
  pacientesDoConvite: vi.fn<Servico['pacientesDoConvite']>(),
  proporPorQr: vi.fn<Servico['proporPorQr']>(),
}))
const toast = vi.hoisted(() => ({ add: vi.fn() }))

/* Só as idas à rede viram dublê; o código em dois blocos continua o de verdade. */
vi.mock('@/service/parceiro/vinculo-service', async (importOriginal) => ({
  ...(await importOriginal<Servico>()),
  ...servico,
}))
vi.mock('@/composables/useParceiroPortal', () => ({
  useParceiroPortal: () => ({
    store: { parceiroNome: 'Clínica Demo' },
    parceiroQuery: () => ({ parceiroId: 'p1' }),
  }),
}))
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))

i18n.global.locale.value = 'pt'

const PACIENTE = {
  id: 'pac1',
  nome: 'Bolota',
  ativo: true,
  cliente: { id: 'cli1', nome: 'Marina Prado', email: 'marina@exemplo.test', telefone: null },
} as unknown as Paciente

const CONVITE: PropostaCriada = {
  id: 'pr1',
  canal: 'PROPOSTA_LINK',
  status: 'PENDENTE',
  expiraEm: '2026-11-24T15:10:00.000Z',
  codigo: 'K7MQX3PA',
  link: 'https://petjourney.health/clinica/vinculo/tok',
  mensagem: 'Olá, Marina! A Clínica Demo convida...',
  whatsappUrl: 'https://wa.me/5511988887701?text=Ol%C3%A1',
  canceladas: 0,
}

const montados: VueWrapper[] = []

function montar(props: { criarAoAbrir?: boolean; paciente?: Paciente } = {}) {
  const wrapper = mount(ConviteParaOApp, {
    props: { paciente: PACIENTE, ...props },
    global: { plugins: [i18n, PrimeVue], stubs: { Teleport: true } },
  })
  montados.push(wrapper)

  return wrapper
}

function botao(wrapper: VueWrapper, texto: string) {
  const achado = wrapper.findAll('button').find((b) => b.text().includes(texto))
  if (!achado) throw new Error(`sem o botão "${texto}"`)

  return achado
}

beforeEach(() => {
  servico.proporVinculo.mockReset()
  servico.pacientesDoConvite.mockReset()
  servico.proporPorQr.mockReset()
  toast.add.mockReset()
  servico.pacientesDoConvite.mockResolvedValue([
    { id: 'pac1', nome: 'Bolota' },
    { id: 'pac2', nome: 'Tofu' },
  ])

  /* Rede de segurança: nada destes testes pode sair para uma API de verdade. */
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('rede desligada no teste'))),
  )
})

afterEach(() => {
  while (montados.length) montados.pop()?.unmount()
  vi.unstubAllGlobals()
})

describe('convite para o app', () => {
  it('na gaveta, nasce ao abrir com LINK e os pacientes do cliente, e mostra a validade', async () => {
    servico.proporVinculo.mockResolvedValue(CONVITE)

    const wrapper = montar({ criarAoAbrir: true })
    await flushPromises()

    expect(servico.proporVinculo).toHaveBeenCalledExactlyOnceWith(
      'cli1',
      ['pac1', 'pac2'],
      'LINK',
      { parceiroId: 'p1' },
    )
    expect(wrapper.text()).toContain('Convite para Bolota e Tofu.')
    expect(wrapper.text()).toMatch(/Vale até 24 de novembro/)
    expect(wrapper.text()).not.toContain('O convite anterior deixou de valer.')
    expect(wrapper.emitted('mudou')).toHaveLength(1)
  })

  it('com canceladas > 0, avisa que o convite anterior deixou de valer', async () => {
    servico.proporVinculo.mockResolvedValue({ ...CONVITE, canceladas: 1 })

    const wrapper = montar({ criarAoAbrir: true })
    await flushPromises()

    expect(wrapper.text()).toContain('O convite anterior deixou de valer.')
  })

  it('"Enviar pelo WhatsApp" abre o whatsappUrl da API em uma aba nova', async () => {
    servico.proporVinculo.mockResolvedValue(CONVITE)
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)

    const wrapper = montar({ criarAoAbrir: true })
    await flushPromises()
    await botao(wrapper, 'Enviar pelo WhatsApp').trigger('click')
    await flushPromises()

    expect(abrir).toHaveBeenCalledWith(CONVITE.whatsappUrl, '_blank', 'noopener')
    expect(servico.proporVinculo).toHaveBeenCalledTimes(1)
    abrir.mockRestore()
  })

  it('"Copiar mensagem" copia a mensagem pronta da API', async () => {
    servico.proporVinculo.mockResolvedValue(CONVITE)
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    const wrapper = montar({ criarAoAbrir: true })
    await flushPromises()
    await botao(wrapper, 'Copiar mensagem').trigger('click')
    await flushPromises()

    expect(writeText).toHaveBeenCalledWith(CONVITE.mensagem)
    expect(toast.add).toHaveBeenCalledWith(expect.objectContaining({ summary: 'Mensagem copiada' }))
  })

  it('"Mostrar QR" abre o QR em tela cheia com o código em dois blocos', async () => {
    servico.proporVinculo.mockResolvedValue(CONVITE)

    const wrapper = montar({ criarAoAbrir: true })
    await flushPromises()
    await botao(wrapper, 'Mostrar QR').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.cv-qr__codigo').exists()).toBe(true))

    expect(wrapper.find('.cv-qr__codigo').text()).toBe('K7MQ-X3PA')
    expect(wrapper.find('.cv-qr__imagem').attributes('src')).toMatch(/^data:image\/png;base64,/)
    expect(wrapper.find('.cv-qr__como').text()).toContain('Ou digite o código K7MQ-X3PA.')
  })

  it('Escape com o QR aberto fecha só o QR: a gaveta de baixo não recebe a tecla', async () => {
    servico.proporVinculo.mockResolvedValue(CONVITE)
    /* O ouvinte do `document` faz o papel do Drawer da gaveta, que fecha no Escape. */
    const gavetaDeBaixo = vi.fn()
    document.addEventListener('keydown', gavetaDeBaixo)

    const wrapper = montar({ criarAoAbrir: true })
    await flushPromises()
    await botao(wrapper, 'Mostrar QR').trigger('click')
    await vi.waitFor(() => expect(wrapper.find('.cv-qr__codigo').exists()).toBe(true))

    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    )
    await flushPromises()

    expect(gavetaDeBaixo).not.toHaveBeenCalled()
    await vi.waitFor(() => expect(wrapper.find('.cv-qr__codigo').exists()).toBe(false))

    /* QR fechado: o Escape volta a ser da gaveta. */
    document.body.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true }),
    )
    expect(gavetaDeBaixo).toHaveBeenCalledTimes(1)
    document.removeEventListener('keydown', gavetaDeBaixo)
  })

  it('"Enviar por e-mail" só aparece com e-mail no cadastro, e manda EMAIL', async () => {
    servico.proporVinculo.mockResolvedValueOnce(CONVITE).mockResolvedValueOnce({
      ...CONVITE,
      canal: 'PROPOSTA_EMAIL',
      codigo: null,
      link: null,
      mensagem: null,
      whatsappUrl: null,
      canceladas: 1,
    })

    const semEmail = montar({
      criarAoAbrir: true,
      paciente: { ...PACIENTE, cliente: { ...PACIENTE.cliente, email: null } } as Paciente,
    })
    await flushPromises()
    expect(semEmail.text()).not.toContain('Enviar por e-mail')
    semEmail.unmount()
    montados.pop()
    servico.proporVinculo.mockClear()
    servico.proporVinculo.mockResolvedValueOnce({
      ...CONVITE,
      canal: 'PROPOSTA_EMAIL',
      canceladas: 1,
    })

    const wrapper = montar({ criarAoAbrir: false })
    await flushPromises()
    await botao(wrapper, 'Enviar por e-mail').trigger('click')
    await flushPromises()

    expect(servico.proporVinculo).toHaveBeenCalledExactlyOnceWith(
      'cli1',
      ['pac1', 'pac2'],
      'EMAIL',
      { parceiroId: 'p1' },
    )
    expect(wrapper.text()).toContain('Pedido enviado. O link foi para marina@exemplo.test.')
    expect(wrapper.text()).toContain('O convite anterior deixou de valer.')
    expect(wrapper.text()).not.toContain('Enviar pelo WhatsApp')
  })

  it('no fim do cadastro, o convite só nasce na primeira ação', async () => {
    servico.proporVinculo.mockResolvedValue(CONVITE)
    const abrir = vi.spyOn(window, 'open').mockReturnValue(null)

    const wrapper = montar()
    await flushPromises()
    expect(servico.proporVinculo).not.toHaveBeenCalled()

    await botao(wrapper, 'Enviar pelo WhatsApp').trigger('click')
    await flushPromises()

    expect(servico.proporVinculo).toHaveBeenCalledExactlyOnceWith(
      'cli1',
      ['pac1', 'pac2'],
      'LINK',
      { parceiroId: 'p1' },
    )
    expect(abrir).toHaveBeenCalledWith(CONVITE.whatsappUrl, '_blank', 'noopener')
    abrir.mockRestore()
  })

  it('o teto do dia (429) mostra a message da API, sem "Tentar de novo"', async () => {
    servico.proporVinculo.mockRejectedValue(
      new ApiError(
        'Limite diário de propostas atingido. Tente amanhã.',
        429,
        undefined,
        undefined,
        {
          codigo: 'PROPOSTA_TETO_DIARIO',
        },
      ),
    )

    const wrapper = montar({ criarAoAbrir: true })
    await flushPromises()

    expect(wrapper.text()).toContain('Limite diário de propostas atingido. Tente amanhã.')
    expect(wrapper.text()).not.toContain('Tentar de novo')
    expect(wrapper.text()).not.toContain('Enviar pelo WhatsApp')
  })

  it('o 409 de paciente já ligado mostra a message, avisa a ficha e lê de novo quem entra', async () => {
    servico.proporVinculo
      .mockRejectedValueOnce(
        new ApiError('Este paciente já está ligado a um pet do app.', 409, undefined, undefined, {
          codigo: 'VINCULO_JA_ATIVO',
        }),
      )
      .mockResolvedValueOnce(CONVITE)

    const wrapper = montar({ criarAoAbrir: true })
    await flushPromises()

    expect(wrapper.text()).toContain('Este paciente já está ligado a um pet do app.')
    expect(wrapper.emitted('mudou')).toHaveLength(1)

    servico.pacientesDoConvite.mockResolvedValue([{ id: 'pac1', nome: 'Bolota' }])
    await botao(wrapper, 'Tentar de novo').trigger('click')
    await flushPromises()

    expect(servico.pacientesDoConvite).toHaveBeenCalledTimes(2)
    expect(servico.proporVinculo).toHaveBeenLastCalledWith('cli1', ['pac1'], 'LINK', {
      parceiroId: 'p1',
    })
    expect(wrapper.text()).toContain('Enviar pelo WhatsApp')
  })

  it('o 409 de paciente já ligado, com um pet só no convite, não oferece tentar de novo', async () => {
    servico.pacientesDoConvite.mockResolvedValue([{ id: 'pac1', nome: 'Bolota' }])
    servico.proporVinculo.mockRejectedValueOnce(
      new ApiError('Este pet já está vinculado a esta clínica.', 409, undefined, undefined, {
        codigo: 'VINCULO_JA_ATIVO',
      }),
    )

    const wrapper = montar({ criarAoAbrir: true })
    await flushPromises()

    expect(wrapper.text()).toContain('Este pet já está vinculado a esta clínica.')
    expect(wrapper.text()).not.toContain('Tentar de novo')
  })
})
