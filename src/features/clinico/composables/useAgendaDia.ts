/**
 * Geometria da grade do dia.
 *
 * Transforma o dia carregado em colunas, cards posicionados e eixo de tempo. Tudo em minutos
 * de parede da clínica convertidos em pixels pelo zoom vigente — nenhuma altura literal.
 */

import { computed, ref, type Ref } from 'vue'

import type {
  Appointment,
  AppointmentType,
  Block,
  Conflict,
  Pet,
  Professional,
  Room,
  Tutor,
} from '../data/types'
import { clockToMinutes, minutesToClock } from '../domain/clinic-time'
import { ocupaHorario } from '../domain/conflicts'
import { layoutSpans, type Span } from '../domain/overlap'
import { clinicClock, useClinicoStore } from '../stores/clinico'
import { useAgendaStore } from '../stores/agenda'

import { useClinicPrefs } from './useClinicPrefs'

export type CardAgenda = {
  id: string
  appointment: Appointment
  pet: Pet | null
  tutor: Tutor | null
  tipo: AppointmentType | null
  inicioMin: number
  fimMin: number
  topPx: number
  alturaPx: number
  lane: number
  lanes: number
  conflitos: Conflict[]
  /** Cancelado e falta continuam no dia — riscados, não removidos. */
  liberouHorario: boolean
}

export type FaixaBloqueio = {
  bloqueio: Block
  topPx: number
  alturaPx: number
}

export type ColunaAgenda = {
  id: string
  titulo: string
  subtitulo: string
  cor: string
  professionalId: string | null
  roomId: string | null
  cards: CardAgenda[]
  faixas: FaixaBloqueio[]
  ocupacaoMinutos: number
  /** Minutos úteis do dia — expediente menos almoço. Zero quando a clínica não abre. */
  capacidadeMinutos: number
  /** 0..n. Acima de 1 a coluna está vendida além do expediente. */
  ocupacao: number
}

export type MarcaDeTempo = {
  minuto: number
  rotulo: string
  /** Marca de hora cheia recebe traço forte; as de 15 e 30 são discretas. */
  principal: boolean
  topPx: number
}

/** Acima disto o eixo de tempo passa a renderizar só a janela visível. */
export const LIMITE_VIRTUALIZACAO = 100

