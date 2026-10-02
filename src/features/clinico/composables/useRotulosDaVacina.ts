/**
 * As frases da vacinação que mais de uma tela escreve.
 *
 * A mesma dose aparece em três lugares — a sequência do protocolo, o diálogo de aplicação e a
 * prévia da carteirinha do app — e precisa ser dita do mesmo jeito nos três. "Atrasada há 16 d"
 * num canto e "vencida" no outro, para a mesma dose, é a divergência que a demonstração lado a
 * lado existe para não ter.
 */

import { useI18n } from 'vue-i18n'

import type { ISODate, ViaDeVacina } from '../data/types'
import { diffDays } from '../domain/clinic-time'
import type { DoseNoPlano, SituacaoNoPlano, TipoDeSerie } from '../domain/protocolo-vacinal'
import { clinicClock } from '../stores/clinico'

import { useClinicFormat } from './useClinicFormat'

export function useRotulosDaVacina() {
  const { t } = useI18n()
  const formato = useClinicFormat()

  /** Sem o ano quando é deste ano; com o ano quando não é — o reforço do ano que vem. */
  function data(valor: ISODate): string {
    return valor.slice(0, 4) === clinicClock.today().slice(0, 4)
      ? formato.dataCurta(valor)
      : formato.dataCurtaComAno(valor)
  }

  function via(valor: ViaDeVacina | null): string {
    return valor ? t(`clinico.vacinas.via.${valor}`) : t('clinico.vacinas.via.naoInformada')
  }

  function serie(tipo: TipoDeSerie): string {
    return t(`clinico.vacinas.plano.serie.${tipo}`)
  }

  /** "2 de 3" na série; "reforço" depois dela. */
  function numero(dose: Pick<DoseNoPlano, 'numero' | 'total' | 'tipo'>): string {
    if (dose.tipo === 'reforco') {
      return t('clinico.vacinas.plano.reforco')
    }

    return dose.total > 1
      ? t('clinico.vacinas.doseDeTotal', { dose: dose.numero, total: dose.total })
      : t('clinico.vacinas.plano.doseUnica')
  }

  /**
   * O que a dose da vez está esperando, numa frase curta.
   *
   * É a frase que carrega a urgência junto com o ícone: "atrasada há 16 dias" é lida; um disco
   * vermelho sozinho, não.
   */
  function quando(dose: DoseNoPlano): string {
    const hoje = clinicClock.today()
    const dias = diffDays(hoje, dose.em)

    switch (dose.estado) {
      case 'aplicada':
        return data(dose.em)
      case 'atrasada':
        return t('clinico.vacinas.plano.atrasadaHa', { dias: Math.abs(dias) }, Math.abs(dias))
      case 'devida':
        return dias === 0
          ? t('clinico.vacinas.plano.hoje')
          : t('clinico.vacinas.plano.venceuHa', { dias: Math.abs(dias) }, Math.abs(dias))
      case 'aguarda-idade':
        return t('clinico.vacinas.plano.aPartirDe', { data: data(dose.em) })
      case 'pendente':
        return t('clinico.vacinas.plano.podeComecar')
      default:
        return dias <= 45 ? t('clinico.vacinas.plano.emDias', { dias }, dias) : data(dose.em)
    }
  }

  function situacao(valor: SituacaoNoPlano): string {
    return t(`clinico.vacinas.plano.situacao.${valor}`)
  }

  return { data, via, serie, numero, quando, situacao }
}
