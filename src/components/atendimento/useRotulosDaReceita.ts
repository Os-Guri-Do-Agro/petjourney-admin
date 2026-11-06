/**
 * Os rótulos da receita na tela: a frequência ("a cada 12 horas", "uma vez ao dia"), a duração
 * ("7 dias", "uso contínuo") e os avisos que o servidor guardou no ato. A dose vem pronta da API
 * ("meio comprimido"): a tela não monta.
 */
import { useI18n } from 'vue-i18n'

export function useRotulosDaReceita() {
  const { t, te } = useI18n()

  function frequencia(horas: number) {
    if (horas === 24) return t('atendimento.receita.frequencia.dia')
    if (horas % 24 === 0) return t('atendimento.receita.frequencia.dias', { n: horas / 24 })
    return t('atendimento.receita.frequencia.horas', { n: horas })
  }

  function duracao(dias: number | null) {
    return dias === null
      ? t('atendimento.receita.prescrever.continuo')
      : t('atendimento.receita.duracao', { n: dias }, dias)
  }

  function avisoNoAto(codigo: string) {
    return te(`atendimento.receita.avisoNoAto.${codigo}`)
      ? t(`atendimento.receita.avisoNoAto.${codigo}`)
      : null
  }

  return { frequencia, duracao, avisoNoAto }
}
