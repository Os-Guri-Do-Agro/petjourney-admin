<script setup lang="ts">
withDefaults(
  defineProps<{
    title: string
    description?: string
    icon?: string
  }>(),
  {
    description: '',
    icon: 'pi pi-spin pi-spinner',
  },
)
</script>

<template>
  <div class="panel-loading" role="status" aria-live="polite">
    <span class="panel-loading__orb" aria-hidden="true">
      <i :class="icon" />
    </span>
    <div class="panel-loading__copy">
      <strong>{{ title }}</strong>
      <p v-if="description">{{ description }}</p>
    </div>
  </div>
</template>

<style scoped>
.panel-loading {
  display: grid;
  justify-items: center;
  gap: 0.95rem;
  padding: 2.4rem 1.4rem;
  border: 1px solid var(--partner-line);
  border-radius: 1.15rem;
  background:
    radial-gradient(
      120% 140% at 50% 0%,
      color-mix(in srgb, var(--partner-primary-soft) 35%, transparent),
      transparent 62%
    ),
    var(--partner-card);
  box-shadow: 0 12px 28px rgb(var(--partner-shadow-rgb) / 0.045);
  text-align: center;
}

.panel-loading__orb {
  display: grid;
  width: 3.1rem;
  height: 3.1rem;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 28%, var(--partner-line));
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary-soft) 40%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 1.15rem;
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 40%, transparent);
}

.panel-loading__copy {
  display: grid;
  gap: 0.28rem;
  max-width: 22rem;
}

.panel-loading__copy strong {
  color: var(--partner-text);
  font-size: 0.95rem;
  font-weight: 700;
  letter-spacing: -0.015em;
}

.panel-loading__copy p {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.84rem;
  line-height: 1.45;
}
</style>
