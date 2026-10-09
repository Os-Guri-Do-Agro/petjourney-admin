<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useCupomResgateModal } from '@/composables/useCupomResgateModal'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { usePartnerFocusSurface } from '@/composables/usePartnerFocusSurface'
import { ApiError } from '@/service/api'
import { validarCupom } from '@/service/parceiro/parceiro-portal-service'
import type { ValidarCupomResultado } from '@/service/parceiro/types'
import { LightColors } from '@/theme/colors'
import { currentColors } from '@/theme/color-mode'
import {
  isCodigoResgateFormatoValido,
  normalizarCodigoResgate,
  type ValidarCupomErrorView,
} from '@/utils/parceiro/cupom-resgate'

const { t } = useI18n()
const { visible, close, markSuccess, canOpen } = useCupomResgateModal()
const { store, parceiroQuery } = useParceiroPortal()
const { focusSurfaceStyle } = usePartnerFocusSurface()

type Step = 'input' | 'success' | 'error'

const step = ref<Step>('input')
const codigoInput = ref('')
const submitting = ref(false)
const formatHint = ref('')
const errorView = ref<ValidarCupomErrorView | null>(null)
const resultado = ref<ValidarCupomResultado | null>(null)

const dialogStyle = computed(() => {
  const colors = currentColors.value

  return {
    ...focusSurfaceStyle.value,
    '--vc-bg': colors.dashboard.surface,
    '--vc-text': colors.dashboard.text,
    '--vc-muted': colors.dashboard.muted,
    '--vc-faint': colors.dashboard.faint,
    '--vc-line': colors.dashboard.line,
    '--vc-surface': colors.dashboard.surfaceSoft,
    '--vc-primary': colors.vet.primary,
    '--vc-primary-soft': colors.vet.secondary,
    '--vc-primary-strong': colors.dashboard.primaryStrong,
    '--vc-success-bg': colors.dashboard.successBg,
    '--vc-success-text': colors.dashboard.successText,
    '--vc-warm-bg': colors.dashboard.warmBg,
    '--vc-warm-text': colors.dashboard.warmText,
    '--vc-shadow-rgb': colors.auth.shadowRgb,
    /** Sempre branco real: `auth.white` é superfície (quebrada no claro, escura no dark). */
    '--vc-on-cta': LightColors.text.inverse,
  }
})

const codigoNormalizado = computed(() => normalizarCodigoResgate(codigoInput.value))
const codigoLength = computed(() => codigoNormalizado.value.length)

const canSubmit = computed(
  () =>
    !submitting.value &&
    store.podeOperar &&
    isCodigoResgateFormatoValido(codigoNormalizado.value),
)

const lengthTone = computed(() => {
  if (codigoLength.value === 0) {
    return 'idle'
  }

  if (codigoLength.value < 6) {
    return 'short'
  }

  if (isCodigoResgateFormatoValido(codigoNormalizado.value)) {
    return 'ok'
  }

  return 'warn'
})

function resetForm() {
  step.value = 'input'
  codigoInput.value = ''
  formatHint.value = ''
  errorView.value = null
  resultado.value = null
  submitting.value = false
}

watch(visible, () => {
  resetForm()
})

watch(canOpen, (ok) => {
  if (!ok && visible.value) {
    close()
  }
})

function onCodigoModel(value: string | undefined) {
  codigoInput.value = normalizarCodigoResgate(value ?? '')
  formatHint.value = ''
}

function closeDialog() {
  close()
}

function backToInput() {
  step.value = 'input'
  errorView.value = null
  resultado.value = null
}

function startAnother() {
  resetForm()
}

function resolveErrorView(error: unknown): ValidarCupomErrorView {
  if (!(error instanceof ApiError)) {
    const message =
      error instanceof Error ? error.message : t('shell.cupom.errors.generic.message')

    return {
      title: t('shell.cupom.errors.generic.title'),
      message,
      suggestCheckHistorico: true,
    }
  }

  if (error.statusCode === 404) {
    return {
      title: t('shell.cupom.errors.invalid.title'),
      message: t('shell.cupom.errors.invalid.message'),
    }
  }

  if (error.statusCode === 410) {
    return {
      title: t('shell.cupom.errors.expired.title'),
      message: t('shell.cupom.errors.expired.message'),
    }
  }

  if (error.statusCode === 409) {
    return {
      title: t('shell.cupom.errors.conflict.title'),
      message: error.message,
      suggestCheckHistorico: true,
    }
  }

  if (error.statusCode === 403) {
    return {
      title: t('shell.cupom.errors.forbidden.title'),
      message: t('shell.cupom.errors.forbidden.message'),
    }
  }

  if (error.statusCode === 400) {
    return {
      title: t('shell.cupom.errors.noBusiness.title'),
      message: error.message || t('shell.cupom.errors.noBusiness.message'),
    }
  }

  return {
    title: t('shell.cupom.errors.generic.title'),
    message: error.message || t('shell.cupom.errors.generic.messageShort'),
    suggestCheckHistorico: true,
  }
}

