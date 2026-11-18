/**
 * Agenda e recepção da demonstração: o que as rotas agregadoras (pendências, Meu dia, atividades,
 * resumo da clínica, linha do tempo do paciente) cruzam desta área.
 *
 * O estado mora nos arquivos `agenda-*.ts` ao lado e nos agendamentos de `base/agenda.ts`, que as
 * escritas da agenda mudam no lugar. Tudo é lido na hora: depois de uma escrita, os números mudam.
 *
 * O que este arquivo exporta:
 *
 * - `contadoresDaAgenda()` — os contadores de pendência na forma do `PendenciaDto` (chave, valor,
 *   tom, rota): `pedidos`, `fila`, `filaComOferta`, `vagasParaAFila`, `faltasSemJustificativa`,
 *   `agendamentosSemConfirmacao`, `retornosPendentes`.
 * - `pendenciasDaAgenda()` — os mesmos números com nome: pedidos esperando e quantos perto do prazo
 *   (`VENCENDO`, 30 min finais) ou atrasados; fila aguardando, com oferta aberta, que não respondeu
 *   e as vagas para a fila; faltas sem contato (30 dias); retornos pendentes e vencidos; horários
 *   sem confirmação nas próximas 48 h.
 * - `resumoDeHoje()` — o dia de hoje: os totais por situação, quem está em atendimento, aguardando
 *   e atrasado, os próximos, as faltas, os bloqueios do dia, as pré-consultas respondidas e o
 *   próximo feriado (a clínica fecha).
 * - `agendaDoPaciente(pacienteId)` — para a linha do tempo: os agendamentos (com os avisos), as
 *   faltas com a situação do contato, os pedidos online, as entradas na fila e o retorno pendente.
 *
 * E repassa, para quem precisar montar outra coisa com a agenda: `dtoDe`/`dtosDe` (o agendamento
 * como a agenda lê, com os avisos), `diaDaAgenda`, `semanaDaAgenda`, `conflitosDoHorario`,
 * `horariosLivres`/`primeiroLivre` (horários sem aviso nenhum), `ocorrenciasDoDia`, `feriadoDe`,
 * `proximoFeriado`, `criarNaAgenda`, `POLITICA`, `BLOQUEIOS`, `PEDIDOS`, `FILA`,
 * `RETORNOS_PENDENTES`, `vagasDaFila`, `preConsultaDe`, `faltaDto` e `marcarRetorno`.
 */
import type { Agendamento } from '@/service/parceiro/agenda-service'

import { AGENDAMENTOS, agendamentosDoDia, agendamentosDoPaciente } from '../base/agenda'
import { paciente } from '../base/cadastro'
import { agora, hoje } from '../relogio'
import { contagemDosRetornos, preConsultasRespondidas, retornosDoPaciente } from './agenda-consulta'
import { faltasDoPaciente, faltasSemJustificativa } from './agenda-faltas'
import { contagemDaFila, filaDoPaciente } from './agenda-fila'
import { dtosDe, ocorrenciasDoDia, proximoFeriado, type Horario } from './agenda-grade'
import { contagemDosPedidos, pedidosDoPaciente } from './agenda-pedidos'

export {
  BLOQUEIOS,
  conflitosDoHorario,
  criarNaAgenda,
  diaDaAgenda,
  dtoDe,
  dtosDe,
  feriadoDe,
  horariosLivres,
  ocorrenciasDoDia,
  POLITICA,
  primeiroLivre,
  proximoFeriado,
  semanaDaAgenda,
} from './agenda-grade'
export { marcarRetorno, preConsultaDe, RETORNOS_PENDENTES } from './agenda-consulta'
export { faltaDto } from './agenda-faltas'
export { FILA, vagasDaFila } from './agenda-fila'
export { PEDIDOS } from './agenda-pedidos'
export type { Horario }

/* -------------------------------------------------------------------------- pendências */

/** Horários que ninguém confirmou e começam nas próximas 48 h (paciente ativo). */
function semConfirmacao48h() {
  const agoraMs = agora().getTime()
  const ate = agoraMs + 48 * 60 * 60_000
  return AGENDAMENTOS.filter(
    (a) =>
      a.status === 'AGENDADO' &&
      Date.parse(a.inicio) > agoraMs &&
      Date.parse(a.inicio) <= ate &&
      Boolean(paciente(a.pacienteId)?.ativo),
  ).length
}

