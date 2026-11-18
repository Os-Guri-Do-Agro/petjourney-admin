/**
 * Os módulos no Início (pedido 2 do guia de 17/11): o DONO liga o teste grátis, desliga com a
 * prévia do que fica só para consulta e religa. Cada botão sai dos campos da API (`podeLigar`,
 * `ligarVira`, `podeDesligar`, `podeSolicitar`, `bloqueioAoLigar`); o portal não recalcula.
 * Depois de ligar ou desligar, e em qualquer 409, o contexto é relido para o menu acompanhar.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'
import type {
  EfeitoDoDesligar,
  EuNoParceiro,
  ModuloDoPortal,
} from '@/service/parceiro/acesso-service'
import { useParceiroStore } from '@/stores/parceiro'

import HomeModulos from '../HomeModulos.vue'

type Servico = typeof import('@/service/parceiro/acesso-service')

const servico = vi.hoisted(() => ({
  ligarModulo: vi.fn<Servico['ligarModulo']>(),
  efeitoDoDesligar: vi.fn<Servico['efeitoDoDesligar']>(),
  desligarModulo: vi.fn<Servico['desligarModulo']>(),
  solicitarModulo: vi.fn<Servico['solicitarModulo']>(),
}))
const portal = vi.hoisted(() => ({ ensureContext: vi.fn<(force?: boolean) => Promise<void>>() }))
const toast = vi.hoisted(() => ({ add: vi.fn<(mensagem: Record<string, unknown>) => void>() }))

vi.mock('@/service/parceiro/acesso-service', async (importOriginal) => ({
  ...(await importOriginal<Servico>()),
  ...servico,
}))
vi.mock('@/composables/useParceiroPortal', async () => {
  const { useParceiroStore: store } = await import('@/stores/parceiro')

  return {
    useParceiroPortal: () => ({
      store: store(),
      ensureContext: portal.ensureContext,
      parceiroQuery: () => ({ parceiroId: 'p1' }),
    }),
  }
})
vi.mock('primevue/usetoast', () => ({ useToast: () => toast }))

i18n.global.locale.value = 'pt'

const montados: VueWrapper[] = []

/* Meio-dia em UTC: a data fica a mesma em qualquer fuso do teste. */
const DEZ_17 = '2026-12-17T15:00:00.000Z'

function modulo(nome: ModuloDoPortal['modulo'], campos: Partial<ModuloDoPortal> = {}) {
  return {
    modulo: nome,
    status: null,
    ativoAte: null,
    podeLer: false,
    podeEscrever: false,
    motivoSomenteLeitura: null,
    podeSolicitar: false,
    origem: null,
    desligadoPeloDono: false,
    podeLigar: false,
    ligarVira: null,
    bloqueioAoLigar: null,
    podeDesligar: false,
    diasDeTesteGratis: 30,
    ...campos,
  } satisfies ModuloDoPortal
}

/** O DONO de clínica sem nenhum módulo: teste grátis na Clínica, Hotel fora da categoria. */
const SEM_MODULO = [
  modulo('CLINICA', { podeSolicitar: true, podeLigar: true, ligarVira: 'TESTE_GRATIS' }),
  modulo('HOTEL', { podeSolicitar: true, bloqueioAoLigar: 'MODULO_FORA_DA_CATEGORIA' }),
]

/** A Clínica em teste, que o dono pode desligar. */
const CLINICA_EM_TESTE = modulo('CLINICA', {
  status: 'TESTE',
  origem: 'TESTE_GRATUITO',
  ativoAte: DEZ_17,
  podeLer: true,
  podeEscrever: true,
  bloqueioAoLigar: 'MODULO_JA_ATIVO',
  podeDesligar: true,
})

function efeito(campos: Partial<EfeitoDoDesligar> = {}): EfeitoDoDesligar {
  const base = {
    modulo: 'CLINICA' as const,
    agendamentosFuturos: 0,
    internacoesAbertas: 0,
    reservasFuturas: 0,
    hospedagensAbertas: 0,
    ...campos,
  }

  return {
    ...base,
    total:
      base.agendamentosFuturos +
      base.internacoesAbertas +
      base.reservasFuturas +
      base.hospedagensAbertas,
  }
}

beforeEach(() => {
  setActivePinia(createPinia())
  window.localStorage.clear()
  Object.values(servico).forEach((dublê) => dublê.mockReset())
  portal.ensureContext.mockReset()
  toast.add.mockReset()
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.reject(new Error('rede desligada no teste'))),
  )
  document.body.innerHTML = ''
})

afterEach(() => {
  while (montados.length) {
    montados.pop()?.unmount()
  }

  vi.unstubAllGlobals()
})