async function handleValidar() {
  const codigo = codigoNormalizado.value

  if (!store.podeOperar) {
    errorView.value = {
      title: t('shell.cupom.errors.noOp.title'),
      message: t('shell.cupom.errors.noOp.message'),
    }
    step.value = 'error'
    return
  }

  if (!isCodigoResgateFormatoValido(codigo)) {
    formatHint.value = t('shell.cupom.formatHint')
    return
  }

  submitting.value = true
  formatHint.value = ''
  errorView.value = null

  try {
    const data = await validarCupom(
      { codigo, canal: 'CODIGO_MANUAL' },
      parceiroQuery(),
    )

    resultado.value = data
    step.value = 'success'
    markSuccess()
  } catch (err) {
    errorView.value = resolveErrorView(err)
    step.value = 'error'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Dialog
    v-model:visible="visible"
    modal
    :draggable="false"
    class="validar-cupom-dialog hc-tema"
    :pt="{ root: { class: 'validar-cupom-dialog' } }"
    @hide="closeDialog"
  >
    <template #container="{ closeCallback }">
      <div class="vc-shell" :style="dialogStyle" role="document">
        <header class="vc-hero">
          <div class="vc-hero__glow" aria-hidden="true" />
          <div class="vc-hero__top">
            <span class="vc-hero__icon" aria-hidden="true">
              <i class="ph ph-ticket" />
            </span>
            <Button
              class="vc-close"
              type="button"
              icon="ph ph-x"
              severity="secondary"
              outlined
              :aria-label="t('shell.cupom.close')"
              :disabled="submitting"
              @click="closeCallback"
            />
          </div>
          <p class="vc-hero__eyebrow">{{ t('shell.cupom.eyebrow') }}</p>
          <h2 id="validar-cupom-title">{{ t('shell.cupom.title') }}</h2>
          <p class="vc-hero__lede">
            {{ t('shell.cupom.lede') }}
          </p>
        </header>

        <div class="vc-shell__body" aria-labelledby="validar-cupom-title">
          <template v-if="step === 'input'">
            <p v-if="!store.podeOperar" class="vc-banner vc-banner--warn" role="status">
              {{ t('shell.cupom.blockedBanner') }}
            </p>

            <div class="vc-stage" :data-tone="lengthTone">
              <div class="vc-field__head">
                <label class="vc-label" for="cupom-resgate-codigo">{{
                  t('shell.cupom.codeLabel')
                }}</label>
                <span class="vc-counter" :data-tone="lengthTone">{{ codigoLength }}/32</span>
              </div>

              <InputText
                id="cupom-resgate-codigo"
                :model-value="codigoInput"
                class="vc-input"
                maxlength="32"
                autocomplete="off"
                spellcheck="false"
                :placeholder="t('shell.cupom.codePlaceholder')"
                :disabled="submitting || !store.podeOperar"
                aria-describedby="cupom-resgate-hint"
                autofocus
                @update:model-value="onCodigoModel"
                @keydown.enter.prevent="handleValidar"
              />

              <p id="cupom-resgate-hint" class="vc-hint">
                {{ t('shell.cupom.hint') }}
              </p>
              <p v-if="formatHint" class="vc-error" role="alert">{{ formatHint }}</p>
            </div>
          </template>

          <template v-else-if="step === 'success' && resultado">
            <div class="vc-result vc-result--success" role="status">
              <span class="vc-result__badge" aria-hidden="true">
                <i class="ph ph-check" />
              </span>
              <p class="vc-result__eyebrow">{{ t('shell.cupom.successEyebrow') }}</p>
              <h3>{{ t('shell.cupom.successTitle') }}</h3>
              <p class="vc-result__discount">
                <span class="vc-result__discount-value">{{ resultado.cupom.descontoPercentual }}%</span>
                <span class="vc-result__discount-label">{{ t('shell.cupom.discountLabel') }}</span>
              </p>

              <div class="vc-result__card">
                <div>
                  <span class="vc-result__k">{{ t('shell.cupom.meta.campaign') }}</span>
                  <strong>{{ resultado.cupom.titulo }}</strong>
                </div>
                <div>
                  <span class="vc-result__k">{{ t('shell.cupom.meta.code') }}</span>
                  <strong>{{ resultado.cupom.codigo }}</strong>
                </div>
                <div v-if="resultado.tutorPrimeiroNome">
                  <span class="vc-result__k">{{ t('shell.cupom.meta.customer') }}</span>
                  <strong>{{ resultado.tutorPrimeiroNome }}</strong>
                </div>
                <div>
                  <span class="vc-result__k">{{ t('shell.cupom.meta.channel') }}</span>
                  <strong>{{ t('shell.cupom.meta.channelManual') }}</strong>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="step === 'error' && errorView">
            <div class="vc-result vc-result--fail" role="alert">
              <span class="vc-result__badge" aria-hidden="true">
                <i class="ph ph-warning-circle" />
              </span>
              <p class="vc-result__eyebrow">{{ t('shell.cupom.errorEyebrow') }}</p>
              <h3>{{ errorView.title }}</h3>
              <p class="vc-result__message">{{ errorView.message }}</p>
              <p v-if="errorView.suggestCheckHistorico" class="vc-result__hint">
                {{ t('shell.cupom.networkHintBefore') }}
                <RouterLink to="/parceiro/divulgacao#resgates" @click="closeDialog">
                  {{ t('shell.cupom.networkHintLink') }}
                </RouterLink>
                {{ t('shell.cupom.networkHintAfter') }}
              </p>
            </div>
          </template>
        </div>

        <footer class="vc-shell__footer">
          <template v-if="step === 'input'">
            <Button
              :label="t('common.cancel')"
              severity="secondary"
              text
              type="button"
              :disabled="submitting"
              @click="closeDialog"
            />
            <Button
              class="vc-cta"
              :label="t('shell.cupom.submit')"
              icon="ph ph-check"
              type="button"
              size="large"
              :loading="submitting"
              :disabled="!canSubmit || submitting"
              @click="handleValidar"
            />
          </template>

          <template v-else-if="step === 'success'">
            <Button
              :label="t('shell.cupom.validateAnother')"
              severity="secondary"
              text
              type="button"
              @click="startAnother"
            />
            <Button
              class="vc-cta"
              :label="t('shell.cupom.applyOk')"
              icon="ph ph-check"
              type="button"
              size="large"
              @click="closeDialog"
            />
          </template>

          <template v-else>
            <Button
              :label="t('shell.cupom.close')"
              severity="secondary"
              text
              type="button"
              @click="closeDialog"
            />
            <Button
              class="vc-cta"
              :label="t('common.tryAgain')"
              icon="ph ph-arrow-clockwise"
              type="button"
              size="large"
              @click="backToInput"
            />
          </template>
        </footer>
      </div>
    </template>
  </Dialog>
</template>

<style scoped>
.vc-shell {
  display: grid;
  grid-template-rows: auto 1fr auto;
  width: min(40rem, calc(100vw - 1.5rem));
  max-height: min(92vh, 52rem);
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--vc-line) 88%, transparent);
  border-radius: 1.55rem;
  background: var(--vc-bg);
  box-shadow:
    0 1px 0 color-mix(in srgb, white 45%, transparent) inset,
    0 28px 70px rgb(var(--vc-shadow-rgb) / 0.24);
  color: var(--vc-text);
}

