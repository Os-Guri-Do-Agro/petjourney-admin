<script setup lang="ts">
import { computed } from 'vue'

import PartnerStatusBadge from '@/components/parceiro/PartnerStatusBadge.vue'
import type { StatusAuditoriaParceiro, StatusModoParceiro } from '@/service/parceiro/types'
import { currentColors } from '@/theme/color-mode'

export type ProgramNavTone = 'primary' | 'success' | 'amber' | 'warm'

export type ProgramNavItem = {
  id: string
  label: string
  description: string
  icon: string
  tone: ProgramNavTone
  status?: StatusAuditoriaParceiro | StatusModoParceiro
}

const props = defineProps<{
  items: ProgramNavItem[]
  activeId: string
}>()

const emit = defineEmits<{
  select: [id: string]
}>()

const navStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--pnav-card': colors.dashboard.surface,
    '--pnav-surface': colors.dashboard.surfaceSoft,
    '--pnav-line': colors.dashboard.line,
    '--pnav-line-soft': colors.dashboard.lineSoft,
    '--pnav-text': colors.dashboard.text,
    '--pnav-muted': colors.dashboard.muted,
    '--pnav-faint': colors.dashboard.faint,
    '--pnav-primary': colors.vet.primary,
    '--pnav-primary-strong': colors.dashboard.primaryStrong,
    '--pnav-success-bg': colors.dashboard.successBg,
    '--pnav-success-text': colors.dashboard.successText,
    '--pnav-amber-bg': colors.dashboard.amberBg,
    '--pnav-amber-text': colors.dashboard.amberText,
    '--pnav-warm-bg': colors.dashboard.warmBg,
    '--pnav-warm-text': colors.dashboard.warmText,
    '--pnav-shadow-rgb': colors.auth.shadowRgb,
  }
})

const ariaLabel = computed(() => `Abas: ${props.items.map((item) => item.label).join(', ')}`)
</script>

<template>
  <nav class="program-nav" :style="navStyle" role="tablist" :aria-label="ariaLabel">
    <button
      v-for="item in items"
      :id="`partner-tab-${item.id}`"
      :key="item.id"
      class="program-nav__card"
      :class="{ 'program-nav__card--active': item.id === activeId }"
      :data-tone="item.tone"
      type="button"
      role="tab"
      :aria-selected="item.id === activeId"
      :aria-controls="`partner-panel-${item.id}`"
      @click="emit('select', item.id)"
    >
      <span class="program-nav__icon" aria-hidden="true">
        <i :class="item.icon" />
      </span>

      <span class="program-nav__body">
        <strong>{{ item.label }}</strong>
        <small>{{ item.description }}</small>
      </span>

      <PartnerStatusBadge
        v-if="item.status"
        class="program-nav__status"
        :status="item.status"
      />
    </button>
  </nav>
</template>

<style scoped>
.program-nav {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 1.15rem;
}

.program-nav__card {
  position: relative;
  display: grid;
  grid-template-columns: 2.75rem 1fr auto;
  align-items: center;
  gap: 0.8rem;
  padding: 0.95rem 1rem 1.1rem;
  border: 1px solid var(--pnav-line);
  border-radius: 1rem;
  background: var(--pnav-card);
  color: var(--pnav-text);
  text-align: left;
  cursor: pointer;
  transition:
    border-color 180ms ease,
    transform 180ms ease,
    box-shadow 180ms ease;
}

.program-nav__card:hover {
  transform: translateY(-1px);
  border-color: color-mix(in srgb, var(--pnav-primary) 28%, var(--pnav-line));
  box-shadow: 0 14px 28px rgb(var(--pnav-shadow-rgb) / 0.06);
}

.program-nav__card:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--pnav-primary) 55%, transparent);
  outline-offset: 2px;
}

.program-nav__card--active {
  border-color: color-mix(in srgb, var(--pnav-primary) 55%, var(--pnav-line));
  background:
    radial-gradient(
      130% 220% at 0% 0%,
      color-mix(in srgb, var(--pnav-primary) 12%, transparent),
      transparent 60%
    ),
    var(--pnav-card);
  box-shadow: 0 18px 34px rgb(var(--pnav-shadow-rgb) / 0.08);
}

.program-nav__card--active::after {
  content: '';
  position: absolute;
  right: 1rem;
  bottom: 0.55rem;
  left: 1rem;
  height: 3px;
  border-radius: 999px;
  background: var(--pnav-primary-strong);
}

.program-nav__icon {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--pnav-primary) 16%, var(--pnav-card));
  color: var(--pnav-primary-strong);
  font-size: 1.02rem;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.program-nav__card[data-tone='success'] .program-nav__icon {
  background: var(--pnav-success-bg);
  color: var(--pnav-success-text);
}

.program-nav__card[data-tone='amber'] .program-nav__icon {
  background: var(--pnav-amber-bg);
  color: var(--pnav-amber-text);
}

.program-nav__card[data-tone='warm'] .program-nav__icon {
  background: var(--pnav-warm-bg);
  color: var(--pnav-warm-text);
}

.program-nav__body {
  display: grid;
  min-width: 0;
  gap: 0.18rem;
}

.program-nav__body strong {
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.01em;
}

.program-nav__body small {
  overflow: hidden;
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  color: var(--pnav-muted);
  font-size: 0.78rem;
  line-height: 1.35;
}

.program-nav__status {
  align-self: center;
}

@media (max-width: 1180px) {
  .program-nav {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .program-nav {
    grid-template-columns: 1fr;
  }

  .program-nav__card {
    grid-template-columns: 2.6rem 1fr;
    grid-template-rows: auto auto;
  }

  .program-nav__status {
    grid-column: 1 / -1;
    justify-self: end;
  }
}
</style>
