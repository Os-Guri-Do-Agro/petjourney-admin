/**
 * De onde as rotas agregadoras (`paineis.ts`) tiram os números de cada área. Cada função devolve o
 * que a área tem agora (o estado muda com o que se faz na demonstração), na forma do item do painel
 * (`ItemDoPainel`) quando a tela lista, ou só a contagem.
 */
import type { ItemDoPainel } from '@/service/parceiro/painel-service'

import { AGENDAMENTOS, agendamentosDoDia } from '../base/agenda'
import { paciente } from '../base/cadastro'
import { importacoesParadas } from '../dados/cadastro-importacao'
import {
  contadoresDaAgenda,
  faltaDto,
  pendenciasDaAgenda,
  PEDIDOS,
  preConsultaDe,
} from '../dados/agenda'
import { preConsultasRespondidas, retornosPendentes } from '../dados/agenda-consulta'
import {
  contarBoletinsPendentes,
  contarDosesAtrasadas,
  internacoesAtivas,
} from '../dados/internacao'
import { vacinasAbaixoDoMinimo } from '../dados/estoque'
import { pendenciasDoPortal } from '../dados/portal'
import { copiasPorGerar, finalizadosSemResumo, prontuariosEmAberto } from '../dados/prontuario'
import { tratamentosQuePedemAtencao } from '../dados/tratamentos'
import { chamadaDeVacinas } from '../dados/vacinas'
import { diasEntre, hoje, minutosAte, somarDias } from '../relogio'

function nome(id: string) {
  return paciente(id)?.nome ?? ''
}

export const fontes = {
  /* Agenda e recepção (os contatos e as justificativas moram em `dados/agenda-*`). */
  faltasSemJustificativa(): ItemDoPainel[] {
    const desde = somarDias(hoje(), -30)
    return AGENDAMENTOS.filter(
      (a) =>
        a.status === 'FALTA' &&
        (!a.grupoId || a.grupoId === a.id) &&
        a.inicio.slice(0, 10) >= desde &&
        Boolean(paciente(a.pacienteId)?.ativo) &&
        ['PENDENTE', 'SEM_RESPOSTA'].includes(faltaDto(a).situacao),
    )
      .sort((a, b) => a.inicio.localeCompare(b.inicio))
      .map((a) => ({
        id: a.id,
        pacienteId: a.pacienteId,
        pacienteNome: nome(a.pacienteId),
        profissionalId: a.profissionalId,
        quando: a.inicio,
        diasDeAtraso: diasEntre(a.inicio.slice(0, 10), hoje()),
      }))
  },
  retornosPendentes(): ItemDoPainel[] {
    return retornosPendentes(false).map((r) => ({
      id: r.atendimentoId,
      pacienteId: r.pacienteId,
      pacienteNome: r.pacienteNome,
      profissionalId: r.profissionalId,
      profissionalNome: r.profissionalNome,
      ...(r.tipoId ? { tipoId: r.tipoId } : {}),
      ...(r.tipoNome ? { tipoNome: r.tipoNome } : {}),
      data: r.venceEm,
      diasDeAtraso: r.diasDeAtraso,
    }))
  },
  preConsultasNovas(): ItemDoPainel[] {
    const respondidas = new Set(preConsultasRespondidas())
    return agendamentosDoDia(hoje())
      .filter(
        (a) =>
          respondidas.has(a.id) &&
          (a.status === 'AGENDADO' || a.status === 'CONFIRMADO' || a.status === 'AGUARDANDO'),
      )
      .map((a) => ({
        id: a.id,
        pacienteId: a.pacienteId,
        pacienteNome: nome(a.pacienteId),
        profissionalId: a.profissionalId,
        quando: a.inicio,
        respondidaEm: preConsultaDe(a).respondidaEm ?? a.inicio,
      }))
  },
  pedidosPendentes(): number {
    return pendenciasDaAgenda().pedidosEsperando
  },
  pedidosAtrasados(): ItemDoPainel[] {
    return PEDIDOS.filter((p) => p.status === 'PENDENTE' && minutosAte(p.responderAte) < 0).map(
      (p) => ({
        id: p.id,
        ...(p.pets[0]?.pacienteId ? { pacienteId: p.pets[0].pacienteId } : {}),
        ...(p.pets[0]?.pacienteId ? { pacienteNome: nome(p.pets[0].pacienteId) } : {}),
        quando: p.responderAte,
        minutosDeAtraso: -minutosAte(p.responderAte),
      }),
    )
  },
  /** Os contadores da agenda já na forma da pendência (pedidos, fila, faltas, retornos...). */
  contadoresDaAgenda,

  /* Prontuário. */
  rascunhos(): ItemDoPainel[] {
    return prontuariosEmAberto().map((r) => ({
      id: r.id,
      pacienteId: r.pacienteId,
      pacienteNome: r.pacienteNome,
      profissionalId: r.profissionalId,
      profissionalNome: r.profissionalNome,
      quando: r.abertoEm,
      horas: Math.max(0, Math.round(-minutosAte(r.abertoEm) / 60)),
      nuncaAberto: r.nuncaAberto,
    }))
  },
  resumosNaoPublicados(): ItemDoPainel[] {
    return finalizadosSemResumo().map((r) => ({
      id: r.id,
      pacienteId: r.pacienteId,
      pacienteNome: r.pacienteNome,
      profissionalId: r.profissionalId,
      quando: r.finalizadoEm ?? r.abertoEm,
      motivo: 'NAO_LIBERADO',
    }))
  },
  copiasPendentes(): number {
    return copiasPorGerar().length
  },

  /* Internação. */
  internados(): ItemDoPainel[] {
    return internacoesAtivas().map((i) => ({
      id: i.id,
      pacienteId: i.pacienteId,
      pacienteNome: i.pacienteNome,
      quando: i.desde,
      leitoNome: i.leitoNome,
      gravidade: i.gravidade,
      urgencia: i.urgencia.nivel,
    }))
  },
  dosesAtrasadas(): number {
    return contarDosesAtrasadas()
  },
  boletinsPendentes(): number {
    return contarBoletinsPendentes()
  },

  /* Vacinas, estoque e tratamentos. */
  /** As doses vencidas da lista de chamada (a série aberta e a que vence logo não atrasaram). */
  vacinasAtrasadas(): ItemDoPainel[] {
    return chamadaDeVacinas()
      .filter((c) => c.situacao === 'VENCIDO')
      .map((c) => ({
        id: c.aplicacaoId,
        pacienteId: c.paciente.id,
        pacienteNome: c.paciente.nome,
        vacinaId: c.vacina.id,
        vacinaNome: c.vacina.nome,
        data: c.proximaDoseEm,
        diasDeAtraso: Math.max(0, -c.diasParaVencer),
      }))
  },
  vacinasAbaixoDoMinimo(): number {
    return vacinasAbaixoDoMinimo().length
  },
  tratamentosEmQueda(): number {
    return tratamentosQuePedemAtencao().length
  },

  /* Cadastro e Portal. */
  importacoesPausadas(): number {
    return importacoesParadas()
  },
  convitesPendentes(): number {
    return pendenciasDoPortal().convitesDeEquipe
  },
  acessosAtivos(): number {
    return pendenciasDoPortal().acessosAtivos
  },
}
