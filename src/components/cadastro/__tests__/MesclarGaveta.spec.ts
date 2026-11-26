/**
 * Juntar cadastros (E2-01, N20/N47/N54/N55): o outro responsável sai da lista de clientes (nome ou
 * telefone, com os pacientes ativos e "Carregar mais"); o telefone curto diz que está incompleto; o
 * juntar mostra que está andando, e o limite por hora e a operação que passou do prazo dizem em
 * quanto tempo tentar de novo.
 */

import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import PrimeVue from 'primevue/config'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import i18n from '@/i18n'
import { ApiError } from '@/service/api'
import type { ClienteDaLista, Paciente } from '@/service/parceiro/pacientes-service'

import MesclarGaveta from '../MesclarGaveta.vue'

type Servico = typeof import('@/service/parceiro/pacientes-service')

const servico = vi.hoisted(() => ({
  listarClientes: vi.fn<Servico['listarClientes']>(),
  listarPacientes: vi.fn<Servico['listarPacientes']>(),
  mesclarPaciente: vi.fn<Servico['mesclarPaciente']>(),
  mesclarCliente: vi.fn<Servico['mesclarCliente']>(),
  obterCliente: vi.fn<Servico['obterCliente']>(),
}))

/* Só as idas à rede viram dublê; a busca e o telefone na tela continuam os de verdade. */
vi.mock('@/service/parceiro/pacientes-service', async (importOriginal) => ({
  ...(await importOriginal<Servico>()),
  ...servico,
}))
vi.mock('@/composables/useParceiroPortal', () => ({
  useParceiroPortal: () => ({ parceiroQuery: () => ({ parceiroId: 'p1' }) }),
}))

i18n.global.locale.value = 'pt'

const PACIENTE = {
  id: 'pac1',
  nome: 'Bolota',
  especie: 'CACHORRO',
  ativo: true,
  cliente: { id: 'cli1', nome: 'Marina Prado', telefone: '5511984112233' },
} as unknown as Paciente

function cliente(id: string, nome: string, extra: Partial<ClienteDaLista> = {}): ClienteDaLista {
  return {
    id,
    nome,
    telefone: '5511984112233',
    telefoneSecundario: null,
    email: null,
    contatoPreferido: 'WHATSAPP',
    codigoNaOrigem: null,
    ativo: true,
    inativoMotivo: null,
    mescladoEmId: null,
    anonimizadoEm: null,
    pacientesAtivos: 2,
    ...extra,
  }
}

const montados: VueWrapper[] = []

function montar(tipo: 'paciente' | 'cliente') {
  const wrapper = mount(MesclarGaveta, {
    props: { tipo, paciente: PACIENTE, visible: true },
    global: {
      plugins: [i18n, PrimeVue],
      /* A gaveta em si é do PrimeVue: aqui basta o miolo e o pé. */
      stubs: { CadastroGaveta: { template: '<div><slot /><slot name="pe" /></div>' } },
    },
  })
  montados.push(wrapper)

  return wrapper
}

function botao(wrapper: VueWrapper, texto: string) {
  const achado = wrapper.findAll('button').find((b) => b.text().includes(texto))
  if (!achado) throw new Error(`sem o botão "${texto}"`)

  return achado
}

/** Digita na busca e espera a pausa da digitação (300 ms) e a resposta. */
async function buscar(wrapper: VueWrapper, termo: string) {
  const campo = wrapper.find('#mesclar-busca')
  await campo.trigger('focus')
  await campo.setValue(termo)
  await new Promise((fim) => setTimeout(fim, 350))
  await flushPromises()
}

