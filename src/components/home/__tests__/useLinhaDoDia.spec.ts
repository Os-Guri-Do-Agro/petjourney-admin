/**
 * A carga do dia da casa, módulo por módulo.
 *
 * O caso que motivou o teste: havia uma carga em voo para as duas faixas juntas. Ligar o hotel
 * enquanto a agenda da clínica ainda carregava devolvia a carga da clínica, e a pista do hotel
 * ficava no esqueleto até a reconferência de cinco minutos.
 */

import { describe, expect, it, vi } from 'vitest'
import { effectScope, ref } from 'vue'

import { useLinhaDoDia } from '../useLinhaDoDia'

const obterDia = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const listarReservas = vi.fn<(...args: unknown[]) => Promise<unknown>>()
const listarHospedes = vi.fn<(...args: unknown[]) => Promise<unknown>>()

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
