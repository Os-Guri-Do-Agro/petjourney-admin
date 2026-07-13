<script setup lang="ts">
import { onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import ProgramasParticipacaoView from '@/components/parceiro/ProgramasParticipacaoView.vue'
import { EQUIPE_MENU_ENABLED } from '@/composables/useAppNavigation'
import { useParceiroPortal } from '@/composables/useParceiroPortal'

const LEGACY_ABA_REDIRECTS: Record<string, { path: string; hash?: string; aba?: string }> = {
  visao: { path: '/parceiro/programas' },
  credenciamento: { path: '/parceiro/programas', hash: '#credenciamento' },
  afiliado: { path: '/parceiro/programas', hash: '#programas' },
  participativo: { path: '/parceiro/programas', hash: '#programas' },
  divulgacao: { path: '/parceiro/divulgacao' },
  indicacao: { path: '/parceiro/divulgacao', aba: 'indicacao' },
  cupons: { path: '/parceiro/divulgacao', aba: 'cupons' },
  resgates: { path: '/parceiro/divulgacao', aba: 'resgates' },
  equipe: { path: EQUIPE_MENU_ENABLED ? '/parceiro/equipe' : '/inicio' },
}

const { store, bootstrapping, ensureContext } = useParceiroPortal()
const route = useRoute()
const router = useRouter()

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
    subtitle="Sua conta"
    title="Programas de participação"
    :loading="bootstrapping || (store.loadState === 'loading' && !store.dashboard)"
    :error="store.loadState === 'error' ? store.errorMessage : ''"
    @retry="ensureContext(true)"
  >
    <PartnerOperabilityBanner />
    <ProgramasParticipacaoView />
  </PartnerPageFrame>
</template>

<style scoped>
:deep(#credenciamento),
:deep(#programas) {
  scroll-margin-top: 5rem;
}
</style>
