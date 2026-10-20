<script setup lang="ts">
/**
 * Redefinir a senha, em três passos à vista: o e-mail, o código de seis dígitos (num diálogo, por
 * cima do e-mail que acabou de ser digitado) e a senha nova. "Voltar para o login" fica no alto,
 * onde se procura a saída.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputOtp from 'primevue/inputotp'
import InputText from 'primevue/inputtext'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import PasswordRequirements from '@/components/auth/PasswordRequirements.vue'
import RegisterStepIndicator from '@/components/auth/RegisterStepIndicator.vue'
import { ApiError } from '@/service/api'
import {
  recoveryPassword,
  resetPasswordWithToken,
  verifyRecoveryPin,
} from '@/service/auth/auth-service'
import { isPasswordValid } from '@/utils/validation/password'

const { t } = useI18n()
const router = useRouter()
const toast = useToast()

const step = ref<1 | 2>(1)
const email = ref('')
const emailError = ref('')
const sendingCode = ref(false)

const PIN_LENGTH = 6

const pinDialogVisible = ref(false)
const pin = ref('')
const pinError = ref('')
const verifyingPin = ref(false)
const resetToken = ref('')
/** Wrapper do InputOtp — as células são <input> internos do PrimeVue. */
const pinOtpRef = ref<HTMLElement | null>(null)

const pinFilled = computed(() => pin.value.replace(/\D/g, '').length === PIN_LENGTH)

watch(pinDialogVisible, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  focusPinCell(0)
})

function focusPinCell(index: number) {
  pinOtpRef.value?.querySelectorAll<HTMLInputElement>('input')[index]?.focus()
}

/** O slot do InputOtp entrega `attrs` como objeto `{ value }` (a tipagem do PrimeVue diz função). */
function valorDaCelula(attrs: unknown) {
  return (attrs as { value?: string } | null)?.value ?? ''
}

function onPinChange() {
  pinError.value = ''
}

/**
 * O InputOtp (integer-only) recusa colagens com separadores ("123 456", "123-456").
 * Este handler roda depois dele (bubbling) e normaliza para só dígitos.
 */
function onPinPaste(event: ClipboardEvent) {
  const digits = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '')
  if (!digits) {
    return
  }

  pin.value = digits.slice(0, PIN_LENGTH)
  pinError.value = ''
  focusPinCell(Math.min(pin.value.length, PIN_LENGTH - 1))
}

function clearPinDigits() {
  pin.value = ''
  pinError.value = ''
}
const newPassword = ref('')
const confirmPassword = ref('')
const newPasswordError = ref('')
const confirmPasswordError = ref('')
const resetting = ref(false)

const stepMeta = computed(() =>
  step.value === 1
    ? {
        title: t('auth.forgot.step1.title'),
        description: t('auth.forgot.step1.description'),
      }
    : {
        title: t('auth.forgot.step2.title'),
        description: t('auth.forgot.step2.description'),
      },
)

/** E-mail, código (no diálogo) e nova senha: o código conta como passo, mesmo sem tela própria. */
const passos = computed(() => [
  t('auth.forgot.passos.email'),
  t('auth.forgot.passos.codigo'),
  t('auth.forgot.passos.senha'),
])

const passoAtual = computed(() => (step.value === 2 ? 3 : pinDialogVisible.value ? 2 : 1))

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function networkOrThrottleDetail(error: unknown) {
  if (error instanceof ApiError && error.statusCode === 429) {
    return t('auth.forgot.errors.throttle')
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return t('auth.forgot.errors.generic')
}

async function handleSendCode() {
  if (sendingCode.value) {
    return
  }

  emailError.value = ''
  const normalized = email.value.trim()

  if (!normalized) {
    emailError.value = t('auth.forgot.errors.emailRequired')
    return
  }

  if (!isValidEmail(normalized)) {
    emailError.value = t('auth.forgot.errors.emailInvalid')
    return
  }

  sendingCode.value = true

  try {
    await recoveryPassword(normalized)
    email.value = normalized
    clearPinDigits()
    pinDialogVisible.value = true
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('auth.forgot.toasts.sendError.summary'),
      detail: networkOrThrottleDetail(error),
      life: 5000,
    })
  } finally {
    sendingCode.value = false
  }
}

async function handleVerifyPin() {
  if (verifyingPin.value) {
    return
  }

  pinError.value = ''
  const code = pin.value.replace(/\D/g, '')

  if (code.length < PIN_LENGTH) {
    pinError.value = t('auth.forgot.errors.pinLength')
    focusPinCell(Math.min(code.length, PIN_LENGTH - 1))
    return
  }

  verifyingPin.value = true

  try {
    resetToken.value = await verifyRecoveryPin({
      email: email.value.trim(),
      pin: code,
    })
    pinDialogVisible.value = false
    clearPinDigits()
    newPassword.value = ''
    confirmPassword.value = ''
    newPasswordError.value = ''
    confirmPasswordError.value = ''
    step.value = 2
  } catch {
    clearPinDigits()
    pinError.value = t('auth.forgot.errors.pinInvalid')
    await nextTick()
    focusPinCell(0)
  } finally {
    verifyingPin.value = false
  }
}

