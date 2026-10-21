<script setup lang="ts">
/**
 * Os dois programas da rede, lado a lado, e como um programa é ativado.
 *
 * Cada programa é uma folha que diz, de cima para baixo: o nome e o estado (selo com palavra), o
 * que ele dá, e a ação certa para aquele estado. A ativação embaixo é uma sequência de verdade
 * (pedir, análise, ativo), por isso vira passos numerados com as cores dos mesmos selos.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ProgramaParticipacaoCard from '@/components/parceiro/ProgramaParticipacaoCard.vue'
import { isGuidanceVisible } from '@/composables/useLayoutPreferences'
import { useParceiroPortal } from '@/composables/useParceiroPortal'

const { t } = useI18n()
const { store } = useParceiroPortal()

const isLoading = computed(() => store.loadState === 'loading' || store.loadState === 'idle')

const activationSteps = computed(() => [
  {
    id: 'solicitar',
    number: '1',
    icon: 'ph ph-paper-plane-tilt',
    title: t('programas.activation.step1.title'),
    description: t('programas.activation.step1.desc'),
  },
  {
    id: 'analise',
    number: '2',
    icon: 'ph ph-hourglass',
    title: t('programas.activation.step2.title'),
    description: t('programas.activation.step2.desc'),
  },
  {
    id: 'ativo',
    number: '3',
    icon: 'ph ph-check-circle',
    title: t('programas.activation.step3.title'),
    description: t('programas.activation.step3.desc'),
  },
])
</script>

<template>
  <div class="programas-view">
    <p v-if="isGuidanceVisible" class="programas-view__lede">{{ t('programas.available.lede') }}</p>

    <section
      id="programas"
      class="programas-view__grade"
      :aria-label="
        isLoading ? t('programas.available.loadingAria') : t('programas.available.title')
      "
      :aria-busy="isLoading || undefined"
      :role="isLoading ? 'status' : undefined"
    >
      <ProgramaParticipacaoCard modo="afiliado" :skeleton="isLoading" />
      <ProgramaParticipacaoCard modo="participativo" :skeleton="isLoading" />
    </section>

    <section
      id="programas-ativacao"
      class="ativacao ui-folha ui-cartao"
      aria-labelledby="programas-ativacao-titulo"
    >
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-flag-checkered" /></span>
        <div class="ui-cartao__titulos">
          <h2 id="programas-ativacao-titulo" class="ui-cartao__titulo">
            {{ t('programas.ativacao.titulo') }}
          </h2>
        </div>
      </header>

      <div class="ui-cartao__corpo ativacao__corpo">
        <ol class="etapas">
          <li
            v-for="step in activationSteps"
            :key="step.id"
            class="etapa"
            :class="`etapa--${step.id}`"
            :data-step="step.id"
          >
            <span class="etapa__marco" aria-hidden="true">
              <span class="etapa__n ui-num">{{ step.number }}</span>
            </span>
            <span class="etapa__texto">
              <strong>
                <i :class="step.icon" aria-hidden="true" />
                {{ step.title }}
              </strong>
              <span>{{ step.description }}</span>
            </span>
          </li>
        </ol>
      </div>

      <p class="ui-cartao__pe etapas__nota">
        <i class="ph ph-info" aria-hidden="true" />
        <template v-if="store.semAcessoParceiro">
          {{ t('programas.activation.noteNoAccess') }}
        </template>
        <template v-else>
          {{ t('programas.activation.noteWithAccess') }}
        </template>
      </p>
    </section>
  </div>
</template>

<style scoped>
.programas-view {
  display: grid;
  gap: 24px;
  min-width: 0;
}

.ativacao {
  overflow: clip;
}

.ativacao__corpo.ui-cartao__corpo {
  padding: 22px 22px 20px;
}

.programas-view__lede {
  margin: 0 0 -8px;
  color: var(--tinta-2);
  font-size: 14px;
}

/* Os dois programas lado a lado: mesma altura, a ação de cada um no pé da folha. */
.programas-view__grade {
  display: grid;
  gap: 20px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 340px), 1fr));
}

/* ------------------------------------------------------------------ etapas */

.etapas {
  --etapa-marco: 36px;

  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

/*
 * Cada etapa: o número num disco e, até o próximo disco, um fio. O fio é o que diz "sequência";
 * a cor do disco é a do selo que o programa ganha naquela etapa (neutro, atenção, ok).
 */
.etapa {
  position: relative;
  display: grid;
  align-content: start;
  gap: 12px;
  padding-inline-end: 20px;
}

.etapa__marco {
  position: relative;
  display: flex;
  align-items: center;
}

.etapa:not(:last-child) .etapa__marco::after {
  position: absolute;
  inset-inline: calc(var(--etapa-marco) + 10px) -10px;
  top: 50%;
  height: 2px;
  border-radius: 2px;
  background: var(--linha-media);
  content: '';
}

.etapa__n {
  display: grid;
  width: var(--etapa-marco);
  height: var(--etapa-marco);
  flex: none;
  place-items: center;
  border-radius: 999px;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-size: 15px;
  font-weight: 650;
}

.etapa--analise .etapa__n {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.etapa--ativo .etapa__n {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.etapa__texto {
  display: grid;
  gap: 3px;
  line-height: 1.45;
}

.etapa__texto strong {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.etapa__texto strong i {
  color: var(--tinta-2);
  font-size: 16px;
}

.etapa__texto > span {
  color: var(--tinta-2);
  font-size: 13.5px;
}

.etapas__nota.ui-cartao__pe {
  flex-wrap: nowrap;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.etapas__nota i {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 16px;
}

/* Estreito: os passos descem em coluna, e o fio vira vertical entre os discos. */
@media (max-width: 720px) {
  .etapas {
    gap: 0;
    grid-template-columns: minmax(0, 1fr);
  }

  .etapa {
    grid-template-columns: var(--etapa-marco) minmax(0, 1fr);
    gap: 14px;
    padding-block-end: 18px;
    padding-inline-end: 0;
  }

  .etapa__marco {
    align-items: flex-start;
    align-self: stretch;
  }

  .etapa:not(:last-child) .etapa__marco::after {
    inset-inline: calc(var(--etapa-marco) / 2 - 1px) auto;
    top: calc(var(--etapa-marco) + 6px);
    bottom: -12px;
    width: 2px;
    height: auto;
  }

  .etapa__texto {
    padding-top: 6px;
  }
}
</style>
