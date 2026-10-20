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
import { MIN_SAQUE_CENTAVOS } from '@/service/parceiro/regras-de-saque'
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
  { id: 'extrato', label: t('carteira.tabs.extrato.label') },
  { id: 'saques', label: t('carteira.tabs.saques.label') },
])

const tabsAriaLabel = computed(() =>
  t('carteira.tabs.ariaLabel', { labels: tabs.value.map((tab) => tab.label).join(', ') }),
)

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

const showAfiliadoGate = computed(
  () => store.loadState === 'ready' && !store.statusAfiliadoAtivo,
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
    minimo: formatBrl(MIN_SAQUE_CENTAVOS),
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
  <UiPagina
    class="tela-carteira"
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
      <span class="carteira-gate__icone" aria-hidden="true"><i class="ph ph-wallet" /></span>
      <h2>{{ t('carteira.gate.title') }}</h2>
      <p>{{ t('carteira.gate.body') }}</p>
      <Button
        type="button"
        icon="ph ph-squares-four"
        :label="t('carteira.gate.cta')"
        @click="goToProgramas"
      />
    </div>

    <div v-else class="carteira">
      <PortalCarteiraVisaoPanel
        @estado="estado = $event"
        @needs-programas="goToProgramas"
      />

      <section class="carteira__listas" :aria-label="tabsAriaLabel">
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

        <PortalCarteiraExtratoPanel
          v-if="activeTab === 'extrato'"
          @needs-programas="goToProgramas"
        />
        <PortalCarteiraSaquesPanel v-else @needs-programas="goToProgramas" />
      </section>

      <PortalCarteiraAjuda />
    </div>
  </UiPagina>
</template>

<style scoped>
/* Botões de contorno e de texto nas cores do Trilha (fora do antigo `.hc-tema`). */
.tela-carteira {
  --p-button-outlined-secondary-border-color: var(--linha-forte);
  --p-button-outlined-secondary-color: var(--tinta);
  --p-button-outlined-secondary-hover-background: var(--superficie-2);
  --p-button-outlined-secondary-active-background: var(--superficie-3);
  --p-button-text-secondary-color: var(--tinta-2);
  --p-button-text-secondary-hover-background: var(--superficie-2);
  --p-button-text-secondary-active-background: var(--superficie-3);
}

.carteira {
  display: grid;
  gap: 32px;
}

.carteira__listas {
  display: grid;
  gap: 16px;
}

.carteira__abas {
  justify-self: start;
}

.carteira__abas :deep(.p-togglebutton-content) {
  min-height: 38px;
  padding-inline: 16px;
  font-size: 14.5px;
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

.carteira-gate__icone {
  display: grid;
  width: 52px;
  height: 52px;
  place-items: center;
  border-radius: 16px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 24px;
}

.carteira-gate h2 {
  margin: 8px 0 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
}

.carteira-gate p {
  max-width: 48ch;
  margin: 0 0 12px;
  color: var(--tinta-2);
  line-height: 1.5;
}
</style>
