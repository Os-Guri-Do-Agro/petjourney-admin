<script setup lang="ts">
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import { computed, ref, watch } from 'vue'
import { RouterLink } from 'vue-router'

import { useCupomResgateModal } from '@/composables/useCupomResgateModal'
import { useParceiroPortal } from '@/composables/useParceiroPortal'
import { validarCupom } from '@/service/parceiro/parceiro-portal-service'
import type { ValidarCupomResultado } from '@/service/parceiro/types'
import { currentColors } from '@/theme/color-mode'
import {
  isCodigoResgateFormatoValido,
  normalizarCodigoResgate,
  resolveValidarCupomError,
  type ValidarCupomErrorView,
} from '@/utils/parceiro/cupom-resgate'

const { visible, close, markSuccess } = useCupomResgateModal()
const { store, parceiroQuery } = useParceiroPortal()

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
    '--vc-bg': colors.auth.white,
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

async function handleValidar() {
  const codigo = codigoNormalizado.value

  if (!store.podeOperar) {
    errorView.value = {
      title: 'Parceiro sem operação',
      message: 'Aguarde a aprovação do credenciamento para validar cupons.',
    }
    step.value = 'error'
    return
  }

  if (!isCodigoResgateFormatoValido(codigo)) {
    formatHint.value =
      'Use 6 a 32 caracteres (A–Z e 2–9). Sem 0, 1 ou espaços. Confira o código no app do cliente.'
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
    errorView.value = resolveValidarCupomError(err)
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
    class="validar-cupom-dialog"
    :pt="{ root: { class: 'validar-cupom-dialog' } }"
    @hide="closeDialog"
  >
    <template #container="{ closeCallback }">
      <div class="vc-shell" :style="dialogStyle" role="document">
        <header class="vc-shell__header">
          <div class="vc-brand">
            <span class="vc-brand__icon" aria-hidden="true">
              <i class="pi pi-ticket" />
            </span>
            <div class="vc-brand__copy">
              <p class="vc-brand__eyebrow">Atendimento no balcão</p>
              <h2 id="validar-cupom-title">Validar cupom</h2>
              <p class="vc-brand__lede">
                Peça o código no app do tutor e aplique o desconto na hora.
              </p>
            </div>
          </div>

          <button
            class="vc-close"
            type="button"
            aria-label="Fechar"
            :disabled="submitting"
            @click="closeCallback"
          >
            <i class="pi pi-times" aria-hidden="true" />
          </button>
        </header>

        <div class="vc-shell__body" aria-labelledby="validar-cupom-title">
          <template v-if="step === 'input'">
            <ol class="vc-steps" aria-label="Como validar">
              <li>
                <span>1</span>
                Cliente abre o cupom no app e toca em usar
              </li>
              <li>
                <span>2</span>
                Você digita o código abaixo
              </li>
              <li>
                <span>3</span>
                Confirma o desconto na tela de sucesso
              </li>
            </ol>

            <p v-if="!store.podeOperar" class="vc-banner vc-banner--warn" role="status">
              Este parceiro ainda não pode operar. A validação fica disponível após a aprovação.
            </p>

            <div class="vc-field">
              <div class="vc-field__head">
                <label class="vc-label" for="cupom-resgate-codigo">Código de resgate</label>
                <span class="vc-counter" :data-tone="lengthTone">
                  {{ codigoLength }}/32
                </span>
              </div>

              <InputText
                id="cupom-resgate-codigo"
                :model-value="codigoInput"
                class="vc-input"
                maxlength="32"
                autocomplete="off"
                spellcheck="false"
                placeholder="ABCDEF2345"
                :disabled="submitting || !store.podeOperar"
                aria-describedby="cupom-resgate-hint"
                autofocus
                @update:model-value="onCodigoModel"
                @keydown.enter.prevent="handleValidar"
              />

              <p id="cupom-resgate-hint" class="vc-hint">
                O código vale cerca de 5 minutos e é de uso único. Digite como aparece no app —
                espaços e minúsculas são corrigidos automaticamente.
              </p>
              <p v-if="formatHint" class="vc-error" role="alert">{{ formatHint }}</p>
            </div>
          </template>

          <template v-else-if="step === 'success' && resultado">
            <div class="vc-result vc-result--success" role="status">
              <span class="vc-result__badge" aria-hidden="true">
                <i class="pi pi-check" />
              </span>
              <p class="vc-result__eyebrow">Resgate confirmado</p>
              <h3>Cupom válido</h3>
              <p class="vc-result__discount">
                {{ resultado.cupom.descontoPercentual }}%
                <span>de desconto</span>
              </p>

              <div class="vc-result__card">
                <div>
                  <span class="vc-result__k">Campanha</span>
                  <strong>{{ resultado.cupom.titulo }}</strong>
                </div>
                <div>
                  <span class="vc-result__k">Código</span>
                  <strong>{{ resultado.cupom.codigo }}</strong>
                </div>
                <div v-if="resultado.tutorPrimeiroNome">
                  <span class="vc-result__k">Cliente</span>
                  <strong>{{ resultado.tutorPrimeiroNome }}</strong>
                </div>
                <div>
                  <span class="vc-result__k">Canal</span>
                  <strong>Código manual</strong>
                </div>
              </div>
            </div>
          </template>

          <template v-else-if="step === 'error' && errorView">
            <div class="vc-result vc-result--fail" role="alert">
              <span class="vc-result__badge" aria-hidden="true">
                <i class="pi pi-exclamation-circle" />
              </span>
              <p class="vc-result__eyebrow">Não validado</p>
              <h3>{{ errorView.title }}</h3>
              <p class="vc-result__message">{{ errorView.message }}</p>
              <p v-if="errorView.suggestCheckHistorico" class="vc-result__hint">
                Se a rede falhou no meio do envio, confira em
                <RouterLink to="/parceiro/divulgacao#resgates" @click="closeDialog">
                  Resgates
                </RouterLink>
                antes de tentar de novo — um POST bem-sucedido já consome o código.
              </p>
            </div>
          </template>
        </div>

        <footer class="vc-shell__footer">
          <template v-if="step === 'input'">
            <Button
              label="Cancelar"
              severity="secondary"
              text
              type="button"
              :disabled="submitting"
              @click="closeDialog"
            />
            <Button
              label="Validar código"
              icon="pi pi-check"
              type="button"
              size="large"
              :loading="submitting"
              :disabled="!canSubmit"
              @click="handleValidar"
            />
          </template>

          <template v-else-if="step === 'success'">
            <Button
              label="Validar outro"
              severity="secondary"
              text
              type="button"
              @click="startAnother"
            />
            <Button
              label="OK, aplicar desconto"
              icon="pi pi-check"
              type="button"
              size="large"
              @click="closeDialog"
            />
          </template>

          <template v-else>
            <Button label="Fechar" severity="secondary" text type="button" @click="closeDialog" />
            <Button
              label="Tentar de novo"
              icon="pi pi-refresh"
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
  width: min(42rem, calc(100vw - 1.25rem));
  max-height: min(92vh, 44rem);
  overflow: hidden;
  border-radius: 1.45rem;
  background: var(--vc-bg);
  box-shadow: 0 28px 80px rgb(var(--vc-shadow-rgb) / 0.22);
  color: var(--vc-text);
}

.vc-shell__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.45rem 1.45rem 1.15rem;
  border-bottom: 1px solid var(--vc-line);
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--vc-primary-soft) 28%, var(--vc-bg)) 0%,
      var(--vc-bg) 100%
    );
}

