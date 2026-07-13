<script setup lang="ts">
/**
 * Stub de produção (sem dados mocados).
 * Implementação anterior arquivada em: src/_mocks/shared/perfil.vue
 */
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import { authSessionVersion, getAuthUser } from '@/service/auth/auth-session'
import { currentColors } from '@/theme/color-mode'

const user = computed(() => {
  void authSessionVersion.value
  return getAuthUser()
})

const pageStyle = computed(() => {
  const colors = currentColors.value

  return {
    '--profile-bg': colors.dashboard.bg,
    '--profile-card': colors.dashboard.surface,
    '--profile-line': colors.dashboard.line,
    '--profile-text': colors.dashboard.text,
    '--profile-muted': colors.dashboard.muted,
    '--profile-primary': colors.vet.primary,
    '--profile-shadow-rgb': colors.auth.shadowRgb,
  }
})

const initials = computed(() => {
  const nome = user.value?.nome?.trim() || user.value?.email || '?'

  return nome
    .split(/\s+/)
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase()
})
</script>

<template>
  <main class="profile-page" :style="pageStyle">
    <article v-if="user" class="profile-card">
      <span class="profile-avatar" aria-hidden="true">{{ initials }}</span>
      <div>
        <p class="profile-kicker">Conta</p>
        <h1>{{ user.nome || 'Usuário' }}</h1>
        <p class="profile-email">{{ user.email }}</p>
      </div>
      <p class="profile-note">
        A edição completa do perfil profissional será disponibilizada com a integração da API. Por
        enquanto, estes são os dados da sessão autenticada.
      </p>
      <RouterLink class="profile-link" to="/settings">Ir para configurações</RouterLink>
    </article>

    <article v-else class="profile-card" role="alert">
      <h1>Sessão indisponível</h1>
      <p class="profile-note">Faça login novamente para ver os dados da conta.</p>
      <RouterLink class="profile-link" to="/auth/login">Entrar</RouterLink>
    </article>
  </main>
</template>

<style scoped>
.profile-page {
  display: grid;
  gap: 1rem;
  padding: 0.25rem 0 1.5rem;
}

.profile-card {
  display: grid;
  gap: 0.75rem;
  max-width: 32rem;
  padding: 1.4rem 1.35rem;
  border: 1px solid var(--profile-line);
  border-radius: 1rem;
  background: var(--profile-card);
  box-shadow: 0 12px 28px rgb(var(--profile-shadow-rgb) / 0.05);
}

.profile-avatar {
  display: grid;
  width: 3rem;
  height: 3rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--profile-primary) 18%, var(--profile-card));
  color: var(--profile-primary);
  font-weight: 700;
}

.profile-kicker {
  margin: 0;
  color: var(--profile-muted);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.profile-card h1 {
  margin: 0.15rem 0 0;
  font-size: 1.35rem;
  color: var(--profile-text);
}

.profile-email {
  margin: 0.25rem 0 0;
  color: var(--profile-muted);
  font-size: 0.92rem;
}

.profile-note {
  margin: 0.35rem 0 0;
  color: var(--profile-muted);
  font-size: 0.88rem;
  line-height: 1.5;
}

.profile-link {
  justify-self: start;
  margin-top: 0.25rem;
  color: var(--profile-primary);
  font-size: 0.9rem;
  font-weight: 600;
  text-decoration: none;
}

.profile-link:hover,
.profile-link:focus-visible {
  text-decoration: underline;
  outline: none;
}
</style>