function montar(modulos: ModuloDoPortal[], elegiveis: ModuloDoPortal['modulo'][] = ['CLINICA']) {
  const store = useParceiroStore()

  store.eu = { modulos, elegiveis } as unknown as EuNoParceiro

  const wrapper = mount(HomeModulos, {
    global: { plugins: [i18n, PrimeVue] },
    attachTo: document.body,
  })

  montados.push(wrapper)

  return wrapper
}

function linha(wrapper: VueWrapper, nome: string) {
  const item = wrapper.findAll('li.modulo').find((li) => li.text().startsWith(nome))

  if (!item) {
    throw new Error(`sem a linha ${nome}`)
  }

  return item
}

function botao(wrapper: VueWrapper, nome: string, rotulo: string) {
  return linha(wrapper, nome)
    .findAll('button')
    .find((b) => b.text().includes(rotulo))
}

function dialogo() {
  return document.body.querySelector('.confirm-dialog')?.textContent ?? ''
}

function confirmarNoDialogo() {
  const desligar = [
    ...document.body.querySelectorAll<HTMLButtonElement>('.confirm-dialog button'),
  ].find((b) => b.textContent?.includes('Desligar'))

  desligar?.click()
}

function resumoDoToast() {
  const chamadas = toast.add.mock.calls

  return chamadas[chamadas.length - 1]?.[0]
}

describe('linha de cada módulo', () => {
  it('teste grátis com os dias da API, a dica embaixo e sem o "Pedir o módulo" ao lado', () => {
    const wrapper = montar([
      modulo('CLINICA', {
        podeSolicitar: true,
        podeLigar: true,
        ligarVira: 'TESTE_GRATIS',
        diasDeTesteGratis: 14,
      }),
    ])
    const clinica = linha(wrapper, 'Clínica')

    expect(clinica.text()).toContain('Combina com o seu cadastro')
    expect(clinica.text()).toContain(
      'Sem custo e sem cartão. Depois dos 14 dias, a equipe PetJourney fala com você para continuar.',
    )
    expect(botao(wrapper, 'Clínica', 'Ligar teste grátis de 14 dias')).toBeTruthy()
    expect(botao(wrapper, 'Clínica', 'Pedir o módulo')).toBeUndefined()
  })

  it('fora da categoria: o texto do código e o "Pedir o módulo", sem ligar', () => {
    const wrapper = montar(SEM_MODULO)
    const hotel = linha(wrapper, 'Hotel')

    expect(hotel.text()).toContain(
      'Este módulo não faz parte das categorias do seu cadastro, então o teste grátis não liga sozinho.',
    )
    expect(botao(wrapper, 'Hotel', 'Pedir o módulo')).toBeTruthy()
    expect(botao(wrapper, 'Hotel', 'Ligar')).toBeUndefined()
  })

  it('desligado pelo dono: a data até quando religar e o botão "Religar"', () => {
    const wrapper = montar([
      modulo('CLINICA', {
        status: 'DESLIGADO',
        ativoAte: DEZ_17,
        podeLer: true,
        motivoSomenteLeitura: 'MODULO_DESLIGADO',
        desligadoPeloDono: true,
        podeLigar: true,
        ligarVira: 'RELIGAR',
      }),
    ])

    expect(linha(wrapper, 'Clínica').text()).toContain(
      'Desligado por você. Você pode religar até 17 de dezembro.',
    )
    expect(botao(wrapper, 'Clínica', 'Religar')).toBeTruthy()
  })

  it('desligado pelo dono sem prazo: só "Desligado por você."', () => {
    const wrapper = montar([
      modulo('CLINICA', {
        status: 'DESLIGADO',
        podeLer: true,
        motivoSomenteLeitura: 'MODULO_DESLIGADO',
        desligadoPeloDono: true,
        podeLigar: true,
        ligarVira: 'RELIGAR',
      }),
    ])

    expect(linha(wrapper, 'Clínica').text()).toContain('Desligado por você.')
    expect(linha(wrapper, 'Clínica').text()).not.toContain('religar até')
  })

  it('ativo sem prazo aparece para o dono só porque ele pode desligar', () => {
    const ativo = modulo('CLINICA', {
      status: 'ATIVO',
      podeLer: true,
      podeEscrever: true,
      bloqueioAoLigar: 'MODULO_JA_ATIVO',
    })

    expect(montar([ativo]).find('li.modulo').exists()).toBe(false)

    const wrapper = montar([{ ...ativo, podeDesligar: true }])
    expect(botao(wrapper, 'Clínica', 'Desligar')).toBeTruthy()
    expect(linha(wrapper, 'Clínica').text()).not.toContain('Este módulo já está ativo.')
  })

  it('desligado pela equipe: o texto do código, sem botão', () => {
    const wrapper = montar([
      modulo('HOTEL', {
        status: 'DESLIGADO',
        podeLer: true,
        motivoSomenteLeitura: 'MODULO_DESLIGADO',
        bloqueioAoLigar: 'MODULO_DECIDIDO_PELO_SUPORTE',
      }),
    ])
    const hotel = linha(wrapper, 'Hotel')

    expect(hotel.text()).toContain(
      'A equipe PetJourney suspendeu, recusou ou desligou este módulo. Para ligá-lo de novo, fale com a equipe PetJourney.',
    )
    expect(hotel.findAll('button')).toHaveLength(0)
  })

  it('OPERADOR: os estados aparecem sem nenhum botão, com "Só o dono liga ou desliga módulos."', () => {
    const wrapper = montar([
      modulo('CLINICA', {
        status: 'TESTE',
        ativoAte: DEZ_17,
        podeLer: true,
        podeEscrever: true,
        bloqueioAoLigar: 'MODULO_GERENCIAR_APENAS_DONO',
      }),
      modulo('HOTEL', { bloqueioAoLigar: 'MODULO_GERENCIAR_APENAS_DONO' }),
    ])

    expect(wrapper.findAll('button')).toHaveLength(0)
    expect(linha(wrapper, 'Clínica').text()).toContain('Em teste até 17 de dezembro.')
    expect(linha(wrapper, 'Clínica').text()).toContain('Só o dono liga ou desliga módulos.')
    /* O Hotel nunca pedido não tem o que mostrar a quem não decide. */
    expect(wrapper.findAll('li.modulo')).toHaveLength(1)
  })
})

