<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { ModoParticipacao, ModoStatusBloco } from '@/service/parceiro/types'
import {
  MODOS_PARTICIPACAO,
  isProgramaEditavelNoCadastro,
} from '@/utils/parceiro/modo-participacao'

const props = withDefaults(
  defineProps<{
    /** Blocos do `GET /status`; ausente no primeiro cadastro. */
    blocos?: Partial<Record<ModoParticipacao, ModoStatusBloco>> | null
    disabled?: boolean
  }>(),
  {
    blocos: null,
    disabled: false,
  },
)

const selecionados = defineModel<ModoParticipacao[]>({ default: () => [] })

const { t } = useI18n()

const ICONES: Record<ModoParticipacao, string> = {
  afiliado: 'ph ph-wallet',
  participativo: 'ph ph-star',
}

type CardEstado = 'editavel' | 'ativo' | 'suspenso'

type ProgramaCard = {
  modo: ModoParticipacao
  icon: string
  estado: CardEstado
  /** Já estava pedido antes deste envio: desmarcar aqui cancela o pedido. */
  jaSolicitado: boolean
}

const cards = computed<ProgramaCard[]>(() =>
  MODOS_PARTICIPACAO.map((modo) => {
    const status = props.blocos?.[modo]?.status

    return {
      modo,
      icon: ICONES[modo],
      estado:
        status && !isProgramaEditavelNoCadastro(status)
          ? status === 'ATIVO'
            ? 'ativo'
            : 'suspenso'
          : 'editavel',
      jaSolicitado: status === 'SOLICITADO',
    }
  }),
)

const total = computed(() => selecionados.value.length)

function isSelecionado(modo: ModoParticipacao) {
  return selecionados.value.includes(modo)
}

function toggle(modo: ModoParticipacao) {
  selecionados.value = isSelecionado(modo)
    ? selecionados.value.filter((item) => item !== modo)
    : [...selecionados.value, modo]
}
</script>

<template>
  <section class="prog-pick" aria-labelledby="prog-pick-title">
    <header class="prog-pick__head">
      <div>
        <h4 id="prog-pick-title">{{ t('parceiroCadastro.programas.title') }}</h4>
        <p>{{ t('parceiroCadastro.programas.lede') }}</p>
      </div>
      <span class="prog-pick__counter" aria-live="polite">
        {{ t('parceiroCadastro.programas.counter', total) }}
      </span>
    </header>

    <div class="prog-pick__grid">
      <component
        :is="card.estado === 'editavel' ? 'label' : 'div'"
        v-for="card in cards"
        :key="card.modo"
        class="prog-card"
        :class="{
          'prog-card--on': card.estado === 'editavel' && isSelecionado(card.modo),
          'prog-card--locked': card.estado !== 'editavel',
        }"
        :data-tone="card.modo"
      >
        <div class="prog-card__top">
          <span class="prog-card__icon" aria-hidden="true">
            <i :class="card.icon" />
          </span>

          <div class="prog-card__id">
            <strong>{{ t(`parceiroCadastro.programas.${card.modo}.name`) }}</strong>
            <span>{{ t(`parceiroCadastro.programas.${card.modo}.tagline`) }}</span>
          </div>

          <!-- O cartão inteiro é o <label>: clicar em qualquer ponto alterna o Checkbox. -->
          <Checkbox
            v-if="card.estado === 'editavel'"
            class="prog-card__check"
            binary
            size="large"
            :input-id="`prog-pick-${card.modo}`"
            :model-value="isSelecionado(card.modo)"
            :disabled="disabled"
            @update:model-value="toggle(card.modo)"
          />
          <span v-else class="prog-card__lock" :data-tone="card.estado">
            {{
              card.estado === 'ativo'
                ? t('parceiroCadastro.programas.lockedAtivo')
                : t('parceiroCadastro.programas.lockedSuspenso')
            }}
          </span>
        </div>

        <p class="prog-card__desc">
          {{ t(`parceiroCadastro.programas.${card.modo}.description`) }}
        </p>

        <ul class="prog-card__features">
          <li v-for="n in 3" :key="n">
            <i class="ph ph-check-circle" aria-hidden="true" />
            <span>{{ t(`parceiroCadastro.programas.${card.modo}.feature${n}`) }}</span>
          </li>
        </ul>

        <footer class="prog-card__foot">
          <span v-if="card.estado !== 'editavel'" class="prog-card__state">
            {{ t('parceiroCadastro.programas.lockedHint') }}
          </span>
          <template v-else>
            <span class="prog-card__state" :data-on="isSelecionado(card.modo)">
              {{
                isSelecionado(card.modo)
                  ? t('parceiroCadastro.programas.selected')
                  : t('parceiroCadastro.programas.notSelected')
              }}
            </span>
            <span v-if="card.jaSolicitado && !isSelecionado(card.modo)" class="prog-card__warn">
              {{ t('parceiroCadastro.programas.cancelWarning') }}
            </span>
          </template>
        </footer>
      </component>
    </div>

    <ol class="prog-pick__how">
      <li v-for="n in 3" :key="n">
        <span class="prog-pick__how-step" aria-hidden="true">{{ n }}</span>
        <span>
          <strong>{{ t(`parceiroCadastro.programas.how.step${n}Title`) }}</strong>
          <small>{{ t(`parceiroCadastro.programas.how.step${n}Desc`) }}</small>
        </span>
      </li>
    </ol>

    <p class="prog-pick__note">{{ t('parceiroCadastro.programas.note') }}</p>
  </section>