.vc-hero {
  position: relative;
  overflow: hidden;
  padding: 1.55rem 1.65rem 1.7rem;
  background: linear-gradient(152deg, var(--pf-from), var(--pf-to));
  color: var(--pf-on);
}

.vc-hero__glow {
  position: absolute;
  top: -3.5rem;
  inset-inline-end: -2rem;
  width: 11rem;
  height: 11rem;
  border-radius: 999px;
  background: rgb(var(--pf-glow-rgb) / 0.16);
  pointer-events: none;
}

.vc-hero__top {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  margin-bottom: 1rem;
}

.vc-hero__icon {
  display: grid;
  width: 3.15rem;
  height: 3.15rem;
  place-items: center;
  border-radius: 0.95rem;
  background: var(--pf-chip);
  color: var(--pf-on);
  font-size: 1.25rem;
  box-shadow: inset 0 0 0 1px var(--pf-line);
}

.vc-hero__eyebrow,
.vc-hero h2,
.vc-hero__lede {
  position: relative;
  z-index: 1;
}

.vc-hero__eyebrow {
  margin: 0 0 0.35rem;
  color: var(--pf-on-soft);
  font-size: 0.75rem;
  font-weight: 700;
}

.vc-hero h2 {
  margin: 0;
  font-size: clamp(1.65rem, 2.4vw, 1.95rem);
  font-weight: 700;
  letter-spacing: -0.035em;
  line-height: 1.15;
}

