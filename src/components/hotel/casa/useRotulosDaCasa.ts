/**
 * Como a casa do hotel se escreve na tela (E7-01): porte, espécie, recurso, motivo, serviço,
 * exigência, dinheiro em centavos e o dia e mês das temporadas (`MM-DD`, sem ano).
 */
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type {
  EspecieDaCasa,
  IconeDaCasa,
  KindDeExigencia,
  KindDeServico,
  MotivoDeInativa,
  PorteDaCasa,
  RecursoDaCasa,
} from '@/service/parceiro/hotel-casa-service'
import { formatCentavosToBrl } from '@/utils/format/money'

/** O traço de cada desenho que a casa escolhe para o corredor e o tipo. */
export const ICONE_DA_CASA: Record<IconeDaCasa, string> = {
  CASA: 'ph ph-house-line',
  CAMA: 'ph ph-bed',
  GATO: 'ph ph-cat',
  CAO: 'ph ph-dog',
  GRUPO: 'ph ph-users-three',
  ESCUDO: 'ph ph-shield',
  ARVORE: 'ph ph-tree',
  PASSARO: 'ph ph-bird',
  COELHO: 'ph ph-rabbit',
}

export function useRotulosDaCasa() {
  const { t, locale } = useI18n()

  function intl() {
    return INTL_LOCALE[locale.value as Locale]
  }

  const porte = (valor: PorteDaCasa) => t(`cadastro.porte.${valor}`)
  const especie = (valor: EspecieDaCasa) => t(`cadastro.especie.${valor}`)
  const recurso = (valor: RecursoDaCasa) => t(`casaDoHotel.recurso.${valor}`)
  const motivo = (valor: MotivoDeInativa) => t(`internacao.leitos.motivo.${valor}`)
  const servico = (valor: KindDeServico) => t(`casaDoHotel.servicoKind.${valor}`)
  const exigencia = (valor: KindDeExigencia) => t(`casaDoHotel.exigenciaKind.${valor}`)
  const desenho = (valor: IconeDaCasa) => t(`casaDoHotel.desenho.${valor}`)

  function dinheiro(centavos: number) {
    return formatCentavosToBrl(centavos, intl())
  }

  /** `MM-DD` como o idioma escreve dia e mês: "20/12", "12/20". */
  function mesDia(valor: string) {
    const [mes, dia] = valor.split('-').map(Number)
    if (!mes || !dia) return valor
    return new Intl.DateTimeFormat(intl(), {
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(2028, mes - 1, dia)))
  }

  /** O nome do mês, de 1 a 12. */
  function nomeDoMes(mes: number) {
    return new Intl.DateTimeFormat(intl(), { month: 'long', timeZone: 'UTC' }).format(
      new Date(Date.UTC(2028, mes - 1, 15)),
    )
  }

  /** Instante da API (com o offset da casa) em data curta. */
  function data(instante: string | null) {
    if (!instante) return ''
    const [ano, mes, dia] = instante.slice(0, 10).split('-').map(Number)
    if (!ano || !mes || !dia) return instante
    return new Intl.DateTimeFormat(intl(), {
      day: 'numeric',
      month: 'short',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(ano, mes - 1, dia)))
  }

  return {
    porte,
    especie,
    recurso,
    motivo,
    servico,
    exigencia,
    desenho,
    dinheiro,
    mesDia,
    nomeDoMes,
    data,
    intl,
  }
}
