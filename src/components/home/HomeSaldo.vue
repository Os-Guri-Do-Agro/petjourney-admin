<script setup lang="ts">
/**
 * Ganhos de indicação: quanto a parceria rendeu e se dá para sacar.
 *
 * ## A forma
 *
 * Um cartão da home no acabamento do Prodify: ícone e título no cabeçalho, o valor liberado como o
 * maior número da página, e — só quando há dinheiro na janela de segurança — uma barra de quanto do
 * total já está liberado, como as barras de meta do Prodify. Embaixo, as linhas do extrato com o
 * que a API de fato devolve: retido (a diferença), total e sacado. Retido e total só aparecem
 * quando há algo retido; sem retenção, o total repetiria o número do topo. A API não informa
 * **quando** o retido libera, então a tela não promete data.
 *
 * ## "Liberado" não é "dá para sacar"
 *
 * O saque tem regras (`regras-de-saque`): dono da conta, chave PIX, mínimo de R$ 50,00, nada
 * bloqueado. A linha abaixo do valor diz a situação real, uma frase por caso, e traz a ação na
 * própria linha quando há uma — como pílula cheia quando é o próximo passo natural (pedir o
 * saque), contornada quando é um conserto (cadastrar a chave, ver o bloqueio).
 *
 * ## O nome
 *
 * "Ganhos de indicação", o mesmo do menu e da página de destino. "Financeiro", numa ferramenta de
 * clínica, lia como o caixa da clínica — e este dinheiro é a participação por indicação.
 *
 * ## Quem não tem o programa ativo
 *
 * Sem afiliação ativa não há carteira. O cartão passa a dizer em que pé está o programa, com o
 * próximo passo e o motivo que o backend mandou, se houver.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import { PhCheckCircle, PhHandCoins, PhLock } from '@phosphor-icons/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { RouterLink, type RouteLocationRaw } from 'vue-router'

import IconeDaCasa from '@/components/common/IconeDaCasa.vue'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getCarteira } from '@/service/parceiro/parceiro-portal-service'
import { capacidadeDeSaque, MIN_SAQUE_CENTAVOS } from '@/service/parceiro/regras-de-saque'
import type { Carteira, StatusModoParceiro } from '@/service/parceiro/types'
import { formatCentavosToBrl } from '@/utils/format/money'

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

/** Quanto do total já saiu da janela de segurança, em %. Só existe quando há algo retido. */
const percentualLiberado = computed(() => {
  const c = carteira.value
  if (!c || retidoCentavos.value <= 0 || c.saldoTotalCentavos <= 0) return null
  return Math.round((c.saldoSacavelCentavos / c.saldoTotalCentavos) * 100)
})

/** O extrato só aparece quando tem o que mostrar além do número do topo. */
const mostrarExtrato = computed(
  () => retidoCentavos.value > 0 || (carteira.value?.totalSacadoCentavos ?? 0) > 0,
)

/** O que impede (ou não) o saque agora — a mesma régua da tela de saque. */
const capacidade = computed(() =>
  carteira.value ? capacidadeDeSaque(carteira.value, store.isDono) : null,
)

/**
 * A frase que acompanha o número. Uma por situação real, nenhuma para situação imaginada. A do
 * mínimo é montada no template, com a quantia isolada — ver o comentário lá.
 */
const fraseDaCapacidade = computed(() =>
  capacidade.value ? t(`inicio.saldo.capacidade.${capacidade.value}`) : '',
)

