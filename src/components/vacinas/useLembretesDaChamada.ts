/**
 * O lembrete de vacina na lista de chamada (N42): ligar e desligar pela API e o que o cartão e a
 * gaveta mostram dele. O estado vem de cada item da chamada (`lembrete`, `responsavelNoApp`), não
 * deste navegador; depois de ligar ou desligar, quem chamou relê a lista.
 *
 * Na primeira vez, apaga o que ficou marcado neste navegador antes do N42.
 */
import { useI18n } from 'vue-i18n'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import {
  apagarLembretesGuardados,
  desligarLembreteDaVacina,
  ligarLembreteDaVacina,
  situacaoDoLembrete,
  type EntregaDoLembrete,
  type LembreteDaVacina,
} from '@/service/parceiro/lembrete-de-vacina-service'

let limpou = false

/** O ícone da entrega do último envio. */
export const ICONE_DA_ENTREGA: Record<EntregaDoLembrete, string> = {
  PENDENTE: 'ph ph-clock',
  SO_NA_CAIXA: 'ph ph-tray',
  ENVIADO: 'ph ph-paper-plane-tilt',
  ENTREGUE: 'ph ph-check-circle',
  FALHOU: 'ph ph-warning-circle',
}

export type LinhaDoLembrete = {
  chave: string
  icone: string
  texto: string
  tom?: 'ok' | 'atencao'
}

/** Urgência no ícone: entregue no verde do "feito", não saiu no tom de atenção. */
function tomDa(entrega: EntregaDoLembrete | null): LinhaDoLembrete['tom'] {
  if (entrega === 'FALHOU') return 'atencao'
  if (entrega === 'ENTREGUE') return 'ok'
  return undefined
}

export function useLembretesDaChamada() {
  const { parceiroQuery } = useParceiroPortal()
  const { t, locale } = useI18n()

  if (!limpou) {
    apagarLembretesGuardados()
    limpou = true
  }

  /**
   * Dia e hora como a API manda, com o fuso da clínica (`2026-12-06T09:00:00-03:00` é 06/12, 09:00):
   * vale a hora da parede da clínica, não a de quem olha (a repetição sai às 9h dela).
   */
  function quando(valor: string) {
    const parede = new Date(`${valor.slice(0, 16)}:00Z`)
    const data = Number.isNaN(parede.getTime()) ? new Date(valor) : parede
    return new Intl.DateTimeFormat(INTL_LOCALE[locale.value as Locale], {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: Number.isNaN(parede.getTime()) ? undefined : 'UTC',
    }).format(data)
  }

  /**
   * O cartão, em uma linha: a entrega, o motivo de não ter saído e "Sem novo envio previsto". Nulo
   * quando ainda não há o que dizer (antes do primeiro envio, com o próximo previsto).
   */
  function resumo(lembrete: LembreteDaVacina): Omit<LinhaDoLembrete, 'chave'> | null {
    const situacao = situacaoDoLembrete(lembrete)
    const texto = [
      situacao.entrega ? t(`vacinas.lembrete.entrega.${situacao.entrega}`) : '',
      situacao.motivo ? t(`vacinas.lembrete.motivo.${situacao.motivo}`) : '',
      situacao.proximoEnvioEm ? '' : t('vacinas.lembrete.semNovoEnvio'),
    ]
      .filter(Boolean)
      .join(' · ')
    if (!texto) return null
    return {
      icone: situacao.entrega ? ICONE_DA_ENTREGA[situacao.entrega] : 'ph ph-calendar-dots',
      texto,
      tom: tomDa(situacao.entrega),
    }
  }

  /** A gaveta: desde quando, o último envio, o motivo e o próximo envio, uma linha cada. */
  function linhas(lembrete: LembreteDaVacina): LinhaDoLembrete[] {
    const situacao = situacaoDoLembrete(lembrete)
    const lista: LinhaDoLembrete[] = [
      {
        chave: 'ligado',
        icone: 'ph ph-bell-ringing',
        texto: t('vacinas.lembrete.ligadoEm', { quando: quando(lembrete.ligadoEm) }),
      },
    ]
    if (situacao.entrega) {
      const entrega = t(`vacinas.lembrete.entrega.${situacao.entrega}`)
      lista.push({
        chave: 'entrega',
        icone: ICONE_DA_ENTREGA[situacao.entrega],
        texto: lembrete.ultimoEnvioEm
          ? t('vacinas.lembrete.ultimoEnvioEm', { quando: quando(lembrete.ultimoEnvioEm), entrega })
          : t('vacinas.lembrete.ultimoEnvio', { entrega }),
        tom: tomDa(situacao.entrega),
      })
    }
    if (situacao.motivo) {
      lista.push({
        chave: 'motivo',
        icone: 'ph ph-info',
        texto: t(`vacinas.lembrete.motivo.${situacao.motivo}`),
      })
    }
    lista.push({
      chave: 'proximo',
      icone: 'ph ph-calendar-dots',
      texto: situacao.proximoEnvioEm
        ? t('vacinas.lembrete.proximoEnvioEm', { quando: quando(situacao.proximoEnvioEm) })
        : t('vacinas.lembrete.semNovoEnvio'),
    })
    return lista
  }

  return {
    ligar: (aplicacaoId: string) => ligarLembreteDaVacina(aplicacaoId, parceiroQuery()),
    desligar: (aplicacaoId: string) => desligarLembreteDaVacina(aplicacaoId, parceiroQuery()),
    resumo,
    linhas,
  }
}
