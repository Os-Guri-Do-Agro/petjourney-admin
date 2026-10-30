<script setup lang="ts">
import Checkbox from 'primevue/checkbox'
import { useToast } from 'primevue/usetoast'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute, useRouter } from 'vue-router'

import AuthButton from '@/components/auth/AuthButton.vue'
import AuthLayout from '@/components/auth/AuthLayout.vue'
import AuthTextField from '@/components/auth/AuthTextField.vue'
import { ApiError } from '@/service/api'
import { login, refreshAuthSession } from '@/service/auth/auth-service'
import { clearAuthSession, getAuthUser, getVeterinarioId } from '@/service/auth/auth-session'
import {
  postUsersMeReactivate,
  type ReactivateProfile,
} from '@/service/user/inativacao-service'
import { useParceiroStore } from '@/stores/parceiro'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { lerTokenDoConvite } from '@/service/parceiro/convite-pendente'
import { ROTA_DO_CONVITE } from '@/router/convite-da-equipe'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const { t } = useI18n()

const email = ref('')
const password = ref('')
const rememberAccess = ref(true)
const loading = ref(false)
const reactivating = ref(false)

/**
 * E-mail ou senha que não conferem: o erro mora embaixo da senha, onde a pessoa está olhando, e o
 * foco volta para ela. No toast do canto ele chegava longe do formulário, em linguagem de sistema
 * ("Credenciais inválidas"), e o foco ia parar no X do aviso.
 *
 * Campo vazio e e-mail sem formato também ficam embaixo do campo, na língua do painel: antes era o
 * balão do navegador, na língua do sistema. Guarda-se o motivo e não a frase, para o erro trocar
 * de idioma junto com o seletor.
 */
const erroDoEmail = ref<'' | 'vazio' | 'invalido'>('')
const erroDaSenha = ref<'' | 'vazia' | 'credenciais'>('')

const EMAIL_COM_FORMATO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const textoDoErroDoEmail = computed(() => {
  if (erroDoEmail.value === 'vazio') {
    return t('auth.forgot.errors.emailRequired')
  }

  return erroDoEmail.value === 'invalido' ? t('auth.forgot.errors.emailInvalid') : ''
})

const textoDoErroDaSenha = computed(() => {
  if (erroDaSenha.value === 'credenciais') {
    return t('auth.login.erroCredenciais')
  }

  return erroDaSenha.value === 'vazia' ? t('auth.login.erroSenhaVazia') : ''
})

watch(email, () => {
  erroDoEmail.value = ''

  if (erroDaSenha.value === 'credenciais') {
    erroDaSenha.value = ''
  }
})

watch(password, () => {
  erroDaSenha.value = ''
})

/** Confere o que dá para conferir antes de chamar a API; foca o primeiro campo com problema. */
function conferirCampos() {
  const digitado = email.value.trim()

  erroDoEmail.value = !digitado ? 'vazio' : EMAIL_COM_FORMATO.test(digitado) ? '' : 'invalido'
  erroDaSenha.value = password.value ? '' : 'vazia'

  if (erroDoEmail.value) {
    void focarCampo('email')
    return false
  }

  if (erroDaSenha.value) {
    void focarCampo('password')
    return false
  }

  return true
}

async function focarCampo(id: 'email' | 'password', selecionar = false) {
  await nextTick()
  const campo = document.getElementById(id)

  if (campo instanceof HTMLInputElement) {
    campo.focus()

    if (selecionar) {
      campo.select()
    }
  }
}

/** Perfis inativos detectados no login — aguardam CTA de reativação. */
const pendingReactivate = ref<ReactivateProfile[]>([])

const route = useRoute()
/** Quem chega pelo link do convite para a equipe vê por que precisa entrar (ver `convite-pendente.ts`). */
const convitePendente = Boolean(lerTokenDoConvite())
const router = useRouter()
const toast = useToast()
const usuarioPerfilStore = useUsuarioPerfilStore()
const parceiroStore = useParceiroStore()

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

  /* Quem passou pelo cadastro e voltou ao login perdeu o `?redirect=`: o convite guardado leva. */
  return convitePendente ? ROTA_DO_CONVITE : getDefaultLandingPath()
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
  await carregarEmpresaAntesDeEntrar()
  await router.replace(getSafeRedirectPath())
}

/** O teto da espera: com a API lenta, entra assim mesmo e a moldura termina de carregar. */
const ESPERA_MAXIMA_DA_EMPRESA_MS = 4000

/**
 * A empresa (papel e programas) chega junto com o "Entrando...": o menu do Portal nasce inteiro.
 * Sem isto, Indicados e Carteira entravam no menu um ou dois segundos depois dos outros itens.
 * Falha aqui não impede a entrada; a moldura pede de novo e mostra o erro no lugar dela.
 */
async function carregarEmpresaAntesDeEntrar() {
  let teto: ReturnType<typeof setTimeout> | undefined

  await Promise.race([
    parceiroStore.bootstrap().catch(() => undefined),
    new Promise<void>((resolve) => {
      teto = setTimeout(resolve, ESPERA_MAXIMA_DA_EMPRESA_MS)
    }),
  ])

  clearTimeout(teto)
}

async function handleLogin() {
  if (loading.value || reactivating.value || !conferirCampos()) {
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
    if (error instanceof ApiError && error.statusCode === 401) {
      erroDaSenha.value = 'credenciais'
      loading.value = false
      void focarCampo('password', true)
      return
    }

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

    <form v-else class="login-form" novalidate @submit.prevent="handleLogin">
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
        :error="textoDoErroDoEmail"
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
          :error="textoDoErroDaSenha"
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

.login-convite {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--linha-suave);
  border-radius: 12px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.login-convite i {
  margin-top: 2px;
  color: var(--tinta-2);
  font-size: 18px;
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
