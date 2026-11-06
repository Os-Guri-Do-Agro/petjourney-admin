/**
 * As frases do pedido de cópia (E4-06c) que a lista e a gaveta repetem: quem pediu, o período e a
 * falha da geração. O documento de quem pediu no balcão nunca volta da API; o nome vem
 * "Anonimizado" depois da exclusão dos dados.
 */
import { useI18n } from 'vue-i18n'

import { useRotulosDoCadastro } from '@/components/cadastro/useRotulosDoCadastro'
import type { PedidoDeCopia } from '@/service/parceiro/copias-service'

/** As falhas do gerador que o guia lista; o resto cai na frase geral. */
const FALHAS = [
  'TEMPO',
  'MEMORIA',
  'RENDER',
  'ARMAZEM',
  'GRANDE_DEMAIS',
  'PDF_GRANDE',
  'TENTATIVAS',
] as const

export function useFrasesDaCopia() {
  const { t } = useI18n()
  const rotulos = useRotulosDoCadastro()

  function quemPediu(pedido: Pick<PedidoDeCopia, 'origem' | 'solicitanteNome'>) {
    if (pedido.origem === 'APP') return t('copias.peloApp')
    return pedido.solicitanteNome
      ? t('copias.noBalcaoPor', { nome: pedido.solicitanteNome })
      : t('copias.noBalcao')
  }

  function periodo(pedido: Pick<PedidoDeCopia, 'de' | 'ate'>) {
    if (pedido.de && pedido.ate)
      return t('copias.periodo.entre', { de: rotulos.dia(pedido.de), ate: rotulos.dia(pedido.ate) })
    if (pedido.de) return t('copias.periodo.desde', { de: rotulos.dia(pedido.de) })
    if (pedido.ate) return t('copias.periodo.ate', { ate: rotulos.dia(pedido.ate) })
    return t('copias.periodo.tudo')
  }

  function falha(codigo: string | null) {
    if (!codigo) return ''
    const conhecida = FALHAS.find((item) => item === codigo)
    return conhecida ? t(`copias.falha.${conhecida}`) : t('copias.falha.outra')
  }

  return { quemPediu, periodo, falha }
}
