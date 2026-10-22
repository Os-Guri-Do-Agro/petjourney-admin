<script setup lang="ts">
/**
 * O Portal no Início: quanto a parceria rendeu, se dá para sacar e quantas vezes o QR foi lido.
 *
 * ## Os números
 *
 * - **liberado** — o que já saiu da janela de segurança. A frase embaixo diz a situação real do
 *   saque, decidida pela API (`capacidadeDeSaque`): pronto, falta a chave PIX, abaixo do mínimo,
 *   bloqueado. "Liberado"
 *   não é "dá para sacar", e o número não promete o que a tela de saque recusaria.
 * - **na janela de segurança** — o retido, só quando há; leva ao extrato.
 * - **leituras do QR em 7 dias** — quantas pessoas apontaram a câmera para o código, com o total.
 *   Vêm de `HomeIndique` (a seção do código, mais abaixo), que as pede uma vez para as duas.
 *
 * ## O próximo passo
 *
 * O que resolve a situação do saque, quando há (pedir o saque, cadastrar a chave PIX, ver o
 * bloqueio); senão, divulgar o código — é o que gera o próximo ganho.
 *
 * ## Sem o programa ativo
 *
 * Sem afiliação ativa não há carteira. O bloco diz em que pé está o programa, com o motivo que o
 * backend mandou, e o passo é ver os programas.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { Espaco } from '@/navegacao/espacos'
import { getCarteira } from '@/service/parceiro/parceiro-portal-service'
import {
  capacidadeDaCarteira,
  type CapacidadeDeSaque,
} from '@/service/parceiro/capacidade-de-saque'
import type { Carteira, StatusModoParceiro } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

import type {
  AtalhoDoEspaco,
  IndicacaoNoBloco,
  NumeroDoEspaco,
  PassoDoEspaco,
  TomDoNumero,
} from './espaco-da-home'
import HomeEspaco from './HomeEspaco.vue'

const props = defineProps<{ espaco: Espaco; indicacao: IndicacaoNoBloco | null }>()

const emit = defineEmits<{ compartilhar: [] }>()

const { t, locale } = useI18n()
const { store, ensureContext, parceiroQuery } = useParceiroPortal()

const carteira = ref<Carteira | null>(null)
const carregando = ref(true)
const falhou = ref(false)

const contextoPronto = computed(() => store.loadState !== 'loading' && store.loadState !== 'idle')
const afiliadoAtivo = computed(() => store.statusAfiliadoAtivo)

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

const pronto = computed(() => !carregando.value && contextoPronto.value)

const retidoCentavos = computed(() => {
  if (!carteira.value) return 0

  return Math.max(0, carteira.value.saldoTotalCentavos - carteira.value.saldoSacavelCentavos)
})

/** O que impede (ou não) o saque agora, como a API decidiu para quem está logado. */
const capacidade = computed<CapacidadeDeSaque | null>(() =>
  carteira.value ? capacidadeDaCarteira(carteira.value) : null,
)

const TOM_DA_CAPACIDADE: Record<CapacidadeDeSaque, TomDoNumero> = {
  liberado: 'ok',
  semChavePix: 'atencao',
  bloqueado: 'risco',
  abaixoDoMinimo: 'neutro',
  soDono: 'neutro',
  tudoRetido: 'apagado',
  semSaldo: 'apagado',
}

/** A frase curta embaixo do valor. As longas (sem saldo, tudo retido) ficam com o resto do bloco. */
function fraseDaCapacidade(atual: CapacidadeDeSaque) {
  switch (atual) {
    case 'abaixoDoMinimo':
      return t('inicio.saldo.capacidade.abaixoDoMinimo', {
        minimo: quantia(carteira.value?.saqueMinimoCentavos ?? 0),
      })
    case 'tudoRetido':
    case 'semSaldo':
      return ''
    default:
      return t(`inicio.saldo.capacidade.${atual}`)
  }
}

const numeros = computed<NumeroDoEspaco[]>(() => {
  if (pronto.value && !afiliadoAtivo.value) {
    return []
  }

  const lista: NumeroDoEspaco[] = []
  const atual = capacidade.value

  lista.push({
    id: 'liberado',
    valor: !pronto.value ? null : carteira.value ? brl(carteira.value.saldoSacavelCentavos) : '–',
    rotulo: atual === 'bloqueado' ? t('inicio.saldo.bloqueadoRotulo') : t('inicio.saldo.liberado'),
    meta: atual ? fraseDaCapacidade(atual) : '',
    tom: atual ? TOM_DA_CAPACIDADE[atual] : 'neutro',
    to: '/parceiro/carteira',
  })

  if (retidoCentavos.value > 0) {
    lista.push({
      id: 'retido',
      valor: brl(retidoCentavos.value),
      rotulo: t('inicio.espacos.portal.retido'),
      tom: 'neutro',
      to: { path: '/parceiro/carteira', query: { aba: 'extrato' } },
    })
  }

  const leituras = props.indicacao?.resumo
  const semana = leituras?.semana ?? 0

  if (!props.indicacao || props.indicacao.carregando || props.indicacao.podeIndicar) {
    lista.push({
      id: 'leituras',
      valor: leituras?.indisponivel ? '–' : (leituras?.semana ?? null),
      rotulo: t('inicio.espacos.portal.leituras', { total: semana }, semana),
      meta: leituras?.indisponivel
        ? t('inicio.espacos.portal.leiturasIndisponiveis')
        : leituras?.total != null
          ? t('inicio.espacos.portal.leiturasTotal', { total: leituras.total }, leituras.total)
          : '',
      tom: semana > 0 ? 'lugar' : 'apagado',
      to: '/parceiro/divulgacao',
    })
  }

  return lista
})

