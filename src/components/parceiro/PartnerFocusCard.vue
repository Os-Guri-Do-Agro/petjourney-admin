<script setup lang="ts">
import { usePartnerFocusSurface } from '@/composables/usePartnerFocusSurface'

withDefaults(
  defineProps<{
    muted?: boolean
  }>(),
  {
    muted: false,
  },
)

const { focusSurfaceStyle } = usePartnerFocusSurface()
</script>

<template>
  <article
    class="partner-focus"
    :class="{ 'partner-focus--muted': muted }"
    :style="focusSurfaceStyle"
  >
    <div v-if="!muted" class="partner-focus__glow" aria-hidden="true" />
    <slot />
  </article>
</template>

<style scoped>
.partner-focus {
  position: relative;
  overflow: hidden;
  display: grid;
  gap: 1.05rem;
  align-content: start;
  min-height: 100%;
  padding: 1.25rem 1.35rem 1.2rem;
  border: 0;
  border-radius: 1.25rem;
  background:
    radial-gradient(
      circle at 88% -8%,
      rgb(var(--pf-glow-rgb) / 0.28) 0%,
      rgb(var(--pf-glow-rgb) / 0.08) 38%,
      transparent 64%
    ),
    linear-gradient(152deg, var(--pf-from), var(--pf-to));
  box-shadow: 0 18px 40px rgb(var(--pf-shadow-rgb) / 0.11);
  color: var(--pf-on);
}

.partner-focus--muted {
  border: 1px solid color-mix(in srgb, var(--pf-from) 35%, transparent);
  background:
    linear-gradient(
      160deg,
      color-mix(in srgb, var(--pf-from) 26%, transparent),
      color-mix(in srgb, var(--pf-to) 10%, transparent) 55%
    );
  box-shadow: 0 12px 28px rgb(var(--pf-shadow-rgb) / 0.045);
  color: inherit;
}

.partner-focus__glow {
  position: absolute;
  top: -4rem;
  inset-inline-end: 0;
  z-index: 0;
  width: 11rem;
  max-width: 55%;
  height: 11rem;
  border-radius: 999px;
  background: rgb(var(--pf-glow-rgb) / 0.14);
  pointer-events: none;
  transform: translateX(30%);
}

[dir='rtl'] .partner-focus__glow {
  transform: translateX(-30%);
}

.partner-focus > :not(.partner-focus__glow) {
  position: relative;
  z-index: 1;
}
</style>