function validateStep2() {
  newPasswordError.value = ''
  confirmPasswordError.value = ''

  if (!isPasswordValid(newPassword.value)) {
    newPasswordError.value = t('auth.forgot.errors.passwordRequirements')
  }

  if (!confirmPassword.value) {
    confirmPasswordError.value = t('auth.forgot.errors.confirmRequired')
  } else if (confirmPassword.value !== newPassword.value) {
    confirmPasswordError.value = t('auth.forgot.errors.mismatch')
  }

  return !newPasswordError.value && !confirmPasswordError.value
}

async function handleResetPassword() {
  if (resetting.value || !validateStep2()) {
    return
  }

  if (!resetToken.value) {
    toast.add({
      severity: 'warn',
      summary: t('auth.forgot.toasts.tokenMissing.summary'),
      detail: t('auth.forgot.toasts.tokenMissing.detail'),
      life: 5000,
    })
    step.value = 1
    return
  }

  resetting.value = true

  try {
    await resetPasswordWithToken({
      reset_token: resetToken.value,
      newPassword: newPassword.value,
    })

    toast.add({
      severity: 'success',
      summary: t('auth.forgot.toasts.success.summary'),
      detail: t('auth.forgot.toasts.success.detail'),
      life: 4500,
    })

    await router.replace('/auth/login')
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: t('auth.forgot.toasts.resetError.summary'),
      detail: networkOrThrottleDetail(error),
      life: 5500,
    })
  } finally {
    resetting.value = false
  }
}

function backToStep1() {
  step.value = 1
  resetToken.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  newPasswordError.value = ''
  confirmPasswordError.value = ''
}

function closePinDialog() {
  if (verifyingPin.value) {
    return
  }
  pinDialogVisible.value = false
  clearPinDigits()
}
</script>

<template>
  <AuthLayout :description="stepMeta.description" :title="stepMeta.title">
    <template #voltar>
      <RouterLink to="/auth/login">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('auth.forgot.backToLogin') }}
      </RouterLink>
    </template>

    <div class="redefinir">
      <RegisterStepIndicator
        :current-step="passoAtual"
        :labels="passos"
        :total-steps="passos.length"
        :list-label="t('auth.forgot.passosAria')"
      />

      <form v-if="step === 1" class="redefinir__form" @submit.prevent="handleSendCode">
        <AuthTextField
          id="forgot-email"
          v-model="email"
          autocomplete="email"
          inputmode="email"
          :disabled="sendingCode"
          :error="emailError"
          :hint="t('auth.forgot.email.hint')"
          :label="t('auth.forgot.email.label')"
          :placeholder="t('auth.forgot.email.placeholder')"
          required
          type="email"
        >
          <template #leading>
            <i class="ph ph-envelope-simple" aria-hidden="true" />
          </template>
        </AuthTextField>

        <AuthButton :loading="sendingCode" full-width type="submit">
          {{ sendingCode ? t('auth.forgot.sending') : t('auth.forgot.submit') }}
        </AuthButton>
      </form>

      <form v-else class="redefinir__form" @submit.prevent="handleResetPassword">
        <AuthTextField
          id="forgot-new-password"
          v-model="newPassword"
          autocomplete="new-password"
          :disabled="resetting"
          :error="newPasswordError"
          :label="t('auth.forgot.password.label')"
          :placeholder="t('auth.forgot.password.placeholder')"
          required
          revelavel
          type="password"
        />

        <PasswordRequirements :password="newPassword" />

        <AuthTextField
          id="forgot-confirm-password"
          v-model="confirmPassword"
          autocomplete="new-password"
          :disabled="resetting"
          :error="confirmPasswordError"
          :label="t('auth.forgot.confirm.label')"
          :placeholder="t('auth.forgot.confirm.placeholder')"
          required
          revelavel
          type="password"
        />

        <div class="redefinir__acoes">
          <AuthButton :loading="resetting" full-width type="submit">
            {{ resetting ? t('auth.forgot.resetting') : t('auth.forgot.reset') }}
          </AuthButton>

          <AuthButton
            :disabled="resetting"
            full-width
            type="button"
            variant="secondary"
            @click="backToStep1"
          >
            {{ t('auth.forgot.requestNewCode') }}
          </AuthButton>
        </div>
      </form>
    </div>

    <Dialog
      v-model:visible="pinDialogVisible"
      modal
      :draggable="false"
      :dismissable-mask="!verifyingPin"
      :closable="false"
      :show-header="false"
      class="forgot-pin-dialog"
      :pt="{
        root: { class: 'forgot-pin-dialog__root' },
        mask: { class: 'forgot-pin-dialog__mask' },
        content: { class: 'forgot-pin-dialog__content' },
      }"
      @hide="closePinDialog"
    >
      <div class="forgot-pin">
        <Button
          class="forgot-pin__close"
          type="button"
          icon="ph ph-x"
          severity="secondary"
          text
          :aria-label="t('common.close')"
          :disabled="verifyingPin"
          @click="closePinDialog"
        />

        <div class="forgot-pin__hero">
          <span class="forgot-pin__icon" aria-hidden="true">
            <i class="ph ph-envelope-simple-open" />
          </span>
          <h2 id="forgot-pin-title">{{ t('auth.forgot.pin.title') }}</h2>
          <p class="forgot-pin__lede">{{ t('auth.forgot.pin.lede') }}</p>
          <p class="forgot-pin__email" :title="email.trim()">
            <i class="ph ph-at" aria-hidden="true" />
            <span>{{ email.trim() }}</span>
          </p>
        </div>

        <form
          class="forgot-pin__form"
          aria-labelledby="forgot-pin-title"
          @submit.prevent="handleVerifyPin"
        >
          <div
            ref="pinOtpRef"
            role="group"
            :aria-label="t('auth.forgot.pin.label')"
            @paste="onPinPaste"
          >
            <InputOtp
              v-model="pin"
              class="forgot-pin__otp"
              :disabled="verifyingPin"
              integer-only
              :invalid="Boolean(pinError)"
              :length="PIN_LENGTH"
              @change="onPinChange"
            >
              <template #default="{ attrs, events, index }">
                <InputText
                  :aria-label="t('auth.forgot.pin.digitAria', { n: index })"
                  autocomplete="one-time-code"
                  class="p-inputotp-input forgot-pin__cell"
                  :class="{ 'forgot-pin__cell--filled': Boolean(valorDaCelula(attrs)) }"
                  :disabled="verifyingPin"
                  inputmode="numeric"
                  :invalid="Boolean(pinError)"
                  maxlength="1"
                  v-bind="attrs"
                  v-on="events"
                />
              </template>
            </InputOtp>
          </div>

          <p v-if="pinError" class="forgot-pin__error" role="alert">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            {{ pinError }}
          </p>
          <p v-else class="forgot-pin__hint">{{ t('auth.forgot.pin.hint') }}</p>

          <AuthButton
            :disabled="!pinFilled && !verifyingPin"
            :loading="verifyingPin"
            full-width
            type="submit"
          >
            {{ verifyingPin ? t('auth.forgot.pin.verifying') : t('auth.forgot.pin.verify') }}
          </AuthButton>
        </form>
      </div>
    </Dialog>
  </AuthLayout>