/* ------------------------------------------------------------ programa não ativo */

const statusDoPrograma = computed<StatusModoParceiro>(
  () => store.status?.afiliado.status ?? 'NAO_SOLICITADO',
)
const motivoDoPrograma = computed(() => store.status?.afiliado.motivo?.trim() ?? '')

const tomDoPrograma = computed(() => {
  switch (statusDoPrograma.value) {
    case 'REJEITADO':
    case 'SUSPENSO':
      return 'risco'
    case 'SOLICITADO':
      return 'atencao'
    default:
      return 'neutro'
  }
})

/** A frase longa do saldo, quando a curta não cabe embaixo do número. */
const fraseLonga = computed(() => {
  if (capacidade.value === 'semSaldo' || capacidade.value === 'tudoRetido') {
    return t(`inicio.saldo.capacidade.${capacidade.value}`)
  }

  return ''
})

/* ------------------------------------------------------------ passo e atalho */

const podeCompartilhar = computed(() => Boolean(props.indicacao?.temQr))

const passo = computed<PassoDoEspaco | null>(() => {
  if (!pronto.value) return null

  if (!afiliadoAtivo.value) {
    return {
      rotulo: t('inicio.programa.cta'),
      icone: 'ph ph-squares-four',
      to: '/parceiro/programas',
    }
  }

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
      break
  }

  if (falhou.value) {
    return { rotulo: t('nav.items.financeiro'), icone: 'ph ph-wallet', to: '/parceiro/carteira' }
  }

  if (podeCompartilhar.value) {
    return { rotulo: t('inicio.acoes.compartilhar'), icone: 'ph ph-qr-code' }
  }

  return {
    rotulo: t('inicio.indique.abrir'),
    icone: 'ph ph-megaphone-simple',
    to: '/parceiro/divulgacao',
  }
})

/** O atalho do título: compartilhar o código — a não ser que já seja o próximo passo. */
const atalho = computed<AtalhoDoEspaco | null>(() => {
  const passoCompartilha = passo.value && !passo.value.to

  if (podeCompartilhar.value && !passoCompartilha) {
    return { rotulo: t('inicio.acoes.compartilhar'), icone: 'ph ph-qr-code' }
  }

  return {
    rotulo: t('nav.items.divulgacao'),
    icone: 'ph ph-megaphone-simple',
    to: '/parceiro/divulgacao',
  }
})
</script>

<template>
  <HomeEspaco
    lugar="portal"
    :titulo="espaco.rotulo"
    :icone="espaco.icone"
    :to="espaco.to"
    :numeros="numeros"
    :atalho="atalho"
    :passo="passo"
    :aviso="falhou ? t('inicio.saldo.falhou') : ''"
    :pode-tentar="falhou"
    @passo="emit('compartilhar')"
    @atalho="emit('compartilhar')"
    @tentar="carregar"
  >
    <p v-if="fraseLonga" class="portal__frase">{{ fraseLonga }}</p>

    <div v-if="pronto && !afiliadoAtivo" class="programa">
      <span class="programa__titulo">
        {{ t('inicio.programa.titulo') }}
        <span class="ui-selo" :class="`ui-selo--${tomDoPrograma}`">
          {{ t(`inicio.programa.selo.${statusDoPrograma}`) }}
        </span>
      </span>
      <p class="programa__texto">{{ t(`inicio.programa.texto.${statusDoPrograma}`) }}</p>
      <p v-if="motivoDoPrograma" class="programa__motivo">
        {{ t('inicio.programa.motivo', { motivo: motivoDoPrograma }) }}
      </p>
    </div>
  </HomeEspaco>
</template>

<style scoped>
.portal__frase {
  max-width: 46ch;
  margin: 0;
  padding: 0 10px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.5;
}

.programa {
  display: grid;
  gap: 6px;
  padding: 8px 10px 0;
}

.programa__titulo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.programa__texto,
.programa__motivo {
  max-width: 52ch;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.programa__motivo {
  color: var(--tinta-3);
  font-size: 13px;
}
</style>
