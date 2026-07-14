<script setup lang="ts">
import Button from 'primevue/button'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import { login, refreshAuthSession } from '@/service/auth/auth-service'
import {
  clearAuthSession,
  getAuthUser,
  getVeterinarioId,
  hasVeterinarioProfile,
} from '@/service/auth/auth-session'
import {
  postUsersMeReactivate,
  type ReactivateProfile,
} from '@/service/user/inativacao-service'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { useAuthThemeVars } from '@/composables/useAuthThemeVars'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const email = ref('')
const password = ref('')
const rememberAccess = ref(true)
const loading = ref(false)
const reactivating = ref(false)
const showPassword = ref(false)
const passwordInputType = computed(() => (showPassword.value ? 'text' : 'password'))

/** Perfis inativos detectados no login — aguardam CTA de reativação. */
const pendingReactivate = ref<ReactivateProfile[]>([])

const route = useRoute()
const router = useRouter()
const toast = useToast()
const usuarioPerfilStore = useUsuarioPerfilStore()
const loginStyle = useAuthThemeVars()

const showReactivatePanel = computed(() => pendingReactivate.value.length > 0)

const reactivateCopy = computed(() => {
  if (pendingReactivate.value.includes('veterinario') && pendingReactivate.value.includes('tutor')) {
    return 'Esta conta tem perfis inativos. Reative o perfil veterinário para entrar no painel.'
  }

  if (pendingReactivate.value.includes('veterinario')) {
    return 'Seu perfil veterinário está inativo. Reative para continuar no painel.'
  }

  return 'Há um perfil inativo nesta conta. Reative para continuar.'
})

function getSafeRedirectPath() {
  const redirect = route.query.redirect

  if (typeof redirect === 'string' && redirect.startsWith('/') && !redirect.startsWith('//')) {
    return redirect === '/tutor' ||
      redirect === '/inicio' ||
      redirect === '/parceiro' ||
      redirect === '/veterinario'
      ? getDefaultLandingPath()
      : redirect
  }

  return getDefaultLandingPath()
}

function collectInactiveProfiles(flags: {
  tutorInactive: boolean
  veterinarioInactive: boolean
}) {
  const profiles: ReactivateProfile[] = []

  if (flags.veterinarioInactive) {
    profiles.push('veterinario')
  }

  if (flags.tutorInactive) {
    profiles.push('tutor')
  }

  return profiles
}

async function enterPanelAfterAuth() {
  if (!hasVeterinarioProfile()) {
    clearAuthSession()
    usuarioPerfilStore.clear()
    toast.add({
      severity: 'warn',
      summary: 'Perfil veterinário necessário',
      detail: 'Esta conta ainda não possui perfil veterinário habilitado para o painel.',
      life: 5000,
    })
    return
  }

  usuarioPerfilStore.syncFromAuth()
  await router.replace(getSafeRedirectPath())
}

