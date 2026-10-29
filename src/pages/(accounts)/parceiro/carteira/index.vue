<script setup lang="ts">
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PortalCarteiraAjuda from '@/components/parceiro/panels/PortalCarteiraAjuda.vue'
import PortalCarteiraExtratoPanel from '@/components/parceiro/panels/PortalCarteiraExtratoPanel.vue'
import PortalCarteiraSaquesPanel from '@/components/parceiro/panels/PortalCarteiraSaquesPanel.vue'
import PortalCarteiraVisaoPanel, {
  type EstadoDaCarteira,
} from '@/components/parceiro/panels/PortalCarteiraVisaoPanel.vue'
import UiPagina from '@/components/ui/UiPagina.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { formatCentavosToBrl } from '@/utils/format/money'

/*
 * Movimentações e Saques, num controle segmentado: as duas listas da mesma carteira, e não dois
 * destinos. `?aba=extrato|saques` continua valendo (e um `?aba=visao` antigo cai na primeira).
 */
const CARTEIRA_TABS = ['extrato', 'saques'] as const
type CarteiraTab = (typeof CARTEIRA_TABS)[number]

const { t, locale } = useI18n()
const router = useRouter()
const { store, ensureContext } = useParceiroPortal()
const { activeTab, setTab } = usePartnerTabs(CARTEIRA_TABS, 'extrato')

const tabs = computed(() => [
  {
    id: 'extrato',
    label: t('carteira.tabs.extrato.label'),
    descricao: t('carteira.tabs.extrato.description'),
    icone: 'ph ph-list-bullets',
  },
  {
    id: 'saques',
    label: t('carteira.tabs.saques.label'),
    descricao: t('carteira.tabs.saques.description'),
    icone: 'ph ph-hand-coins',
  },
])

/** A cabeça do cartão das listas diz qual das duas está aberta. */
const abaAberta = computed(
  () => tabs.value.find((tab) => tab.id === activeTab.value) ?? tabs.value[0]!,
)

const tabsAriaLabel = computed(() =>
  t('carteira.tabs.ariaLabel', { labels: tabs.value.map((tab) => tab.label).join(', ') }),
)

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

const showAfiliadoGate = computed(
  () => store.loadState === 'ready' && !store.statusAfiliadoAtivo,
)

/**
 * Pedido já feito (ou cadastro em análise): a folha diz que está em análise e leva aos programas
 * para acompanhar. "Solicitar programa afiliado" mandava pedir de novo o que já estava pedido.
 */
const gateEmAnalise = computed(
  () =>
    store.statusAuditoria === 'PENDENTE' || store.modoBloco('afiliado').status === 'SOLICITADO',
)

const estado = ref<EstadoDaCarteira | null>(null)

function formatBrl(centavos: number) {
  return formatCentavosToBrl(centavos, INTL_LOCALE[locale.value as Locale])
}

/**
 * A frase do topo: em que pé está o saque. O saldo está grande logo abaixo, então a frase diz o
 * que ele não diz — se dá para sacar agora e, se não, o que falta.
 */
const fraseDoResumo = computed(() => {
  const atual = estado.value

  if (!atual || atual.carregando || !atual.capacidade) {
    return ''
  }

  if (atual.capacidade === 'liberado') {
    return t('carteira.tela.liberado')
  }

  return t(`inicio.saldo.capacidade.${atual.capacidade}`, {
    minimo: formatBrl(atual.saqueMinimoCentavos ?? 0),
  })
})

function escolherAba(valor: CarteiraTab | null) {
  if (valor) {
    setTab(valor)
  }
}

function goToProgramas() {
  void router.replace({ path: '/parceiro/programas', hash: '#programas' })
}

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <!--
    O título vem do menu, e a Carteira só entra no menu com o programa ativo: sem ele a faixa
    ficava sem nome. O nome é o mesmo do item do menu.
  -->
  <UiPagina
    class="tela-carteira"
    :titulo="t('nav.items.financeiro')"
    :erro="loadError"
    :sem-acesso-de-parceiro="store.semAcessoParceiro"
    bloquear-se-suspenso
    @tentar-de-novo="ensureContext(true)"
  >
    <template v-if="fraseDoResumo && !showAfiliadoGate" #resumo>
      <span aria-live="polite">{{ fraseDoResumo }}</span>
    </template>

    <!-- Sem o programa de afiliados não há carteira: a folha diz isso e leva aos programas. -->
    <div v-if="showAfiliadoGate" class="carteira-gate ui-folha">
      <span class="ui-ladrilho ui-ladrilho--g ui-ladrilho--lugar" aria-hidden="true">
        <i class="ph ph-wallet" />
      </span>
      <h2>{{ gateEmAnalise ? t('carteira.gate.emAnaliseTitle') : t('carteira.gate.title') }}</h2>
      <p>{{ gateEmAnalise ? t('carteira.gate.emAnaliseBody') : t('carteira.gate.body') }}</p>
      <Button
        type="button"
        icon="ph ph-squares-four"
        :label="gateEmAnalise ? t('divulgacao.shareKit.esperaCta') : t('carteira.gate.cta')"
        @click="goToProgramas"
      />
    </div>

    <div v-else class="carteira">
      <PortalCarteiraVisaoPanel
        @estado="estado = $event"
        @needs-programas="goToProgramas"
      />

      <section class="carteira__listas ui-folha ui-cartao" :aria-label="tabsAriaLabel">
        <header class="ui-cartao__cabeca carteira__cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i :class="abaAberta.icone" /></span>
          <div class="ui-cartao__titulos">
            <h2 class="ui-cartao__titulo">{{ abaAberta.label }}</h2>
            <p class="ui-cartao__descricao">{{ abaAberta.descricao }}</p>
          </div>
          <div class="ui-cartao__acoes">
            <SelectButton
              class="carteira__abas"
              :model-value="activeTab"
              :options="tabs"
              option-label="label"
              option-value="id"
              :allow-empty="false"
              :aria-label="tabsAriaLabel"
              @update:model-value="escolherAba"
            />
          </div>
        </header>

        <PortalCarteiraExtratoPanel
          v-if="activeTab === 'extrato'"
          @needs-programas="goToProgramas"
        />
        <PortalCarteiraSaquesPanel v-else @needs-programas="goToProgramas" />
      </section>

      <PortalCarteiraAjuda :saque-minimo-centavos="estado?.saqueMinimoCentavos ?? null" />
    </div>
  </UiPagina>
</template>

<style scoped>
.carteira {
  display: grid;
  gap: 24px;
}

.carteira__listas {
  overflow: clip;
}

.carteira__cabeca {
  flex-wrap: wrap;
}

/* Base zero: o título divide a linha com o ladrilho, e só a troca de lista desce no estreito. */
.carteira__cabeca .ui-cartao__titulos {
  flex-basis: 0;
}

.carteira__abas :deep(.p-togglebutton-content) {
  min-height: 34px;
  padding-inline: 14px;
  font-size: 14px;
}

.carteira-gate {
  display: grid;
  max-width: 560px;
  justify-items: center;
  gap: 8px;
  margin: 8px auto;
  padding: 40px 32px;
  text-align: center;
}

.carteira-gate h2 {
  margin: 10px 0 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
}

.carteira-gate p {
  max-width: 48ch;
  margin: 0 0 12px;
  color: var(--tinta-2);
  line-height: 1.5;
  /* Sem "e-" sozinho no fim da linha e "mail." na outra. */
  text-wrap: pretty;
}

@media (max-width: 640px) {
  .carteira__cabeca .ui-cartao__acoes {
    width: 100%;
    justify-content: flex-start;
  }
}
</style>
