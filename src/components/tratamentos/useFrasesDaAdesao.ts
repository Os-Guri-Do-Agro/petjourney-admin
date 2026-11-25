/**
 * As frases da adesão pela API (E4-05b): a API manda contagens e códigos; o texto é do portal.
 * Nunca porcentagem, nunca "o remédio não foi dado" (a queda diz que pode ser que tenham parado de
 * registrar).
 */
import { useI18n } from 'vue-i18n'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { ResumoDaAdesao, Tratamento } from '@/service/parceiro/adesao-service'

/** O que a ficha e a lista leem da reavaliação do contínuo (D11; nulo/false sem compartilhar). */
export type ReavaliacaoDaAdesao = Pick<
  Tratamento,
  'reavaliarEm' | 'reavaliacaoPendente' | 'ultimaReavaliacao'
>

/** O selo da linha: o texto e se é a reavaliação vencida (a deixa para chamar o paciente). */
export type SeloDaReavaliacao = { texto: string; vencida: boolean }

export function useFrasesDaAdesao() {
  const { t, locale } = useI18n()
  const rotulos = useRotulosDoCadastro()

  /** "10/03", com o ano quando não é o de hoje ("22/02/2027"). */
  function diaCurto(ano: number, mes: number, dia: number) {
    return new Intl.DateTimeFormat(INTL_LOCALE[locale.value as Locale], {
      day: '2-digit',
      month: '2-digit',
      ...(ano !== new Date().getFullYear() ? { year: 'numeric' as const } : {}),
      timeZone: 'UTC',
    }).format(Date.UTC(ano, mes - 1, dia))
  }

  /** `AAAA-MM-DD` é dia civil: sai como está, sem passar pelo fuso. */
  function dataDoDia(valor: string) {
    const [ano, mes, dia] = valor.split('-').map(Number)
    return ano && mes && dia ? diaCurto(ano, mes, dia) : valor
  }

  /** A resposta (`em`) é um instante: o dia é o de quem olha. */
  function dataDoInstante(instante: string) {
    const quando = new Date(instante)
    return Number.isNaN(quando.getTime())
      ? ''
      : diaCurto(quando.getFullYear(), quando.getMonth() + 1, quando.getDate())
  }

  /**
   * O selo da reavaliação (guia 9): vencida em destaque; depois a resposta do responsável; sem
   * resposta, a data. Sem nada (ou sem compartilhar), nenhum selo.
   */
  function reavaliacao(item: ReavaliacaoDaAdesao): SeloDaReavaliacao | null {
    const decisao = item.ultimaReavaliacao?.decisao
    const em = item.ultimaReavaliacao ? dataDoInstante(item.ultimaReavaliacao.em) : ''
    if (item.reavaliacaoPendente) {
      return { texto: t('adesao.reavaliacao.vencida'), vencida: true }
    }
    if (decisao === 'ENCERRAR') {
      return { texto: t('adesao.reavaliacao.encerrado', { data: em }), vencida: false }
    }
    if (item.reavaliarEm) {
      const data = dataDoDia(item.reavaliarEm)
      return {
        texto:
          decisao === 'NOVA_DATA'
            ? t('adesao.reavaliacao.novaData', { data })
            : t('adesao.reavaliacao.em', { data }),
        vencida: false,
      }
    }
    if (decisao === 'CONTINUAR_SEM_DATA') {
      return { texto: t('adesao.reavaliacao.continuou', { data: em }), vencida: false }
    }
    return null
  }

  function posologia(item: Pick<Tratamento, 'posologia'>) {
    const p = item.posologia
    return [
      p.dose,
      p.via,
      p.frequencia,
      p.usoContinuo
        ? t('clinico.adesao.posologia.continuo')
        : p.duracaoDias
          ? t('clinico.adesao.posologia.porDias', { dias: p.duracaoDias }, p.duracaoDias)
          : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }

  /** "Desde 20 de out.: 12 dadas · 1 pulada · 3 sem registro". */
  function contagens(resumo: ResumoDaAdesao) {
    const partes = [
      t('clinico.adesao.contagem.dadas', { total: resumo.dadas }, resumo.dadas),
      resumo.puladas
        ? t('clinico.adesao.contagem.puladas', { total: resumo.puladas }, resumo.puladas)
        : '',
      resumo.semRegistro
        ? t(
            'clinico.adesao.contagem.semRegistro',
            { total: resumo.semRegistro },
            resumo.semRegistro,
          )
        : '',
    ].filter(Boolean)
    return t('adesao.desde', {
      data: rotulos.data(resumo.desde),
      contagens: partes.join(' · '),
    })
  }

  /** "Motivos: esquecimento (2), acabou o remédio (1)". */
  function motivos(lista: { motivo: string; vezes: number }[]) {
    if (!lista.length) return ''
    return t('clinico.adesao.alerta.motivos', {
      motivos: lista
        .map(
          (item) =>
            `${t(`clinico.adesao.motivoNaFrase.${item.motivo.toLowerCase()}`)} (${item.vezes})`,
        )
        .join(', '),
    })
  }

  function alerta(motivo: 'PULADAS' | 'QUEDA', puladas?: number) {
    return motivo === 'QUEDA'
      ? t('adesao.alerta.QUEDA')
      : puladas
        ? t('adesao.alerta.PULADAS', { n: puladas }, puladas)
        : t('adesao.alerta.PULADAS_SEM_CONTA')
  }

  return { posologia, contagens, motivos, alerta, reavaliacao }
}
