<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import PasswordRequirements from '@/components/auth/PasswordRequirements.vue'
import RegisterStepIndicator from '@/components/auth/RegisterStepIndicator.vue'
import { checkEmailAvailability, registerUsuario } from '@/service/user/user-service'
import { useAuthThemeVars } from '@/composables/useAuthThemeVars'
import { isPasswordValid } from '@/utils/validation/password'

/**
 * Cadastro único de parceiro: conta mínima (nome/email/senha), sem perfil clínico.
 * Vet no produto É um parceiro (multi-perfil.md, D6); CRMV/especialidade são
 * opcionais e entram depois em Configurações > Perfil ou no cadastro da empresa.
 */
const TOTAL_STEPS = 2

const { t } = useI18n()

const STEP_LABELS = computed(() => [
  t('auth.register.stepLabels.identity'),
  t('auth.register.stepLabels.account'),
])

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
const senha = ref('')
const confirmarSenha = ref('')

const nomeError = ref('')
const emailError = ref('')
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
  const eyebrow = t('auth.register.stepOf', {
    current: currentStep.value,
    total: TOTAL_STEPS,
  })

  if (currentStep.value === 1) {
    return {
      eyebrow,
      title: t('auth.register.step1.title'),
      description: t('auth.register.step1.description'),
    }
  }

  return {
    eyebrow,
    title: t('auth.register.step3.title'),
    description: t('auth.register.step3.description'),
  }
})

function resetFieldErrors() {
  nomeError.value = ''
  emailError.value = ''
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
}

function goToPreviousStep() {
  if (isBusy.value || currentStep.value === 1) {
    return
  }

  resetFieldErrors()
  currentStep.value = 1
}

async function handleSubmit() {
  if (submitting.value) {
    return
  }

  if (!validateStep2()) {
    return
  }

  submitting.value = true
  globalError.value = ''

  try {
    await registerUsuario(
      {
        email: email.value.trim(),
        nome: nome.value.trim(),
        senha: senha.value,
        ativo: true,
      },
      { rememberAccess: rememberAccess.value },
    )

    toast.add({
      severity: 'success',
      summary: t('auth.register.toast.success.summary'),
      detail: t('auth.register.toast.success.detail'),
      life: 4000,
    })

    /* Todo cadastro novo entra no funil de credenciamento da empresa. */
    await router.replace('/settings?aba=empresa')
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
        :list-label="t('auth.register.stepsAria')"
      />

      <form
        class="register-form"
        @submit.prevent="currentStep === 2 ? handleSubmit() : goToNextStep()"
      >
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
              <Button
                :aria-label="
                  showPassword
                    ? t('auth.register.password.hide')
                    : t('auth.register.password.show')
                "
                class="register-password-toggle"
                :disabled="isBusy"
                :icon="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"
                rounded
                severity="secondary"
                text
                type="button"
                @click="showPassword = !showPassword"
              />
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
              <Button
                :aria-label="
                  showConfirmPassword
                    ? t('auth.register.password.hide')
                    : t('auth.register.password.show')
                "
                class="register-password-toggle"
                :disabled="isBusy"
                :icon="showConfirmPassword ? 'pi pi-eye-slash' : 'pi pi-eye'"
                rounded
                severity="secondary"
                text
                type="button"
                @click="showConfirmPassword = !showConfirmPassword"
              />
            </template>
          </AuthTextField>

          <label class="register-terms" for="register-accept-terms">
            <Checkbox
              v-model="acceptedTerms"
              binary
              class="register-terms__check"
              :disabled="isBusy"
              input-id="register-accept-terms"
              :invalid="Boolean(termsError)"
              size="small"
            />
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

          <label class="register-terms" for="register-remember">
            <Checkbox
              v-model="rememberAccess"
              binary
              class="register-terms__check"
              :disabled="isBusy"
              input-id="register-remember"
              size="small"
            />
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
            v-if="currentStep === 1"
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

.register-password-toggle.p-button {
  width: 2rem;
  height: 2rem;
  color: var(--auth-soft);
}

.register-password-toggle.p-button:not(:disabled):hover {
  background: var(--auth-sage-tint);
  color: var(--auth-soft);
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

.register-terms__check {
  flex: 0 0 auto;
  margin-top: 0.15rem;
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