/** A ação que resolve a situação, quando existe uma e quem está logado pode fazê-la. */
const acaoDaCapacidade = computed<{
  rotulo: string
  to: RouteLocationRaw
  principal: boolean
} | null>(() => {
  switch (capacidade.value) {
    case 'liberado':
      return { rotulo: t('inicio.saldo.acao.liberado'), to: '/parceiro/carteira', principal: true }
    case 'semChavePix':
    case 'bloqueado':
      return {
        rotulo: t(`inicio.saldo.acao.${capacidade.value}`),
        to: '/parceiro/carteira',
        principal: false,
      }
    default:
      return null
  }
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
</script>

<template>
  <section class="hc saldo" aria-labelledby="home-saldo-titulo">
    <!-- Carregando: a mesma geometria do cartão pronto, para a troca não saltar. -->
    <template v-if="carregando || !contextoPronto">
      <div class="hc__cabeca" aria-hidden="true">
        <Skeleton width="10rem" height="1.1rem" border-radius="6px" />
      </div>
      <div
        class="saldo__corpo"
        role="status"
        aria-live="polite"
        aria-busy="true"
        :aria-label="t('inicio.saldo.carregandoAria')"
      >
        <Skeleton width="12rem" height="2.6rem" border-radius="8px" />
        <Skeleton width="16rem" height="0.95rem" border-radius="6px" />
        <Skeleton width="100%" height="0.95rem" border-radius="6px" />
      </div>
      <h2 id="home-saldo-titulo" class="sr-only">{{ t('nav.items.financeiro') }}</h2>
    </template>

    <!-- Afiliado ativo: o extrato. -->
    <template v-else-if="afiliadoAtivo">
      <header class="hc__cabeca">
        <!-- O mesmo nome do menu e da página de destino: uma coisa, um nome. -->
        <h2 id="home-saldo-titulo" class="hc__titulo">
          <PhHandCoins class="hc__icone" weight="duotone" aria-hidden="true" />
          {{ t('nav.items.financeiro') }}
        </h2>
        <RouterLink
          class="hc__link"
          :to="{ path: '/parceiro/carteira', query: { aba: 'extrato' } }"
        >
          {{ t('inicio.saldo.verExtrato') }}
          <IconeDaCasa nome="irPara" class="cartao__seta" />
        </RouterLink>
      </header>

      <div v-if="falhou" class="saldo__falha" role="alert">
        <p>{{ t('inicio.saldo.falhou') }}</p>
        <Button
          type="button"
          :label="t('inicio.saldo.tentar')"
          severity="secondary"
          outlined
          size="small"
          @click="carregar"
        />
      </div>

      <div v-else-if="carteira" class="saldo__corpo">
        <div class="saldo__destaque">
          <!-- O maior número da página: o valor liberado, isolado para não se inverter em RTL. -->
          <p class="saldo__valor">
            <bdi dir="ltr">{{ brl(carteira.saldoSacavelCentavos) }}</bdi>
          </p>
          <p class="saldo__rotulo">
            {{
              capacidade === 'bloqueado'
                ? t('inicio.saldo.bloqueadoRotulo')
                : t('inicio.saldo.liberado')
            }}
          </p>
        </div>

        <div
          v-if="percentualLiberado !== null"
          class="saldo__barra"
          role="img"
          :aria-label="
            t('inicio.saldo.barraAria', {
              liberado: brl(carteira.saldoSacavelCentavos),
              total: brl(carteira.saldoTotalCentavos),
            })
          "
        >
          <span class="saldo__barra-cheia" :style="{ inlineSize: `${percentualLiberado}%` }" />
        </div>

        <div class="saldo__capacidade" :class="`saldo__capacidade--${capacidade}`">
          <p class="saldo__capacidade-frase">
            <PhLock
              v-if="capacidade === 'bloqueado'"
              class="saldo__capacidade-icone"
              weight="fill"
              aria-hidden="true"
            />
            <PhCheckCircle
              v-else-if="capacidade === 'liberado'"
              class="saldo__capacidade-icone saldo__capacidade-icone--ok"
              weight="fill"
              aria-hidden="true"
            />
            <!--
              O mínimo é uma quantia dentro de uma frase: em árabe, sem isolamento, o "R$" se
              inverte para "$R" no meio do texto da direita para a esquerda.
            -->
            <I18nT
              v-if="capacidade === 'abaixoDoMinimo'"
              keypath="inicio.saldo.capacidade.abaixoDoMinimo"
              tag="span"
            >
              <template #minimo>
                <bdi dir="ltr">{{ brl(MIN_SAQUE_CENTAVOS) }}</bdi>
              </template>
            </I18nT>
            <span v-else>{{ fraseDaCapacidade }}</span>
          </p>
          <RouterLink
            v-if="acaoDaCapacidade"
            class="pilula"
            :class="{ 'pilula--cheia': acaoDaCapacidade.principal }"
            :to="acaoDaCapacidade.to"
          >
            {{ acaoDaCapacidade.rotulo }}
            <IconeDaCasa nome="irPara" class="cartao__seta" />
          </RouterLink>
        </div>

        <dl v-if="mostrarExtrato" class="saldo__extrato">
          <template v-if="retidoCentavos > 0">
            <div class="saldo__linha">
              <dt>{{ t('inicio.saldo.retido') }}</dt>
              <dd>
                <bdi dir="ltr">{{ brl(retidoCentavos) }}</bdi>
              </dd>
            </div>
            <div class="saldo__linha">
              <dt>{{ t('inicio.saldo.total') }}</dt>
              <dd>
                <bdi dir="ltr">{{ brl(carteira.saldoTotalCentavos) }}</bdi>
              </dd>
            </div>
          </template>
          <div class="saldo__linha">
            <dt>{{ t('inicio.saldo.sacado') }}</dt>
            <dd>
              <bdi dir="ltr">{{ brl(carteira.totalSacadoCentavos) }}</bdi>
            </dd>
          </div>
        </dl>

        <!-- No rodapé, o que gera o dinheiro: o QR e o código de indicação (slot da página). -->
        <slot name="indicacao" />

        <p v-if="isGuidanceVisible" class="saldo__nota">{{ t('inicio.saldo.nota') }}</p>
      </div>
    </template>

    <!-- Sem afiliação ativa: em que pé está o programa. -->
    <template v-else>
      <header class="hc__cabeca">
        <h2 id="home-saldo-titulo" class="hc__titulo">
          <PhHandCoins class="hc__icone" weight="duotone" aria-hidden="true" />
          {{ t('inicio.programa.titulo') }}
        </h2>
        <span class="saldo__selo" :class="`saldo__selo--${tomDoPrograma}`">
          {{ t(`inicio.programa.selo.${statusDoPrograma}`) }}
        </span>
      </header>

      <div class="saldo__corpo">
        <p class="saldo__programa">{{ t(`inicio.programa.texto.${statusDoPrograma}`) }}</p>
        <p v-if="motivoDoPrograma" class="saldo__motivo">
          {{ t('inicio.programa.motivo', { motivo: motivoDoPrograma }) }}
        </p>
        <RouterLink class="pilula saldo__programa-acao" to="/parceiro/programas">
          {{ t('inicio.programa.cta') }}
          <IconeDaCasa nome="irPara" class="cartao__seta" />
        </RouterLink>
      </div>
    </template>
  </section>
</template>

<style scoped>
/*
 * Ganhos de indicação no acabamento do Prodify: o cartão branco compartilhado (`hc`), o valor como
 * o número grande da página, a situação do saque num bloco cinza-claro com o botão em degradê, e o
 * extrato em linhas finas.
 */
.saldo {
  gap: 1rem;
}

.hc__icone {
  width: 1.2rem;
  height: 1.2rem;
}

.cartao__seta {
  width: 0.95rem;
  height: 0.95rem;
}

[dir='rtl'] .cartao__seta {
  scale: -1 1;
}

.saldo__corpo {
  display: grid;
  gap: 0.9rem;
}

.saldo__destaque {
  display: grid;
  gap: 0.15rem;
}

.saldo__valor {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 2.1rem;
  font-weight: 700;
  line-height: 1.1;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
}

.saldo__rotulo {
  margin: 0;
  color: var(--hc-tinta-3);
  font-size: 0.8125rem;
  font-weight: 500;
}

/* A barra de quanto do total já saiu da janela de segurança, como as barras do "My Goals". */
.saldo__barra {
  overflow: hidden;
  block-size: 0.4rem;
  border-radius: 999px;
  background: var(--hc-linha);
}

.saldo__barra-cheia {
  display: block;
  block-size: 100%;
  border-radius: inherit;
  background: var(--hc-degrade-botao);
}

.saldo__capacidade {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
  padding: 0.7rem 0.75rem 0.7rem 0.9rem;
  border-radius: 0.8rem;
  background: var(--hc-fundo);
}

.saldo__capacidade-frase {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.8125rem;
  line-height: 1.45;
}

.saldo__capacidade--bloqueado .saldo__capacidade-frase {
  color: var(--hc-pessego-tinta);
  font-weight: 600;
}

.saldo__capacidade-icone {
  flex-shrink: 0;
  width: 1.05rem;
  height: 1.05rem;
}

.saldo__capacidade-icone--ok {
  color: var(--hc-verde-tinta);
}

/* As ações do cartão: o botão cheio em degradê da marca, e o contornado para o conserto. */
.pilula {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-height: 2.1rem;
  padding: 0 0.95rem;
  border: 1px solid var(--hc-borda);
  border-radius: 999px;
  background: var(--hc-cartao);
  color: var(--hc-tinta);
  font-size: 0.8125rem;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
  transition:
    background-color 150ms ease-out,
    box-shadow 150ms ease-out;
}

.pilula:hover {
  background: var(--hc-linha);
}

.pilula:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 2px;
}

.pilula--cheia {
  border-color: transparent;
  background: var(--hc-degrade-botao);
  box-shadow: 0 6px 14px -8px rgb(37 111 98 / 60%);
  color: #ffffff;
}

.pilula--cheia:hover {
  background: var(--hc-degrade-botao);
  box-shadow: 0 8px 18px -8px rgb(37 111 98 / 70%);
}

.saldo__extrato {
  display: grid;
  margin: 0;
}

.saldo__linha {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
  padding-block: 0.6rem;
}

.saldo__linha + .saldo__linha {
  border-block-start: 1px solid var(--hc-linha);
}

.saldo__linha dt {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.saldo__linha dd {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.saldo__nota {
  margin: 0;
  color: var(--hc-tinta-3);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.saldo__falha {
  display: grid;
  justify-items: start;
  gap: 0.6rem;
}

.saldo__falha p {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

/* ------------------------------------------------------------------ programa */

.saldo__selo {
  display: inline-flex;
  align-items: center;
  padding: 0.2rem 0.6rem;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

.saldo__selo--neutro {
  background: var(--hc-cinza-fundo);
  color: var(--hc-cinza-tinta);
}

.saldo__selo--atencao {
  background: var(--hc-pessego-fundo);
  color: var(--hc-pessego-tinta);
}

.saldo__selo--risco {
  background: var(--hc-coral-fundo);
  color: var(--hc-coral-tinta);
}

.saldo__programa {
  max-width: 34rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  line-height: 1.5;
}

.saldo__motivo {
  max-width: 34rem;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.5;
}

.saldo__programa-acao {
  justify-self: start;
}

@media (prefers-reduced-motion: reduce) {
  .pilula {
    transition: none;
  }
}
</style>
