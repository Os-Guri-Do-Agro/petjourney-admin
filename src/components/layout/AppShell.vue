<script setup lang="ts">
import Button from 'primevue/button'
import { computed, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import logoHeaderUrl from '@/assets/Logos/logo-clara-em-row.png'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import { clearAuthSession, getAuthUser } from '@/service/auth/auth-session'
import { currentColors, isDarkMode, toggleColorMode } from '@/theme/color-mode'

const router = useRouter()
const route = useRoute()
const drawerOpen = ref(true)
const userMenuOpen = ref(false)
const logoutConfirmVisible = ref(false)
const activeSectionId = ref('workspace')
const searchQuery = ref('')
const user = computed(() => getAuthUser())
const logoMarkUrl = computed(() => (isDarkMode.value ? '/pata-escura.png' : '/pata-clara.png'))

type NavigationItem = {
  label: string
  to: string
  icon: string
}

type NavigationSection = {
  id: string
  label: string
  icon: string
  items: NavigationItem[]
}

const shellStyle = computed(() => {
  const colors = currentColors.value
  const isDark = isDarkMode.value

  return {
    '--brand-navy': colors.auth.text,
    '--profile-primary': colors.vet.primary,
    '--profile-secondary': colors.vet.secondary,
    '--clinical-muted': colors.auth.muted,
    '--danger-soft': colors.red,
    '--shell-bg': colors.auth.appBg,
    '--shell-surface': colors.auth.white,
    '--shell-surface-soft': colors.auth.sageTint,
    '--shell-line': colors.auth.line,
    '--shell-text': colors.auth.text,
    '--shell-muted': colors.auth.muted,
    '--shell-soft': colors.auth.soft,
    '--shell-brand': isDark ? colors.bg.card : colors.vet.primary,
    '--shell-on-brand': isDark ? colors.text.primary : colors.auth.white,
    '--shell-on-brand-muted': isDark ? colors.auth.soft : '#ffffffC2',
    '--shell-rail-active-bg': isDark ? colors.auth.sageTint : colors.auth.white,
    '--shell-accent': colors.vet.primary,
    '--shell-accent-strong': colors.auth.sageStrong,
    '--shell-accent-soft': colors.vet.secondary,
    '--shell-cream': colors.secondary,
    '--shell-shadow-rgb': colors.auth.shadowRgb,
  }
})

const navigationSections: NavigationSection[] = [
  {
    id: 'workspace',
    label: 'Operação',
    icon: 'pi pi-th-large',
    items: [
      { label: 'Dashboard', to: '/veterinario', icon: 'pi pi-home' },
      { label: 'Agenda', to: '/veterinario/agenda', icon: 'pi pi-calendar' },
      { label: 'Atividades', to: '/veterinario#atividades', icon: 'pi pi-list' },
    ],
  },
  {
    id: 'patients',
    label: 'Pets',
    icon: 'pi pi-heart',
    items: [
      { label: 'Pacientes', to: '/veterinario/pacientes', icon: 'pi pi-users' },
      { label: 'Prontuários', to: '/veterinario/prontuarios', icon: 'pi pi-file-edit' },
      { label: 'Compartilhamentos', to: '/veterinario#pacientes', icon: 'pi pi-share-alt' },
    ],
  },
  {
    id: 'partner',
    label: 'Parceiro',
    icon: 'pi pi-briefcase',
    items: [
      { label: 'Empresa', to: '/settings', icon: 'pi pi-building' },
      { label: 'Equipe', to: '/settings', icon: 'pi pi-id-card' },
      { label: 'Integrações', to: '/settings', icon: 'pi pi-link' },
    ],
  },
  {
    id: 'account',
    label: 'Conta',
    icon: 'pi pi-user',
    items: [
      { label: 'Perfil', to: '/perfil', icon: 'pi pi-user' },
      { label: 'Configurações', to: '/settings', icon: 'pi pi-cog' },
    ],
  },
]

const fallbackSection = navigationSections[0] as NavigationSection
const activeSection = computed<NavigationSection>(
  () => navigationSections.find((section) => section.id === activeSectionId.value) ?? fallbackSection,
)

const initials = computed(() => {
  const name = user.value?.nome ?? 'Vet'

  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()
})

const shellClasses = computed(() => ({
  'app-shell--navigator-hidden': !drawerOpen.value,
}))

function handleSectionChange(sectionId: string) {
  activeSectionId.value = sectionId
  drawerOpen.value = true
}

watch(
  () => route.path,
  (path) => {
    if (path.startsWith('/veterinario/pacientes') || path.startsWith('/veterinario/prontuarios')) {
      activeSectionId.value = 'patients'
      return
    }

    if (path.startsWith('/settings')) {
      activeSectionId.value = 'partner'
      return
    }

    if (path.startsWith('/perfil')) {
      activeSectionId.value = 'account'
      return
    }

    activeSectionId.value = 'workspace'
  },
  { immediate: true },
)

function requestLogout() {
  userMenuOpen.value = false
  logoutConfirmVisible.value = true
}

async function handleLogout() {
  clearAuthSession()
  userMenuOpen.value = false
  await router.replace('/auth/login')
}
</script>

<template>
  <div class="app-shell" :class="shellClasses" :style="shellStyle">
    <aside class="app-navigator" :aria-hidden="!drawerOpen">
      <nav class="section-rail" aria-label="Seções do painel">
        <RouterLink class="rail-brand" to="/veterinario" aria-label="PetJourney">
          <img :src="logoMarkUrl" alt="" />
        </RouterLink>

        <button
          v-for="section in navigationSections"
          :key="section.id"
          class="rail-button"
          :class="{ 'rail-button--active': activeSectionId === section.id }"
          type="button"
          :aria-label="section.label"
          :title="section.label"
          @click="handleSectionChange(section.id)"
        >
          <i :class="section.icon" aria-hidden="true" />
        </button>

        <div class="rail-bottom-actions">
          <RouterLink class="rail-button" to="/settings" aria-label="Configurações" title="Configurações">
            <i class="pi pi-cog" aria-hidden="true" />
          </RouterLink>

          <button class="rail-button rail-button--danger" type="button" aria-label="Logout" title="Logout" @click="requestLogout">
            <i class="pi pi-sign-out" aria-hidden="true" />
          </button>
        </div>
      </nav>

      <section class="navigator-panel">
        <RouterLink class="navigator-logo" to="/veterinario">
          <img :src="logoHeaderUrl" alt="PetJourney" />
        </RouterLink>

        <div class="navigator-section-heading">
          <span>Visão rápida</span>
          <strong>{{ activeSection.label }}</strong>
        </div>

        <nav class="page-nav" aria-label="Páginas da seção ativa">
          <RouterLink
            v-for="item in activeSection.items"
            :key="item.label"
            class="page-nav__link"
            :to="item.to"
          >
            <i :class="item.icon" aria-hidden="true" />
            <span>{{ item.label }}</span>
          </RouterLink>
        </nav>

      </section>
    </aside>

    <header class="app-header">
      <div class="app-header__left">
        <Button
          class="header-icon-button"
          severity="secondary"
          text
          type="button"
          :aria-label="drawerOpen ? 'Fechar navegador' : 'Abrir navegador'"
          icon="pi pi-bars"
          @click="drawerOpen = !drawerOpen"
        />

        <div class="header-context">
          <span>Painel parceiro</span>
          <strong>{{ activeSection.label }}</strong>
        </div>
      </div>

      <div class="app-header__right">
        <label class="header-search" for="header-search">
          <i class="pi pi-search" aria-hidden="true" />
          <input id="header-search" v-model="searchQuery" type="search" placeholder="Pesquisar" />
        </label>

        <button
          class="theme-switch"
          type="button"
          :aria-label="isDarkMode ? 'Ativar tema claro' : 'Ativar tema escuro'"
          :title="isDarkMode ? 'Tema claro' : 'Tema escuro'"
          :aria-pressed="isDarkMode"
          @click="toggleColorMode"
        >
          <span class="theme-switch__track">
            <i :class="isDarkMode ? 'pi pi-moon' : 'pi pi-sun'" aria-hidden="true" />
          </span>
          <span class="theme-switch__label">{{ isDarkMode ? 'Dark' : 'Light' }}</span>
        </button>

        <div class="user-menu">
          <button
            class="user-menu__trigger"
            type="button"
            :aria-expanded="userMenuOpen"
            aria-haspopup="menu"
            @click="userMenuOpen = !userMenuOpen"
          >
            <span class="user-avatar">{{ initials }}</span>
            <span class="user-menu__identity">
              <strong>{{ user?.nome ?? 'Veterinário' }}</strong>
              <small>Conta parceiro</small>
            </span>
            <i class="pi pi-angle-down" aria-hidden="true" />
          </button>

          <div v-if="userMenuOpen" class="user-menu__dropdown" role="menu">
            <RouterLink role="menuitem" to="/perfil" @click="userMenuOpen = false">
              <i class="pi pi-user" aria-hidden="true" />
              Perfil
            </RouterLink>
            <RouterLink role="menuitem" to="/settings" @click="userMenuOpen = false">
              <i class="pi pi-cog" aria-hidden="true" />
              Configurações
            </RouterLink>
            <Button type="button" role="menuitem" text severity="danger" @click="requestLogout">
              <i class="pi pi-sign-out" aria-hidden="true" />
              Logout
            </Button>
          </div>
        </div>
      </div>
    </header>

    <main class="app-content">
      <slot />
    </main>

    <ConfirmActionDialog
      v-model:visible="logoutConfirmVisible"
      title="Sair da conta?"
      message="Você será desconectado deste painel. Para acessar novamente, será necessário fazer login."
      icon="pi pi-sign-out"
      confirm-label="Sair"
      cancel-label="Continuar no painel"
      severity="danger"
      @confirm="handleLogout"
    />
  </div>
</template>

<style scoped>
.app-shell {
  --navigator-width: 19.5rem;
  --header-height: 4.25rem;
  min-height: 100vh;
  background: var(--shell-bg);
  color: var(--shell-text);
}

.app-navigator {
  position: fixed;
  z-index: 50;
  inset: 0 auto 0 0;
  display: grid;
  width: var(--navigator-width);
  grid-template-columns: 4.25rem minmax(0, 1fr);
  background: var(--shell-surface);
  box-shadow: 1px 0 0 var(--shell-line);
  transition: transform 180ms ease;
}

.app-shell--navigator-hidden .app-navigator {
  transform: translateX(-100%);
}

.section-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.45rem;
  padding: 0.85rem 0.55rem;
  background: var(--shell-brand);
}