describe('ligar', () => {
  it('teste grátis: toast com a data e o contexto relido', async () => {
    servico.ligarModulo.mockResolvedValue({
      modulo: 'CLINICA',
      status: 'TESTE',
      origem: 'TESTE_GRATUITO',
      ativoAte: DEZ_17,
      acao: 'TESTE_GRATIS',
    })
    const wrapper = montar(SEM_MODULO)

    await botao(wrapper, 'Clínica', 'Ligar teste grátis')?.trigger('click')
    await flushPromises()

    expect(servico.ligarModulo).toHaveBeenCalledWith('CLINICA', { parceiroId: 'p1' })
    expect(resumoDoToast()).toMatchObject({
      severity: 'success',
      summary: 'Clínica: teste grátis ligado até 17 de dezembro.',
    })
    expect(portal.ensureContext).toHaveBeenCalledWith(true)
  })

  it('religar: "Clínica religada." e "Hotel religado."', async () => {
    const desligado = (nome: ModuloDoPortal['modulo']) =>
      modulo(nome, {
        status: 'DESLIGADO',
        podeLer: true,
        motivoSomenteLeitura: 'MODULO_DESLIGADO',
        desligadoPeloDono: true,
        podeLigar: true,
        ligarVira: 'RELIGAR',
      })
    servico.ligarModulo.mockImplementation(async (nome) => ({
      modulo: nome,
      status: 'ATIVO',
      origem: 'ADMIN',
      ativoAte: null,
      acao: 'RELIGADO',
    }))
    const wrapper = montar([desligado('CLINICA'), desligado('HOTEL')])

    await botao(wrapper, 'Clínica', 'Religar')?.trigger('click')
    await flushPromises()
    expect(resumoDoToast()?.summary).toBe('Clínica religada.')

    await botao(wrapper, 'Hotel', 'Religar')?.trigger('click')
    await flushPromises()
    expect(resumoDoToast()?.summary).toBe('Hotel religado.')
  })

  it('409: a mensagem da API e o contexto relido', async () => {
    servico.ligarModulo.mockRejectedValue(
      new ApiError(
        'O teste grátis deste módulo já foi usado. Para continuar com ele, fale com a equipe PetJourney.',
        409,
        undefined,
        undefined,
        { codigo: 'MODULO_TESTE_JA_USADO' },
      ),
    )
    const wrapper = montar(SEM_MODULO)

    await botao(wrapper, 'Clínica', 'Ligar teste grátis')?.trigger('click')
    await flushPromises()

    expect(resumoDoToast()).toMatchObject({
      severity: 'error',
      detail:
        'O teste grátis deste módulo já foi usado. Para continuar com ele, fale com a equipe PetJourney.',
    })
    expect(portal.ensureContext).toHaveBeenCalledWith(true)
  })

  it('429: a mensagem, sem reler o contexto', async () => {
    servico.ligarModulo.mockRejectedValue(
      new ApiError(
        'Muitas trocas neste módulo em pouco tempo. Tente de novo daqui a pouco.',
        429,
        undefined,
        undefined,
        { codigo: 'MODULO_TAXA_EXCEDIDA' },
      ),
    )
    const wrapper = montar(SEM_MODULO)

    await botao(wrapper, 'Clínica', 'Ligar teste grátis')?.trigger('click')
    await flushPromises()

    expect(resumoDoToast()?.detail).toBe(
      'Muitas trocas neste módulo em pouco tempo. Tente de novo daqui a pouco.',
    )
    expect(portal.ensureContext).not.toHaveBeenCalled()
  })
})

