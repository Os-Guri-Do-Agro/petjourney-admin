/**
 * A miniatura do QR da página pública: a imagem do WFQR quando a API a entrega, e a reserva
 * desenhada no navegador quando ela não entrega (WFQR fora, chamada que falha, imagem que não abre).
 */

import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'

import EstabelecimentoLinkPublico from '../EstabelecimentoLinkPublico.vue'

const obterQrDaPagina = vi.hoisted(() => vi.fn())

vi.mock('@/service/parceiro/estabelecimento-service', () => ({ obterQrDaPagina }))
vi.mock('primevue/usetoast', () => ({ useToast: () => ({ add: vi.fn() }) }))

i18n.global.locale.value = 'pt'

const IMAGEM = 'https://srhub.up.railway.app/q/image/Uq42EXm8'
const LINKS = [
  { tipo: 'clinica' as const, url: 'https://petjourney.health/agendar/demo' },
  { tipo: 'hotel' as const, url: 'https://petjourney.health/reservar/demo' },
]

function montar(links = LINKS) {
  return mount(EstabelecimentoLinkPublico, {
    props: { links, slug: 'demo', nome: 'Casa Demo' },
    global: {
      plugins: [i18n],
      stubs: { EstabelecimentoQrGaveta: true, Teleport: true },
    },
  })
}

function fontes(wrapper: ReturnType<typeof montar>) {
  return wrapper.findAll('img.link__imagem').map((img) => img.attributes('src'))
}

beforeEach(() => {
  obterQrDaPagina.mockReset()
})

describe('miniatura do QR da página', () => {
  it('com qrImageUrl, usa a imagem da API em 560 px e pede uma vez por página', async () => {
    obterQrDaPagina.mockResolvedValue({ qrImageUrl: IMAGEM })

    const wrapper = montar()
    await flushPromises()

    expect(fontes(wrapper)).toEqual([`${IMAGEM}?size=560`, `${IMAGEM}?size=560`])
    expect(obterQrDaPagina).toHaveBeenCalledTimes(2)
    expect(obterQrDaPagina).toHaveBeenCalledWith('CLINICA', { parceiroId: undefined })
    expect(obterQrDaPagina).toHaveBeenCalledWith('HOTEL', { parceiroId: undefined })
  })

  it('com qrImageUrl nulo, desenha o QR local', async () => {
    obterQrDaPagina.mockResolvedValue({ qrImageUrl: null })

    const wrapper = montar([LINKS[0]!])
    await flushPromises()

    await vi.waitFor(() => expect(fontes(wrapper)[0]).toMatch(/^data:image\/png;base64,/))
  })

  it('com a chamada falhando (429, rede), desenha o QR local', async () => {
    obterQrDaPagina.mockRejectedValue(new Error('429'))

    const wrapper = montar([LINKS[0]!])
    await flushPromises()

    await vi.waitFor(() => expect(fontes(wrapper)[0]).toMatch(/^data:image\/png;base64,/))
  })

  it('se a imagem do WFQR não abrir, troca para o QR local', async () => {
    obterQrDaPagina.mockResolvedValue({ qrImageUrl: IMAGEM })

    const wrapper = montar([LINKS[0]!])
    await flushPromises()

    await wrapper.find('img.link__imagem').trigger('error')
    await flushPromises()

    await vi.waitFor(() => expect(fontes(wrapper)[0]).toMatch(/^data:image\/png;base64,/))
  })

  it('pede o QR de novo quando o endereço muda, e só então', async () => {
    obterQrDaPagina.mockResolvedValue({ qrImageUrl: IMAGEM })

    const wrapper = montar([LINKS[0]!])
    await flushPromises()
    expect(obterQrDaPagina).toHaveBeenCalledTimes(1)

    await wrapper.setProps({
      links: [{ ...LINKS[0]!, url: 'https://petjourney.health/agendar/demo-2' }],
    })
    await flushPromises()

    expect(obterQrDaPagina).toHaveBeenCalledTimes(2)
    expect(fontes(wrapper)).toEqual([`${IMAGEM}?size=560`])
  })
})