</template>

<style scoped>
.redefinir {
  display: grid;
  gap: 24px;
}

.redefinir__form {
  display: grid;
  gap: 20px;
}

.redefinir__acoes {
  display: grid;
  gap: 10px;
}

.forgot-pin {
  position: relative;
  display: grid;
  gap: 22px;
  color: var(--tinta);
}

.forgot-pin__close.p-button {
  position: absolute;
  z-index: 1;
  top: -6px;
  width: 40px;
  height: 40px;
  inset-inline-end: -6px;
  border-radius: 10px;
}

.forgot-pin__hero {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding-top: 6px;
  text-align: center;
}

.forgot-pin__icon {
  display: grid;
  width: 52px;
  height: 52px;
  margin-bottom: 6px;
  place-items: center;
  border-radius: 16px;
  background: var(--musgo-fundo);
  color: var(--musgo);
  font-size: 26px;
}

.forgot-pin h2 {
  margin: 0;
  font-size: 22px;
  font-weight: 600;
  letter-spacing: -0.02em;
}

.forgot-pin__lede {
  max-width: 22rem;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.55;
}

.forgot-pin__email {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 6px;
  margin: 4px 0 0;
  padding: 6px 12px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-2);
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
}

.forgot-pin__email span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.forgot-pin__email .ph {
  flex: none;
  color: var(--musgo);
}

.forgot-pin__form {
  display: grid;
  gap: 14px;
}

.forgot-pin__otp.p-inputotp {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(6, minmax(0, 1fr));
}

.forgot-pin__cell.p-inputtext {
  width: 100%;
  min-height: 52px;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid var(--linha-forte);
  border-radius: 12px;
  background: var(--superficie);
  box-shadow: none;
  caret-color: var(--musgo);
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  text-align: center;
}

.forgot-pin__cell--filled.p-inputtext {
  border-color: var(--musgo);
  background: var(--musgo-fundo);
}

.forgot-pin__cell.p-inputtext:enabled:focus {
  border-color: var(--musgo);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--musgo) 22%, transparent);
  outline: none;
}

.forgot-pin__cell.p-inputtext.p-invalid {
  border-color: var(--risco);
  background: var(--risco-fundo);
}

.forgot-pin__cell.p-inputtext:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.forgot-pin__hint {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
  text-align: center;
}

.forgot-pin__error {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 550;
  line-height: 1.4;
}
</style>

<style>
.forgot-pin-dialog.p-dialog,
.forgot-pin-dialog__root.p-dialog {
  width: min(calc(100vw - 32px), 27rem);
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 20px;
  background: var(--superficie);
  box-shadow: var(--sombra-3);
}

.forgot-pin-dialog .p-dialog-content,
.forgot-pin-dialog__content {
  padding: 24px;
}

.forgot-pin-dialog__mask.p-dialog-mask {
  background: color-mix(in oklab, var(--rail) 45%, transparent);
  backdrop-filter: blur(4px);
}
</style>
