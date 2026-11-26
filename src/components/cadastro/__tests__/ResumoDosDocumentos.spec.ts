/**
 * O resumo dos documentos por IA na ficha (PJ-87WIZU, guia do resumo, parte 2): sem a chave
 * `documentos` no vínculo o cartão some e a rota nem sai; com ela, os estados PRONTO,
 * DESATUALIZADO e SEM_RESUMO e as recusas da tabela 2.2. As respostas são as do guia.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'
import type { ResumoDosDocumentos as Resumo } from '@/service/parceiro/leitura-do-app-service'
import type { Vinculo } from '@/service/parceiro/vinculo-service'

import ResumoDosDocumentos from '../ResumoDosDocumentos.vue'

type Leitura = typeof import('@/service/parceiro/leitura-do-app-service')
type DoVinculo = typeof import('@/service/parceiro/vinculo-service')

const servico = vi.hoisted(() => ({
  lerResumoDosDocumentos: vi.fn<Leitura['lerResumoDosDocumentos']>(),
  obterVinculo: vi.fn<DoVinculo['obterVinculo']>(),
}))

/* Só as idas à rede viram dublê; a leitura das recusas continua a de verdade. */
vi.mock('@/service/parceiro/leitura-do-app-service', async (importOriginal) => ({
  ...(await importOriginal<Leitura>()),
  lerResumoDosDocumentos: servico.lerResumoDosDocumentos,
}))
vi.mock('@/service/parceiro/vinculo-service', async (importOriginal) => ({
  ...(await importOriginal<DoVinculo>()),
  obterVinculo: servico.obterVinculo,
}))
vi.mock('@/composables/useParceiroPortal', () => ({
  useParceiroPortal: () => ({ parceiroQuery: () => ({ parceiroId: 'p1' }) }),
}))

i18n.global.locale.value = 'pt'

const AVISO =
  'Resumo feito automaticamente a partir dos documentos guardados. Pode ter erros e não substitui a avaliação do veterinário.'

function vinculo(documentos: boolean): Vinculo {
  return {
    id: 'v1',
    origem: 'PEDIDO_APP',
    ativadoEm: '2026-10-01T12:00:00.000Z',
    consentimento: { diarioCompleto: true, peso: true, notas: false, documentos },
    doDonoAtual: true,
  }
}

/** A resposta da seção 2.2 do guia. */
const PRONTO: Resumo = {
  estado: 'PRONTO',
  geradoEm: '2026-11-25T03:44:05.000Z',
  idioma: 'pt-BR',
  mudancas: null,
  aviso: AVISO,
  conteudo: {
    panorama: 'Dois exames de sangue mostram a creatinina acima da faixa do laboratório.',
    achados: [
      {
        texto: 'Creatinina 2,9 mg/dL, referência 0,8 a 1,8',
        categoria: 'FORA_DA_FAIXA',
        data: '2026-06-02',
        refs: ['Qm3kAAAABBBBCCCC'],
      },
    ],
    series: [
      {
        item: 'Creatinina',
        unidade: 'mg/dL',
        pontos: [
          {
            data: '2026-03-10',
            valor: '2,4',
            referencia: '0,8 a 1,8',
            situacao: 'ACIMA',
            ref: 'Xx1kAAAABBBBCCCC',
          },
        ],
      },
    ],
    remediosCitados: [{ nome: 'Benazepril', data: '2026-03-12', ref: 'Rr2kAAAABBBBCCCC' }],
    linhaDoTempo: [
      {
        data: '2026-06-02',
        tipo: 'EXAME_LABORATORIAL',
        titulo: 'Perfil bioquímico',
        ref: 'Qm3kAAAABBBBCCCC',
      },
    ],
    naoEntraram: 1,
  },
  documentos: [
    {
      ref: 'Qm3kAAAABBBBCCCC',
      tipo: 'EXAME_LABORATORIAL',
      data: '2026-06-02',
      titulo: 'Perfil bioquímico',
      situacao: 'INCLUIDO',
    },
  ],
}

const DESATUALIZADO: Resumo = {
  ...PRONTO,
  estado: 'DESATUALIZADO',
  mudancas: { novos: 1, alterados: 0 },
  documentos: [
    ...PRONTO.documentos,
    { ref: 'Zp9aAAAABBBBCCCC', tipo: null, data: '2026-07-01', titulo: null, situacao: 'NOVO' },
  ],
}

const SEM_RESUMO: Resumo = {
  estado: 'SEM_RESUMO',
  geradoEm: null,
  idioma: null,
  mudancas: null,
  aviso: AVISO,
  conteudo: null,
  documentos: [],
}

function erro(statusCode: number, corpo: { codigo?: string } & Record<string, unknown>) {
  const { codigo, ...detalhes } = corpo
  return new ApiError('x', statusCode, undefined, undefined, { codigo, detalhes })
}

const montados: VueWrapper[] = []

async function montar() {
  const wrapper = mount(ResumoDosDocumentos, {
    props: { pacienteId: 'pac1' },
    global: { plugins: [i18n, PrimeVue] },
  })
  montados.push(wrapper)
  await flushPromises()

  return wrapper
}

async function abrirDetalhes(wrapper: VueWrapper) {
  const botao = wrapper.findAll('button').find((b) => b.text().includes('Ver exames repetidos'))
  if (!botao) throw new Error('sem o botão de ver mais')
  await botao.trigger('click')
}

beforeEach(() => {
  servico.lerResumoDosDocumentos.mockReset()
  servico.obterVinculo.mockReset()
})

