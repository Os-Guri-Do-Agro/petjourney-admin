<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { currentColors } from '@/theme/color-mode'

const sectionStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--dash-card': colors.dashboard.surface,
    '--dash-line': colors.dashboard.line,
    '--dash-muted': colors.dashboard.muted,
    '--dash-primary': colors.vet.primary,
    '--dash-primary-soft': colors.vet.secondary,
    '--dash-success-bg': colors.dashboard.successBg,
    '--dash-success-text': colors.dashboard.successText,
    '--dash-warm-bg': colors.dashboard.warmBg,
    '--dash-warm-text': colors.dashboard.warmText,
    '--dash-amber-bg': colors.dashboard.amberBg,
    '--dash-amber-text': colors.dashboard.amberText,
  }
})

const metrics = [
  { label: 'Consultas hoje', value: '8', detail: '3 até 12h', tone: 'success' },
  { label: 'Atendidos', value: '5', detail: '62% do dia', tone: 'success' },
  { label: 'Pendências', value: '6', detail: '2 urgentes', tone: 'attention' },
  { label: 'Em atenção', value: '3', detail: 'risco ou retorno', tone: 'danger' },
]

const shortcuts = [
  { label: 'Agenda', to: '/veterinario/agenda', icon: 'pi pi-calendar', description: 'Calendário do dia' },
  { label: 'Atividades', to: '/veterinario/atividades', icon: 'pi pi-list', description: 'Tarefas e follow-ups' },
  { label: 'Pacientes', to: '/veterinario/pacientes', icon: 'pi pi-users', description: 'Cadastro e busca' },
  { label: 'Prontuários', to: '/veterinario/prontuarios', icon: 'pi pi-file-edit', description: 'Histórico clínico' },
]
</script>

<template>
  <section class="home-block" :style="sectionStyle" aria-labelledby="home-clinical-title">
    <header class="home-block__header">
      <div>
        <p class="home-block__eyebrow">Clínica</p>
        <h2 id="home-clinical-title">Rotina de hoje</h2>
        <p class="home-block__meta">Agenda, pendências e pacientes em um só lugar.</p>
      </div>
      <RouterLink class="home-block__cta" to="/veterinario/agenda">
        <i class="pi pi-calendar" aria-hidden="true" />
        Abrir agenda
      </RouterLink>
    </header>

    <div class="home-block__metrics">
      <article
        v-for="metric in metrics"
        :key="metric.label"
        class="metric-card"
        :data-tone="metric.tone"
      >
        <span>{{ metric.label }}</span>
        <strong>{{ metric.value }}</strong>
        <small>{{ metric.detail }}</small>
      </article>
    </div>

    <div class="home-block__links">
      <RouterLink
        v-for="item in shortcuts"
        :key="item.to"
        class="quick-link"
        :to="item.to"
      >
        <i :class="item.icon" aria-hidden="true" />
        <span>{{ item.label }}</span>
        <small>{{ item.description }}</small>
      </RouterLink>
    </div>
  </section>
</template>

<style scoped>
.home-block {
  display: grid;
  gap: 1rem;
  padding: 1.2rem 1.25rem;
  border: 1px solid var(--dash-line);
  border-radius: 1rem;
  background: var(--dash-card);
}

.home-block__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
}

.home-block__eyebrow {
  margin: 0 0 0.35rem;
  color: var(--dash-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.home-block__header h2 {
  margin: 0;
  font-size: 1.25rem;
}

.home-block__meta {
  margin: 0.45rem 0 0;
  color: var(--dash-muted);
  font-size: 0.88rem;
}

.home-block__cta {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.55rem 0.9rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--dash-primary-soft) 20%, var(--dash-card));
  color: var(--dash-primary);
  font-size: 0.84rem;
  font-weight: 650;
  text-decoration: none;
}

.home-block__metrics {
  display: grid;
  gap: 0.65rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.metric-card {
  display: grid;
  gap: 0.15rem;
  padding: 0.85rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--dash-primary-soft) 8%, var(--dash-card));
}

.metric-card[data-tone='success'] {
  background: color-mix(in srgb, var(--dash-success-bg) 55%, var(--dash-card));
}

.metric-card[data-tone='attention'] {
  background: color-mix(in srgb, var(--dash-amber-bg) 55%, var(--dash-card));
}

.metric-card[data-tone='danger'] {
  background: color-mix(in srgb, var(--dash-warm-bg) 55%, var(--dash-card));
}

.metric-card span,
.metric-card small {
  color: var(--dash-muted);
  font-size: 0.76rem;
}

.metric-card strong {
  font-size: 1.2rem;
}

.home-block__links {
  display: grid;
  gap: 0.55rem;
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.quick-link {
  display: grid;
  gap: 0.2rem;
  min-height: 4.25rem;
  padding: 0.75rem;
  border: 1px solid var(--dash-line);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--dash-primary-soft) 12%, var(--dash-card));
  color: inherit;
  text-decoration: none;
}

.quick-link i {
  color: var(--dash-primary);
  font-size: 0.95rem;
}

.quick-link span {
  font-size: 0.86rem;
  font-weight: 650;
}

.quick-link small {
  color: var(--dash-muted);
  font-size: 0.74rem;
}

@media (max-width: 900px) {
  .home-block__metrics,
  .home-block__links {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 560px) {
  .home-block__header {
    flex-direction: column;
  }

  .home-block__metrics,
  .home-block__links {
    grid-template-columns: 1fr;
  }
}
</style>