.rail-brand {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  margin-bottom: 0.7rem;
  place-items: center;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--shell-on-brand) 12%, transparent);
}

.rail-brand img {
  width: 1.45rem;
  height: 1.45rem;
  object-fit: contain;
}

.rail-button {
  display: grid;
  width: 2.5rem;
  height: 2.5rem;
  place-items: center;
  border: 0;
  border-radius: 0.85rem;
  background: transparent;
  color: var(--shell-on-brand-muted);
  cursor: pointer;
}

.rail-button:hover {
  background: color-mix(in srgb, var(--shell-on-brand) 10%, transparent);
  color: var(--shell-on-brand);
}

.rail-button--active {
  background: var(--shell-rail-active-bg);
  color: var(--shell-accent-strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-accent) 24%, transparent);
}

.rail-bottom-actions {
  display: grid;
  gap: 0.45rem;
  margin-top: auto;
  padding-top: 0.75rem;
}

.rail-button--danger {
  color: color-mix(in srgb, var(--danger-soft) 82%, var(--shell-surface));
}

.rail-button--danger:hover {
  background: color-mix(in srgb, var(--danger-soft) 18%, transparent);
  color: var(--shell-on-brand);
}

.navigator-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 0.95rem 0.85rem;
}

.navigator-logo img {
  display: block;
  width: 9.25rem;
  max-height: 2.75rem;
  object-fit: contain;
}

