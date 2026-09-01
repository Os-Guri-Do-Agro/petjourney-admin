/**
 * Store da agenda.
 *
 * Guarda o estado do dia carregado e o de visualização (data, visão, agrupamento, filtros).
 * O estado de visualização vive também na URL — quem manda o link para o veterinário precisa
 * que ele abra no mesmo lugar. Aqui ficam os valores; a sincronia com a query é do
 * `useAgendaUrlState`.
 *
 * Toda mutação termina em `invalidarTudo()` e recarrega o que está na tela.
 */

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'

import { agendaRepository } from '../data/repositories'
import type {
  AgendaDia,
  Appointment,
  AppointmentStatus,
  AppointmentTypeKind,
  Block,
  BlockReason,
  CancelReason,
  Conflict,
  DiaCarga,
  ISODate,
  ISODateTime,
  WeekdayIndex,
} from '../data/types'
import { addDays, startOfWeek } from '../domain/clinic-time'
import {
  detectarConflitos,
  type ConflictCandidate,
  type ConflictContext,
} from '../domain/conflicts'

import { CAPACIDADE_MINUTOS_POR_PROFISSIONAL, clinicClock, useClinicoStore } from './clinico'

export type VisaoAgenda = 'dia' | 'semana'
export type AgrupamentoAgenda = 'profissional' | 'sala'

/** Oito segundos: tempo de perceber o engano, não de mudar de ideia. */
export const DESFAZER_SEGUNDOS = 8

export type AcaoDesfazivel = {
  token: string
  /** `kind` traduzível da ação — a faixa de desfazer nomeia o que aconteceu. */
  kind: 'mover' | 'cancelar' | 'falta' | 'criar' | 'status'
  expiraEm: number
}