describe('desligar', () => {
  it('pede a prévia, mostra os números com plural e o destaque do internado', async () => {
    servico.efeitoDoDesligar.mockResolvedValue(
      efeito({ agendamentosFuturos: 3, internacoesAbertas: 1 }),
    )
    const wrapper = montar([CLINICA_EM_TESTE])

    await botao(wrapper, 'Clínica', 'Desligar')?.trigger('click')
    await flushPromises()

    expect(servico.efeitoDoDesligar).toHaveBeenCalledWith('CLINICA', { parceiroId: 'p1' })
    expect(dialogo()).toContain('Desligar a Clínica?')
    expect(dialogo()).toContain(
      'O que já foi registrado continua disponível para consulta e exportação.',
    )
    expect(dialogo()).toContain(
      'Ficam só para consulta: 3 agendamentos futuros e 1 internação em andamento.',
    )
    expect(dialogo()).toContain(
      'Há paciente internado: a equipe não vai conseguir registrar medicação nem evolução até você religar.',
    )
    expect(dialogo()).toContain(
      'Nada é cancelado nem apagado, e os responsáveis não recebem aviso.',
    )
    expect(servico.desligarModulo).not.toHaveBeenCalled()
  })

  it('só os números maiores que zero, no singular quando é 1', async () => {
    servico.efeitoDoDesligar.mockResolvedValue(efeito({ agendamentosFuturos: 1 }))
    const wrapper = montar([CLINICA_EM_TESTE])

    await botao(wrapper, 'Clínica', 'Desligar')?.trigger('click')
    await flushPromises()

    expect(dialogo()).toContain('Ficam só para consulta: 1 agendamento futuro.')
    expect(dialogo()).not.toContain('internação')
    expect(dialogo()).not.toContain('Há paciente internado')
  })

  it('Hotel: reservas e hospedagens, com o título no masculino', async () => {
    servico.efeitoDoDesligar.mockResolvedValue(
      efeito({ modulo: 'HOTEL', reservasFuturas: 2, hospedagensAbertas: 1 }),
    )
    const wrapper = montar([{ ...CLINICA_EM_TESTE, modulo: 'HOTEL' }])

    await botao(wrapper, 'Hotel', 'Desligar')?.trigger('click')
    await flushPromises()

    expect(dialogo()).toContain('Desligar o Hotel?')
    expect(dialogo()).toContain(
      'Ficam só para consulta: 2 reservas futuras e 1 hospedagem em andamento.',
    )
  })

  it('nada em andamento: "Nada em andamento será afetado."', async () => {
    servico.efeitoDoDesligar.mockResolvedValue(efeito())
    const wrapper = montar([CLINICA_EM_TESTE])

    await botao(wrapper, 'Clínica', 'Desligar')?.trigger('click')
    await flushPromises()

    expect(dialogo()).toContain('Nada em andamento será afetado.')
  })

  it('a prévia falhou: o texto sem os números, e ainda dá para desligar', async () => {
    servico.efeitoDoDesligar.mockRejectedValue(new Error('rede'))
    servico.desligarModulo.mockResolvedValue({
      modulo: 'CLINICA',
      status: 'DESLIGADO',
      efeito: efeito(),
    })
    const wrapper = montar([CLINICA_EM_TESTE])

    await botao(wrapper, 'Clínica', 'Desligar')?.trigger('click')
    await flushPromises()

    expect(dialogo()).toContain('Desligar a Clínica?')
    expect(dialogo()).not.toContain('Ficam só para consulta')
    expect(dialogo()).not.toContain('Nada em andamento será afetado.')

    confirmarNoDialogo()
    await flushPromises()

    expect(servico.desligarModulo).toHaveBeenCalledWith('CLINICA', { parceiroId: 'p1' })
    expect(resumoDoToast()).toMatchObject({ severity: 'success', summary: 'Clínica desligada.' })
    expect(portal.ensureContext).toHaveBeenCalledWith(true)
  })

  it('409 no desligar: a mensagem e o contexto relido', async () => {
    servico.efeitoDoDesligar.mockResolvedValue(efeito())
    servico.desligarModulo.mockRejectedValue(
      new ApiError('Este módulo já está desligado.', 409, undefined, undefined, {
        codigo: 'MODULO_JA_DESLIGADO',
      }),
    )
    const wrapper = montar([CLINICA_EM_TESTE])

    await botao(wrapper, 'Clínica', 'Desligar')?.trigger('click')
    await flushPromises()
    confirmarNoDialogo()
    await flushPromises()

    expect(resumoDoToast()).toMatchObject({
      severity: 'error',
      detail: 'Este módulo já está desligado.',
    })
    expect(portal.ensureContext).toHaveBeenCalledWith(true)
  })
})
