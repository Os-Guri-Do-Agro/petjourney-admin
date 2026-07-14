<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import PasswordRequirements from '@/components/auth/PasswordRequirements.vue'
import RegisterStepIndicator from '@/components/auth/RegisterStepIndicator.vue'
import { checkEmailAvailability, registerVeterinarian } from '@/service/user/user-service'
import { useAuthThemeVars } from '@/composables/useAuthThemeVars'
import { isPasswordValid } from '@/utils/validation/password'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const { t } = useI18n()

const STEP_LABELS = computed(() => [
  t('auth.register.stepLabels.identity'),
  t('auth.register.stepLabels.professional'),
  t('auth.register.stepLabels.account'),
])
const TOTAL_STEPS = 3

const router = useRouter()
const toast = useToast()

const currentStep = ref(1)
const loading = ref(false)
const submitting = ref(false)
const showPassword = ref(false)
const showConfirmPassword = ref(false)
const acceptedTerms = ref(false)
const rememberAccess = ref(true)

const nome = ref('')
const email = ref('')
const crmv = ref('')
const especialidade = ref('')
const senha = ref('')
const confirmarSenha = ref('')

const nomeError = ref('')
const emailError = ref('')
const crmvError = ref('')
const especialidadeError = ref('')
const senhaError = ref('')
const confirmarSenhaError = ref('')
const termsError = ref('')
const globalError = ref('')

const emailChecking = ref(false)
const emailAvailable = ref<boolean | null>(null)

const passwordInputType = computed(() => (showPassword.value ? 'text' : 'password'))
const confirmPasswordInputType = computed(() => (showConfirmPassword.value ? 'text' : 'password'))
const isBusy = computed(() => loading.value || submitting.value)

const registerStyle = useAuthThemeVars()

const stepMeta = computed(() => {
  switch (currentStep.value) {
    case 1:
      return {
        eyebrow: t('auth.register.step1.eyebrow'),
        title: t('auth.register.step1.title'),
        description: t('auth.register.step1.description'),
      }
    case 2:
      return {
        eyebrow: t('auth.register.step2.eyebrow'),
        title: t('auth.register.step2.title'),
        description: t('auth.register.step2.description'),
      }
    default:
      return {
        eyebrow: t('auth.register.step3.eyebrow'),
        title: t('auth.register.step3.title'),
        description: t('auth.register.step3.description'),
      }
  }
})