export const useAgendaStore = defineStore('clinico-agenda', () => {
  const clinico = useClinicoStore()

  const data = ref<ISODate>(clinicClock.today())
  const visao = ref<VisaoAgenda>('dia')
  const agrupamento = ref<AgrupamentoAgenda>('profissional')
  const filtroProfissionais = ref<string[]>([])
  const filtroStatus = ref<AppointmentStatus[]>([])
  /** Filtro por tipo de atendimento — é a legenda quem o liga e desliga. */
  const filtroTipos = ref<AppointmentTypeKind[]>([])
  const focoId = ref<string | null>(null)

  const dia = ref<AgendaDia | null>(null)
  const semanaDias = ref<DiaCarga[]>([])
  const semanaAtendimentos = ref<Appointment[]>([])

  const carregando = ref(false)
  const salvando = ref(false)
  const erro = ref('')

  const desfazer = ref<AcaoDesfazivel | null>(null)
  let desfazerTimer: ReturnType<typeof setTimeout> | null = null

  const atendimentos = computed(() => dia.value?.atendimentos ?? [])
  const bloqueios = computed<Block[]>(() => dia.value?.bloqueios ?? [])
  const clinicaFechada = computed(() => dia.value?.clinicaFechada ?? false)
  const vazio = computed(() => !carregando.value && !erro.value && atendimentos.value.length === 0)

  /** Contexto que o detector de conflitos precisa — montado uma vez, usado em toda checagem. */
  const contextoDeConflito = computed<ConflictContext | null>(() => {
    if (!clinico.clinic) {
      return null
    }

    return {
      clinic: clinico.clinic,
      clock: clinicClock,
      data: data.value,
      atendimentos: atendimentos.value,
      bloqueios: bloqueios.value,
      tipos: clinico.tipos,
      salas: clinico.salas,
      pets: clinico.pets,
      capacidadeMinutos: CAPACIDADE_MINUTOS_POR_PROFISSIONAL,
    }
  })

  function conflitosDe(candidato: ConflictCandidate): Conflict[] {
    const contexto = contextoDeConflito.value

    return contexto ? detectarConflitos(candidato, contexto) : []
  }

  async function carregarDia() {
    carregando.value = true
    erro.value = ''

    try {
      dia.value = await agendaRepository.obterDia(data.value)
    } catch {
      erro.value = 'clinico.erros.agenda'
      dia.value = null
    } finally {
      carregando.value = false
    }
  }

  async function carregarSemana() {
    try {
      const resultado = await agendaRepository.obterSemana(data.value)

      semanaDias.value = resultado.dias
      semanaAtendimentos.value = resultado.atendimentos
    } catch {
      erro.value = 'clinico.erros.agenda'
    }
  }

  async function recarregar() {
    await (visao.value === 'semana' ? Promise.all([carregarDia(), carregarSemana()]) : carregarDia())
  }

  function registrarDesfazer(token: string, kind: AcaoDesfazivel['kind']) {
    if (desfazerTimer) {
      clearTimeout(desfazerTimer)
    }

    desfazer.value = { token, kind, expiraEm: Date.now() + DESFAZER_SEGUNDOS * 1000 }
    desfazerTimer = setTimeout(() => {
      desfazer.value = null
    }, DESFAZER_SEGUNDOS * 1000)
  }

  /** Fechamento comum de toda mutação: invalida tudo e recarrega o que está na tela. */
  async function depoisDeMutar(token: string, kind: AcaoDesfazivel['kind']) {
    clinico.invalidarTudo()
    registrarDesfazer(token, kind)
    await recarregar()
  }

  async function comSalvamento<T>(acao: () => Promise<T>): Promise<T | null> {
    salvando.value = true
    erro.value = ''

    try {
      return await acao()
    } catch {
      erro.value = 'clinico.erros.mutacao'

      return null
    } finally {
      salvando.value = false
    }
  }

  async function criar(input: {
    petId: string
    tutorId: string
    professionalId: string
    roomIds: string[]
    typeId: string
    inicio: ISODateTime
    fim: ISODateTime
    encaixe: boolean
    observacao: string
    origem: Appointment['origem']
  }) {
    const resultado = await comSalvamento(() => agendaRepository.criar(input))

    if (resultado) {
      await depoisDeMutar(resultado.undoToken, 'criar')
    }

    return resultado?.atendimentos[0] ?? null
  }

  async function mover(
    id: string,
    destino: {
      inicio: ISODateTime
      fim: ISODateTime
      professionalId?: string
      /** Ausente significa "mantém as salas"; presente substitui a lista inteira. */
      roomIds?: string[]
    },
  ) {
    const resultado = await comSalvamento(() => agendaRepository.mover(id, destino))

    if (resultado) {
      await depoisDeMutar(resultado.undoToken, 'mover')
    }

    return resultado?.atendimentos ?? []
  }

  async function alterarStatus(id: string, status: AppointmentStatus) {
    const resultado = await comSalvamento(() => agendaRepository.alterarStatus(id, status))

    if (resultado) {
      await depoisDeMutar(resultado.undoToken, status === 'falta' ? 'falta' : 'status')
    }

    return resultado?.atendimentos[0] ?? null
  }

  async function cancelar(id: string, motivo: CancelReason) {
    const resultado = await comSalvamento(() => agendaRepository.cancelar(id, motivo))

    if (resultado) {
      await depoisDeMutar(resultado.undoToken, 'cancelar')
    }

    return resultado?.atendimentos[0] ?? null
  }

  async function criarBloqueio(input: {
    professionalId: string | null
    roomId: string | null
    inicio: ISODateTime
    fim: ISODateTime
    motivo: BlockReason
    detalhe: string
    weekdaysRecorrentes: WeekdayIndex[] | null
  }) {
    const bloqueio = await comSalvamento(() => agendaRepository.criarBloqueio(input))

    if (bloqueio) {
      clinico.invalidarTudo()
      await recarregar()
    }

    return bloqueio
  }

  async function removerBloqueio(id: string) {
    await comSalvamento(() => agendaRepository.removerBloqueio(id))
    clinico.invalidarTudo()
    await recarregar()
  }

  async function desfazerUltima() {
    const acao = desfazer.value

    if (!acao) {
      return false
    }

    const ok = await comSalvamento(() => agendaRepository.desfazer(acao.token))

    desfazer.value = null
    clinico.invalidarTudo()
    await recarregar()

    return ok ?? false
  }

  // ----------------------------------------------------------- navegação de data

  function irPara(novaData: ISODate) {
    data.value = novaData
  }

  function avancar(dias: number) {
    data.value = addDays(data.value, dias)
  }

  function hoje() {
    data.value = clinicClock.today()
  }

  const inicioDaSemana = computed(() => startOfWeek(data.value))

  function alternarFiltroProfissional(professionalId: string) {
    filtroProfissionais.value = filtroProfissionais.value.includes(professionalId)
      ? filtroProfissionais.value.filter((id) => id !== professionalId)
      : [...filtroProfissionais.value, professionalId]
  }

  function alternarFiltroStatus(status: AppointmentStatus) {
    filtroStatus.value = filtroStatus.value.includes(status)
      ? filtroStatus.value.filter((item) => item !== status)
      : [...filtroStatus.value, status]
  }

  function alternarFiltroTipo(kind: AppointmentTypeKind) {
    filtroTipos.value = filtroTipos.value.includes(kind)
      ? filtroTipos.value.filter((item) => item !== kind)
      : [...filtroTipos.value, kind]
  }

  function limparFiltros() {
    filtroProfissionais.value = []
    filtroStatus.value = []
    filtroTipos.value = []
  }

  return {
    data,
    visao,
    agrupamento,
    filtroProfissionais,
    filtroStatus,
    filtroTipos,
    focoId,
    dia,
    semanaDias,
    semanaAtendimentos,
    carregando,
    salvando,
    erro,
    desfazer,
    atendimentos,
    bloqueios,
    clinicaFechada,
    vazio,
    inicioDaSemana,
    contextoDeConflito,
    conflitosDe,
    carregarDia,
    carregarSemana,
    recarregar,
    criar,
    mover,
    alterarStatus,
    cancelar,
    criarBloqueio,
    removerBloqueio,
    desfazerUltima,
    irPara,
    avancar,
    hoje,
    alternarFiltroProfissional,
    alternarFiltroStatus,
    alternarFiltroTipo,
    limparFiltros,
  }
})