.vc-brand {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  min-width: 0;
}

.vc-brand__icon {
  display: grid;
  flex-shrink: 0;
  width: 3.15rem;
  height: 3.15rem;
  place-items: center;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--vc-primary) 20%, var(--vc-bg));
  color: var(--vc-primary-strong);
  font-size: 1.25rem;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vc-primary) 18%, transparent);
}

.vc-brand__copy {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.vc-brand__eyebrow {
  margin: 0;
  color: var(--vc-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.vc-brand__copy h2 {
  margin: 0;
  font-size: 1.45rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.vc-brand__lede {
  margin: 0.15rem 0 0;
  color: var(--vc-muted);
  font-size: 0.92rem;
  line-height: 1.45;
}

.vc-close {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  flex-shrink: 0;
  place-items: center;
  border: 1px solid var(--vc-line);
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--vc-surface) 70%, var(--vc-bg));
  color: var(--vc-muted);
  cursor: pointer;
}

.vc-close:hover {
  color: var(--vc-text);
  background: var(--vc-surface);
}

.vc-close:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.vc-shell__body {
  overflow: auto;
  padding: 1.35rem 1.45rem 1.1rem;
}

.vc-steps {
  display: grid;
  gap: 0.55rem;
  margin: 0 0 1.25rem;
  padding: 0.95rem 1rem;
  list-style: none;
  border: 1px solid var(--vc-line);
  border-radius: 1rem;
  background: color-mix(in srgb, var(--vc-surface) 78%, var(--vc-bg));
}

.vc-steps li {
  display: flex;
  align-items: flex-start;
  gap: 0.7rem;
  color: var(--vc-muted);
  font-size: 0.88rem;
  line-height: 1.4;
}

.vc-steps span {
  display: grid;
  width: 1.45rem;
  height: 1.45rem;
  flex-shrink: 0;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--vc-primary) 18%, var(--vc-bg));
  color: var(--vc-primary-strong);
  font-size: 0.72rem;
  font-weight: 800;
}

