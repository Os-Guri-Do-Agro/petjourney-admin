<script setup lang="ts">
import Dialog from 'primevue/dialog'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import PasswordRequirements from '@/components/auth/PasswordRequirements.vue'
import { useAuthThemeVars } from '@/composables/useAuthThemeVars'
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
const authStyle = useAuthThemeVars()

const step = ref<1 | 2>(1)
const email = ref('')
const emailError = ref('')
const sendingCode = ref(false)

const pinDialogVisible = ref(false)
const pinDigits = ref(['', '', '', '', '', ''])
const pinError = ref('')
const verifyingPin = ref(false)
const resetToken = ref('')
const pinInputRefs = ref<Array<HTMLInputElement | null>>([])

const pin = computed(() => pinDigits.value.join(''))
const pinFilled = computed(() => pin.value.length === 6)

const dialogStyle = computed(() => ({
  ...authStyle.value,
}))

watch(pinDialogVisible, async (open) => {
  if (!open) {
    return
  }

  await nextTick()
  pinInputRefs.value[0]?.focus()
})

function setPinDigitRef(index: number, el: unknown) {
  pinInputRefs.value[index] = (el as HTMLInputElement | null) ?? null
}

function syncPinDigits(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 6).split('')
  pinDigits.value = Array.from({ length: 6 }, (_, i) => digits[i] ?? '')
}

function onPinDigitInput(index: number, event: Event) {
  const target = event.target as HTMLInputElement
  const cleaned = target.value.replace(/\D/g, '')

  if (cleaned.length > 1) {
    syncPinDigits(cleaned)
    const focusAt = Math.min(cleaned.length, 5)
    pinInputRefs.value[focusAt]?.focus()
    pinError.value = ''
    return
  }

  const next = [...pinDigits.value]
  next[index] = cleaned.slice(-1)
  pinDigits.value = next
  pinError.value = ''

  if (cleaned && index < 5) {
    pinInputRefs.value[index + 1]?.focus()
  }
}

function onPinKeydown(index: number, event: KeyboardEvent) {
  if (event.key === 'Backspace' && !pinDigits.value[index] && index > 0) {
    pinInputRefs.value[index - 1]?.focus()
  }

  if (event.key === 'ArrowLeft' && index > 0) {
    event.preventDefault()
    pinInputRefs.value[index - 1]?.focus()
  }

  if (event.key === 'ArrowRight' && index < 5) {
    event.preventDefault()
    pinInputRefs.value[index + 1]?.focus()
  }
}

function onPinPaste(event: ClipboardEvent) {
  const text = event.clipboardData?.getData('text') ?? ''
  if (!/\d/.test(text)) {
    return
  }

  event.preventDefault()
  syncPinDigits(text)
  pinError.value = ''
  const focusAt = Math.min(text.replace(/\D/g, '').length, 5)
  pinInputRefs.value[focusAt]?.focus()
}

function clearPinDigits() {
  pinDigits.value = ['', '', '', '', '', '']
  pinError.value = ''
}
const newPassword = ref('')
const confirmPassword = ref('')
const newPasswordError = ref('')
const confirmPasswordError = ref('')
const resetting = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const newPasswordType = computed(() => (showNewPassword.value ? 'text' : 'password'))
const confirmPasswordType = computed(() => (showConfirmPassword.value ? 'text' : 'password'))

