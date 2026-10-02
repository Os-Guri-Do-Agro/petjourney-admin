<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ProgramaParticipacaoCard from '@/components/parceiro/ProgramaParticipacaoCard.vue'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { currentColors } from '@/theme/color-mode'

const { t } = useI18n()
const { store } = useParceiroPortal()

const isLoading = computed(() => store.loadState === 'loading' || store.loadState === 'idle')

/** As etapas de ativação ficam recolhidas: com os programas já ativos, ninguém precisa delas. */
const etapasAbertas = ref(false)

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

const activationSteps = computed(() => [
  {
    id: 'solicitar',
    number: '1',
    title: t('programas.activation.step1.title'),
    description: t('programas.activation.step1.desc'),
  },
  {
    id: 'analise',
    number: '2',
    title: t('programas.activation.step2.title'),
    description: t('programas.activation.step2.desc'),
  },
  {
    id: 'ativo',
    number: '3',
    title: t('programas.activation.step3.title'),
    description: t('programas.activation.step3.desc'),
  },
])
</script>

<template>
  <div class="programas-view" :style="viewStyle">
    <p v-if="isGuidanceVisible" class="programas-view__lede">{{ t('programas.available.lede') }}</p>

    <!-- O título "Programas disponíveis" saiu: a saudação da página já diz de que tela se trata. -->
    <section
      id="programas"
      class="hc programas-view__lista"
      :aria-label="
        isLoading ? t('programas.available.loadingAria') : t('programas.available.title')
      "
      :aria-busy="isLoading || undefined"
      :role="isLoading ? 'status' : undefined"
    >
      <ProgramaParticipacaoCard modo="afiliado" :skeleton="isLoading" />
      <ProgramaParticipacaoCard modo="participativo" :skeleton="isLoading" />
    </section>

    <section class="hc ativacao" aria-labelledby="activation-title">
      <div class="ativacao__linha">
        <p class="ativacao__frase">
          <strong id="activation-title">{{ t('programas.linha.ativacaoRotulo') }}</strong>
          {{ t('programas.linha.ativacaoFrase') }}
        </p>
        <Button
          type="button"
          :label="
            etapasAbertas ? t('programas.linha.ocultarEtapas') : t('programas.linha.verEtapas')
          "
          :icon="etapasAbertas ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          icon-pos="right"
          severity="secondary"
          text
          size="small"
          :aria-expanded="etapasAbertas"
          aria-controls="programas-etapas"
          @click="etapasAbertas = !etapasAbertas"
        />
      </div>

      <!-- v-show, não v-if: o alvo do `aria-controls` precisa existir sempre. -->
      <div v-show="etapasAbertas" id="programas-etapas" class="activation-panel">
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
          <template v-if="store.semAcessoParceiro">
            {{ t('programas.activation.noteNoAccess') }}
          </template>
          <template v-else>
            {{ t('programas.activation.noteWithAccess') }}
          </template>
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.programas-view__lede {
  margin: 0;
  color: var(--prog-muted);
  font-size: 0.875rem;
}

.programas-view__lista {
  display: grid;
  padding-block: 0.25rem;
}

.ativacao {
  display: grid;
  gap: 0.85rem;
  padding-block: 0.9rem;
}

.ativacao__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}

.ativacao__frase {
  margin: 0;
  color: var(--prog-muted);
  font-size: 0.875rem;
  line-height: 1.5;
}

.ativacao__frase strong {
  color: var(--prog-text);
}

.programas-view {
  display: grid;
  gap: 1.65rem;
  width: 100%;
  max-width: 100%;
  overflow-x: clip;
}

/* Dentro da linha de ativação, sem moldura própria: cartão dentro de cartão não volta. */
.activation-panel {
  display: grid;
  gap: 1rem;
  width: 100%;
}

.activation-panel__steps {
  --activation-gap: 1.5rem;
  --activation-number-size: 2rem;

  display: grid;
  width: 100%;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: var(--activation-gap);
  margin: 0;
  padding: 0;
  list-style: none;
}

/* Etapa sem moldura: número, linha tracejada até o próximo número, texto embaixo. */
.activation-step {
  position: relative;
  display: grid;
  gap: 0.55rem;
  justify-items: start;
}

.activation-step:not(:last-child)::after {
  content: '';
  position: absolute;
  top: calc(var(--activation-number-size) / 2);
  inset-inline-start: calc(var(--activation-number-size) + 0.6rem);
  inset-inline-end: calc(-1 * var(--activation-gap) + 0.6rem);
  height: 0;
  border-top: 2px dashed var(--prog-line);
  pointer-events: none;
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
  font-size: 0.8rem;
  font-weight: 700;
}

.activation-step[data-step='analise'] .activation-step__number {
  border-color: color-mix(in srgb, var(--prog-primary) 35%, var(--prog-line));
  background: color-mix(in srgb, var(--prog-primary-soft) 35%, var(--prog-card));
  color: var(--prog-primary-strong);
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

@media (max-width: 900px) {
  .activation-panel__steps {
    grid-template-columns: 1fr;
  }

  .activation-step:not(:last-child)::after {
    display: none;
  }
}
</style>