export function useAgendaDia(scrollTop: Ref<number>, alturaVisivel: Ref<number>) {
  const agenda = useAgendaStore()
  const clinico = useClinicoStore()
  const { pixelsPorMinuto, ocultarCancelados } = useClinicPrefs()

  const passoDaGrade = computed(() => clinico.clinic?.slotMinutos ?? 15)

  /**
   * Minutos úteis do dia, por coluna. É o denominador da ocupação que aparece no cabeçalho:
   * "62%" compara colunas de relance, coisa que "275 min ocupados" não faz.
   */
  const capacidadeDaColuna = computed(() => {
    const expediente = agenda.dia?.expediente

    if (!expediente || agenda.clinicaFechada) {
      return 0
    }

    const almoco = agenda.dia?.almoco
    const bruto = clockToMinutes(expediente.fim) - clockToMinutes(expediente.inicio)
    const pausa = almoco ? clockToMinutes(almoco.fim) - clockToMinutes(almoco.inicio) : 0

    return Math.max(bruto - pausa, 0)
  })

  const limites = computed(() => {
    const expediente = agenda.dia?.expediente ?? { inicio: '08:00', fim: '19:00' }
    let inicio = clockToMinutes(expediente.inicio)
    let fim = clockToMinutes(expediente.fim)

    /** Encaixe e atendimento que atravessa o fim do dia não podem cair fora da moldura. */
    for (const appointment of agenda.atendimentos) {
      inicio = Math.min(inicio, clinicClock.minutesFrom(appointment.inicio, agenda.data))
      fim = Math.max(fim, clinicClock.minutesFrom(appointment.fim, agenda.data))
    }

    for (const bloqueio of agenda.bloqueios) {
      inicio = Math.min(inicio, clinicClock.minutesFrom(bloqueio.inicio, agenda.data))
      fim = Math.max(fim, clinicClock.minutesFrom(bloqueio.fim, agenda.data))
    }

    const passo = passoDaGrade.value

    return {
      inicio: Math.floor(inicio / passo) * passo,
      fim: Math.ceil(fim / passo) * passo,
    }
  })

  const alturaTotalPx = computed(
    () => (limites.value.fim - limites.value.inicio) * pixelsPorMinuto.value,
  )

  function paraTopo(minuto: number) {
    return (minuto - limites.value.inicio) * pixelsPorMinuto.value
  }

  const totalDeMarcas = computed(
    () => Math.ceil((limites.value.fim - limites.value.inicio) / passoDaGrade.value) + 1,
  )

  const virtualizado = computed(() => totalDeMarcas.value > LIMITE_VIRTUALIZACAO)

  /**
   * Eixo de tempo. Acima de `LIMITE_VIRTUALIZACAO` linhas só a janela visível é montada, com
   * uma folga de tela para cima e para baixo — rolar não pode revelar buraco.
   */
  const marcas = computed<MarcaDeTempo[]>(() => {
    const passo = passoDaGrade.value
    const { inicio, fim } = limites.value

    let primeiro = inicio
    let ultimo = fim

    if (virtualizado.value && alturaVisivel.value > 0) {
      const folga = alturaVisivel.value
      const minutoInicial = inicio + (scrollTop.value - folga) / pixelsPorMinuto.value
      const minutoFinal = inicio + (scrollTop.value + alturaVisivel.value + folga) / pixelsPorMinuto.value

      primeiro = Math.max(inicio, Math.floor(minutoInicial / passo) * passo)
      ultimo = Math.min(fim, Math.ceil(minutoFinal / passo) * passo)
    }

    const lista: MarcaDeTempo[] = []

    for (let minuto = primeiro; minuto <= ultimo; minuto += passo) {
      lista.push({
        minuto,
        rotulo: minutesToClock(minuto),
        principal: minuto % 60 === 0,
        topPx: paraTopo(minuto),
      })
    }

    return lista
  })

  const atendimentosVisiveis = computed(() =>
    agenda.atendimentos.filter((appointment) => {
      if (ocultarCancelados.value && appointment.status === 'cancelado') {
        return false
      }

      if (
        agenda.filtroStatus.length > 0 &&
        !agenda.filtroStatus.includes(appointment.status)
      ) {
        return false
      }

      if (
        agenda.filtroProfissionais.length > 0 &&
        !agenda.filtroProfissionais.includes(appointment.professionalId)
      ) {
        return false
      }

      return true
    }),
  )

  function montarCards(lista: Appointment[]): CardAgenda[] {
    const spans: Span[] = lista.map((appointment) => ({
      id: appointment.id,
      inicioMin: clinicClock.minutesFrom(appointment.inicio, agenda.data),
      fimMin: clinicClock.minutesFrom(appointment.fim, agenda.data),
    }))

    const layouts = new Map(layoutSpans(spans).map((layout) => [layout.id, layout]))

    return lista.map((appointment) => {
      const layout = layouts.get(appointment.id)
      const inicioMin = layout?.inicioMin ?? 0
      const fimMin = layout?.fimMin ?? inicioMin + 30
      const pet = clinico.pet(appointment.petId)

      return {
        id: appointment.id,
        appointment,
        pet,
        tutor: clinico.tutor(appointment.tutorId),
        tipo: clinico.tipo(appointment.typeId),
        inicioMin,
        fimMin,
        topPx: paraTopo(inicioMin),
        /** Piso de altura: consulta de 15 min ainda precisa caber nome e hora. */
        alturaPx: Math.max((fimMin - inicioMin) * pixelsPorMinuto.value, 22),
        lane: layout?.lane ?? 0,
        lanes: layout?.lanes ?? 1,
        conflitos: agenda.conflitosDe({
          id: appointment.id,
          petId: appointment.petId,
          professionalId: appointment.professionalId,
          roomIds: appointment.roomIds,
          typeId: appointment.typeId,
          inicio: appointment.inicio,
          fim: appointment.fim,
          linkedGroupId: appointment.linkedGroupId,
        }),
        liberouHorario: !ocupaHorario(appointment),
      }
    })
  }

  function montarFaixas(filtro: (bloqueio: Block) => boolean): FaixaBloqueio[] {
    return agenda.bloqueios.filter(filtro).map((bloqueio) => {
      const inicioMin = clinicClock.minutesFrom(bloqueio.inicio, agenda.data)
      const fimMin = clinicClock.minutesFrom(bloqueio.fim, agenda.data)

      return {
        bloqueio,
        topPx: paraTopo(inicioMin),
        alturaPx: Math.max((fimMin - inicioMin) * pixelsPorMinuto.value, 8),
      }
    })
  }

  function minutosDe(lista: Appointment[]) {
    return lista
      .filter(ocupaHorario)
      .reduce(
        (total, appointment) =>
          total + clinicClock.durationMinutes(appointment.inicio, appointment.fim),
        0,
      )
  }

  function proporcao(minutos: number) {
    return capacidadeDaColuna.value > 0 ? minutos / capacidadeDaColuna.value : 0
  }

  const colunas = computed<ColunaAgenda[]>(() => {
    const lista = atendimentosVisiveis.value

    if (agenda.agrupamento === 'sala') {
      const salas: Room[] = clinico.salas.filter((sala) =>
        lista.some((appointment) => appointment.roomIds.includes(sala.id)),
      )

      return salas.map((sala, indice) => {
        const daSala = lista.filter((appointment) => appointment.roomIds.includes(sala.id))

        return {
          id: sala.id,
          titulo: sala.nome,
          subtitulo: '',
          cor: `var(--clinic-col-${indice % 6})`,
          professionalId: null,
          roomId: sala.id,
          cards: montarCards(daSala),
          faixas: montarFaixas((bloqueio) => bloqueio.roomId === sala.id),
          ocupacaoMinutos: minutosDe(daSala),
          capacidadeMinutos: capacidadeDaColuna.value,
          ocupacao: proporcao(minutosDe(daSala)),
        }
      })
    }

    const profissionais: Professional[] =
      agenda.filtroProfissionais.length > 0
        ? clinico.profissionais.filter((professional) =>
            agenda.filtroProfissionais.includes(professional.id),
          )
        : clinico.profissionais

    return profissionais.map((professional) => {
      const doProfissional = lista.filter(
        (appointment) => appointment.professionalId === professional.id,
      )

      return {
        id: professional.id,
        titulo: professional.nome,
        subtitulo: professional.conselho,
        cor: clinico.corDaColuna(professional.id),
        professionalId: professional.id,
        roomId: null,
        cards: montarCards(doProfissional),
        /*
         * Bloqueio de sala não pinta coluna de profissional: manutenção do aparelho de imagem
         * não impede a Ana de atender no consultório 1. Na coluna de profissional entram só o
         * bloqueio dela e os da clínica inteira; o de sala aparece no agrupamento por sala.
         */
        faixas: montarFaixas((bloqueio) => bloqueio.professionalId === professional.id),
        ocupacaoMinutos: minutosDe(doProfissional),
        capacidadeMinutos: capacidadeDaColuna.value,
        ocupacao: proporcao(minutosDe(doProfissional)),
      }
    })
  })

  /**
   * Bloqueio que vale para a clínica inteira — almoço, feriado, reunião geral. Antes ele era
   * repetido em cada coluna, e "ALMOÇO" aparecia cinco vezes na mesma faixa horizontal. Agora
   * é uma faixa só, atravessando a grade, com o rótulo no eixo de tempo.
   */
  const faixasDaClinica = computed<FaixaBloqueio[]>(() =>
    montarFaixas((bloqueio) => bloqueio.professionalId === null && bloqueio.roomId === null),
  )

  /** Linha do agora — só existe quando o dia na tela é o dia de hoje. */
  const agoraMinuto = ref(clinicClock.now().minutes)
  const mostrarLinhaDoAgora = computed(
    () =>
      agenda.data === clinicClock.today() &&
      agoraMinuto.value >= limites.value.inicio &&
      agoraMinuto.value <= limites.value.fim,
  )
  const topoDaLinhaDoAgora = computed(() => paraTopo(agoraMinuto.value))

  function atualizarAgora() {
    agoraMinuto.value = clinicClock.now().minutes
  }

  /** Converte uma posição em pixels dentro da coluna de volta para minuto da parede. */
  function minutoDoPixel(y: number): number {
    return limites.value.inicio + y / pixelsPorMinuto.value
  }

  return {
    limites,
    passoDaGrade,
    faixasDaClinica,
    alturaTotalPx,
    marcas,
    virtualizado,
    colunas,
    atendimentosVisiveis,
    mostrarLinhaDoAgora,
    topoDaLinhaDoAgora,
    atualizarAgora,
    paraTopo,
    minutoDoPixel,
    pixelsPorMinuto,
  }
}
