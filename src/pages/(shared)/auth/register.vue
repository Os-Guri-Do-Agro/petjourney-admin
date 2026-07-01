<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import PasswordRequirements from '@/components/auth/PasswordRequirements.vue'
import RegisterStepIndicator from '@/components/auth/RegisterStepIndicator.vue'
import { checkEmailAvailability, registerVeterinarian } from '@/service/user/user-service'
import { currentColors } from '@/theme/color-mode'
import { isPasswordValid } from '@/utils/validation/password'

const STEP_LABELS = ['Identidade', 'Profissional', 'Conta']
const TOTAL_STEPS = STEP_LABELS.length

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
const fotoUrl = ref('')
const senha = ref('')
const confirmarSenha = ref('')

const nomeError = ref('')
const emailError = ref('')
const crmvError = ref('')
const especialidadeError = ref('')
const fotoUrlError = ref('')
const senhaError = ref('')
const confirmarSenhaError = ref('')
const termsError = ref('')
const globalError = ref('')

const emailChecking = ref(false)
const emailAvailable = ref<boolean | null>(null)

const passwordInputType = computed(() => (showPassword.value ? 'text' : 'password'))
const confirmPasswordInputType = computed(() => (showConfirmPassword.value ? 'text' : 'password'))
const isBusy = computed(() => loading.value || submitting.value)

const registerStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--auth-primary': colors.auth.text,
    '--auth-muted': colors.auth.muted,
    '--auth-soft': colors.auth.soft,
    '--auth-line': colors.auth.line,
    '--auth-sage': colors.vet.primary,
    '--auth-sage-tint': colors.auth.sageTint,
    '--auth-white': colors.auth.white,
    '--auth-danger': colors.red,
    '--auth-link': colors.auth.sageStrong,
  }
})

const stepMeta = computed(() => {
  switch (currentStep.value) {
    case 1:
      return {
        eyebrow: 'Etapa 1 de 3',
        title: 'Identidade',
        description: 'Informe nome e e-mail para criar sua conta veterinária.',
      }
    case 2:
      return {
        eyebrow: 'Etapa 2 de 3',
        title: 'Dados profissionais',
        description: 'Registre suas informações clínicas para o painel.',
      }
    default:
      return {
        eyebrow: 'Etapa 3 de 3',
        title: 'Segurança da conta',
        description: 'Defina uma senha forte e aceite os termos de uso.',
      }
  }
})