.vc-hero__lede {
  margin: 0.5rem 0 0;
  max-width: 32rem;
  color: var(--pf-on-soft);
  font-size: 1rem;
  line-height: 1.5;
}

/* Fechar sobre o hero de foco (tinta --pf-*). */
.vc-close.p-button {
  width: 2.25rem;
  height: 2.25rem;
  flex-shrink: 0;
  border-color: var(--pf-line);
  border-radius: 0.7rem;
  background: var(--pf-field);
  color: var(--pf-on);
}

.vc-close.p-button:not(:disabled):hover,
.vc-close.p-button:not(:disabled):active {
  border-color: var(--pf-line);
  background: var(--pf-chip);
  color: var(--pf-on);
}

.vc-close.p-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.vc-shell__body {
  overflow: auto;
  padding: 1.55rem 1.65rem 1.25rem;
  background:
    radial-gradient(
      120% 80% at 50% 0%,
      color-mix(in srgb, var(--vc-primary-soft) 18%, transparent),
      transparent 58%
    ),
    var(--vc-bg);
}

.vc-stage {
  display: grid;
  gap: 0.85rem;
  padding: 1.35rem 1.25rem 1.4rem;
  border: 1px solid color-mix(in srgb, var(--vc-primary) 22%, var(--vc-line));
  border-radius: 1.25rem;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--vc-primary-soft) 22%, var(--vc-bg)) 0%,
      color-mix(in srgb, var(--vc-surface) 55%, var(--vc-bg)) 100%
    );
  box-shadow: 0 14px 28px rgb(var(--vc-shadow-rgb) / 0.06);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease;
}

.vc-stage[data-tone='ok'] {
  border-color: color-mix(in srgb, var(--vc-success-text) 35%, var(--vc-line));
  box-shadow: 0 14px 28px color-mix(in srgb, var(--vc-success-text) 12%, transparent);
}

.vc-stage[data-tone='warn'],
.vc-stage[data-tone='short'] {
  border-color: color-mix(in srgb, var(--vc-warm-text) 32%, var(--vc-line));
}

.vc-field__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.vc-label {
  color: var(--vc-faint);
  font-size: 0.7rem;
  font-weight: 700;
}

