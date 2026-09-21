<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import HomeNavigationShortcuts from '@/components/home/HomeNavigationShortcuts.vue'
import PartnerOperabilityBanner from '@/components/parceiro/PartnerOperabilityBanner.vue'
import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
import PortalParceiroDashboard from '@/components/parceiro/PortalParceiroDashboard.vue'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import { getAuthUser } from '@/service/auth/auth-session'
import { currentColors } from '@/theme/color-mode'

const { t, locale } = useI18n()
const { store, ensureContext } = useParceiroPortal()

const now = ref(new Date())
let clockId: ReturnType<typeof setInterval> | undefined

const greetingTitle = computed(() => {
  if (store.semAcessoParceiro) {
    const nome = getAuthUser()?.nome?.trim()
    return nome ? t('inicio.greeting.helloName', { name: nome }) : t('inicio.greeting.hello')
  }

  return t('inicio.greeting.helloName', { name: store.parceiroNome })
})

const loadError = computed(() =>
  store.loadState === 'error' && !store.semAcessoParceiro ? store.errorMessage : '',
)

/**
 * Só a primeira letra sobe. `text-transform: capitalize` fazia "Quinta-Feira, 17 De Setembro" e,
 * no sérvio, "Četvrtak, 17. Septembar" (mês com maiúscula é erro nos dois idiomas).
 */
const todayLabel = computed(() => {
  const intlLocale = INTL_LOCALE[locale.value as Locale]
  const label = now.value.toLocaleDateString(intlLocale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  })

  return label.charAt(0).toLocaleUpperCase(intlLocale) + label.slice(1)
})

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
    :subtitle="t('inicio.subtitle')"
    :title="greetingTitle"
    :loading="false"
    :error="loadError"
    :no-partner-access="store.semAcessoParceiro"
    block-when-suspended
    guidance
    @retry="ensureContext(true)"
  >
    <template #actions>
      <time class="inicio-date" :style="pageAtmosphere" :datetime="now.toISOString()">
        {{ todayLabel }}
      </time>
    </template>

    <div class="inicio-shell" :style="pageAtmosphere">
      <PartnerOperabilityBanner />

      <p v-if="isGuidanceVisible" class="inicio-lede">
        {{ t('inicio.lede') }}
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