function resetFieldErrors() {
  nomeError.value = ''
  emailError.value = ''
  crmvError.value = ''
  especialidadeError.value = ''
  senhaError.value = ''
  confirmarSenhaError.value = ''
  termsError.value = ''
  globalError.value = ''
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

async function handleEmailBlur() {
  emailError.value = ''
  emailAvailable.value = null

  const normalizedEmail = email.value.trim()

  if (!normalizedEmail) {
    return
  }

  if (!isValidEmail(normalizedEmail)) {
    emailError.value = t('auth.register.errors.emailInvalid')
    return
  }

  emailChecking.value = true

  try {
    const result = await checkEmailAvailability(normalizedEmail)
    emailAvailable.value = result.available

    if (!result.available) {
      emailError.value = t('auth.register.errors.emailTaken')
    }
  } catch (error) {
    emailError.value =
      error instanceof Error ? error.message : t('auth.register.errors.emailCheckFailed')
  } finally {
    emailChecking.value = false
  }
}

function validateStep1() {
  resetFieldErrors()

  const normalizedName = nome.value.trim()
  const normalizedEmail = email.value.trim()

  if (normalizedName.length < 3) {
    nomeError.value = t('auth.register.errors.nameMin')
  }

  if (!normalizedEmail) {
    emailError.value = t('auth.register.errors.emailRequired')
  } else if (!isValidEmail(normalizedEmail)) {
    emailError.value = t('auth.register.errors.emailInvalid')
  } else if (emailAvailable.value === false) {
    emailError.value = t('auth.register.errors.emailTaken')
  } else if (emailAvailable.value === null && !emailChecking.value) {
    emailError.value = t('auth.register.errors.emailVerifyFirst')
  }

  return !nomeError.value && !emailError.value
}

function validateStep2() {
  resetFieldErrors()

  if (!crmv.value.trim()) {
    crmvError.value = t('auth.register.errors.crmvRequired')
  }

  if (!especialidade.value.trim()) {
    especialidadeError.value = t('auth.register.errors.specialtyRequired')
  }

  return !crmvError.value && !especialidadeError.value
}

function validateStep3() {
  resetFieldErrors()

  if (!isPasswordValid(senha.value)) {
    senhaError.value = t('auth.register.errors.passwordRequirements')
  }

  if (!confirmarSenha.value) {
    confirmarSenhaError.value = t('auth.register.errors.confirmRequired')
  } else if (confirmarSenha.value !== senha.value) {
    confirmarSenhaError.value = t('auth.register.errors.confirmMismatch')
  }

  if (!acceptedTerms.value) {
    termsError.value = t('auth.register.errors.termsRequired')
  }

  return !senhaError.value && !confirmarSenhaError.value && !termsError.value
}

async function ensureEmailAvailability() {
  if (emailAvailable.value !== null) {
    return emailAvailable.value
  }

  await handleEmailBlur()
  return emailAvailable.value === true
}

async function goToNextStep() {
  if (isBusy.value) {
    return
  }

  if (currentStep.value === 1) {
    loading.value = true

    try {
      const isEmailReady = await ensureEmailAvailability()

      if (!validateStep1() || !isEmailReady) {
        return
      }

      currentStep.value = 2
    } finally {
      loading.value = false
    }

    return
  }

  if (currentStep.value === 2 && validateStep2()) {
    currentStep.value = 3
  }
}

function goToPreviousStep() {
  if (isBusy.value || currentStep.value === 1) {
    return
  }

  resetFieldErrors()
  currentStep.value -= 1
}

function buildPayload() {
  return {
    email: email.value.trim(),
    nome: nome.value.trim(),
    senha: senha.value,
    ativo: true as const,
    veterinario: {
      crmv: crmv.value.trim(),
      especialidade: especialidade.value.trim(),
    },
  }
}

async function handleSubmit() {
  if (submitting.value) {
    return
  }

  if (!validateStep3()) {
    return
  }

  submitting.value = true
  globalError.value = ''

  try {
    await registerVeterinarian(buildPayload(), {
      rememberAccess: rememberAccess.value,
    })

    toast.add({
      severity: 'success',
      summary: t('auth.register.toast.success.summary'),
      detail: t('auth.register.toast.success.detail'),
      life: 4000,
    })

    await router.replace(getDefaultLandingPath())
  } catch (error) {
    globalError.value =
      error instanceof Error ? error.message : t('auth.register.errors.submitFailed')

    toast.add({
      severity: 'error',
      summary: t('auth.register.toast.error.summary'),
      detail: globalError.value,
      life: 6000,
    })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <AuthLayout
    :description="stepMeta.description"
    :eyebrow="stepMeta.eyebrow"
    :title="stepMeta.title"
  >
    <div class="register-flow" :style="registerStyle">
      <RegisterStepIndicator
        :current-step="currentStep"
        :labels="STEP_LABELS"
        :total-steps="TOTAL_STEPS"
      />

      <form class="register-form" @submit.prevent="currentStep === 3 ? handleSubmit() : goToNextStep()">
        <section v-if="currentStep === 1" class="register-form__step">
          <AuthTextField
            id="register-name"
            v-model="nome"
            autocomplete="name"
            :disabled="isBusy"
            :error="nomeError"
            :label="t('auth.register.name.label')"
            :placeholder="t('auth.register.name.placeholder')"
            required
          />

          <AuthTextField
            id="register-email"
            v-model="email"
            autocomplete="email"
            :disabled="isBusy"
            :error="emailError"
            :hint="t('auth.register.email.hint')"
            :label="t('auth.register.email.label')"
            :placeholder="t('auth.register.email.placeholder')"
            required
            type="email"
            @blur="handleEmailBlur"
          />

          <p v-if="emailChecking" class="register-form__status">
            {{ t('auth.register.email.checking') }}
          </p>
          <p v-else-if="emailAvailable" class="register-form__status register-form__status--success">
            {{ t('auth.register.email.available') }}
          </p>
        </section>

        <section v-else-if="currentStep === 2" class="register-form__step">
          <AuthTextField
            id="register-crmv"
            v-model="crmv"
            :disabled="isBusy"
            :error="crmvError"
            :label="t('auth.register.crmv.label')"
            :placeholder="t('auth.register.crmv.placeholder')"
            required
          />

          <label class="register-textarea-field" for="register-especialidade">
            <span class="register-textarea-field__label">
              {{ t('auth.register.specialty.label') }}
              <span class="register-textarea-field__required">*</span>
            </span>
            <textarea
              id="register-especialidade"
              v-model="especialidade"
              class="register-textarea-field__input"
              :class="{ 'register-textarea-field__input--invalid': Boolean(especialidadeError) }"
              :disabled="isBusy"
              :placeholder="t('auth.register.specialty.placeholder')"
              rows="3"
            />
            <span v-if="especialidadeError" class="register-textarea-field__error">
              {{ especialidadeError }}
            </span>
          </label>
        </section>

        <section v-else class="register-form__step">
          <AuthTextField
            id="register-password"
            v-model="senha"
            autocomplete="new-password"
            :disabled="isBusy"
            :error="senhaError"
            :label="t('auth.register.password.label')"
            :placeholder="t('auth.register.password.placeholder')"
            required
            :type="passwordInputType"
          >
            <template #trailing>
              <button
                :aria-label="
                  showPassword
                    ? t('auth.register.password.hide')
                    : t('auth.register.password.show')
                "
                class="register-password-toggle"
                :disabled="isBusy"
                type="button"
                @click="showPassword = !showPassword"
              >
                <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
              </button>
            </template>
          </AuthTextField>

          <PasswordRequirements :password="senha" />

          <AuthTextField
            id="register-confirm-password"
            v-model="confirmarSenha"
            autocomplete="new-password"
            :disabled="isBusy"
            :error="confirmarSenhaError"
            :label="t('auth.register.confirmPassword.label')"
            :placeholder="t('auth.register.confirmPassword.placeholder')"
            required
            :type="confirmPasswordInputType"
          >
            <template #trailing>
              <button
                :aria-label="
                  showConfirmPassword
                    ? t('auth.register.password.hide')
                    : t('auth.register.password.show')
                "
                class="register-password-toggle"
                :disabled="isBusy"
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

          <label class="register-terms">
            <input v-model="acceptedTerms" :disabled="isBusy" type="checkbox" />
            <span class="register-terms__box" aria-hidden="true">
              <i class="pi pi-check" />
            </span>
            <span class="register-terms__copy">
              {{ t('auth.register.terms.copy') }}
              <a
                class="register-terms__details"
                href="https://www.petjourney.health/termos"
                target="_blank"
                rel="noopener noreferrer"
                @click.stop
              >
                {{ t('auth.register.terms.details') }}
              </a>
            </span>
          </label>
          <p v-if="termsError" class="register-form__inline-error">{{ termsError }}</p>

          <label class="register-terms">
            <input v-model="rememberAccess" :disabled="isBusy" type="checkbox" />
            <span class="register-terms__box" aria-hidden="true">
              <i class="pi pi-check" />
            </span>
            <span class="register-terms__copy">
              {{ t('auth.register.remember') }}
            </span>
          </label>
        </section>

        <p v-if="globalError" class="register-form__global-error" role="alert">
          {{ globalError }}
        </p>

        <div class="register-form__actions">
          <AuthButton
            v-if="currentStep < 3"
            :disabled="isBusy"
            full-width
            :loading="loading"
            type="submit"
          >
            {{ loading ? t('auth.register.validating') : t('auth.register.continue') }}
          </AuthButton>

          <AuthButton
            v-else
            :disabled="isBusy"
            full-width
            :loading="submitting"
            type="submit"
          >
            {{ submitting ? t('auth.register.creating') : t('auth.register.createAccount') }}
          </AuthButton>

          <AuthButton
            v-if="currentStep > 1"
            :disabled="isBusy"
            full-width
            type="button"
            variant="secondary"
            @click="goToPreviousStep"
          >
            {{ t('auth.register.back') }}
          </AuthButton>
        </div>
      </form>
    </div>

    <p class="register-support">
      {{ t('auth.register.support.prompt') }}
      <RouterLink to="/auth/login">{{ t('auth.register.support.login') }}</RouterLink>
    </p>
  </AuthLayout>
</template>

<style scoped>
.register-flow {
  display: grid;
}

.register-form {
  display: grid;
  gap: 1rem;
}

.register-form__step {
  display: grid;
  gap: 1rem;
}

.register-form__status {
  margin: -0.35rem 0 0;
  color: var(--auth-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

.register-form__status--success {
  color: var(--auth-link);
}

.register-form__inline-error,
.register-form__global-error {
  margin: 0;
  color: var(--auth-danger);
  font-size: 0.8125rem;
  font-weight: 600;
}

.register-form__actions {
  display: grid;
  gap: 0.75rem;
}

.register-textarea-field {
  display: grid;
  gap: 0.5rem;
}

.register-textarea-field__label {
  color: var(--auth-text);
  font-size: 0.8125rem;
  font-weight: 700;
}

.register-textarea-field__required {
  color: var(--auth-danger);
}

.register-textarea-field__input {
  width: 100%;
  min-height: 6.5rem;
  padding: 0.85rem 1rem;
  border: 1px solid var(--auth-line);
  border-radius: 0.875rem;
  background: var(--auth-field-bg);
  color: var(--auth-text);
  font: inherit;
  line-height: 1.5;
  outline: none;
  resize: vertical;
}

.register-textarea-field__input:focus {
  border-color: var(--auth-sage);
  background: color-mix(in srgb, var(--auth-sage-tint) 35%, var(--auth-field-bg));
}

.register-textarea-field__input--invalid {
  border-color: var(--auth-danger);
}

.register-textarea-field__error {
  color: var(--auth-danger);
  font-size: 0.75rem;
  font-weight: 600;
}

.register-password-toggle {
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

.register-password-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.register-terms {
  display: inline-flex;
  align-items: flex-start;
  gap: 0.65rem;
  color: var(--auth-muted);
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.45;
  cursor: pointer;
}

.register-terms input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.register-terms__box {
  display: grid;
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  margin-top: 0.15rem;
  place-items: center;
  border-radius: 0.3rem;
  background: var(--auth-sage);
  color: var(--auth-cta-text);
}

.register-terms__box .pi {
  font-size: 0.58rem;
  font-weight: 700;
}

.register-terms input:not(:checked) + .register-terms__box {
  border: 1px solid var(--auth-line);
  background: var(--auth-field-bg);
  color: transparent;
}

.register-terms__copy {
  min-width: 0;
  color: var(--auth-muted);
}

.register-terms__details {
  color: var(--auth-link);
  font-weight: 800;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.register-terms__details:hover {
  color: var(--auth-sage-strong);
}

.register-support {
  margin: 2rem 0 0;
  color: var(--auth-soft);
  font-size: 0.875rem;
  text-align: center;
}

.register-support a {
  color: var(--auth-link);
  font-weight: 800;
  text-decoration: none;
}
</style>
