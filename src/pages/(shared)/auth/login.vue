<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import { login, refreshAuthSession } from '@/service/auth/auth-service'
import { clearAuthSession, getAuthUser, getVeterinarioId } from '@/service/auth/auth-session'
import {
  postUsersMeReactivate,
  type ReactivateProfile,
} from '@/service/user/inativacao-service'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const { t } = useI18n()

const email = ref('')
const password = ref('')
const rememberAccess = ref(true)
const loading = ref(false)
const reactivating = ref(false)

/** Perfis inativos detectados no login — aguardam CTA de reativação. */
const pendingReactivate = ref<ReactivateProfile[]>([])

const route = useRoute()
const router = useRouter()
const toast = useToast()
const usuarioPerfilStore = useUsuarioPerfilStore()

const showReactivatePanel = computed(() => pendingReactivate.value.length > 0)

const reactivateCopy = computed(() => {
  if (pendingReactivate.value.includes('veterinario') && pendingReactivate.value.includes('tutor')) {
    return t('auth.login.reactivate.copyBoth')
  }

  if (pendingReactivate.value.includes('veterinario')) {
    return t('auth.login.reactivate.copyVet')
  }

  return t('auth.login.reactivate.copyGeneric')
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

/**
 * Parte 9: conta sem perfil veterinário (prestador/parceiro) também entra.
 * O shell degrada sozinho (menus clínicos só com veterinarioId) e o funil
 * de credenciamento cobre quem ainda não tem parceiro.
 */
async function enterPanelAfterAuth() {
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
      summary: t('auth.login.toast.loginError.summary'),
      detail: error instanceof Error ? error.message : t('auth.login.toast.loginError.fallback'),
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
        summary: t('auth.login.toast.stillInactive.summary'),
        detail: t('auth.login.toast.stillInactive.detail'),
        life: 5000,
      })
      return
    }

    pendingReactivate.value = pendingReactivate.value.filter((item) => item !== profile)

    if (profile === 'veterinario' || getVeterinarioId()) {
      pendingReactivate.value = []
      toast.add({
        severity: 'success',
        summary: t('auth.login.toast.reactivated.summary'),
        detail: t('auth.login.toast.reactivated.detail'),
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
      summary: t('auth.login.toast.reactivateError.summary'),
      detail:
        error instanceof Error ? error.message : t('auth.login.toast.reactivateError.fallback'),
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
    :description="t('auth.login.description')"
    :title="t('auth.login.title')"
  >
    <div v-if="showReactivatePanel" class="login-reactivate" role="status">
      <div class="login-reactivate__icon" aria-hidden="true">
        <i class="ph ph-user-minus" />
      </div>
      <h2>{{ t('auth.login.reactivate.title') }}</h2>
      <p>{{ reactivateCopy }}</p>

      <div class="login-reactivate__actions">
        <AuthButton
          v-if="pendingReactivate.includes('veterinario')"
          :loading="reactivating"
          full-width
          type="button"
          @click="handleReactivate('veterinario')"
        >
          {{
            reactivating
              ? t('auth.login.reactivate.loading')
              : t('auth.login.reactivate.vet')
          }}
        </AuthButton>

        <AuthButton
          v-if="pendingReactivate.includes('tutor') && !pendingReactivate.includes('veterinario')"
          :loading="reactivating"
          full-width
          type="button"
          @click="handleReactivate('tutor')"
        >
          {{
            reactivating
              ? t('auth.login.reactivate.loading')
              : t('auth.login.reactivate.tutor')
          }}
        </AuthButton>

        <AuthButton
          variant="secondary"
          full-width
          type="button"
          :disabled="reactivating"
          @click="cancelReactivate"
        >
          {{ t('auth.login.reactivate.otherAccount') }}
        </AuthButton>
      </div>
    </div>

    <form v-else class="login-form" @submit.prevent="handleLogin">
      <AuthTextField
        id="email"
        v-model="email"
        autocomplete="email"
        :disabled="loading"
        :label="t('auth.login.email.label')"
        :placeholder="t('auth.login.email.placeholder')"
        required
        type="email"
      >
        <template #leading>
          <i class="ph ph-envelope-simple" aria-hidden="true" />
        </template>
      </AuthTextField>

      <div class="login-password-group">
        <div class="login-password-group__header">
          <label for="password">{{ t('auth.login.password.label') }}</label>
          <RouterLink class="login-link" to="/auth/forgot-password">
            {{ t('auth.login.password.forgot') }}
          </RouterLink>
        </div>

        <AuthTextField
          id="password"
          v-model="password"
          autocomplete="current-password"
          :disabled="loading"
          label=""
          :placeholder="t('auth.login.password.placeholder')"
          required
          revelavel
          type="password"
        >
          <template #leading>
            <i class="ph ph-lock-simple" aria-hidden="true" />
          </template>
        </AuthTextField>
      </div>

      <label class="login-remember" for="login-remember">
        <Checkbox v-model="rememberAccess" binary :disabled="loading" input-id="login-remember" />
        {{ t('auth.login.remember') }}
      </label>

      <AuthButton :loading="loading" full-width type="submit">
        {{ loading ? t('auth.login.submitting') : t('auth.login.submit') }}
      </AuthButton>

      <!-- Conta da clínica: ocultado por enquanto
      <div class="login-divider">
        <span>ou</span>
      </div>

      <AuthButton full-width variant="secondary">
        <i class="ph ph-building me-2" aria-hidden="true" />
        Acessar com conta da clínica
      </AuthButton>
      -->
    </form>

    <p v-if="!showReactivatePanel" class="login-support">
      {{ t('auth.login.support.prompt') }}
      <RouterLink class="login-link" to="/auth/register">
        {{ t('auth.login.support.createAccount') }}
      </RouterLink>
    </p>
  </AuthLayout>
</template>

<style scoped>
.login-form {
  display: grid;
  gap: 20px;
}

.login-password-group {
  display: grid;
  gap: 7px;
}

.login-password-group__header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 12px;
}

.login-password-group__header label {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
}

/* O link do kit: musgo sublinhado, o sublinhado acende no hover. */
.login-link {
  border-radius: 4px;
  color: var(--musgo);
  font-size: 14px;
  font-weight: 600;
  text-decoration: underline;
  text-decoration-color: color-mix(in oklab, var(--musgo) 35%, transparent);
  text-underline-offset: 3px;
}

.login-link:hover {
  text-decoration-color: currentColor;
}

.login-link:focus-visible {
  outline: 2px solid var(--musgo);
  outline-offset: 2px;
}

.login-remember {
  display: inline-flex;
  width: fit-content;
  min-height: 36px;
  align-items: center;
  gap: 10px;
  color: var(--tinta-2);
  cursor: pointer;
  font-size: 14.5px;
}

.login-support {
  margin: 2rem 0 0;
  color: var(--tinta-2);
  font-size: 14.5px;
}

.login-reactivate {
  display: grid;
  justify-items: start;
  gap: 10px;
  padding: 22px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie);
  box-shadow: var(--sombra-cartao);
}

.login-reactivate__icon {
  display: grid;
  width: 44px;
  height: 44px;
  place-items: center;
  border-radius: 12px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 21px;
}

.login-reactivate h2 {
  margin: 4px 0 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
}

.login-reactivate p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14.5px;
  line-height: 1.5;
}

.login-reactivate__actions {
  display: grid;
  width: 100%;
  gap: 10px;
  margin-top: 8px;
}
</style>