.vc-field {
  display: grid;
  gap: 0.65rem;
}

.vc-field__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
}

.vc-label {
  color: var(--vc-faint);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.vc-counter {
  color: var(--vc-faint);
  font-size: 0.75rem;
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
  min-height: 3.55rem;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: clamp(1.25rem, 2.4vw, 1.65rem);
  font-weight: 700;
  letter-spacing: 0.18em;
  text-align: center;
  text-transform: uppercase;
}

.vc-hint {
  margin: 0;
  color: var(--vc-muted);
  font-size: 0.86rem;
  line-height: 1.5;
}

.vc-error {
  margin: 0;
  padding: 0.7rem 0.85rem;
  border-radius: 0.8rem;
  background: var(--vc-warm-bg);
  color: var(--vc-warm-text);
  font-size: 0.88rem;
  line-height: 1.4;
}

.vc-banner {
  margin: 0 0 1rem;
  padding: 0.85rem 1rem;
  border-radius: 0.9rem;
  font-size: 0.9rem;
  line-height: 1.45;
}

.vc-banner--warn {
  background: var(--vc-warm-bg);
  color: var(--vc-warm-text);
}

.vc-result {
  display: grid;
  gap: 0.45rem;
  justify-items: center;
  padding: 0.5rem 0.25rem 0.15rem;
  text-align: center;
}

.vc-result__badge {
  display: grid;
  width: 3.6rem;
  height: 3.6rem;
  place-items: center;
  margin-bottom: 0.45rem;
  border-radius: 999px;
  font-size: 1.4rem;
}

.vc-result--success .vc-result__badge {
  background: var(--vc-success-bg);
  color: var(--vc-success-text);
}

.vc-result--fail .vc-result__badge {
  background: var(--vc-warm-bg);
  color: var(--vc-warm-text);
}

.vc-result__eyebrow {
  margin: 0;
  color: var(--vc-faint);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.vc-result h3 {
  margin: 0;
  font-size: 1.55rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.vc-result__discount {
  display: grid;
  gap: 0.1rem;
  margin: 0.35rem 0 0.55rem;
  color: var(--vc-primary-strong);
  font-size: clamp(2.4rem, 6vw, 3.2rem);
  font-weight: 800;
  letter-spacing: -0.04em;
  line-height: 1;
}

.vc-result__discount span {
  color: var(--vc-muted);
  font-size: 0.95rem;
  font-weight: 600;
  letter-spacing: 0;
}

.vc-result__card {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem;
  width: 100%;
  margin-top: 0.55rem;
  padding: 1rem;
  border: 1px solid var(--vc-line);
  border-radius: 1.05rem;
  background: color-mix(in srgb, var(--vc-surface) 80%, var(--vc-bg));
  text-align: left;
}

.vc-result__card > div {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.vc-result__k {
  color: var(--vc-faint);
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.vc-result__card strong {
  overflow-wrap: anywhere;
  font-size: 0.98rem;
  font-weight: 700;
}

.vc-result__message {
  margin: 0.25rem 0 0;
  max-width: 34rem;
  color: var(--vc-muted);
  font-size: 1rem;
  line-height: 1.5;
}

.vc-result__hint {
  margin: 0.55rem 0 0;
  max-width: 34rem;
  color: var(--vc-muted);
  font-size: 0.86rem;
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
  padding: 1rem 1.45rem 1.35rem;
  border-top: 1px solid var(--vc-line);
  background: color-mix(in srgb, var(--vc-surface) 55%, var(--vc-bg));
}

@media (max-width: 560px) {
  .vc-shell {
    width: min(100vw - 0.75rem, 42rem);
    border-radius: 1.15rem;
  }

  .vc-shell__header,
  .vc-shell__body,
  .vc-shell__footer {
    padding-left: 1.05rem;
    padding-right: 1.05rem;
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
