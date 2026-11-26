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
const carteirinha = vi.hoisted(() => ({
  resolverCarteirinha:
    vi.fn<typeof import('@/service/parceiro/carteirinha-service').resolverCarteirinha>(),
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
vi.mock('@/service/parceiro/carteirinha-service', () => carteirinha)
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
  carteirinha.resolverCarteirinha.mockReset()
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
    /* N49: o app não lê QR em Minhas clínicas; a folha manda digitar o código. */
    expect(wrapper.find('.cv-qr__como').text()).toContain(
      'abra Minhas clínicas e digite o código K7MQ-X3PA.',
    )
    expect(wrapper.find('.cv-qr__como').text()).not.toContain('toque em Minhas clínicas e aponte')
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

/*
 * N19: o texto do QR da coleira (link curto, só o código ou o link antigo) vai como veio para a
 * API, que devolve o slug; o slug segue para a proposta pelo QR.
 */
describe('QR da carteirinha, em "Outras formas"', () => {
  const LINK_CURTO = 'https://srhub.up.railway.app/q/wINmrnv8'
  const SLUG = '63e2edef6b2d6f98858a06943c571ff8'

  async function abrirOutras() {
    servico.proporVinculo.mockResolvedValue(CONVITE)
    const wrapper = montar({ criarAoAbrir: true })
    await flushPromises()
    await botao(wrapper, 'Outras formas').trigger('click')

    return wrapper
  }

  it('manda o texto lido para o resolver e o slug devolvido para a proposta', async () => {
    carteirinha.resolverCarteirinha.mockResolvedValue({ publicSlug: SLUG })
    servico.proporPorQr.mockResolvedValue({ propostaId: 'pq1' })

    const wrapper = await abrirOutras()
    await wrapper.find('#cv-qr').setValue(`  ${LINK_CURTO} `)
    await botao(wrapper, 'Enviar pedido').trigger('click')
    await flushPromises()

    expect(carteirinha.resolverCarteirinha).toHaveBeenCalledExactlyOnceWith(`  ${LINK_CURTO} `, {
      parceiroId: 'p1',
    })
    expect(servico.proporPorQr).toHaveBeenCalledExactlyOnceWith(SLUG, 'pac1', { parceiroId: 'p1' })
    expect(wrapper.text()).toContain('Pedido enviado.')
  })

  it('o Enter do leitor de QR de mão manda o pedido', async () => {
    carteirinha.resolverCarteirinha.mockResolvedValue({ publicSlug: SLUG })
    servico.proporPorQr.mockResolvedValue({ propostaId: 'pq1' })

    const wrapper = await abrirOutras()
    await wrapper.find('#cv-qr').setValue('wINmrnv8')
    await wrapper.find('#cv-qr').trigger('keydown', { key: 'Enter' })
    await flushPromises()

    expect(carteirinha.resolverCarteirinha).toHaveBeenCalledWith('wINmrnv8', { parceiroId: 'p1' })
    expect(servico.proporPorQr).toHaveBeenCalledOnce()
  })

  it('campo vazio não chama a API', async () => {
    const wrapper = await abrirOutras()
    await botao(wrapper, 'Enviar pedido').trigger('click')
    await flushPromises()

    expect(carteirinha.resolverCarteirinha).not.toHaveBeenCalled()
    expect(wrapper.text()).toContain('Cole o endereço da carteirinha do pet.')
  })

  it('QR que não é de carteirinha (404) mostra a message da API e não propõe nada', async () => {
    carteirinha.resolverCarteirinha.mockRejectedValue(
      new ApiError(
        'Não encontramos uma carteirinha ativa para este QR.',
        404,
        undefined,
        undefined,
        {
          codigo: 'CARTEIRINHA_NAO_ENCONTRADA',
        },
      ),
    )

    const wrapper = await abrirOutras()
    await wrapper.find('#cv-qr').setValue('https://exemplo.test/qualquer')
    await botao(wrapper, 'Enviar pedido').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Não encontramos uma carteirinha ativa para este QR.')
    expect(servico.proporPorQr).not.toHaveBeenCalled()
  })

  it('muitas leituras no minuto (429) dizem quanto esperar', async () => {
    carteirinha.resolverCarteirinha.mockRejectedValue(
      new ApiError('Muitas leituras de QR em pouco tempo.', 429, undefined, undefined, {
        codigo: 'CARTEIRINHA_TAXA_EXCEDIDA',
        detalhes: { limite: 30, tenteDeNovoEmSegundos: 42 },
      }),
    )

    const wrapper = await abrirOutras()
    await wrapper.find('#cv-qr').setValue(LINK_CURTO)
    await botao(wrapper, 'Enviar pedido').trigger('click')
    await flushPromises()

    expect(wrapper.text()).toContain('Tente de novo em 42 segundos.')
  })

  describe('pela câmera', () => {
    const parar = vi.fn()
    const detectar = vi.fn()
    let pedirCamera: ReturnType<typeof vi.fn>

    beforeEach(() => {
      parar.mockReset()
      detectar.mockReset()
      pedirCamera = vi.fn().mockResolvedValue({ getTracks: () => [{ stop: parar }] })

      class DetectorFalso {
        static getSupportedFormats = () => Promise.resolve(['qr_code', 'ean_13'])
        detect = detectar
      }

      vi.stubGlobal('BarcodeDetector', DetectorFalso)
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: pedirCamera },
      })
      Object.defineProperty(HTMLMediaElement.prototype, 'readyState', {
        configurable: true,
        get: () => 4,
      })
      vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
    })

    afterEach(() => {
      Reflect.deleteProperty(navigator, 'mediaDevices')
      Reflect.deleteProperty(HTMLMediaElement.prototype, 'readyState')
      vi.restoreAllMocks()
    })

    it('o QR lido entra no campo, a câmera desliga e o pedido segue pelo resolver', async () => {
      detectar.mockResolvedValueOnce([]).mockResolvedValue([{ rawValue: LINK_CURTO }])
      carteirinha.resolverCarteirinha.mockResolvedValue({ publicSlug: SLUG })
      servico.proporPorQr.mockResolvedValue({ propostaId: 'pq1' })

      const wrapper = await abrirOutras()
      await flushPromises()
      await botao(wrapper, 'Ler com a câmera').trigger('click')
      await flushPromises()

      expect(pedirCamera).toHaveBeenCalledWith({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      })
      expect(wrapper.find('video').exists()).toBe(true)

      await vi.waitFor(() => expect(servico.proporPorQr).toHaveBeenCalledOnce(), { timeout: 2000 })

      expect(carteirinha.resolverCarteirinha).toHaveBeenCalledWith(LINK_CURTO, { parceiroId: 'p1' })
      expect(servico.proporPorQr).toHaveBeenCalledWith(SLUG, 'pac1', { parceiroId: 'p1' })
      expect(parar).toHaveBeenCalled()
      expect((wrapper.find('#cv-qr').element as HTMLInputElement).value).toBe(LINK_CURTO)
      await flushPromises()
      expect(wrapper.find('video').exists()).toBe(false)
    })

    it('sem permissão da câmera, explica e deixa o campo para colar', async () => {
      pedirCamera.mockRejectedValue(new DOMException('negado', 'NotAllowedError'))

      const wrapper = await abrirOutras()
      await flushPromises()
      await botao(wrapper, 'Ler com a câmera').trigger('click')
      await flushPromises()

      expect(wrapper.text()).toContain('O navegador não liberou a câmera.')
      expect(wrapper.find('video').exists()).toBe(false)
      expect(wrapper.find('#cv-qr').exists()).toBe(true)
    })

    it('fechar "Outras formas" desliga a câmera', async () => {
      detectar.mockResolvedValue([])

      const wrapper = await abrirOutras()
      await flushPromises()
      await botao(wrapper, 'Ler com a câmera').trigger('click')
      await flushPromises()
      await botao(wrapper, 'Outras formas').trigger('click')
      await flushPromises()

      expect(parar).toHaveBeenCalled()
    })
  })

  it('sem o leitor de QR no navegador, a câmera não aparece', async () => {
    const wrapper = await abrirOutras()
    await flushPromises()

    expect(wrapper.text()).not.toContain('Ler com a câmera')
    expect(wrapper.text()).toContain('Cole o endereço que o QR da coleira traz')
  })
})
