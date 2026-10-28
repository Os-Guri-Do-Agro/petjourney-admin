<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { I18nT, useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import PasswordRequirements from '@/components/auth/PasswordRequirements.vue'
import RegisterStepIndicator from '@/components/auth/RegisterStepIndicator.vue'
import { checkEmailAvailability, registerUsuario } from '@/service/user/user-service'
import { isPasswordValid } from '@/utils/validation/password'

/**
 * Cadastro único de parceiro: conta mínima (nome/email/senha), sem perfil clínico.
 * Vet no produto É um parceiro (multi-perfil.md, D6); CRMV/especialidade são
 * opcionais e entram depois em Configurações > Perfil ou no cadastro da empresa.
 */
const TOTAL_STEPS = 2

const { t } = useI18n()

/* O passo e o título dizem a mesma coisa: "Senha" no passo, "Escolha uma senha" no título. Antes
   o passo era "Conta" e o título "Segurança da conta". */
const STEP_LABELS = computed(() => [
  t('auth.register.stepLabels.identity'),
  t('auth.register.passos.senha'),
])

const router = useRouter()
const toast = useToast()

const currentStep = ref(1)
const loading = ref(false)
const submitting = ref(false)
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

const isBusy = computed(() => loading.value || submitting.value)

/* Sem sobretítulo "Etapa 1 de 2": quem diz a etapa são os passos, logo abaixo do título. */
const stepMeta = computed(() =>
  currentStep.value === 1
    ? {
        title: t('auth.register.step1.title'),
        description: t('auth.register.step1.description'),
      }
    : {
        title: t('auth.register.passo2.titulo'),
        description: t('auth.register.step3.description'),
      },
)

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
  <AuthLayout :description="stepMeta.description" :title="stepMeta.title">
    <div class="register-flow">
      <RegisterStepIndicator
        :current-step="currentStep"
        :labels="STEP_LABELS"
        :total-steps="TOTAL_STEPS"
        :list-label="t('auth.register.stepsAria')"
      />

      <!-- `novalidate`: a conferência é a da tela, embaixo de cada campo e no idioma do portal. O
           balão do navegador ("Preencha este campo.") tapava a lista de requisitos da senha. -->
      <form
        class="register-form"
        novalidate
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
            revelavel
            type="password"
          />

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
            revelavel
            type="password"
          />

          <label class="register-terms" for="register-accept-terms">
            <Checkbox
              v-model="acceptedTerms"
              binary
              class="register-terms__check"
              :disabled="isBusy"
              input-id="register-accept-terms"
              :invalid="Boolean(termsError)"
            />
            <!-- O link é o próprio nome dos termos, dentro da frase, e não um "detalhes" solto. -->
            <I18nT
              keypath="auth.register.terms.copy"
              tag="span"
              class="register-terms__copy"
              scope="global"
            >
              <template #termos>
                <a
                  class="register-terms__details"
                  href="https://www.petjourney.health/termos"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click.stop
                >
                  {{ t('auth.register.terms.details') }}
                </a>
              </template>
            </I18nT>
          </label>
          <p v-if="termsError" class="register-form__inline-error">{{ termsError }}</p>

          <label class="register-terms" for="register-remember">
            <Checkbox
              v-model="rememberAccess"
              binary
              class="register-terms__check"
              :disabled="isBusy"
              input-id="register-remember"
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
      <RouterLink class="register-link" to="/auth/login">
        {{ t('auth.register.support.login') }}
      </RouterLink>
    </p>
  </AuthLayout>
</template>

<style scoped>
.register-flow {
  display: grid;
  gap: 24px;
}

.register-form {
  display: grid;
  gap: 20px;
}

.register-form__step {
  display: grid;
  gap: 20px;
}

.register-form__status {
  margin: -12px 0 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.register-form__status--success {
  color: var(--ok-tinta);
}

.register-form__inline-error,
.register-form__global-error {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 500;
}

.register-form__actions {
  display: grid;
  gap: 10px;
}

.register-terms {
  display: inline-flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta-2);
  cursor: pointer;
  font-size: 14.5px;
  line-height: 1.45;
}

.register-terms__check {
  flex: 0 0 auto;
  margin-top: 1px;
}

.register-terms__copy {
  min-width: 0;
}

/* O link do kit: musgo sublinhado, o sublinhado acende no hover. */
.register-terms__details,
.register-link {
  border-radius: 4px;
  color: var(--musgo);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: color-mix(in oklab, var(--musgo) 35%, transparent);
  text-underline-offset: 3px;
}

.register-terms__details:hover,
.register-link:hover {
  text-decoration-color: currentColor;
}

.register-terms__details:focus-visible,
.register-link:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.register-support {
  margin: 2rem 0 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  text-align: center;
}
</style>
