<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PortalDivulgacaoPanel from '@/components/parceiro/panels/PortalDivulgacaoPanel.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const ABA_TO_HASH: Record<string, string> = {
  indicacao: '#indicacao',
  cupons: '#cupons',
  resgates: '#resgates',
}

const { store, ensureContext } = useParceiroPortal()
const route = useRoute()
const router = useRouter()

const loadError = computed(() =>
  store.loadState === 'error' ? store.errorMessage : '',
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
    subtitle="Portal"
    title="Divulgação"
    :loading="false"
    :error="loadError"
    @retry="ensureContext(true)"
  >
    <div class="divulgacao-page" :style="pageAtmosphere">
      <PartnerOperabilityBanner />

      <p class="divulgacao-page__lede">
        Indicação, cupons e resgates da parceria — tudo em um só lugar para divulgar com clareza.
      </p>

      <PortalDivulgacaoPanel />
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
