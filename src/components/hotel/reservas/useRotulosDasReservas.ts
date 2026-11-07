/**
 * Como a reserva do hotel se escreve na tela (E7-02): status, origem, motivo do cancelamento,
 * linhas do orçamento, situação das exigências e da vaga, dinheiro em centavos e os instantes da
 * API (ISO com o offset da casa: a data e a hora mostradas são as da parede da casa, nunca as do
 * navegador).
 */
import { useI18n } from 'vue-i18n'

import { useRotulosDaCasa } from '@/components/hotel/casa/useRotulosDaCasa'
import type {
  Impedimento,
  LinhaDoOrcamento,
  MotivoDoCancelamento,
  OrigemDaReserva,
  Reserva,
  SituacaoDaExigencia,
  SituacaoDaVaga,
  StatusDaReserva,
  StatusDaEspera,
} from '@/service/parceiro/hotel-reservas-service'

export const TOM_DO_STATUS: Record<StatusDaReserva, '' | 'ok' | 'atencao' | 'contorno'> = {
  PENDENTE: 'atencao',
  CONFIRMADA: '',
  HOSPEDADO: 'ok',
  ENCERRADA: 'contorno',
  CANCELADA: 'contorno',
  NAO_COMPARECEU: 'contorno',
}

export const TOM_DA_SITUACAO: Record<SituacaoDaExigencia, '' | 'ok' | 'atencao' | 'risco'> = {
  OK: 'ok',
  DISPENSADO: '',
  VENCE_DURANTE: 'atencao',
  VENCIDO: 'risco',
  AUSENTE: 'risco',
}

export function useRotulosDasReservas() {
  const { t } = useI18n()
  const casa = useRotulosDaCasa()

  const status = (valor: StatusDaReserva) => t(`reservasDoHotel.status.${valor}`)
  const origem = (valor: OrigemDaReserva) => t(`reservasDoHotel.origem.${valor}`)
  const motivo = (valor: NonNullable<Reserva['motivoCancelamento']> | MotivoDoCancelamento) =>
    t(`reservasDoHotel.motivo.${valor}`)
  const situacao = (valor: SituacaoDaExigencia) => t(`reservasDoHotel.situacao.${valor}`)
  const impedimento = (valor: Impedimento) => t(`reservasDoHotel.impedimento.${valor}`)
  const vaga = (valor: SituacaoDaVaga) => t(`reservasDoHotel.vaga.${valor}`)
  const espera = (valor: StatusDaEspera) => t(`reservasDoHotel.espera.status.${valor}`)

  function linha(l: LinhaDoOrcamento) {
    if (l.tipo === 'SERVICO' && l.servico) return casa.servico(l.servico)
    if (l.tipo === 'TEMPORADA')
      return t('reservasDoHotel.orcamento.temporada', {
        nome: l.temporadaNome ?? '',
        p: l.percentual ?? 0,
      })
    if (l.tipo === 'SAIDA_TARDIA')
      return t('reservasDoHotel.orcamento.saidaTardia', { p: l.percentual ?? 0 })
    if (l.tipo === 'ACOMPANHANTE')
      return t('reservasDoHotel.orcamento.acompanhante', { p: l.percentual ?? 0 })
    return t('reservasDoHotel.orcamento.diaria')
  }

  /** "20 de dez." da parte da data do ISO (a parede da casa). */
  function dia(iso: string | null | undefined) {
    if (!iso) return ''
    const [ano, mes, d] = iso.slice(0, 10).split('-').map(Number)
    if (!ano || !mes || !d) return iso
    return new Intl.DateTimeFormat(casa.intl(), {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(ano, mes - 1, d)))
  }

  /** "20 de dez., 14:00": a hora como a casa a escreveu, sem converter fuso. */
  function quando(iso: string | null | undefined) {
    if (!iso) return ''
    const hora = iso.slice(11, 16)
    return hora ? `${dia(iso)}, ${hora}` : dia(iso)
  }

  function periodo(entrada: string, saida: string) {
    return t('reservasDoHotel.periodo', { de: quando(entrada), ate: quando(saida) })
  }

  function diarias(n: number) {
    return t('reservasDoHotel.diarias', { n }, n)
  }

  return {
    ...casa,
    status,
    origem,
    motivo,
    situacao,
    impedimento,
    vaga,
    espera,
    linha,
    dia,
    quando,
    periodo,
    diarias,
  }
}
