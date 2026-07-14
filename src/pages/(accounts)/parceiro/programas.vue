<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ProgramasParticipacaoView from '@/components/parceiro/ProgramasParticipacaoView.vue'
import { EQUIPE_MENU_ENABLED } from '@/composables/useAppNavigation'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const { t } = useI18n()

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
    :subtitle="t('programas.subtitle')"
    :title="t('programas.title')"
    :loading="false"
    :error="store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : ''"
    @retry="ensureContext(true)"
  >
    <div class="programas-page" :style="pageAtmosphere">
      <PartnerOperabilityBanner />

      <aside
        v-if="store.semAcessoParceiro"
        class="programas-page__entry"
        role="status"
      >
        <i class="pi pi-send" aria-hidden="true" />
        <div>
          <strong>{{ t('programas.entry.title') }}</strong>
          <p>
            {{ t('programas.entry.body') }}
          </p>
        </div>
      </aside>

      <p v-else class="programas-page__lede">
        {{ t('programas.lede') }}
      </p>

      <ProgramasParticipacaoView />
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.programas-page {
  --programas-gap: 1.65rem;
  display: grid;
  gap: var(--programas-gap);
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
}

.programas-page__lede {
  margin: -0.35rem 0 0;
  color: var(--prog-page-muted);
  font-size: 0.94rem;
  line-height: 1.5;
}

.programas-page__entry {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 0.85rem;
  align-items: start;
  padding: 1rem 1.1rem;
  border: 1px solid color-mix(in srgb, var(--prog-page-muted) 28%, transparent);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--prog-page-muted) 8%, transparent);
}

.programas-page__entry i {
  margin-top: 0.15rem;
  font-size: 1.15rem;
  color: var(--prog-page-muted);
}

.programas-page__entry strong {
  display: block;
  margin-bottom: 0.25rem;
  font-size: 0.98rem;
}

.programas-page__entry p {
  margin: 0;
  color: var(--prog-page-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

:deep(#credenciamento),
:deep(#programas) {
  scroll-margin-top: 5rem;
}

@media (max-width: 720px) {
  .programas-page {
    --programas-gap: 1.35rem;
  }
}
</style>
