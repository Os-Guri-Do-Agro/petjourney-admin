<script setup lang="ts">
import { computed, onMounted } from 'vue'

import HomeNavigationShortcuts from '@/components/home/HomeNavigationShortcuts.vue'
import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PortalParceiroDashboard from '@/components/parceiro/PortalParceiroDashboard.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const { store, bootstrapping, ensureContext } = useParceiroPortal()

const greetingTitle = computed(() => `Olá, ${store.parceiroNome}`)

const pageAtmosphere = computed(() => {
  const colors = currentColors.value

  return {
    '--inicio-bloom': colorMixSafe(colors.vet.primary, colors.dashboard.bg),
    '--inicio-bloom-soft': colors.vet.secondary,
  }
})

function colorMixSafe(primary: string, bg: string) {
  return `color-mix(in srgb, ${primary} 18%, ${bg})`
}

onMounted(() => {
  void ensureContext()
})
</script>

<template>
  <PartnerPageFrame
    subtitle="Visão geral"
    :title="greetingTitle"
    :loading="bootstrapping || (store.loadState === 'loading' && !store.dashboard)"
    :error="store.loadState === 'error' ? store.errorMessage : ''"
    @retry="ensureContext(true)"
  >
    <div class="inicio-shell" :style="pageAtmosphere">
      <div class="inicio-shell__bloom" aria-hidden="true" />
      <PartnerOperabilityBanner />
      <PortalParceiroDashboard />
      <HomeNavigationShortcuts class="inicio-shortcuts" />
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.inicio-shell {
  position: relative;
  display: grid;
  gap: 1.45rem;
  isolation: isolate;
}

.inicio-shell__bloom {
  position: absolute;
  top: -4rem;
  right: -2rem;
  z-index: -1;
  width: min(28rem, 70vw);
  height: 16rem;
  border-radius: 999px;
  background:
    radial-gradient(
      circle at 40% 40%,
      var(--inicio-bloom) 0%,
      transparent 68%
    );
  opacity: 0.9;
  pointer-events: none;
  filter: blur(8px);
}

.inicio-shortcuts {
  margin-top: 0.15rem;
  padding-top: 0.35rem;
}

@media (prefers-reduced-motion: reduce) {
  .inicio-shell__bloom {
    filter: none;
  }
}
</style>
