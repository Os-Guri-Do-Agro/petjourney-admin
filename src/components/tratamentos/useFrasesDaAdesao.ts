/**
 * As frases da adesão pela API (E4-05b): a API manda contagens e códigos; o texto é do portal.
 * Nunca porcentagem, nunca "o remédio não foi dado" (a queda diz que pode ser que tenham parado de
 * registrar).
 */
import { useI18n } from 'vue-i18n'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import type { ResumoDaAdesao, Tratamento } from '@/service/parceiro/adesao-service'

export function useFrasesDaAdesao() {
  const { t } = useI18n()
  const rotulos = useRotulosDoCadastro()

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

  return { posologia, contagens, motivos, alerta }
}