function resetFieldErrors() {
  nomeError.value = ''
  emailError.value = ''
  crmvError.value = ''
  especialidadeError.value = ''
  fotoUrlError.value = ''
  senhaError.value = ''
  confirmarSenhaError.value = ''
  termsError.value = ''
  globalError.value = ''
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

function isValidUrl(value: string) {
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

async function handleEmailBlur() {
  emailError.value = ''
  emailAvailable.value = null

  const normalizedEmail = email.value.trim()

  if (!normalizedEmail) {
    return
  }

  if (!isValidEmail(normalizedEmail)) {
    emailError.value = 'Informe um e-mail válido.'
    return
  }

  emailChecking.value = true

  try {
    const result = await checkEmailAvailability(normalizedEmail)
    emailAvailable.value = result.available

    if (!result.available) {
      emailError.value = 'E-mail já cadastrado.'
    }
  } catch (error) {
    emailError.value =
      error instanceof Error ? error.message : 'Não foi possível verificar o e-mail.'
  } finally {
    emailChecking.value = false
  }
}

function validateStep1() {
  resetFieldErrors()

  const normalizedName = nome.value.trim()
  const normalizedEmail = email.value.trim()

  if (normalizedName.length < 3) {
    nomeError.value = 'Informe pelo menos 3 caracteres.'
  }

  if (!normalizedEmail) {
    emailError.value = 'E-mail é obrigatório.'
  } else if (!isValidEmail(normalizedEmail)) {
    emailError.value = 'Informe um e-mail válido.'
  } else if (emailAvailable.value === false) {
    emailError.value = 'E-mail já cadastrado.'
  } else if (emailAvailable.value === null && !emailChecking.value) {
    emailError.value = 'Verifique a disponibilidade do e-mail antes de continuar.'
  }

  return !nomeError.value && !emailError.value
}

function validateStep2() {
  resetFieldErrors()

  if (!crmv.value.trim()) {
    crmvError.value = 'CRMV é obrigatório.'
  }

  if (!especialidade.value.trim()) {
    especialidadeError.value = 'Informe sua especialidade principal.'
  }

  const trimmedFoto = fotoUrl.value.trim()

  if (trimmedFoto && !isValidUrl(trimmedFoto)) {
    fotoUrlError.value = 'Informe uma URL válida (http ou https).'
  }

  return !crmvError.value && !especialidadeError.value && !fotoUrlError.value
}

function validateStep3() {
  resetFieldErrors()

  if (!isPasswordValid(senha.value)) {
    senhaError.value = 'A senha não atende todos os requisitos.'
  }

  if (!confirmarSenha.value) {
    confirmarSenhaError.value = 'Confirme sua senha.'
  } else if (confirmarSenha.value !== senha.value) {
    confirmarSenhaError.value = 'As senhas não coincidem.'
  }

  if (!acceptedTerms.value) {
    termsError.value = 'É necessário aceitar os termos para continuar.'
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
  const trimmedFoto = fotoUrl.value.trim()

  return {
    email: email.value.trim(),
    nome: nome.value.trim(),
    senha: senha.value,
    ativo: true as const,
    veterinario: {
      crmv: crmv.value.trim(),
      especialidade: especialidade.value.trim(),
      ...(trimmedFoto ? { foto: trimmedFoto } : {}),
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
      summary: 'Conta criada',
      detail: 'Bem-vindo ao painel veterinário PetJourney.',
      life: 4000,
    })

    await router.replace('/veterinario')
  } catch (error) {
    globalError.value =
      error instanceof Error ? error.message : 'Não foi possível concluir o cadastro.'

    toast.add({
      severity: 'error',
      summary: 'Erro no cadastro',
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
            label="Nome completo"
            placeholder="Dra. Maria Silva"
            required
          />

          <AuthTextField
            id="register-email"
            v-model="email"
            autocomplete="email"
            :disabled="isBusy"
            :error="emailError"
            hint="Usaremos este e-mail para login e comunicações importantes."
            label="E-mail"
            placeholder="dra.maria@clinica.com"
            required
            type="email"
            @blur="handleEmailBlur"
          />

          <p v-if="emailChecking" class="register-form__status">Verificando disponibilidade do e-mail...</p>
          <p v-else-if="emailAvailable" class="register-form__status register-form__status--success">
            E-mail disponível.
          </p>
        </section>

        <section v-else-if="currentStep === 2" class="register-form__step">
          <AuthTextField
            id="register-crmv"
            v-model="crmv"
            :disabled="isBusy"
            :error="crmvError"
            label="CRMV"
            placeholder="CRMV-SP 12345"
            required
          />

          <label class="register-textarea-field" for="register-especialidade">
            <span class="register-textarea-field__label">
              Especialidade
              <span class="register-textarea-field__required">*</span>
            </span>
            <textarea
              id="register-especialidade"
              v-model="especialidade"
              class="register-textarea-field__input"
              :class="{ 'register-textarea-field__input--invalid': Boolean(especialidadeError) }"
              :disabled="isBusy"
              placeholder="Clínica Geral, Dermatologia..."
              rows="3"
            />
            <span v-if="especialidadeError" class="register-textarea-field__error">
              {{ especialidadeError }}
            </span>
          </label>

          <AuthTextField
            id="register-foto"
            v-model="fotoUrl"
            :disabled="isBusy"
            :error="fotoUrlError"
            hint="Opcional. Cole a URL da foto; o upload direto será integrado em breve."
            label="URL da foto de perfil"
            placeholder="https://..."
            type="url"
          />
        </section>

        <section v-else class="register-form__step">
          <AuthTextField
            id="register-password"
            v-model="senha"
            autocomplete="new-password"
            :disabled="isBusy"
            :error="senhaError"
            label="Senha"
            placeholder="Crie uma senha segura"
            required
            :type="passwordInputType"
          >
            <template #trailing>
              <button
                :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
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
            label="Confirmar senha"
            placeholder="Repita a senha"
            required
            :type="confirmPasswordInputType"
          >
            <template #trailing>
              <button
                :aria-label="showConfirmPassword ? 'Ocultar senha' : 'Mostrar senha'"
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
            <span>
              <i class="pi pi-check" aria-hidden="true" />
            </span>
            Li e aceito os termos de uso e a política de privacidade do PetJourney.
          </label>
          <p v-if="termsError" class="register-form__inline-error">{{ termsError }}</p>

          <label class="register-terms">
            <input v-model="rememberAccess" :disabled="isBusy" type="checkbox" />
            <span>
              <i class="pi pi-check" aria-hidden="true" />
            </span>
            Manter conectado neste computador após o cadastro
          </label>
        </section>

        <p v-if="globalError" class="register-form__global-error" role="alert">
          {{ globalError }}
        </p>

        <div class="register-form__actions">
          <AuthButton
            v-if="currentStep > 1"
            :disabled="isBusy"
            full-width
            type="button"
            variant="secondary"
            @click="goToPreviousStep"
          >
            Voltar
          </AuthButton>

          <AuthButton
            v-if="currentStep < 3"
            :disabled="isBusy"
            full-width
            :loading="loading"
            type="submit"
          >
            {{ loading ? 'Validando...' : 'Continuar' }}
          </AuthButton>

          <AuthButton
            v-else
            :disabled="isBusy"
            full-width
            :loading="submitting"
            type="submit"
          >
            {{ submitting ? 'Criando conta...' : 'Criar conta' }}
          </AuthButton>
        </div>
      </form>
    </div>

    <p class="register-support">
      Já possui conta?
      <RouterLink to="/auth/login">Entrar agora</RouterLink>
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
  color: var(--auth-primary);
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
  background: var(--auth-white);
  color: var(--auth-primary);
  font: inherit;
  line-height: 1.5;
  outline: none;
  resize: vertical;
}

.register-textarea-field__input:focus {
  border-color: var(--auth-sage);
  background: color-mix(in srgb, var(--auth-sage-tint) 35%, var(--auth-white));
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

.register-terms span {
  display: grid;
  width: 1rem;
  height: 1rem;
  flex: 0 0 auto;
  margin-top: 0.15rem;
  place-items: center;
  border-radius: 0.3rem;
  background: var(--auth-sage);
  color: var(--auth-white);
}

.register-terms span .pi {
  font-size: 0.58rem;
  font-weight: 700;
}

.register-terms input:not(:checked) + span {
  border: 1px solid var(--auth-line);
  background: var(--auth-white);
  color: transparent;
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
