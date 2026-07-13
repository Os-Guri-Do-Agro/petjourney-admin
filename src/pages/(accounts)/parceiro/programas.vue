<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ProgramasParticipacaoView from '@/components/parceiro/ProgramasParticipacaoView.vue'
import { EQUIPE_MENU_ENABLED } from '@/composables/useAppNavigation'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const LEGACY_ABA_REDIRECTS: Record<string, { path: string; hash?: string; aba?: string }> = {
  visao: { path: '/parceiro/programas' },
  credenciamento: { path: '/parceiro/programas', hash: '#credenciamento' },
  afiliado: { path: '/parceiro/programas', hash: '#programas' },
  participativo: { path: '/parceiro/programas', hash: '#programas' },
  divulgacao: { path: '/parceiro/divulgacao' },
  indicacao: { path: '/parceiro/divulgacao', hash: '#indicacao' },
  cupons: { path: '/parceiro/divulgacao', hash: '#cupons' },
  resgates: { path: '/parceiro/divulgacao', hash: '#resgates' },
  equipe: { path: EQUIPE_MENU_ENABLED ? '/parceiro/equipe' : '/inicio' },
}

const { store, ensureContext } = useParceiroPortal()
const route = useRoute()
const router = useRouter()

const pageAtmosphere = computed(() => {
  const colors = currentColors.value

  return {
    '--prog-page-muted': colors.dashboard.muted,
    '--prog-page-bloom': `color-mix(in srgb, ${colors.vet.primary} 16%, ${colors.dashboard.bg})`,
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

  if (typeof aba !== 'string' || !(aba in LEGACY_ABA_REDIRECTS)) {
    return
  }

  const target = LEGACY_ABA_REDIRECTS[aba]!

  const nextQuery = { ...route.query }
  delete nextQuery.aba

  if (target.aba) {
    nextQuery.aba = target.aba
  }

  await router.replace({
    path: target.path,
    query: nextQuery,
    hash: target.hash ? target.hash : '',
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
    title="Programas de participação"
    :loading="false"
    :error="store.loadState === 'error' ? store.errorMessage : ''"
    @retry="ensureContext(true)"
  >
    <div class="programas-page" :style="pageAtmosphere">
      <div class="programas-page__bloom" aria-hidden="true" />

      <PartnerOperabilityBanner />

      <p class="programas-page__lede">
        Escolha os programas da rede PetJourney. Cada um é independente e passa por análise do time.
      </p>

      <ProgramasParticipacaoView />
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.programas-page {
  --programas-gap: 1.65rem;
  position: relative;
  display: grid;
  gap: var(--programas-gap);
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
  isolation: isolate;
}

.programas-page__bloom {
  position: absolute;
  top: -3.5rem;
  right: 0;
  z-index: -1;
  width: min(26rem, 100%);
  height: 14rem;
  border-radius: 999px;
  background: radial-gradient(circle at 40% 40%, var(--prog-page-bloom) 0%, transparent 70%);
  opacity: 0.85;
  pointer-events: none;
  filter: blur(10px);
}

.programas-page__lede {
  margin: -0.35rem 0 0;
  color: var(--prog-page-muted);
  font-size: 0.94rem;
  line-height: 1.5;
}

:deep(#credenciamento),
:deep(#programas) {
  scroll-margin-top: 5rem;
}

@media (prefers-reduced-motion: reduce) {
  .programas-page__bloom {
    filter: none;
  }
}

@media (max-width: 720px) {
  .programas-page {
    --programas-gap: 1.35rem;
  }
}
</style>
