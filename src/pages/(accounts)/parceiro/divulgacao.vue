<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PortalDivulgacaoPanel from '@/components/parceiro/panels/PortalDivulgacaoPanel.vue'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const ABA_TO_HASH: Record<string, string> = {
  indicacao: '#indicacao',
  cupons: '#cupons',
  resgates: '#resgates',
}

const { t } = useI18n()
const toast = useToast()

/** O que o painel carregou e a saudação precisa: código, link e leituras do QR. */
const estado = ref({ codigo: '', link: '', leituras: null as number | null, podeIndicar: false })

/**
 * A frase da saudação: o código já à vista, e quantas leituras o QR teve. Sem programa de
 * afiliados ativo não existe código, e a frase diz o que falta em vez de ficar em branco.
 */
const fraseDoResumo = computed(() => {
  if (!estado.value.podeIndicar || !estado.value.codigo) {
    return t('divulgacao.saudacao.semCodigo')
  }

  const leituras = estado.value.leituras ?? 0

  return t('divulgacao.saudacao.resumo', {
    codigo: estado.value.codigo,
    leituras: t('divulgacao.saudacao.leituras', { n: leituras }, leituras),
  })
})

async function copiarLink() {
  try {
    await navigator.clipboard.writeText(estado.value.link)
    toast.add({
      severity: 'success',
      summary: t('divulgacao.toast.copied'),
      detail: t('divulgacao.toast.copiedDetail', { label: t('divulgacao.shareKit.linkName') }),
      life: 2400,
    })
  } catch {
    toast.add({
      severity: 'error',
      summary: t('divulgacao.toast.copyFail'),
      detail: t('divulgacao.toast.copyFailDetail'),
      life: 4000,
    })
  }
}
const { store, ensureContext } = useParceiroPortal()
const route = useRoute()
const router = useRouter()

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

const pageAtmosphere = computed(() => {
  const colors = currentColors.value

  return {
    '--div-page-muted': colors.dashboard.muted,
  }
})

function scrollToHash() {
  const targetId = route.hash.replace('#', '')

  if (!targetId) {
    return
  }

  requestAnimationFrame(() => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  })
}

async function resolveLegacyTabQuery() {
  const aba = route.query.aba

  if (typeof aba !== 'string' || !(aba in ABA_TO_HASH)) {
    return
  }

  const nextQuery = { ...route.query }
  delete nextQuery.aba

  await router.replace({
    path: '/parceiro/divulgacao',
    query: nextQuery,
    hash: ABA_TO_HASH[aba],
  })
}

onMounted(async () => {
  await ensureContext()
  await resolveLegacyTabQuery()
  scrollToHash()
})

watch(
  () => route.hash,
  () => {
    scrollToHash()
  },
)
</script>

<template>
  <PartnerPageFrame
    class="hc-tema"
    :subtitle="t('divulgacao.subtitle')"
    :title="t('divulgacao.title')"
    :loading="false"
    :error="loadError"
    :no-partner-access="store.semAcessoParceiro"
    block-when-suspended
    guidance
    @retry="ensureContext(true)"
  >
    <template #cabecalho>
      <div class="hc-saudacao">
        <p class="hc-saudacao__data">{{ t('divulgacao.subtitle') }}</p>
        <h1 class="hc-saudacao__titulo">{{ t('divulgacao.title') }}</h1>

        <div class="hc-saudacao__linha">
          <p class="hc-saudacao__resumo" aria-live="polite">{{ fraseDoResumo }}</p>

          <nav v-if="estado.podeIndicar && estado.link" class="hc-acoes" :aria-label="t('divulgacao.saudacao.acoes')">
            <Button
              type="button"
              class="hc-pilula hc-pilula--cheia"
              icon="ph ph-link"
              :label="t('divulgacao.saudacao.copiarLink')"
              @click="copiarLink"
            />
          </nav>
        </div>
      </div>
    </template>

    <div class="divulgacao-page" :style="pageAtmosphere">
      <PartnerOperabilityBanner />

      <p v-if="isGuidanceVisible" class="divulgacao-page__lede">
        {{ t('divulgacao.lede') }}
      </p>

      <PortalDivulgacaoPanel @estado="estado = $event" />
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.divulgacao-page {
  --divulgacao-gap: 1.65rem;
  display: grid;
  gap: var(--divulgacao-gap);
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
}

.divulgacao-page__lede {
  margin: -0.35rem 0 0;
  color: var(--div-page-muted);
  font-size: 0.94rem;
  line-height: 1.5;
}

:deep(#indicacao),
:deep(#cupons),
:deep(#resgates) {
  scroll-margin-top: 5rem;
}

@media (max-width: 720px) {
  .divulgacao-page {
    --divulgacao-gap: 1.35rem;
  }
}
</style>