export function pendenciasDaAgenda() {
  const pedidos = contagemDosPedidos()
  const fila = contagemDaFila()
  const retornos = contagemDosRetornos()
  return {
    pedidosEsperando: pedidos.esperando,
    pedidosPertoDoPrazo: pedidos.vencendo,
    pedidosAtrasados: pedidos.atrasados,
    filaAguardando: fila.aguardando,
    filaComOferta: fila.comOferta,
    filaNaoResponderam: fila.naoResponderam,
    vagasParaAFila: fila.vagas,
    faltasSemContato: faltasSemJustificativa(),
    retornosPendentes: retornos.pendentes,
    retornosVencidos: retornos.vencidos,
    semConfirmacao48h: semConfirmacao48h(),
  }
}

export type ContadorDaAgenda = {
  chave: string
  valor: number
  tom: 'NEUTRO' | 'ATENCAO' | 'RISCO'
  rota: string
}

/** Os contadores da área como o `GET /parceiro/portal/pendencias` manda (módulo CLINICA). */
export function contadoresDaAgenda(): ContadorDaAgenda[] {
  const p = pendenciasDaAgenda()
  return [
    { chave: 'pedidos', valor: p.pedidosEsperando, tom: 'ATENCAO', rota: '/clinica/pedidos' },
    { chave: 'fila', valor: p.filaAguardando, tom: 'NEUTRO', rota: '/clinica/fila' },
    { chave: 'filaComOferta', valor: p.filaComOferta, tom: 'ATENCAO', rota: '/clinica/fila' },
    { chave: 'vagasParaAFila', valor: p.vagasParaAFila, tom: 'ATENCAO', rota: '/clinica/fila' },
    {
      chave: 'faltasSemJustificativa',
      valor: p.faltasSemContato,
      tom: 'ATENCAO',
      rota: '/clinica/faltas',
    },
    {
      chave: 'agendamentosSemConfirmacao',
      valor: p.semConfirmacao48h,
      tom: 'ATENCAO',
      rota: '/clinica/agenda',
    },
    {
      chave: 'retornosPendentes',
      valor: p.retornosPendentes,
      tom: p.retornosVencidos ? 'ATENCAO' : 'NEUTRO',
      rota: '/clinica/retornos-pendentes',
    },
  ]
}

/* ---------------------------------------------------------------------------- hoje */

export function resumoDeHoje() {
  const data = hoje()
  const agoraMs = agora().getTime()
  const doDia = agendamentosDoDia(data)
  const principais = doDia.filter((a) => !a.grupoId || a.grupoId === a.id)
  const por = (status: Agendamento['status']) => principais.filter((a) => a.status === status)
  const aindaNaoChegou = principais.filter(
    (a) => a.status === 'AGENDADO' || a.status === 'CONFIRMADO',
  )
  const atrasados = aindaNaoChegou.filter((a) => Date.parse(a.inicio) < agoraMs)
  const porVir = aindaNaoChegou.filter((a) => Date.parse(a.inicio) >= agoraMs)
  const respondidas = new Set(preConsultasRespondidas())

  return {
    data,
    totais: {
      marcados: principais.filter((a) => a.status !== 'CANCELADO').length,
      finalizados: por('FINALIZADO').length,
      emAtendimento: por('EM_ATENDIMENTO').length,
      aguardando: por('AGUARDANDO').length,
      atrasados: atrasados.length,
      porVir: porVir.length,
      faltas: por('FALTA').length,
      cancelados: por('CANCELADO').length,
    },
    emAtendimento: dtosDe(por('EM_ATENDIMENTO')),
    aguardando: dtosDe(por('AGUARDANDO')),
    atrasados: dtosDe(atrasados),
    proximos: dtosDe(porVir.slice(0, 6)),
    faltas: dtosDe(por('FALTA')),
    bloqueios: ocorrenciasDoDia(data).filter((o) => o.motivo !== 'ALMOCO'),
    preConsultasRespondidas: principais.filter((a) => respondidas.has(a.id)).map((a) => a.id),
    feriadoQueVem: proximoFeriado(),
  }
}

/* ------------------------------------------------------------------- linha do tempo */

export function agendaDoPaciente(pacienteId: string) {
  return {
    agendamentos: dtosDe(agendamentosDoPaciente(pacienteId)),
    faltas: faltasDoPaciente(pacienteId),
    pedidos: pedidosDoPaciente(pacienteId),
    fila: filaDoPaciente(pacienteId),
    retornosPendentes: retornosDoPaciente(pacienteId),
  }
}