.navigator-section-heading {
  display: grid;
  gap: 0.18rem;
  margin-top: 1.35rem;
  margin-bottom: 0.65rem;
}

.navigator-section-heading span,
.header-context span {
  color: var(--shell-soft);
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.navigator-section-heading strong {
  color: var(--shell-text);
  font-size: 0.98rem;
  font-weight: 600;
}

.page-nav {
  display: grid;
  gap: 0.28rem;
}

.page-nav__link {
  display: flex;
  min-height: 2.34rem;
  align-items: center;
  justify-content: flex-start;
  gap: 0.58rem;
  padding: 0 0.62rem;
  border-radius: 0.72rem;
  color: var(--shell-muted);
  font-size: 0.82rem;
  font-weight: 500;
  text-decoration: none;
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.page-nav__link i {
  display: grid;
  width: 1.55rem;
  height: 1.55rem;
  place-items: center;
  border-radius: 0.55rem;
  background: color-mix(in srgb, var(--shell-accent-soft) 16%, var(--shell-surface));
  color: var(--shell-soft);
  font-size: 0.76rem;
}

.page-nav__link:hover,
.page-nav__link.router-link-active {
  background: color-mix(in srgb, var(--shell-accent-soft) 28%, var(--shell-surface));
  color: var(--shell-accent-strong);
}

.page-nav__link:hover {
  transform: translateX(1px);
}

.page-nav__link:hover i,
.page-nav__link.router-link-active i {
  background: color-mix(in srgb, var(--shell-accent) 16%, var(--shell-surface));
  color: var(--shell-accent-strong);
}

.app-header {
  position: fixed;
  z-index: 40;
  top: 0;
  right: 0;
  left: var(--navigator-width);
  display: flex;
  height: var(--header-height);
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  background: var(--shell-surface);
  box-shadow: 0 1px 0 var(--shell-line);
  backdrop-filter: blur(14px);
  transition: left 180ms ease;
}

.app-shell--navigator-hidden .app-header {
  left: 0;
}

.app-header__left,
.app-header__right {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

.header-icon-button {
  width: 2.5rem;
  height: 2.5rem;
  border: 1px solid var(--shell-line);
  border-radius: 0.85rem;
  background: var(--shell-surface) !important;
  color: var(--shell-text) !important;
  line-height: 1 !important;
}

.header-search {
  display: inline-flex;
  width: min(16rem, 24vw);
  min-width: 10.5rem;
  height: 2.45rem;
  align-items: center;
  gap: 0.55rem;
  padding: 0 0.8rem;
  border: 1px solid var(--shell-line);
  border-radius: 0.85rem;
  background: var(--shell-surface);
  color: var(--shell-soft);
  line-height: 1;
}

.header-search .pi {
  display: block;
  flex: 0 0 auto;
  font-size: 0.86rem;
  line-height: 1;
}

.header-search input {
  width: 100%;
  min-width: 0;
  border: 0;
  background: transparent;
  color: var(--shell-text);
  font: inherit;
  font-size: 0.84rem;
  font-weight: 500;
  line-height: 1;
  outline: none;
}

.header-search input::placeholder {
  color: var(--shell-soft);
}

.theme-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.45rem;
  padding: 0 0.78rem 0 0.28rem;
  border: 1px solid var(--shell-line);
  border-radius: 999px;
  background: var(--shell-surface);
  color: var(--shell-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
}

.theme-switch:hover {
  background: var(--shell-surface-soft);
}

.theme-switch__track {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shell-accent) 22%, var(--shell-surface));
  color: var(--shell-accent-strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-accent) 18%, transparent);
}