afterEach(() => {
  while (montados.length) montados.pop()!.unmount()
})

describe('sem a chave documentos', () => {
  it('o cartão não aparece e a rota não é chamada', async () => {
    servico.obterVinculo.mockResolvedValue(vinculo(false))

    const wrapper = await montar()

    expect(wrapper.find('section').exists()).toBe(false)
    expect(servico.lerResumoDosDocumentos).not.toHaveBeenCalled()
  })

  it('sem vínculo com o app, também não', async () => {
    servico.obterVinculo.mockResolvedValue(null)

    const wrapper = await montar()

    expect(wrapper.find('section').exists()).toBe(false)
    expect(servico.lerResumoDosDocumentos).not.toHaveBeenCalled()
  })
})

describe('com a chave ligada', () => {
  beforeEach(() => {
    servico.obterVinculo.mockResolvedValue(vinculo(true))
  })

  it('PRONTO: panorama, achados com data e documento, o aviso no pé', async () => {
    servico.lerResumoDosDocumentos.mockResolvedValue(PRONTO)

    const wrapper = await montar()
    const texto = wrapper.text()

    expect(servico.lerResumoDosDocumentos).toHaveBeenCalledWith('pac1', { parceiroId: 'p1' })
    expect(texto).toContain('Resumo dos documentos (feito por IA)')
    expect(texto).toContain('Dois exames de sangue mostram a creatinina')
    expect(texto).toContain('Creatinina 2,9 mg/dL, referência 0,8 a 1,8')
    expect(texto).toContain('Fora da faixa')
    expect(texto).toContain('2 de jun. de 2026 · Perfil bioquímico')
    expect(texto).toContain(AVISO)
    expect(texto).not.toContain('mais novo')
  })

  it('PRONTO: exames repetidos, remédios e linha do tempo ficam recolhidos', async () => {
    servico.lerResumoDosDocumentos.mockResolvedValue(PRONTO)

    const wrapper = await montar()
    expect(wrapper.text()).not.toContain('Benazepril')

    await abrirDetalhes(wrapper)
    const texto = wrapper.text()

    expect(texto).toContain('Exames repetidos')
    expect(texto).toContain('2,4')
    expect(texto).toContain('acima da faixa')
    expect(texto).toContain('faixa 0,8 a 1,8')
    expect(texto).toContain('Benazepril')
    expect(texto).toContain('Só o nome: a dose está no documento.')
    expect(texto).toContain('Linha do tempo')
    expect(texto).toContain('1 documento não entrou no resumo')
  })

  it('DESATUALIZADO: quantos chegaram depois, e o novo sem título na linha do tempo', async () => {
    servico.lerResumoDosDocumentos.mockResolvedValue(DESATUALIZADO)

    const wrapper = await montar()
    expect(wrapper.text()).toContain('Há 1 documento mais novo que este resumo.')

    await abrirDetalhes(wrapper)
    expect(wrapper.text()).toContain('Documento novo')
    expect(wrapper.text()).toContain('Fora deste resumo')
  })

  it('DESATUALIZADO sem documento novo: a frase geral', async () => {
    servico.lerResumoDosDocumentos.mockResolvedValue({
      ...PRONTO,
      estado: 'DESATUALIZADO',
      mudancas: { novos: 0, alterados: 2 },
    })

    const wrapper = await montar()

    expect(wrapper.text()).toContain('Os documentos mudaram depois deste resumo.')
  })

  it('SEM_RESUMO: o responsável ainda não gerou, com o aviso', async () => {
    servico.lerResumoDosDocumentos.mockResolvedValue(SEM_RESUMO)

    const wrapper = await montar()

    expect(wrapper.text()).toContain('O responsável ainda não gerou o resumo dos documentos.')
    expect(wrapper.text()).toContain(AVISO)
    expect(wrapper.text()).not.toContain('Achados')
  })

  it('403 SEM_CONSENTIMENTO (chave desligada depois do vínculo): não liberado, sem botão', async () => {
    servico.lerResumoDosDocumentos.mockRejectedValue(
      erro(403, { codigo: 'SEM_CONSENTIMENTO', chave: 'documentos' }),
    )

    const wrapper = await montar()

    expect(wrapper.text()).toContain(
      'O responsável não liberou o resumo dos documentos para esta clínica.',
    )
    expect(wrapper.find('button').exists()).toBe(false)
  })

  it('403 PET_SEM_ACESSO: sem acesso ao app deste paciente', async () => {
    servico.lerResumoDosDocumentos.mockRejectedValue(erro(403, { codigo: 'PET_SEM_ACESSO' }))

    const wrapper = await montar()

    expect(wrapper.text()).toContain('Sem acesso ao app deste paciente.')
  })

  it('429: espera e tenta de novo', async () => {
    servico.lerResumoDosDocumentos
      .mockRejectedValueOnce(
        erro(429, { codigo: 'LEITURA_APP_TAXA_EXCEDIDA', tenteDeNovoEmSegundos: 40 }),
      )
      .mockResolvedValueOnce(SEM_RESUMO)

    const wrapper = await montar()
    expect(wrapper.text()).toContain('Tente de novo em 40 s.')

    await wrapper.find('button').trigger('click')
    await flushPromises()

    expect(servico.lerResumoDosDocumentos).toHaveBeenCalledTimes(2)
    expect(wrapper.text()).toContain('O responsável ainda não gerou o resumo dos documentos.')
  })
})