async function handleLogin() {
  if (loading.value || reactivating.value) {
    return
  }

  loading.value = true
  pendingReactivate.value = []

  try {
    const result = await login(
      {
        email: email.value.trim(),
        senha: password.value,
      },
      {
        rememberAccess: rememberAccess.value,
      },
    )

    const inactive = collectInactiveProfiles(result)

    if (inactive.length > 0) {
      pendingReactivate.value = inactive
      return
    }

    await enterPanelAfterAuth()
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

async function handleReactivate(profile: ReactivateProfile = 'veterinario') {
  if (reactivating.value) {
    return
  }

  reactivating.value = true

  try {
    await postUsersMeReactivate({ profile })
    await refreshAuthSession(rememberAccess.value)

    const user = getAuthUser()
    const stillInactive =
      (profile === 'veterinario' && user?.veterinarioActive === false) ||
      (profile === 'tutor' && user?.tutorActive === false)

    if (stillInactive) {
      toast.add({
        severity: 'warn',
        summary: 'Perfil ainda inativo',
        detail: 'A reativação foi pedida, mas o token ainda indica perfil inativo. Tente de novo.',
        life: 5000,
      })
      return
    }

    pendingReactivate.value = pendingReactivate.value.filter((item) => item !== profile)

    if (profile === 'veterinario' || getVeterinarioId()) {
      pendingReactivate.value = []
      toast.add({
        severity: 'success',
        summary: 'Perfil reativado',
        detail: 'Bem-vindo de volta ao painel.',
        life: 3500,
      })
      await enterPanelAfterAuth()
      return
    }

    if (pendingReactivate.value.length === 0) {
      await enterPanelAfterAuth()
    }
  } catch (error) {
    toast.add({
      severity: 'error',
      summary: 'Não foi possível reativar',
      detail: error instanceof Error ? error.message : 'Tente novamente em instantes.',
      life: 5000,
    })
  } finally {
    reactivating.value = false
  }
}

function cancelReactivate() {
  clearAuthSession()
  usuarioPerfilStore.clear()
  pendingReactivate.value = []
}
</script>

<template>
  <AuthLayout
    description="Entre para acompanhar a agenda, os prontuários e o cuidado dos seus pacientes."
    title="Bem-vindo de volta"
  >
    <div v-if="showReactivatePanel" class="login-reactivate" :style="loginStyle" role="status">
      <div class="login-reactivate__icon" aria-hidden="true">
        <i class="pi pi-user-minus" />
      </div>
      <h2>Perfil inativo</h2>
      <p>{{ reactivateCopy }}</p>

      <div class="login-reactivate__actions">
        <AuthButton
          v-if="pendingReactivate.includes('veterinario')"
          :loading="reactivating"
          full-width
          type="button"
          @click="handleReactivate('veterinario')"
        >
          {{ reactivating ? 'Reativando…' : 'Reativar perfil veterinário' }}
        </AuthButton>

        <AuthButton
          v-if="pendingReactivate.includes('tutor') && !pendingReactivate.includes('veterinario')"
          :loading="reactivating"
          full-width
          type="button"
          @click="handleReactivate('tutor')"
        >
          {{ reactivating ? 'Reativando…' : 'Reativar perfil tutor' }}
        </AuthButton>

        <Button
          label="Usar outra conta"
          severity="secondary"
          outlined
          type="button"
          :disabled="reactivating"
          @click="cancelReactivate"
        />
      </div>
    </div>

    <form v-else class="login-form" :style="loginStyle" @submit.prevent="handleLogin">
      <AuthTextField
        id="email"
        v-model="email"
        autocomplete="email"
        :disabled="loading"
        label="E-mail"
        placeholder="seuemail@empresa.com"
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

      <!-- Conta da clínica: ocultado por enquanto
      <div class="login-divider">
        <span>ou</span>
      </div>

      <button class="login-clinic-button" type="button">
        <i class="pi pi-building" aria-hidden="true" />
        Acessar com conta da clínica
      </button>
      -->
    </form>

    <p v-if="!showReactivatePanel" class="login-support">
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
  color: var(--auth-soft);
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
  color: var(--auth-soft);
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
  color: var(--auth-cta-text);
}

.login-remember span .pi {
  font-size: 0.58rem;
  font-weight: 700;
}

.login-remember input:not(:checked) + span {
  border: 1px solid var(--auth-line);
  background: var(--auth-field-bg);
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
  border: 1px solid var(--auth-border);
  border-radius: 0.875rem;
  background: var(--auth-field-bg);
  color: var(--auth-text);
  font-weight: 800;
  cursor: pointer;
}

.login-support {
  margin: 2rem 0 0;
  color: var(--auth-soft);
  font-size: 0.875rem;
}

.login-reactivate {
  display: grid;
  gap: 0.75rem;
  padding: 1.15rem 1.2rem 1.25rem;
  border: 1px solid color-mix(in srgb, var(--auth-sage) 28%, var(--auth-line));
  border-radius: 1.1rem;
  background: color-mix(in srgb, var(--auth-sage-tint) 72%, var(--auth-field-bg));
  box-shadow: 0 10px 24px rgb(var(--auth-shadow-rgb) / 0.06);
}

.login-reactivate__icon {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  place-items: center;
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--auth-sage) 18%, var(--auth-field-bg));
  color: var(--auth-sage-strong);
  font-size: 1.15rem;
}

.login-reactivate h2 {
  margin: 0;
  color: var(--auth-text);
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.login-reactivate p {
  margin: 0;
  color: var(--auth-muted);
  font-size: 0.92rem;
  line-height: 1.5;
}

.login-reactivate__actions {
  display: grid;
  gap: 0.55rem;
  margin-top: 0.35rem;
}
</style>
