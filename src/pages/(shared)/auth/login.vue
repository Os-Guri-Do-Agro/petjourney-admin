<script setup lang="ts">
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import { login, refreshAuthSession } from '@/service/auth/auth-service'
import { clearAuthSession, getAuthUser } from '@/service/auth/auth-session'
import {
  postUsersMeReactivate,
  type ReactivateProfile,
} from '@/service/user/inativacao-service'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { lerTokenDoConvite } from '@/service/parceiro/convite-pendente'
import { useAuthThemeVars } from '@/composables/useAuthThemeVars'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const { t } = useI18n()

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
/** Quem chega pelo link do convite para a equipe vê por que precisa entrar (ver `convite-pendente.ts`). */
const convitePendente = Boolean(lerTokenDoConvite())
const router = useRouter()
const toast = useToast()
const usuarioPerfilStore = useUsuarioPerfilStore()
const loginStyle = useAuthThemeVars()

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
 * Parte 9: toda conta entra; o que cada uma vê no portal é decidido pelo parceiro e pelos
 * módulos dele, nunca por um perfil "veterinário" (que não existe no produto). O funil de
 * credenciamento cobre quem ainda não tem parceiro.
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

    if (profile === 'veterinario') {
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
    <div v-if="showReactivatePanel" class="login-reactivate" :style="loginStyle" role="status">
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

        <Button
          :label="t('auth.login.reactivate.otherAccount')"
          severity="secondary"
          outlined
          type="button"
          :disabled="reactivating"
          @click="cancelReactivate"
        />
      </div>
    </div>

    <form v-else class="login-form" :style="loginStyle" @submit.prevent="handleLogin">
      <p v-if="convitePendente" class="login-convite" role="status">
        <i class="ph ph-envelope-open" aria-hidden="true" />
        {{ t('parceiro.convite.link.semSessao') }}
      </p>

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
          <i class="ph ph-envelope-simple login-field-icon" aria-hidden="true" />
        </template>
      </AuthTextField>

      <div class="login-password-group">
        <div class="login-password-group__header">
          <span>{{ t('auth.login.password.label') }}</span>
          <RouterLink class="login-inline-link" to="/auth/forgot-password">
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
          :type="passwordInputType"
        >
          <template #leading>
            <i class="ph ph-lock login-field-icon" aria-hidden="true" />
          </template>

          <template #trailing>
            <Button
              :aria-label="
                showPassword ? t('auth.login.password.hide') : t('auth.login.password.show')
              "
              class="login-password-toggle"
              :disabled="loading"
              :icon="showPassword ? 'ph ph-eye-slash' : 'ph ph-eye'"
              rounded
              severity="secondary"
              text
              type="button"
              @click="showPassword = !showPassword"
            />
          </template>
        </AuthTextField>
      </div>

      <label class="login-remember" for="login-remember">
        <Checkbox
          v-model="rememberAccess"
          binary
          :disabled="loading"
          input-id="login-remember"
          size="small"
        />
        {{ t('auth.login.remember') }}
      </label>

      <AuthButton :loading="loading" full-width type="submit">
        {{ loading ? t('auth.login.submitting') : t('auth.login.submit') }}
        <i v-if="!loading" class="ph ph-arrow-right ms-2" aria-hidden="true" />
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
      <RouterLink to="/auth/register">{{ t('auth.login.support.createAccount') }}</RouterLink>
    </p>
  </AuthLayout>
</template>

<style scoped>
.login-form {
  display: grid;
  gap: 1.1rem;
}

.login-convite {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--auth-line);
  border-radius: 0.875rem;
  color: var(--auth-text);
  font-size: 14px;
  line-height: 1.5;
}

.login-convite i {
  margin-top: 2px;
  color: var(--auth-muted);
  font-size: 18px;
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

.login-password-toggle.p-button {
  width: 2rem;
  height: 2rem;
  color: var(--auth-soft);
}

.login-password-toggle.p-button:not(:disabled):hover {
  background: var(--auth-sage-tint);
  color: var(--auth-soft);
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
