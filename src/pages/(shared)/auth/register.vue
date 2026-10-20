<script setup lang="ts">
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
import { isPasswordValid } from '@/utils/validation/password'

/**
 * Criar conta, em dois passos: quem é (nome e e-mail, com o e-mail conferido na hora) e a senha.
 * Os passos ficam à vista no alto; o botão diz o que vem depois.
 *
 * Cadastro único de parceiro: conta mínima (nome/email/senha), sem perfil clínico.
 * Vet no produto É um parceiro (multi-perfil.md, D6); CRMV/especialidade são
 * opcionais e entram depois em Configurações > Perfil ou no cadastro da empresa.
 */
const TOTAL_STEPS = 2

const { t } = useI18n()

const STEP_LABELS = computed(() => [
  t('auth.register.passos.dados'),
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

const stepMeta = computed(() =>
  currentStep.value === 1
    ? {
        title: t('auth.register.passo1.titulo'),
        description: t('auth.register.passo1.descricao'),
      }
    : {
        title: t('auth.register.passo2.titulo'),
        description: t('auth.register.passo2.descricao'),
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
    <div class="cadastro">
      <RegisterStepIndicator
        :current-step="currentStep"
        :labels="STEP_LABELS"
        :total-steps="TOTAL_STEPS"
        :list-label="t('auth.register.stepsAria')"
      />

      <form
        class="cadastro__form"
        @submit.prevent="currentStep === 2 ? handleSubmit() : goToNextStep()"
      >
        <div v-if="currentStep === 1" class="cadastro__passo">
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

          <div class="cadastro__email">
            <AuthTextField
              id="register-email"
              v-model="email"
              autocomplete="email"
              inputmode="email"
              :disabled="isBusy"
              :error="emailError"
              :hint="emailChecking || emailAvailable ? '' : t('auth.register.email.hint')"
              :label="t('auth.register.email.label')"
              :placeholder="t('auth.register.email.placeholder')"
              required
              type="email"
              @blur="handleEmailBlur"
            />

            <p v-if="emailChecking" class="cadastro__estado" role="status">
              <i class="ph ph-circle-notch ph-spin" aria-hidden="true" />
              {{ t('auth.register.email.checking') }}
            </p>
            <p
              v-else-if="emailAvailable && !emailError"
              class="cadastro__estado cadastro__estado--ok"
              role="status"
            >
              <i class="ph ph-check-circle" aria-hidden="true" />
              {{ t('auth.register.email.available') }}
            </p>
          </div>
        </div>

        <div v-else class="cadastro__passo">
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

          <div class="cadastro__marcas">
            <label class="cadastro__marca" for="register-accept-terms">
              <Checkbox
                v-model="acceptedTerms"
                binary
                :disabled="isBusy"
                input-id="register-accept-terms"
                :invalid="Boolean(termsError)"
              />
              <span>
                {{ t('auth.register.terms.copy') }}
                <a
                  class="cadastro__termos"
                  href="https://www.petjourney.health/termos"
                  target="_blank"
                  rel="noopener noreferrer"
                  @click.stop
                >
                  {{ t('auth.register.terms.details') }}
                </a>
              </span>
            </label>
            <p v-if="termsError" class="cadastro__erro" role="alert">
              <i class="ph ph-warning-circle" aria-hidden="true" />
              {{ termsError }}
            </p>

            <label class="cadastro__marca" for="register-remember">
              <Checkbox
                v-model="rememberAccess"
                binary
                :disabled="isBusy"
                input-id="register-remember"
              />
              <span>{{ t('auth.register.remember') }}</span>
            </label>
          </div>
        </div>

        <p v-if="globalError" class="cadastro__erro cadastro__erro--geral" role="alert">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          {{ globalError }}
        </p>

        <div class="cadastro__acoes">
          <AuthButton
            v-if="currentStep === 1"
            :disabled="isBusy"
            full-width
            :loading="loading"
            type="submit"
          >
            {{ loading ? t('auth.register.validating') : t('auth.register.continue') }}
          </AuthButton>

          <template v-else>
            <AuthButton :disabled="isBusy" full-width :loading="submitting" type="submit">
              {{ submitting ? t('auth.register.creating') : t('auth.register.createAccount') }}
            </AuthButton>

            <AuthButton
              :disabled="isBusy"
              full-width
              type="button"
              variant="secondary"
              @click="goToPreviousStep"
            >
              <i class="ph ph-arrow-left" aria-hidden="true" />
              {{ t('auth.register.back') }}
            </AuthButton>
          </template>
        </div>
      </form>
    </div>

    <p class="cadastro__entrar">
      {{ t('auth.register.support.prompt') }}
      <RouterLink to="/auth/login">{{ t('auth.register.support.login') }}</RouterLink>
    </p>
  </AuthLayout>
</template>

<style scoped>
.cadastro {
  display: grid;
  gap: 24px;
}

.cadastro__form,
.cadastro__passo {
  display: grid;
  gap: 20px;
}

.cadastro__email {
  display: grid;
  gap: 8px;
}

.cadastro__estado {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.cadastro__estado--ok {
  color: var(--ok-tinta);
  font-weight: 550;
}

.cadastro__estado i {
  font-size: 16px;
}

.cadastro__marcas {
  display: grid;
  gap: 12px;
}

.cadastro__marca {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  color: var(--tinta-2);
  cursor: pointer;
  font-size: 14.5px;
  line-height: 1.5;
}

.cadastro__marca :deep(.p-checkbox) {
  flex: none;
  margin-top: 2px;
}

.cadastro__termos {
  color: var(--musgo);
  font-weight: 600;
  text-decoration: underline;
  text-underline-offset: 3px;
}

.cadastro__erro {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: -4px 0 0;
  color: var(--risco-tinta);
  font-size: 13.5px;
  font-weight: 550;
  line-height: 1.4;
}

.cadastro__erro i {
  flex: none;
  margin-top: 1px;
  font-size: 16px;
}

.cadastro__erro--geral {
  margin: 0;
  padding: 12px 14px;
  border-radius: 12px;
  background: var(--risco-fundo);
}

.cadastro__acoes {
  display: grid;
  gap: 10px;
}

.cadastro__entrar {
  margin: 0;
  padding-top: 20px;
  border-top: 1px solid var(--linha);
  color: var(--tinta-2);
  font-size: 14.5px;
}

.cadastro__entrar a {
  border-radius: 4px;
  color: var(--musgo);
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: color-mix(in oklab, var(--musgo) 35%, transparent);
  text-underline-offset: 3px;
}

.cadastro__entrar a:focus-visible,
.cadastro__termos:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

[dir='rtl'] .cadastro__acoes .ph-arrow-left {
  transform: scaleX(-1);
}
</style>