.vc-counter {
  color: var(--vc-faint);
  font-size: 0.74rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.vc-counter[data-tone='short'],
.vc-counter[data-tone='warn'] {
  color: var(--vc-warm-text);
}

.vc-counter[data-tone='ok'] {
  color: var(--vc-success-text);
}

.vc-input {
  width: 100%;
  min-height: 4.5rem;
  border-radius: 1rem !important;
  border-color: var(--vc-line) !important;
  background: var(--vc-surface) !important;
  color: var(--vc-text) !important;
  caret-color: var(--vc-primary-strong);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: clamp(1.4rem, 3.2vw, 1.85rem);
  font-weight: 700;
  letter-spacing: 0.22em;
  text-align: center;
  text-transform: uppercase;
  box-shadow: 0 1px 0 color-mix(in srgb, white 12%, transparent) inset;
}

.vc-input::placeholder {
  color: var(--vc-faint) !important;
  letter-spacing: 0.22em;
  opacity: 0.85;
}

.vc-stage :deep(.p-inputtext.vc-input),
.vc-stage :deep(input.vc-input) {
  background: var(--vc-surface) !important;
  color: var(--vc-text) !important;
  caret-color: var(--vc-primary-strong);
}

.vc-stage :deep(.p-inputtext.vc-input::placeholder),
.vc-stage :deep(input.vc-input::placeholder) {
  color: var(--vc-faint) !important;
}

.vc-input:focus,
.vc-input:focus-visible,
.vc-stage :deep(.p-inputtext.vc-input:focus),
.vc-stage :deep(.p-inputtext.vc-input:focus-visible) {
  outline: none;
  border-color: color-mix(in srgb, var(--vc-primary) 55%, var(--vc-line)) !important;
  color: var(--vc-text) !important;
  box-shadow:
    0 0 0 3px color-mix(in srgb, var(--vc-primary) 28%, transparent),
    0 1px 0 color-mix(in srgb, white 12%, transparent) inset;
}

.vc-hint {
  margin: 0;
  color: var(--vc-muted);
  font-size: 0.88rem;
  line-height: 1.5;
  text-align: center;
}

.vc-error {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border: 1px solid color-mix(in srgb, var(--vc-warm-text) 22%, var(--vc-line));
  border-radius: 0.8rem;
  background: var(--vc-surface);
  color: var(--vc-warm-text);
  font-size: 0.86rem;
  line-height: 1.4;
}

.vc-banner {
  margin: 0 0 1rem;
  padding: 0.85rem 1rem;
  border-radius: 0.9rem;
  font-size: 0.88rem;
  line-height: 1.45;
}

.vc-banner--warn {
  border: 1px solid color-mix(in srgb, var(--vc-warm-text) 22%, var(--vc-line));
  background: var(--vc-surface);
  color: var(--vc-text);
}

.vc-result {
  display: grid;
  gap: 0.35rem;
  justify-items: center;
  padding: 0.35rem 0.15rem 0.1rem;
  text-align: center;
}

.vc-result__badge {
  display: grid;
  width: 3.5rem;
  height: 3.5rem;
  place-items: center;
  margin-bottom: 0.35rem;
  border-radius: 999px;
  font-size: 1.35rem;
}

.vc-result--success .vc-result__badge {
  background: var(--vc-success-bg);
  color: var(--vc-success-text);
  box-shadow: 0 10px 24px color-mix(in srgb, var(--vc-success-text) 18%, transparent);
}

.vc-result--fail .vc-result__badge {
  background: color-mix(in srgb, var(--vc-warm-text) 14%, var(--vc-bg));
  color: var(--vc-warm-text);
}

.vc-result__eyebrow {
  margin: 0;
  color: var(--vc-faint);
  font-size: 0.75rem;
  font-weight: 700;
}

.vc-result h3 {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.vc-result__discount {
  display: grid;
  gap: 0.15rem;
  margin: 0.45rem 0 0.35rem;
  padding: 0.95rem 1.2rem;
  border-radius: 1.05rem;
  background: linear-gradient(152deg, var(--pf-from), var(--pf-to));
  color: var(--pf-on);
  box-shadow: 0 14px 30px rgb(var(--pf-shadow-rgb) / 0.14);
}

.vc-result__discount-value {
  font-size: clamp(2.3rem, 8vw, 3rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
}

.vc-result__discount-label {
  color: var(--pf-on-soft);
  font-size: 0.88rem;
  font-weight: 600;
}

.vc-result__card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.65rem;
  padding: 1rem;
  border: 1px solid var(--vc-line);
  border-radius: 1.05rem;
  background: color-mix(in srgb, var(--vc-surface) 70%, var(--vc-bg));
  text-align: start;
}

.vc-result__card > div {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.vc-result__k {
  color: var(--vc-faint);
  font-size: 0.75rem;
  font-weight: 700;
}

.vc-result__card strong {
  overflow-wrap: anywhere;
  font-size: 0.94rem;
  font-weight: 700;
}

.vc-result__message {
  margin: 0.25rem 0 0;
  max-width: 22rem;
  color: var(--vc-muted);
  font-size: 0.95rem;
  line-height: 1.5;
}

.vc-result__hint {
  margin: 0.55rem 0 0;
  max-width: 22rem;
  color: var(--vc-muted);
  font-size: 0.84rem;
  line-height: 1.45;
}

.vc-result__hint a {
  color: var(--vc-primary-strong);
  font-weight: 700;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.vc-shell__footer {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 0.65rem;
  padding: 1.15rem 1.65rem 1.45rem;
  border-top: 1px solid var(--vc-line);
  background: color-mix(in srgb, var(--vc-surface) 60%, var(--vc-bg));
}

.vc-shell__footer :deep(.vc-cta.p-button) {
  background: var(--vc-primary);
  border-color: transparent;
  color: var(--vc-on-cta);
  font-weight: 700;
}

.vc-shell__footer :deep(.vc-cta.p-button:not(:disabled):hover) {
  filter: brightness(1.04);
}

.vc-shell__footer :deep(.vc-cta.p-button:disabled) {
  opacity: 0.48;
}

@media (max-width: 560px) {
  .vc-shell {
    width: min(100vw - 0.75rem, 40rem);
    border-radius: 1.25rem;
  }

  .vc-hero,
  .vc-shell__body,
  .vc-shell__footer {
    padding-inline: 1.15rem;
  }

  .vc-result__card {
    grid-template-columns: 1fr;
  }

  .vc-shell__footer {
    flex-direction: column-reverse;
  }

  .vc-shell__footer :deep(.p-button) {
    width: 100%;
  }
}
</style>

<style>
.validar-cupom-dialog.p-dialog,
.validar-cupom-dialog .p-dialog {
  border: 0 !important;
  background: transparent !important;
  box-shadow: none !important;
}

.validar-cupom-dialog .p-dialog-content {
  padding: 0 !important;
  background: transparent !important;
}
</style>
