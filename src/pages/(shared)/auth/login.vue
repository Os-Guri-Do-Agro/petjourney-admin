<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import { login } from '@/service/auth/auth-service'
import { currentColors } from '@/theme/color-mode'

const email = ref('')
const password = ref('')
const rememberAccess = ref(true)
const loading = ref(false)
const showPassword = ref(false)
const passwordInputType = computed(() => (showPassword.value ? 'text' : 'password'))

const route = useRoute()
const router = useRouter()
const toast = useToast()

const loginStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--auth-icon': colors.auth.soft,
    '--auth-text': colors.auth.text,
    '--auth-link': colors.auth.sageStrong,
    '--auth-sage-tint': colors.auth.sageTint,
    '--auth-muted': colors.auth.muted,
    '--auth-sage': colors.vet.primary,
    '--auth-white': colors.auth.white,
    '--auth-line': colors.auth.line,
    '--auth-divider': colors.auth.divider,
    '--auth-shadow-rgb': colors.auth.shadowRgb,
  }
})

function getSafeRedirectPath() {
  const redirect = route.query.redirect

  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect === '/tutor' ? '/veterinario' : redirect
  }

  return '/veterinario'
}

async function handleLogin() {
  if (loading.value) {
    return
  }

  loading.value = true

  try {
    await login(
      {
        email: email.value.trim(),
        senha: password.value,
      },
      {
        rememberAccess: rememberAccess.value,
      },
    )

    await router.replace(getSafeRedirectPath())
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Erro ao entrar',
      detail: error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.',
      life: 5000,
    })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AuthLayout
    description="Entre para acompanhar a agenda, os prontuários e o cuidado dos seus pacientes."
    title="Bem-vindo de volta"
  >
    <form class="login-form" :style="loginStyle" @submit.prevent="handleLogin">
      <AuthTextField
        id="email"
        v-model="email"
        autocomplete="email"
        :disabled="loading"
        label="E-mail"
        placeholder="dra.marina@petjourney.vet"
        required
        type="email"
      >
        <template #leading>
          <i class="pi pi-envelope login-field-icon" aria-hidden="true" />
        </template>
      </AuthTextField>

      <div class="login-password-group">
        <div class="login-password-group__header">
          <span>Senha</span>
          <RouterLink class="login-inline-link" to="/auth/forgot-password">
            Esqueceu a senha?
          </RouterLink>
        </div>

        <AuthTextField
          id="password"
          v-model="password"
          autocomplete="current-password"
          :disabled="loading"
          label=""
          placeholder="Digite sua senha"
          required
          :type="passwordInputType"
        >
          <template #leading>
            <i class="pi pi-lock login-field-icon" aria-hidden="true" />
          </template>

          <template #trailing>
            <button
              :aria-label="showPassword ? 'Ocultar senha' : 'Mostrar senha'"
              class="login-password-toggle"
              :disabled="loading"
              type="button"
              @click="showPassword = !showPassword"
            >
              <i :class="showPassword ? 'pi pi-eye-slash' : 'pi pi-eye'" aria-hidden="true" />
            </button>
          </template>
        </AuthTextField>
      </div>

      <label class="login-remember">
        <input v-model="rememberAccess" :disabled="loading" type="checkbox" />
        <span>
          <i class="pi pi-check" aria-hidden="true" />
        </span>
        Manter conectado neste computador
      </label>

      <AuthButton :loading="loading" full-width type="submit">
        {{ loading ? 'Entrando...' : 'Entrar no painel' }}
        <i v-if="!loading" class="pi pi-arrow-right ml-2" aria-hidden="true" />
      </AuthButton>

      <div class="login-divider">
        <span>ou</span>
      </div>

      <button class="login-clinic-button" type="button">
        <i class="pi pi-building" aria-hidden="true" />
        Acessar com conta da clínica
      </button>
    </form>

    <p class="login-support">
      Novo por aqui?
      <RouterLink to="/auth/register">Criar conta</RouterLink>
    </p>
  </AuthLayout>
</template>

<style scoped>
.login-form {
  display: grid;
  gap: 1.1rem;
}

.login-field-icon {
  color: var(--auth-icon);
  font-size: 1rem;
}

.login-password-group {
  display: grid;
  gap: 0.45rem;
}

.login-password-group__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  color: var(--auth-text);
  font-size: 0.8125rem;
  font-weight: 700;
}

.login-inline-link,
.login-support a {
  color: var(--auth-link);
  font-weight: 800;
  text-decoration: none;
}

.login-password-toggle {
  display: inline-flex;
  width: 2rem;
  height: 2rem;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--auth-icon);
  cursor: pointer;
  transition:
    background 160ms ease,
    opacity 160ms ease;
}

.login-password-toggle:hover {
  background: var(--auth-sage-tint);
}

.login-password-toggle:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.login-password-toggle .pi {
  font-size: 1rem;
}

.login-remember {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  gap: 0.65rem;
  color: var(--auth-muted);
  font-size: 0.875rem;
  font-weight: 600;
  cursor: pointer;
}

.login-remember input {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.login-remember span {
  display: grid;
  width: 1rem;
  height: 1rem;
  place-items: center;
  border-radius: 0.3rem;
  background: var(--auth-sage);
  color: var(--auth-white);
}

.login-remember span .pi {
  font-size: 0.58rem;
  font-weight: 700;
}

.login-remember input:not(:checked) + span {
  border: 1px solid var(--auth-line);
  background: var(--auth-white);
  color: transparent;
}

.login-divider {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 0.8rem;
  align-items: center;
  color: var(--auth-divider);
  font-size: 0.8125rem;
  font-weight: 700;
}

.login-divider::before,
.login-divider::after {
  height: 1px;
  background: var(--auth-line);
  content: '';
}

.login-clinic-button {
  display: inline-flex;
  height: 3.125rem;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  border: 1px solid var(--auth-line);
  border-radius: 0.875rem;
  background: var(--auth-white);
  color: var(--auth-muted);
  font-weight: 800;
  cursor: pointer;
}

.login-support {
  margin: 2rem 0 0;
  color: var(--auth-icon);
  font-size: 0.875rem;
}
</style>