</template>

<style scoped>
/*
 * A escolha dos programas no cadastro, nos tokens do Trilha: cada programa é uma folha que se
 * marca inteira (o cartão é o <label>); marcado, a borda e o fundo ganham a cor do Portal.
 */
.prog-pick {
  display: grid;
  gap: 18px;
}

.prog-pick__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.prog-pick__head h4 {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 600;
}

.prog-pick__head p {
  max-width: 52ch;
  margin: 4px 0 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.prog-pick__counter {
  flex: none;
  padding: 4px 10px;
  border-radius: 999px;
  background: var(--portal-fundo);
  color: var(--portal-tinta);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.prog-pick__grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.prog-card {
  position: relative;
  display: grid;
  align-content: start;
  gap: 12px;
  padding: 18px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  cursor: pointer;
  transition:
    border-color var(--pj-tempo-curto, 140ms) ease-out,
    background-color var(--pj-tempo-curto, 140ms) ease-out;
}

.prog-card:hover:not(.prog-card--locked) {
  border-color: var(--linha-forte);
}

/* O foco vive no Checkbox, mas o cartão inteiro é o alvo: o anel aparece no cartão. */
.prog-card:focus-within:not(.prog-card--locked) {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.prog-card--on {
  border-color: var(--portal);
  background: color-mix(in oklab, var(--portal-fundo) 45%, var(--superficie));
}

.prog-card--on:hover:not(.prog-card--locked) {
  border-color: var(--portal);
}

.prog-card--locked {
  border-style: dashed;
  background: var(--superficie-2);
  cursor: default;
}

.prog-card__top {
  display: grid;
  align-items: center;
  gap: 12px;
  grid-template-columns: auto minmax(0, 1fr) auto;
}

.prog-card__icon {
  display: grid;
  width: 42px;
  height: 42px;
  place-items: center;
  border-radius: 12px;
  background: var(--portal-fundo);
  color: var(--portal-tinta);
  font-size: 21px;
}

.prog-card__id {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.prog-card__id strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.prog-card__id span {
  color: var(--tinta-2);
  font-size: 13px;
}

.prog-card__check :deep(.p-checkbox-box) {
  border-radius: 7px;
}

.prog-card__lock {
  display: inline-flex;
  height: 24px;
  align-items: center;
  padding: 0 9px;
  border-radius: 7px;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
  font-size: 12.5px;
  font-weight: 600;
  white-space: nowrap;
}

.prog-card__lock[data-tone='suspenso'] {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.prog-card__desc {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.55;
}

.prog-card__features {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.prog-card__features li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

.prog-card__features i {
  margin-top: 2px;
  color: var(--ok-tinta);
  font-size: 15px;
}

.prog-card__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding-top: 12px;
  border-top: 1px solid var(--linha);
}

.prog-card__state {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

.prog-card__state[data-on='true'] {
  color: var(--portal-tinta);
  font-weight: 600;
}

.prog-card__warn {
  color: var(--atencao-tinta);
  font-size: 13px;
}

.prog-pick__how {
  display: grid;
  gap: 10px;
  margin: 0;
  padding: 0;
  list-style: none;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.prog-pick__how li {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--superficie-2);
}

.prog-pick__how-step {
  display: grid;
  width: 24px;
  height: 24px;
  flex: none;
  place-items: center;
  border-radius: 999px;
  background: var(--portal-fundo);
  color: var(--portal-tinta);
  font-family: var(--font-dados);
  font-size: 12.5px;
  font-weight: 650;
}

.prog-pick__how span > strong {
  display: block;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.prog-pick__how span > small {
  display: block;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.45;
}

.prog-pick__note {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.5;
}

@media (max-width: 860px) {
  .prog-pick__grid,
  .prog-pick__how {
    grid-template-columns: 1fr;
  }

  .prog-pick__head {
    flex-wrap: wrap;
  }
}

@media (prefers-reduced-motion: reduce) {
  .prog-card {
    transition: none;
  }
}
</style>
