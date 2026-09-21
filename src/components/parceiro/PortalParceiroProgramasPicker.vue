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
  afiliado: 'pi pi-wallet',
  participativo: 'pi pi-star',
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
            <i class="pi pi-check-circle" aria-hidden="true" />
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
.prog-pick {
  display: grid;
  gap: 1rem;
}

.prog-pick__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
}

.prog-pick__head h4 {
  margin: 0;
  color: var(--partner-text);
  font-size: 0.98rem;
  font-weight: 750;
  letter-spacing: -0.02em;
}

.prog-pick__head p {
  margin: 0.25rem 0 0;
  max-width: 46ch;
  color: var(--partner-muted);
  font-size: 0.85rem;
  line-height: 1.5;
}

.prog-pick__counter {
  flex: 0 0 auto;
  padding: 0.32rem 0.7rem;
  border: 1px solid color-mix(in srgb, var(--partner-primary) 30%, var(--partner-line));
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary-soft) 22%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 0.76rem;
  font-weight: 700;
  white-space: nowrap;
}

.prog-pick__grid {
  display: grid;
  gap: 0.85rem;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.prog-card {
  position: relative;
  display: grid;
  gap: 0.7rem;
  align-content: start;
  padding: 1.05rem 1.1rem;
  border: 1.5px solid var(--partner-line);
  border-radius: 1.1rem;
  background: var(--partner-card);
  cursor: pointer;
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease,
    transform 160ms ease;
}

.prog-card:hover:not(.prog-card--locked) {
  border-color: color-mix(in srgb, var(--partner-primary) 45%, var(--partner-line));
  transform: translateY(-1px);
}

/* O foco vive no Checkbox, mas o cartão inteiro é o alvo: o anel aparece no cartão. */
.prog-card:focus-within:not(.prog-card--locked) {
  border-color: var(--partner-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--partner-primary) 22%, transparent);
}

.prog-card--on {
  border-color: color-mix(in srgb, var(--partner-primary) 62%, var(--partner-line));
  background:
    radial-gradient(
      120% 130% at 100% 0%,
      color-mix(in srgb, var(--partner-primary-soft) 30%, transparent),
      transparent 58%
    ),
    var(--partner-card);
  box-shadow: 0 14px 30px rgb(var(--partner-shadow-rgb) / 0.06);
}

.prog-card--locked {
  cursor: default;
  border-style: dashed;
  background: color-mix(in srgb, var(--partner-surface) 55%, var(--partner-card));
}

.prog-card__top {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.7rem;
}

.prog-card__icon {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-primary) 16%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 1rem;
}

.prog-card[data-tone='participativo'] .prog-card__icon {
  background: color-mix(in srgb, var(--partner-amber-text) 16%, var(--partner-card));
  color: var(--partner-amber-text);
}

.prog-card__id {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.prog-card__id strong {
  color: var(--partner-text);
  font-size: 0.94rem;
  font-weight: 750;
  letter-spacing: -0.01em;
}

.prog-card__id span {
  color: var(--partner-muted);
  font-size: 0.78rem;
}

.prog-card__check :deep(.p-checkbox-box) {
  border-radius: 0.55rem;
}

.prog-card__lock {
  padding: 0.24rem 0.6rem;
  border-radius: 999px;
  background: var(--partner-success-bg);
  color: var(--partner-success-text);
  font-size: 0.72rem;
  font-weight: 700;
  white-space: nowrap;
}

.prog-card__lock[data-tone='suspenso'] {
  background: var(--partner-warm-bg);
  color: var(--partner-warm-text);
}

.prog-card__desc {
  margin: 0;
  color: var(--partner-muted);
  font-size: 0.84rem;
  line-height: 1.55;
}

.prog-card__features {
  display: grid;
  gap: 0.35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.prog-card__features li {
  display: flex;
  align-items: flex-start;
  gap: 0.45rem;
  color: var(--partner-text);
  font-size: 0.82rem;
  line-height: 1.4;
}

.prog-card__features i {
  margin-top: 0.12rem;
  color: var(--partner-primary-strong);
  font-size: 0.78rem;
}

.prog-card[data-tone='participativo'] .prog-card__features i {
  color: var(--partner-amber-text);
}

.prog-card__foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
  padding-top: 0.55rem;
  border-top: 1px solid color-mix(in srgb, var(--partner-line) 70%, transparent);
}

.prog-card__state {
  color: var(--partner-faint);
  font-size: 0.76rem;
  font-weight: 650;
}

.prog-card__state[data-on='true'] {
  color: var(--partner-primary-strong);
}

.prog-card__warn {
  color: var(--partner-amber-text);
  font-size: 0.74rem;
}

.prog-pick__how {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0.5rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.prog-pick__how li {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.65rem 0.75rem;
  border: 1px solid color-mix(in srgb, var(--partner-line) 80%, transparent);
  border-radius: 0.8rem;
  background: color-mix(in srgb, var(--partner-surface) 70%, var(--partner-card));
}

.prog-pick__how-step {
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--partner-primary) 18%, var(--partner-card));
  color: var(--partner-primary-strong);
  font-size: 0.72rem;
  font-weight: 750;
}

.prog-pick__how span > strong {
  display: block;
  color: var(--partner-text);
  font-size: 0.8rem;
  font-weight: 700;
}

.prog-pick__how span > small {
  display: block;
  color: var(--partner-muted);
  font-size: 0.74rem;
  line-height: 1.4;
}

.prog-pick__note {
  margin: 0;
  color: var(--partner-faint);
  font-size: 0.78rem;
  line-height: 1.45;
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
</style>
