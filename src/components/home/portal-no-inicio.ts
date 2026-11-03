/**
 * O Portal no Início: a carteira e os programas, como o pé da página (`HomeEspacoPortal`) e as
 * áreas do Portal (`HomePortalAreas`) os leem. As duas formas nunca aparecem juntas — a linha é de
 * quem tem a Clínica ou o Hotel, as áreas são de quem só tem o Portal —, então cada uma carrega o
 * seu e nada é pedido duas vezes.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { RouteLocationRaw } from 'vue-router'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getCarteira } from '@/service/parceiro/parceiro-portal-service'
import {
  capacidadeDaCarteira,
  type CapacidadeDeSaque,
} from '@/service/parceiro/capacidade-de-saque'
import type { Carteira, StatusModoParceiro } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

import type { TomDoNumero } from './espaco-da-home'

export type AcaoDoPortal = { rotulo: string; icone: string; to: RouteLocationRaw }

const TOM_DA_CAPACIDADE: Record<CapacidadeDeSaque, TomDoNumero> = {
  liberado: 'ok',
  semChavePix: 'atencao',
  bloqueado: 'risco',
  abaixoDoMinimo: 'neutro',
  soDono: 'neutro',
  tudoRetido: 'apagado',
  semSaldo: 'apagado',
}

/**
 * A carteira: o liberado, o que ainda está na janela de segurança e o que a API diz do saque. Sem
 * o Programa de Afiliados ativo não há carteira, e nada é pedido.
 */
export function useCarteiraDoInicio() {
  const { t, locale } = useI18n()
  const { store, ensureContext, parceiroQuery } = useParceiroPortal()

  const carteira = ref<Carteira | null>(null)
  const carregando = ref(true)
  const falhou = ref(false)

  const contextoPronto = computed(() => store.loadState !== 'loading' && store.loadState !== 'idle')
  const afiliadoAtivo = computed(() => store.statusAfiliadoAtivo)
  const pronto = computed(() => !carregando.value && contextoPronto.value)

  function brl(centavos: number) {
    return formatCentavosToBrl(centavos, INTL_LOCALE[locale.value as Locale])
  }

  /** Quantia dentro de frase: isolada, para o "R$" não se inverter no árabe. */
  function quantia(centavos: number) {
    return `⁦${brl(centavos)}⁩`
  }

  async function carregar() {
    falhou.value = false
    carregando.value = true

    try {
      await ensureContext()

      if (!store.statusAfiliadoAtivo) {
        carteira.value = null
        return
      }

      carteira.value = await getCarteira(parceiroQuery())
    } catch {
      carteira.value = null
      falhou.value = true
    } finally {
      carregando.value = false
    }
  }

  /* Troca de parceiro ou afiliação aprovada no meio da sessão: o extrato é outro. */
  watch(afiliadoAtivo, (agora, antes) => {
    if (agora !== antes) {
      void carregar()
    }
  })

  onMounted(() => {
    void carregar()
  })

  const retidoCentavos = computed(() => {
    if (!carteira.value) return 0

    return Math.max(0, carteira.value.saldoTotalCentavos - carteira.value.saldoSacavelCentavos)
  })

  /** O que impede (ou não) o saque agora, como a API decidiu para quem está logado. */
  const capacidade = computed<CapacidadeDeSaque | null>(() =>
    carteira.value ? capacidadeDaCarteira(carteira.value) : null,
  )

  const tom = computed<TomDoNumero>(() =>
    capacidade.value ? TOM_DA_CAPACIDADE[capacidade.value] : 'neutro',
  )

  /** A frase do saque: a curta da capacidade, ou o retido quando é ele que importa. */
  const frase = computed(() => {
    /* Sem a capacidade (carteira que não carregou, ou resposta sem o campo), sem frase. */
    if (!capacidade.value) return ''

    switch (capacidade.value) {
      case 'abaixoDoMinimo':
        return t('inicio.saldo.capacidade.abaixoDoMinimo', {
          minimo: quantia(carteira.value?.saqueMinimoCentavos ?? 0),
        })
      case 'semSaldo':
        return ''
      case 'tudoRetido':
        return t('inicio.espacos.portal.retidoNaLinha', { valor: quantia(retidoCentavos.value) })
      default:
        return t(`inicio.saldo.capacidade.${capacidade.value}`)
    }
  })

  /** O passo do saque, só quando há o que fazer: pedir, cadastrar a chave PIX, ver o bloqueio. */
  const acao = computed<AcaoDoPortal | null>(() => {
    switch (capacidade.value) {
      case 'liberado':
        return {
          rotulo: t('inicio.saldo.acao.liberado'),
          icone: 'ph ph-hand-coins',
          to: '/parceiro/carteira',
        }
      case 'semChavePix':
        return {
          rotulo: t('inicio.saldo.acao.semChavePix'),
          icone: 'ph ph-key',
          to: '/parceiro/carteira',
        }
      case 'bloqueado':
        return {
          rotulo: t('inicio.saldo.acao.bloqueado'),
          icone: 'ph ph-lock',
          to: '/parceiro/carteira',
        }
      default:
        return null
    }
  })

  return {
    carteira,
    falhou,
    pronto,
    afiliadoAtivo,
    retidoCentavos,
    capacidade,
    tom,
    frase,
    acao,
    brl,
    quantia,
    carregar,
  }
}

export type ProgramaDoParceiro = {
  id: 'afiliado' | 'participativo'
  titulo: string
  status: StatusModoParceiro
  motivo: string
  tom: 'neutro' | 'atencao' | 'risco' | 'ok'
}

function tomDoStatus(status: StatusModoParceiro): ProgramaDoParceiro['tom'] {
  switch (status) {
    case 'ATIVO':
      return 'ok'
    case 'REJEITADO':
    case 'SUSPENSO':
      return 'risco'
    case 'SOLICITADO':
      return 'atencao'
    default:
      return 'neutro'
  }
}

/** Os dois programas, com o selo de cada um, e se o de Afiliados está em análise. */
export function useProgramasDoParceiro() {
  const { t } = useI18n()
  const { store } = useParceiroPortal()

  const todos = computed<ProgramaDoParceiro[]>(() => {
    const afiliado = store.status?.afiliado
    const participativo = store.status?.participativo

    return [
      {
        id: 'afiliado' as const,
        titulo: t('inicio.programa.titulo'),
        status: afiliado?.status ?? 'NAO_SOLICITADO',
        motivo: afiliado?.motivo?.trim() ?? '',
      },
      {
        id: 'participativo' as const,
        titulo: t('programas.card.participativo.title'),
        status: participativo?.status ?? 'NAO_SOLICITADO',
        motivo: participativo?.motivo?.trim() ?? '',
      },
    ].map((programa) => ({ ...programa, tom: tomDoStatus(programa.status) }))
  })

  /**
   * Os que foram pedidos: o de Afiliados sempre (é ele que abre a carteira e o código); o
   * Participativo só quando foi pedido.
   */
  const pedidos = computed(() =>
    todos.value.filter(
      (programa) => programa.id === 'afiliado' || programa.status !== 'NAO_SOLICITADO',
    ),
  )

  /** Cadastro ou Programa de Afiliados em análise: liberar não depende de quem está olhando. */
  const afiliadoEmAnalise = computed(
    () =>
      store.statusAuditoria === 'PENDENTE' || store.modoBloco('afiliado').status === 'SOLICITADO',
  )

  return { todos, pedidos, afiliadoEmAnalise }
}
