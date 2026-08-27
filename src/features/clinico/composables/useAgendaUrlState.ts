/**
 * Estado de visualização da agenda na URL.
 *
 * Data, visão, agrupamento, filtros e foco viram query params. É o que permite a recepção
 * mandar o link para o veterinário e voltar ao mesmo lugar depois de recarregar. No web isso
 * é natural, então não tem desculpa para guardar só em memória.
 *
 * A sincronia é nos dois sentidos, com `replace` para não empilhar histórico a cada filtro
 * — quem aperta "voltar" quer sair da agenda, não desfazer sete cliques de filtro.
 */

import { watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { AppointmentStatus } from '../data/types'
import type { AgrupamentoAgenda, VisaoAgenda } from '../stores/agenda'
import { useAgendaStore } from '../stores/agenda'
import { clinicClock } from '../stores/clinico'

const VISOES: VisaoAgenda[] = ['dia', 'semana']
const AGRUPAMENTOS: AgrupamentoAgenda[] = ['profissional', 'sala']
const STATUS: AppointmentStatus[] = [
  'agendado',
  'confirmado',
  'aguardando',
  'em-atendimento',
  'finalizado',
  'falta',
  'cancelado',
]

function comoLista(valor: unknown): string[] {
  if (typeof valor !== 'string' || valor.length === 0) {
    return []
  }

  return valor.split(',').filter(Boolean)
}

function primeiro(valor: unknown): string {
  if (Array.isArray(valor)) {
    return typeof valor[0] === 'string' ? valor[0] : ''
  }

  return typeof valor === 'string' ? valor : ''
}

export function useAgendaUrlState() {
  const route = useRoute()
  const router = useRouter()
  const agenda = useAgendaStore()

  /** URL → store. Roda na montagem e sempre que a rota muda por fora (link, voltar). */
  function lerDaUrl() {
    const data = primeiro(route.query.data)
    const visao = primeiro(route.query.visao) as VisaoAgenda
    const agrupar = primeiro(route.query.agrupar) as AgrupamentoAgenda
    const profissionais = comoLista(primeiro(route.query.prof))
    const status = comoLista(primeiro(route.query.status)) as AppointmentStatus[]
    const foco = primeiro(route.query.foco)

    agenda.data = /^\d{4}-\d{2}-\d{2}$/.test(data) ? data : clinicClock.today()
    agenda.visao = VISOES.includes(visao) ? visao : 'dia'
    agenda.agrupamento = AGRUPAMENTOS.includes(agrupar) ? agrupar : 'profissional'
    agenda.filtroProfissionais = profissionais
    agenda.filtroStatus = status.filter((item) => STATUS.includes(item))
    agenda.focoId = foco || null
  }

  /** store → URL. Só o que difere do padrão entra, para o link não virar sopa de letrinhas. */
  function escreverNaUrl() {
    const query: Record<string, string> = {}

    if (agenda.data !== clinicClock.today()) {
      query.data = agenda.data
    }

    if (agenda.visao !== 'dia') {
      query.visao = agenda.visao
    }

    if (agenda.agrupamento !== 'profissional') {
      query.agrupar = agenda.agrupamento
    }

    if (agenda.filtroProfissionais.length > 0) {
      query.prof = agenda.filtroProfissionais.join(',')
    }

    if (agenda.filtroStatus.length > 0) {
      query.status = agenda.filtroStatus.join(',')
    }

    if (agenda.focoId) {
      query.foco = agenda.focoId
    }

    const atual = JSON.stringify(route.query)
    const proximo = JSON.stringify(query)

    if (atual !== proximo) {
      void router.replace({ path: route.path, query })
    }
  }

  lerDaUrl()

  watch(
    () => [
      agenda.data,
      agenda.visao,
      agenda.agrupamento,
      agenda.filtroProfissionais.join(','),
      agenda.filtroStatus.join(','),
      agenda.focoId,
    ],
    escreverNaUrl,
  )

  watch(
    () => route.fullPath,
    () => {
      /** Navegação externa (link colado, botão voltar) reabastece o store. */
      if (route.path.startsWith('/veterinario/agenda')) {
        lerDaUrl()
      }
    },
  )

  return { lerDaUrl, escreverNaUrl }
}