beforeEach(() => {
  for (const funcao of Object.values(servico)) funcao.mockReset()
  servico.listarPacientes.mockResolvedValue({
    itens: [
      {
        id: 'pac2',
        nome: 'Bolota C',
        especie: 'CACHORRO',
        fotoUrl: null,
        cliente: PACIENTE.cliente,
      },
    ] as never,
    proximoCursor: null,
  })

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

describe('juntar responsável: a lista de clientes (N54)', () => {
  it('procura pelo telefone, mostra os pacientes ativos e carrega mais pelo cursor', async () => {
    servico.listarClientes
      .mockResolvedValueOnce({ itens: [cliente('cli1', 'Marina Prado')], proximoCursor: null })
      .mockResolvedValueOnce({
        itens: [cliente('cli1', 'Marina Prado'), cliente('cli2', 'Marina P.')],
        proximoCursor: 'c2',
      })
      .mockResolvedValueOnce({
        itens: [cliente('cli3', 'Marina Prado Lima', { pacientesAtivos: 0 })],
        proximoCursor: null,
      })

    const wrapper = montar('cliente')
    await buscar(wrapper, '5511984112233')

    expect(servico.listarClientes).toHaveBeenLastCalledWith(
      { telefone: '5511984112233', limit: 20 },
      { parceiroId: 'p1' },
    )
    /* O cliente da ficha não é candidato a juntar com ele mesmo. */
    expect(wrapper.text()).not.toContain('Marina Prado ·')
    expect(wrapper.text()).toContain('Marina P.')
    expect(wrapper.text()).toContain('Pacientes ativos: 2')

    await botao(wrapper, 'Carregar mais').trigger('click')
    await flushPromises()

    expect(servico.listarClientes).toHaveBeenLastCalledWith(
      { telefone: '5511984112233', cursor: 'c2', limit: 20 },
      { parceiroId: 'p1' },
    )
    expect(wrapper.text()).toContain('Marina Prado Lima')
    expect(wrapper.text()).toContain('Pacientes ativos: 0')
  })

  it('com letras, procura pelo nome', async () => {
    servico.listarClientes.mockResolvedValue({ itens: [], proximoCursor: null })

    const wrapper = montar('cliente')
    await buscar(wrapper, 'marina')

    expect(servico.listarClientes).toHaveBeenLastCalledWith(
      { q: 'marina', limit: 20 },
      { parceiroId: 'p1' },
    )
  })

  it('o telefone curto diz que está incompleto (400 TELEFONE_INVALIDO)', async () => {
    servico.listarClientes.mockResolvedValueOnce({ itens: [], proximoCursor: null })
    servico.listarClientes.mockRejectedValueOnce(
      new ApiError('Telefone inválido.', 400, undefined, undefined, {
        codigo: 'TELEFONE_INVALIDO',
      }),
    )

    const wrapper = montar('cliente')
    await buscar(wrapper, '9841122')

    expect(wrapper.text()).toContain('Telefone incompleto')
    expect(wrapper.text()).not.toContain('Nenhum outro cadastro')
  })
})

describe('juntar paciente: a espera e os erros (N55)', () => {
  async function escolherOOutro() {
    const wrapper = montar('paciente')
    await buscar(wrapper, 'bolota')
    await botao(wrapper, 'Bolota C').trigger('click')
    await flushPromises()

    return wrapper
  }

  it('mostra que está juntando enquanto a API trabalha, e fecha ao terminar', async () => {
    let terminar: (valor: Paciente) => void = () => {}
    servico.mesclarPaciente.mockReturnValue(new Promise((fim) => (terminar = fim)))

    const wrapper = await escolherOOutro()
    await botao(wrapper, 'Juntar').trigger('click')
    await flushPromises()

    expect(servico.mesclarPaciente).toHaveBeenCalledExactlyOnceWith('pac1', 'pac2', {
      parceiroId: 'p1',
    })
    expect(wrapper.text()).toContain('Juntando os cadastros')

    terminar(PACIENTE)
    await flushPromises()

    expect(wrapper.emitted('mesclado')).toHaveLength(1)
    expect(wrapper.emitted('update:visible')).toContainEqual([false])
  })

  it('o limite por hora (429) e a operação que passou do prazo (503) dizem quando tentar', async () => {
    servico.mesclarPaciente
      .mockRejectedValueOnce(
        new ApiError('Muitos.', 429, undefined, undefined, {
          codigo: 'MESCLA_TAXA_EXCEDIDA',
          detalhes: { limite: 30, tenteDeNovoEmSegundos: 30 },
        }),
      )
      .mockRejectedValueOnce(
        new ApiError('Demorou.', 503, undefined, undefined, {
          codigo: 'OPERACAO_DEMOROU_DEMAIS',
          detalhes: { tenteDeNovoEmSegundos: 5 },
        }),
      )
      .mockRejectedValueOnce(
        new ApiError('Este cadastro está sendo alterado agora.', 409, undefined, undefined, {
          codigo: 'CADASTRO_EM_USO',
        }),
      )

    const wrapper = await escolherOOutro()

    await botao(wrapper, 'Juntar').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Tente de novo em 30 segundos.')

    await botao(wrapper, 'Juntar').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('nada mudou')
    expect(wrapper.text()).toContain('Tente de novo em 5 segundos.')

    await botao(wrapper, 'Juntar').trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain('Este cadastro está sendo alterado agora.')
    expect(wrapper.emitted('mesclado')).toBeUndefined()
  })
})
