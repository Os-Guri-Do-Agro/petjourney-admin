<script setup lang="ts">
import { computed } from 'vue'

import ProgramaParticipacaoCard from '@/components/parceiro/ProgramaParticipacaoCard.vue'
import PortalCredenciamentoSection from '@/components/parceiro/sections/PortalCredenciamentoSection.vue'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const { store } = useParceiroPortal()

const isLoading = computed(
  () => store.loadState === 'loading' || store.loadState === 'idle',
)

const viewStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--prog-card': colors.dashboard.surface,
    '--prog-surface': colors.dashboard.surfaceSoft,
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
    description: 'O dono pede a ativação do programa.',
  },
  {
    id: 'analise',
    number: '2',
    title: 'Em análise',
    description: 'A equipe PetJourney revisa o pedido.',
  },
  {
    id: 'ativo',
    number: '3',
    title: 'Ativo',
    description: 'Benefícios liberados para a empresa.',
  },
] as const
</script>

<template>
  <div class="programas-view" :style="viewStyle">
    <section class="prog-zone" aria-labelledby="prog-cards-title">
      <header class="prog-zone__head">
        <div class="prog-zone__title-row">
          <p class="prog-zone__index">01</p>
          <h2 id="prog-cards-title">Programas disponíveis</h2>
        </div>
        <p>Solicite afiliado e/ou participativo conforme o modelo da sua empresa.</p>
      </header>

      <div
        id="programas"
        class="programas-view__grid"
        :aria-busy="isLoading || undefined"
        :aria-label="isLoading ? 'Carregando programas' : undefined"
        :role="isLoading ? 'status' : undefined"
      >
        <ProgramaParticipacaoCard modo="afiliado" :skeleton="isLoading" />
        <ProgramaParticipacaoCard modo="participativo" :skeleton="isLoading" />
      </div>
    </section>

    <section class="prog-zone" aria-labelledby="activation-title">
      <header class="prog-zone__head">
        <div class="prog-zone__title-row">
          <p class="prog-zone__index">02</p>
          <h2 id="activation-title">Como funciona a ativação</h2>
        </div>
        <p>Fluxo simples, com análise do time PetJourney.</p>
      </header>

      <div class="activation-panel">
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
      </div>
    </section>

    <section
      v-if="!store.podeOperar || isLoading"
      class="prog-zone programas-view__cred"
      aria-labelledby="cred-zone-title"
    >
      <header class="prog-zone__head">
        <div class="prog-zone__title-row">
          <p class="prog-zone__index">03</p>
          <h2 id="cred-zone-title">Credenciamento</h2>
        </div>
        <p>Status da auditoria necessária para liberar solicitações.</p>
      </header>

      <PortalCredenciamentoSection :skeleton="isLoading" />
    </section>
  </div>
</template>

<style scoped>
.programas-view {
  display: grid;
  gap: 1.65rem;
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
}

.prog-zone {
  display: grid;
  gap: 0.9rem;
  width: 100%;
}

.prog-zone__head {
  display: grid;
  gap: 0.28rem;
  padding-bottom: 0.55rem;
  border-bottom: 1px solid color-mix(in srgb, var(--prog-line) 85%, transparent);
}

.prog-zone__title-row {
  display: flex;
  align-items: baseline;
  gap: 0.55rem;
}

.prog-zone__index {
  margin: 0;
  color: var(--prog-faint);
  font-size: 0.72rem;
  font-weight: 750;
  letter-spacing: 0.08em;
}

.prog-zone__head h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--prog-text);
}

.prog-zone__head > p {
  margin: 0;
  color: var(--prog-muted);
  font-size: 0.82rem;
  line-height: 1.4;
}

.programas-view__grid {
  display: grid;
  gap: 0.9rem;
  width: 100%;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  align-items: stretch;
  scroll-margin-top: 5rem;
}

.activation-panel {
  display: grid;
  gap: 1rem;
  width: 100%;
  padding: 1.25rem 1.3rem 1.2rem;
  border: 1px solid var(--prog-line);
  border-radius: 1.2rem;
  background: var(--prog-card);
  box-shadow: 0 12px 28px rgb(var(--prog-shadow-rgb) / 0.04);
}

.activation-panel__steps {
  --activation-gap: 1.5rem;
  --activation-number-size: 2.2rem;
  --activation-pad-y: 1rem;

  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--activation-gap);
  margin: 0;
  padding: 0;
  list-style: none;
}

.activation-step {
  position: relative;
  display: grid;
  gap: 0.65rem;
  justify-items: start;
  padding: var(--activation-pad-y) 1.05rem;
  border: 1px solid var(--prog-line);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--prog-surface) 75%, var(--prog-card));
}

.activation-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: calc(var(--activation-pad-y) + (var(--activation-number-size) / 2));
  left: 100%;
  width: var(--activation-gap);
  height: 0;
  border-top: 2px dashed color-mix(in srgb, var(--prog-primary) 45%, var(--prog-line));
  transform: translateY(-50%);
  pointer-events: none;
  z-index: 1;
}

.activation-step__number {
  display: grid;
  width: var(--activation-number-size);
  height: var(--activation-number-size);
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
  margin: 0;
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
  }

  .activation-step:not(:last-child)::after {
    display: none;
  }
}
</style>