const stepMeta = computed(() => {
  if (step.value === 1) {
    return {
      eyebrow: t('auth.forgot.step1.eyebrow'),
      title: t('auth.forgot.step1.title'),
      description: t('auth.forgot.step1.description'),
    }
  }

  return {
    eyebrow: t('auth.forgot.step2.eyebrow'),
    title: t('auth.forgot.step2.title'),
    description: t('auth.forgot.step2.description'),
  }
})

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
  const code = pin.value

  if (code.length < 6) {
    pinError.value = t('auth.forgot.errors.pinLength')
    pinInputRefs.value[Math.min(code.length, 5)]?.focus()
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
    pinError.value = t('auth.forgot.errors.pinInvalid')
    clearPinDigits()
    await nextTick()
    pinInputRefs.value[0]?.focus()
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
  <AuthLayout
    :description="stepMeta.description"
    :eyebrow="stepMeta.eyebrow"
    :title="stepMeta.title"
  >
    <div class="forgot-stack" :style="authStyle">
      <form
        v-if="step === 1"
        class="forgot-stack__form"
        @submit.prevent="handleSendCode"
      >
        <AuthTextField
          id="forgot-email"
          v-model="email"
          autocomplete="email"
          :disabled="sendingCode"
          :error="emailError"
          :hint="t('auth.forgot.email.hint')"
          :label="t('auth.forgot.email.label')"
          :placeholder="t('auth.forgot.email.placeholder')"
          required
          type="email"
        />

        <AuthButton :loading="sendingCode" full-width type="submit">
          {{ sendingCode ? t('auth.forgot.sending') : t('auth.forgot.submit') }}
        </AuthButton>
      </form>

      <form
        v-else
        class="forgot-stack__form"
        @submit.prevent="handleResetPassword"
      >
        <AuthTextField
          id="forgot-new-password"
          v-model="newPassword"
          autocomplete="new-password"
          :disabled="resetting"
          :error="newPasswordError"
          :label="t('auth.forgot.password.label')"
          :placeholder="t('auth.forgot.password.placeholder')"
          required
          :type="newPasswordType"
        >
          <template #trailing>
            <button
              :aria-label="
                showNewPassword
                  ? t('auth.forgot.password.hide')
                  : t('auth.forgot.password.show')
              "
              class="forgot-password-toggle"
              :disabled="resetting"
              type="button"
              @click="showNewPassword = !showNewPassword"
            >
              <i :class="showNewPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
            </button>
          </template>
        </AuthTextField>

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
          :type="confirmPasswordType"
        >
          <template #trailing>
            <button
              :aria-label="
                showConfirmPassword
                  ? t('auth.forgot.password.hide')
                  : t('auth.forgot.password.show')
              "
              class="forgot-password-toggle"
              :disabled="resetting"
              type="button"
              @click="showConfirmPassword = !showConfirmPassword"
            >
              <i
                :class="showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"
                aria-hidden="true"
              />
            </button>
          </template>
        </AuthTextField>

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
      </form>

      <AuthButton
        v-if="step === 1"
        full-width
        to="/auth/login"
        variant="secondary"
      >
        {{ t('auth.forgot.backToLogin') }}
      </AuthButton>
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
      <div class="forgot-pin" :style="dialogStyle">
        <button
          class="forgot-pin__close"
          type="button"
          :aria-label="t('common.close')"
          :disabled="verifyingPin"
          @click="closePinDialog"
        >
          <i class="pi pi-times" aria-hidden="true" />
        </button>

        <div class="forgot-pin__hero">
          <span class="forgot-pin__icon" aria-hidden="true">
            <i class="pi pi-envelope" />
          </span>
          <p class="forgot-pin__eyebrow">{{ t('auth.forgot.pin.eyebrow') }}</p>
          <h2 id="forgot-pin-title">{{ t('auth.forgot.pin.title') }}</h2>
          <p class="forgot-pin__lede">{{ t('auth.forgot.pin.lede') }}</p>
          <p class="forgot-pin__email" :title="email.trim()">
            <i class="pi pi-envelope" aria-hidden="true" />
            <span>{{ email.trim() }}</span>
          </p>
        </div>

        <form class="forgot-pin__form" aria-labelledby="forgot-pin-title" @submit.prevent="handleVerifyPin">
          <div
            class="forgot-pin__otp"
            role="group"
            :aria-label="t('auth.forgot.pin.label')"
            @paste="onPinPaste"
          >
            <input
              v-for="(digit, index) in pinDigits"
              :key="index"
              :ref="(el) => setPinDigitRef(index, el)"
              class="forgot-pin__cell"
              :class="{
                'forgot-pin__cell--filled': Boolean(digit),
                'forgot-pin__cell--invalid': Boolean(pinError),
              }"
              :value="digit"
              inputmode="numeric"
              autocomplete="one-time-code"
              maxlength="1"
              :aria-label="t('auth.forgot.pin.digitAria', { n: index + 1 })"
              :disabled="verifyingPin"
              @input="onPinDigitInput(index, $event)"
              @keydown="onPinKeydown(index, $event)"
            />
          </div>

          <p v-if="pinError" class="forgot-pin__error" role="alert">{{ pinError }}</p>
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
.forgot-stack {
  display: grid;
  gap: 0.85rem;
}

.forgot-stack__form {
  display: grid;
  gap: 1rem;
}

.forgot-password-toggle {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--auth-soft);
  cursor: pointer;
}

.forgot-password-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.forgot-pin {
  position: relative;
  display: grid;
  gap: 1.35rem;
  width: min(100%, 24.5rem);
  padding: 0.35rem 0.15rem 0.15rem;
  color: var(--auth-text);
}