.theme-switch__track i {
  font-size: 0.86rem;
}

.theme-switch__label {
  line-height: 1;
}

.header-context {
  display: grid;
  gap: 0.1rem;
}

.header-context strong {
  color: var(--shell-text);
  font-size: 0.95rem;
}

.app-content {
  min-height: 100vh;
  padding-top: var(--header-height);
  padding-left: var(--navigator-width);
  transition: padding-left 180ms ease;
}

.app-shell--navigator-hidden .app-content {
  padding-left: 0;
}

.user-menu {
  position: relative;
}

.user-menu__trigger {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 2.65rem;
  padding: 0.25rem 0.45rem 0.25rem 0.3rem;
  border: 1px solid var(--shell-line);
  border-radius: 999px;
  background: var(--shell-surface);
  color: var(--shell-text);
  line-height: 1;
  cursor: pointer;
}

.user-avatar {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shell-accent) 18%, var(--shell-surface));
  color: var(--shell-accent-strong);
  font-size: 0.78rem;
  font-weight: 600;
}

.user-menu__identity {
  display: grid;
  justify-items: start;
  line-height: 1.15;
}

.user-menu__identity strong {
  font-size: 0.86rem;
}

.user-menu__identity small {
  color: var(--shell-muted);
  font-size: 0.72rem;
}

.user-menu__dropdown {
  position: absolute;
  top: calc(100% + 0.65rem);
  right: 0;
  display: grid;
  min-width: 13rem;
  padding: 0.45rem;
  border: 1px solid var(--shell-line);
  border-radius: 1rem;
  background: var(--shell-surface);
}

.user-menu__dropdown a,
.user-menu__dropdown button {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 2.55rem;
  padding: 0 0.75rem;
  border: 0;
  border-radius: 0.75rem;
  background: transparent;
  color: var(--shell-text);
  font: inherit;
  font-size: 0.9rem;
  font-weight: 600;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.user-menu__dropdown a:hover,
.user-menu__dropdown button:hover {
  background: var(--shell-surface-soft);
}

.user-menu__dropdown button {
  color: color-mix(in srgb, var(--danger-soft) 80%, var(--shell-text));
}

@media (max-width: 900px) {
  .app-header,
  .app-shell--navigator-hidden .app-header {
    left: 0;
  }

  .app-navigator {
    width: min(var(--navigator-width), 88vw);
  }

  .app-content,
  .app-shell--navigator-hidden .app-content {
    padding-left: 0;
  }

  .user-menu__identity,
  .header-context,
  .header-search input,
  .theme-switch__label {
    display: none;
  }

  .header-search {
    width: 2.5rem;
    min-width: 2.5rem;
    padding: 0;
    justify-content: center;
  }
}
</style>
