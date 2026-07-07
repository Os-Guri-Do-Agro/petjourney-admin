<script setup lang="ts">
import { computed } from 'vue'

import ProgramaParticipacaoCard from '@/components/parceiro/ProgramaParticipacaoCard.vue'
import PortalCredenciamentoSection from '@/components/parceiro/sections/PortalCredenciamentoSection.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const { store } = useParceiroPortal()

const viewStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--prog-bg': colors.dashboard.bg,
    '--prog-card': colors.dashboard.surface,
    '--prog-line': colors.dashboard.line,
    '--prog-line-soft': colors.dashboard.lineSoft,
    '--prog-text': colors.dashboard.text,
    '--prog-muted': colors.dashboard.muted,
    '--prog-faint': colors.dashboard.faint,
    '--prog-primary': colors.vet.primary,
    '--prog-primary-soft': colors.vet.secondary,
    '--prog-primary-strong': colors.dashboard.primaryStrong,
    '--prog-success-bg': colors.dashboard.successBg,
    '--prog-success-text': colors.dashboard.successText,
    '--prog-amber-bg': colors.dashboard.amberBg,
    '--prog-amber-text': colors.dashboard.amberText,
    '--prog-shadow-rgb': colors.auth.shadowRgb,
  }
})

const activationSteps = [
  {
    id: 'solicitar',
    number: '1',
    title: 'Solicitar',
    description: 'O dono pede a ativação',
  },
  {
    id: 'analise',
    number: '2',
    title: 'Em análise',
    description: 'Equipe PetJourney revisa',
  },
  {
    id: 'ativo',
    number: '3',
    title: 'Ativo',
    description: 'Benefícios liberados',
  },
] as const
</script>

<template>
  <div class="programas-view" :style="viewStyle">
    <p class="programas-view__intro">
      Programas opcionais e independentes para ganhar mais benefícios na rede PetJourney. Cada
      solicitação passa por aprovação do time.
    </p>

    <div id="programas" class="programas-view__grid">
      <ProgramaParticipacaoCard modo="afiliado" />
      <ProgramaParticipacaoCard modo="participativo" />
    </div>

    <section class="activation-panel" aria-labelledby="activation-title">
      <h2 id="activation-title">Como funciona a ativação</h2>

      <ol class="activation-panel__steps">
        <li
          v-for="step in activationSteps"
          :key="step.id"
          class="activation-step"
          :data-step="step.id"
        >
          <span class="activation-step__number">{{ step.number }}</span>
          <div>
            <strong>{{ step.title }}</strong>
            <small>{{ step.description }}</small>
          </div>
        </li>
      </ol>

      <p class="activation-panel__note">
        Somente o dono da conta pode solicitar a ativação. Operadores acompanham o status, mas não
        enviam pedidos.
      </p>
    </section>

    <section
      v-if="!store.podeOperar"
      class="programas-view__cred"
      aria-label="Credenciamento"
    >
      <PortalCredenciamentoSection />
    </section>
  </div>
</template>

<style scoped>
.programas-view {
  display: grid;
  gap: 1.25rem;
}

.programas-view__intro {
  margin: 0;
  max-width: 42rem;
  color: var(--prog-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.programas-view__grid {
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  scroll-margin-top: 5rem;
}

.activation-panel {
  display: grid;
  gap: 0;
  width: 100%;
  padding: 1.35rem 1.5rem 1.25rem;
  border: 1px solid var(--prog-line);
  border-radius: 1rem;
  background: var(--prog-card);
  text-align: center;
}

.activation-panel h2 {
  width: 100%;
  margin: 0 0 1.15rem;
  font-size: 0.98rem;
  font-weight: 700;
}

.activation-panel__steps {
  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  margin: 0;
  padding: 0;
  list-style: none;
}

.activation-step {
  position: relative;
  display: grid;
  gap: 0.55rem;
  justify-items: center;
  padding: 0 0.75rem;
  text-align: center;
}

.activation-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: 1.1rem;
  left: calc(50% + 1.1rem);
  width: calc(100% - 2.2rem);
  border-top: 1px dashed var(--prog-line-soft);
  pointer-events: none;
}

.activation-step__number {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  border: 1px solid var(--prog-line);
  border-radius: 999px;
  background: var(--prog-card);
  color: var(--prog-muted);
  font-size: 0.82rem;
  font-weight: 700;
}

.activation-step[data-step='analise'] .activation-step__number {
  border-color: color-mix(in srgb, var(--prog-amber-text) 35%, var(--prog-line));
  background: var(--prog-amber-bg);
  color: var(--prog-amber-text);
}

.activation-step[data-step='ativo'] .activation-step__number {
  border-color: color-mix(in srgb, var(--prog-success-text) 35%, var(--prog-line));
  background: var(--prog-success-bg);
  color: var(--prog-success-text);
}

.activation-step strong {
  display: block;
  font-size: 0.86rem;
}

.activation-step small {
  display: block;
  margin-top: 0.12rem;
  color: var(--prog-muted);
  font-size: 0.76rem;
  line-height: 1.35;
}

.activation-panel__note {
  width: 100%;
  margin: 1.1rem 0 0;
  padding-top: 0.95rem;
  border-top: 1px solid var(--prog-line-soft);
  color: var(--prog-faint);
  font-size: 0.8rem;
  line-height: 1.45;
}

.programas-view__cred {
  scroll-margin-top: 5rem;
}

@media (max-width: 900px) {
  .programas-view__grid {
    grid-template-columns: 1fr;
  }

  .activation-panel__steps {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .activation-step:not(:last-child)::after {
    display: none;
  }
}
</style>
