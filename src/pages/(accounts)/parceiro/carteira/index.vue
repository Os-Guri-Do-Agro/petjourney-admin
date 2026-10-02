<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PartnerSectionTabs from '@/components/parceiro/PartnerSectionTabs.vue'
import PortalCarteiraExtratoPanel from '@/components/parceiro/panels/PortalCarteiraExtratoPanel.vue'
import PortalCarteiraSaquesPanel from '@/components/parceiro/panels/PortalCarteiraSaquesPanel.vue'
import PortalCarteiraAjuda from '@/components/parceiro/panels/PortalCarteiraAjuda.vue'
import PortalCarteiraVisaoPanel, {
  type EstadoDaCarteira,
} from '@/components/parceiro/panels/PortalCarteiraVisaoPanel.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { formatCentavosToBrl } from '@/utils/format/money'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerTabs } from '@/composables/usePartnerTabs'

/*
 * Duas abas, e não três: a "Visão geral" saiu de aba — o saldo foi para a frase do topo e o resto
 * para a linha de fatos, que fica sempre à vista acima das abas. Um `?aba=visao` antigo cai na
 * primeira.
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
    description: t('carteira.tabs.extrato.description'),
  },
  {
    id: 'saques',
    label: t('carteira.tabs.saques.label'),
    description: t('carteira.tabs.saques.description'),
  },
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

const resumo = ref<InstanceType<typeof PortalCarteiraVisaoPanel> | null>(null)
const estado = ref<EstadoDaCarteira | null>(null)

function formatBrl(centavos: number) {
  return formatCentavosToBrl(centavos, INTL_LOCALE[locale.value as Locale])
}

/**
 * A frase da saudação: quanto dá para sacar agora. Sem nada liberado, diz quanto ainda está na
 * janela de segurança; sem ganho nenhum, diz isso — nunca "R$ 0,00 disponível".
 */
const fraseDoResumo = computed(() => {
  const atual = estado.value

  if (!atual || atual.carregando) {
    return ''
  }

  if (atual.saldoSacavelCentavos > 0) {
    return t('carteira.saudacao.disponivel', { valor: formatBrl(atual.saldoSacavelCentavos) })
  }

  if (atual.saldoTotalCentavos > 0) {
    return t('carteira.saudacao.retido', { valor: formatBrl(atual.saldoTotalCentavos) })
  }

  return t('carteira.saudacao.semSaldo')
})

/**
 * As pílulas seguem a situação: liberado, sacar é a cheia; faltando a chave, cadastrá-la é que é a
 * cheia. Quem não é dono não vê nenhuma das duas — o saque e a chave são do dono da conta.
 */
const acaoCheia = computed<'sacar' | 'cadastrarPix' | null>(() => {
  if (!estado.value?.ehDono) {
    return null
  }

  if (estado.value.capacidade === 'liberado') {
    return 'sacar'
  }

  return estado.value.capacidade === 'semChavePix' ? 'cadastrarPix' : null
})

function goToProgramas() {
  void router.replace({ path: '/parceiro/programas', hash: '#programas' })
}

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :subtitle="t('carteira.subtitle')"
    :title="t('carteira.title')"
    :loading="false"
    :error="loadError"
    :no-partner-access="store.semAcessoParceiro"
    block-when-suspended
    @retry="ensureContext(true)"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('carteira.subtitle') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('carteira.title') }}</h1>

        <div v-if="!showAfiliadoGate" class="hc-saudacao__linha">
          <p v-if="fraseDoResumo" class="hc-saudacao__resumo" aria-live="polite">
            {{ fraseDoResumo }}
          </p>

          <nav v-if="estado?.ehDono" class="hc-acoes" :aria-label="t('carteira.saudacao.acoes')">
            <Button
              v-if="acaoCheia === 'sacar'"
              type="button"
              class="hc-pilula hc-pilula--cheia"
              icon="pi pi-wallet"
              :label="t('carteira.visao.saque.submit')"
              @click="resumo?.abrirSaque()"
            />
            <Button
              v-if="acaoCheia === 'cadastrarPix'"
              type="button"
              class="hc-pilula hc-pilula--cheia"
              icon="pi pi-key"
              :label="t('carteira.saudacao.cadastrarPix')"
              @click="resumo?.abrirPix()"
            />
            <Button
              v-else
              type="button"
              class="hc-pilula"
              icon="pi pi-key"
              :label="t('carteira.visao.pix.title')"
              severity="secondary"
              outlined
              @click="resumo?.abrirPix()"
            />
          </nav>
        </div>
      </div>
    </template>

    <article v-if="showAfiliadoGate" class="carteira-gate">
      <h3>{{ t('carteira.gate.title') }}</h3>
      <p>{{ t('carteira.gate.body') }}</p>
      <Button :label="t('carteira.gate.cta')" @click="goToProgramas" />
    </article>

    <div v-else class="carteira-pagina">
      <PortalCarteiraVisaoPanel
        ref="resumo"
        @estado="estado = $event"
        @needs-programas="goToProgramas"
      />

      <PartnerSectionTabs
        :tabs="tabs"
        :active-tab="activeTab"
        :aria-label="tabsAriaLabel"
        @select="setTab($event as CarteiraTab)"
      />

      <PortalCarteiraExtratoPanel v-if="activeTab === 'extrato'" @needs-programas="goToProgramas" />
      <PortalCarteiraSaquesPanel v-else @needs-programas="goToProgramas" />

      <PortalCarteiraAjuda />
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.carteira-pagina {
  display: grid;
  gap: 1rem;
}

/* As abas trazem a própria margem de baixo; na grade, quem espaça é o gap. */
.carteira-pagina :deep(.partner-tabs) {
  margin-bottom: 0;
}

.carteira-gate {
  display: grid;
  gap: 0.75rem;
  max-width: 28rem;
  padding: 1.2rem;
  border: 1px solid var(--partner-line);
  border-radius: 1rem;
  background: var(--partner-card);
}

.carteira-gate h3 {
  margin: 0;
  font-size: 1rem;
}

.carteira-gate p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.9rem;
}
</style>
