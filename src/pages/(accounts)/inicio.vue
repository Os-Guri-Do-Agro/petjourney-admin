<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'

import HomeNavigationShortcuts from '@/components/home/HomeNavigationShortcuts.vue'
import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PortalParceiroDashboard from '@/components/parceiro/PortalParceiroDashboard.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const { store, ensureContext } = useParceiroPortal()

const now = ref(new Date())
let clockId: ReturnType<typeof setInterval> | undefined

const greetingTitle = computed(() => `Olá, ${store.parceiroNome}`)

const todayLabel = computed(() =>
  now.value.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }),
)

const pageAtmosphere = computed(() => {
  const colors = currentColors.value

  return {
    '--inicio-card': colors.dashboard.surface,
    '--inicio-line': colors.dashboard.line,
    '--inicio-muted': colors.dashboard.muted,
    '--inicio-faint': colors.dashboard.faint,
    '--inicio-text': colors.dashboard.text,
    '--inicio-shadow-rgb': colors.auth.shadowRgb,
  }
})

onMounted(() => {
  void ensureContext()
  clockId = setInterval(() => {
    now.value = new Date()
  }, 60_000)
})

onUnmounted(() => {
  if (clockId) {
    clearInterval(clockId)
  }
})
</script>

<template>
  <PartnerPageFrame
    subtitle="Visão geral"
    :title="greetingTitle"
    :loading="false"
    :error="store.loadState === 'error' ? store.errorMessage : ''"
    @retry="ensureContext(true)"
  >
    <template #actions>
      <time class="inicio-date" :style="pageAtmosphere" :datetime="now.toISOString()">
        {{ todayLabel }}
      </time>
    </template>

    <div class="inicio-shell" :style="pageAtmosphere">
      <PartnerOperabilityBanner />

      <p class="inicio-lede">
        Cupons, indicação e comissão da parceria — organizados para você agir rápido.
      </p>

      <div class="inicio-layout">
        <PortalParceiroDashboard />
        <HomeNavigationShortcuts />
      </div>
    </div>
  </PartnerPageFrame>
</template>

<style scoped>
.inicio-date {
  display: inline-flex;
  align-items: center;
  min-height: 2.2rem;
  padding: 0.35rem 0.8rem;
  border: 1px solid var(--inicio-line, transparent);
  border-radius: 999px;
  background: var(--inicio-card, transparent);
  color: var(--inicio-muted, inherit);
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.01em;
  text-transform: capitalize;
  box-shadow: 0 8px 18px rgb(var(--inicio-shadow-rgb, 40 51 47) / 0.04);
}

.inicio-shell {
  --inicio-gap: 1.65rem;
  display: grid;
  gap: var(--inicio-gap);
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
}

.inicio-lede {
  margin: -0.35rem 0 0;
  color: var(--inicio-muted);
  font-size: 0.94rem;
  line-height: 1.5;
}

.inicio-layout {
  display: grid;
  gap: var(--inicio-gap);
  width: 100%;
}

@media (max-width: 720px) {
  .inicio-shell {
    --inicio-gap: 1.35rem;
  }
}
</style>