.forgot-pin__close {
  position: absolute;
  top: -0.15rem;
  right: -0.1rem;
  display: grid;
  width: 2.15rem;
  height: 2.15rem;
  place-items: center;
  border: 0;
  border-radius: 0.7rem;
  background: transparent;
  color: var(--auth-soft);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.forgot-pin__close:hover:not(:disabled) {
  background: var(--auth-sage-tint);
  color: var(--auth-text);
}

.forgot-pin__close:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}

.forgot-pin__hero {
  display: grid;
  justify-items: center;
  gap: 0.55rem;
  padding-top: 0.35rem;
  text-align: center;
}

.forgot-pin__icon {
  display: grid;
  width: 3.25rem;
  height: 3.25rem;
  place-items: center;
  margin-bottom: 0.35rem;
  border-radius: 1rem;
  background: color-mix(in srgb, var(--auth-sage) 16%, var(--auth-field-bg));
  color: var(--auth-sage-strong);
  font-size: 1.25rem;
  box-shadow: 0 10px 24px rgb(var(--auth-shadow-rgb) / 0.08);
}

.forgot-pin__eyebrow {
  margin: 0;
  color: var(--auth-soft);
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.forgot-pin h2 {
  margin: 0;
  color: var(--auth-text);
  font-size: 1.45rem;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.forgot-pin__lede {
  max-width: 22rem;
  margin: 0;
  color: var(--auth-muted);
  font-size: 0.92rem;
  line-height: 1.55;
}

.forgot-pin__email {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 0.4rem;
  margin: 0.25rem 0 0;
  padding: 0.4rem 0.75rem;
  overflow: hidden;
  border: 1px solid var(--auth-line);
  border-radius: 999px;
  background: color-mix(in srgb, var(--auth-sage-tint) 55%, var(--auth-field-bg));
  color: var(--auth-text);
  font-size: 0.82rem;
  font-weight: 700;
}

.forgot-pin__email span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.forgot-pin__email .pi {
  flex-shrink: 0;
  color: var(--auth-sage-strong);
  font-size: 0.78rem;
}

.forgot-pin__form {
  display: grid;
  gap: 0.85rem;
}

.forgot-pin__otp {
  display: grid;
  grid-template-columns: repeat(6, minmax(0, 1fr));
  gap: 0.45rem;
}

.forgot-pin__cell {
  width: 100%;
  aspect-ratio: 1;
  min-height: 2.85rem;
  border: 1.5px solid var(--auth-line);
  border-radius: 0.85rem;
  background: var(--auth-field-bg);
  color: var(--auth-text);
  font-family: inherit;
  font-size: 1.25rem;
  font-weight: 750;
  text-align: center;
  caret-color: var(--auth-sage);
  transition:
    border-color 160ms ease,
    box-shadow 160ms ease,
    background 160ms ease;
}

.forgot-pin__cell:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--auth-sage) 40%, var(--auth-line));
}

.forgot-pin__cell:focus {
  outline: none;
  border-color: var(--auth-sage);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--auth-sage) 22%, transparent);
}

.forgot-pin__cell--filled {
  border-color: color-mix(in srgb, var(--auth-sage) 55%, var(--auth-line));
  background: color-mix(in srgb, var(--auth-sage-tint) 40%, var(--auth-field-bg));
}

.forgot-pin__cell--invalid {
  border-color: var(--auth-danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--auth-danger) 16%, transparent);
}

.forgot-pin__cell:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.forgot-pin__hint {
  margin: 0;
  color: var(--auth-soft);
  font-size: 0.8rem;
  line-height: 1.4;
  text-align: center;
}

.forgot-pin__error {
  margin: 0;
  color: var(--auth-danger);
  font-size: 0.82rem;
  font-weight: 650;
  line-height: 1.4;
  text-align: center;
}
</style>

<style>
.forgot-pin-dialog.p-dialog,
.forgot-pin-dialog__root.p-dialog {
  width: min(calc(100vw - 2rem), 28rem);
  border: 1px solid color-mix(in srgb, var(--auth-line, #eaf0ee) 80%, transparent);
  border-radius: 1.35rem;
  overflow: hidden;
  background: var(--auth-field-bg, #fff);
  box-shadow: 0 24px 60px rgb(15 23 20 / 0.18);
}

.forgot-pin-dialog .p-dialog-content,
.forgot-pin-dialog__content {
  padding: 1.35rem 1.35rem 1.45rem;
}

.forgot-pin-dialog__mask.p-dialog-mask {
  backdrop-filter: blur(6px);
  background: color-mix(in srgb, #1a2420 42%, transparent);
}
</style>
