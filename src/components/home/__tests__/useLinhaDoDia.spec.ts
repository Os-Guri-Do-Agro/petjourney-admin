/**
 * A carga do dia da casa, módulo por módulo.
 *
 * O caso que motivou o teste: havia uma carga em voo para as duas faixas juntas. Ligar o hotel
 * enquanto a agenda da clínica ainda carregava devolvia a carga da clínica, e a pista do hotel
 * ficava no esqueleto até a reconferência de cinco minutos.
 */

import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { carregarAgendaDoDia, useLinhaDoDia } from '../useLinhaDoDia'

const obterDia = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const listarReservas = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const listarHospedes = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const obterDiaDaApi = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const lerMeuDia = vi.fn<(...args: unknown[]) => Promise<unknown>>()

vi.mock('@/service/parceiro/agenda-service', () => ({
  obterDia: (...args: unknown[]) => obterDiaDaApi(...args),
}))

vi.mock('@/service/parceiro/agenda-config-service', () => ({
  listarTipos: async () => [],
  offsetDoFuso: () => '-03:00',
}))

vi.mock('@/service/parceiro/profissionais-service', () => ({
  listarProfissionais: async () => [],
}))

vi.mock('@/service/parceiro/painel-service', () => ({
  lerMeuDia: (...args: unknown[]) => lerMeuDia(...args),
}))

vi.mock('@/features/clinico/data/repositories', () => ({
  agendaRepository: { obterDia: (...args: unknown[]) => obterDia(...args) },
}))

vi.mock('@/features/clinico/stores/clinico', () => ({
  clinicClock: {
    nowIso: () => '2026-09-28T10:12:00-04:00',
    today: () => '2026-09-28',
  },
  useClinicoStore: () => ({
    carregar: async () => {},
    erro: '',
    pet: () => null,
    tipo: () => null,
    profissional: () => null,
  }),
}))

vi.mock('@/features/hotel/data/repositories', () => ({
  reservaRepository: { listar: (...args: unknown[]) => listarReservas(...args) },
  hospedagemRepository: { listar: (...args: unknown[]) => listarHospedes(...args) },
}))

vi.mock('@/features/hotel/data/store', () => ({
  agoraIso: () => '2026-09-28T10:12:00-04:00',
  hojeIso: () => '2026-09-28',
}))

const DIA_VAZIO = {
  data: '2026-09-28',
  clinicaFechada: false,
  feriado: null,
  expediente: { inicio: '08:00', fim: '18:00' },
  almoco: null,
  profissionais: [],
  atendimentos: [],
  bloqueios: [],
}

describe('useLinhaDoDia', () => {
  it('ligar o hotel no meio da carga da agenda carrega o hotel também', async () => {
    let soltarAgenda: (dia: typeof DIA_VAZIO) => void = () => {}
    obterDia.mockReturnValue(
      new Promise((resolver) => {
        soltarAgenda = resolver
      }),
    )
    listarReservas.mockResolvedValue([])
    listarHospedes.mockResolvedValue([])

    const comHotel = ref(false)
    const escopo = effectScope()
    const dia = escopo.run(() =>
      useLinhaDoDia({ clinica: () => true, hotel: () => comHotel.value }),
    )!

    await vi.waitFor(() => expect(obterDia).toHaveBeenCalled())

    comHotel.value = true

    await vi.waitFor(() => expect(listarHospedes).toHaveBeenCalled())
    await vi.waitFor(() => expect(dia.hotel.value.carga).toBe('pronta'))

    soltarAgenda(DIA_VAZIO)

    await vi.waitFor(() => expect(dia.clinica.value.carga).toBe('pronta'))

    escopo.stop()
  })
})

/*
 * As iniciais pela API cortavam o nome em `/s+/`, na letra "s", e não no espaço: "Bisteca" virava
 * "BT" e "Bolinha de Neve", sem "s", ficava só "B".
 */
describe('as iniciais do pet pela API', () => {
  const agendamento = (id: string, nome: string, especie: string, fotoUrl: string | null) => ({
    id,
    status: 'AGENDADO',
    inicio: '2026-09-28T09:00:00-03:00',
    fim: '2026-09-28T09:30:00-03:00',
    tipoId: 'tipo-1',
    profissionalId: 'prof-1',
    chegadaEm: null,
    paciente: { id: `p-${id}`, nome, especie, fotoUrl },
  })

  it('na agenda do dia, cortam no espaço e trazem a foto e a espécie', async () => {
    obterDiaDaApi.mockResolvedValue({
      clinicaFechada: false,
      feriado: null,
      profissionais: [],
      agendamentos: [
        agendamento('a1', 'Bisteca', 'CACHORRO', 'https://cofre.exemplo/bisteca.jpg'),
        agendamento('a2', 'Bolinha de Neve', 'GATO', null),
      ],
    })

    const { contas } = await carregarAgendaDoDia('2026-09-28', true)

    expect(contas.map((conta) => conta.petIniciais)).toEqual(['B', 'BN'])
    expect(contas.map((conta) => conta.petFotoUrl)).toEqual([
      'https://cofre.exemplo/bisteca.jpg',
      '',
    ])
    expect(contas.map((conta) => conta.petEspecie)).toEqual(['canina', 'felina'])
  })

  it('no Início (meu-dia), cortam no espaço; o painel não traz foto', async () => {
    const atendimento = (id: string, pacienteNome: string) => ({
      id,
      status: 'AGENDADO',
      quando: '2026-09-28T09:00:00-03:00',
      fim: '2026-09-28T09:30:00-03:00',
      pacienteNome,
      tipoId: 'tipo-1',
      profissionalId: 'prof-1',
    })
    lerMeuDia.mockResolvedValue({
      fuso: 'America/Sao_Paulo',
      blocos: {
        salaDeEspera: { falhou: false, itens: [] },
        atendimentos: {
          falhou: false,
          itens: [atendimento('m1', 'Bisteca'), atendimento('m2', 'Bolinha de Neve')],
        },
      },
    })

    const escopo = effectScope()
    const dia = escopo.run(() =>
      useLinhaDoDia({ clinica: () => true, clinicaPelaApi: () => true, hotel: () => false }),
    )!

    await vi.waitFor(() => expect(dia.clinica.value.carga).toBe('pronta'))

    expect(dia.clinica.value.contas.map((conta) => conta.petIniciais)).toEqual(['B', 'BN'])
    expect(dia.clinica.value.contas.map((conta) => conta.petFotoUrl)).toEqual(['', ''])

    escopo.stop()
  })
})
