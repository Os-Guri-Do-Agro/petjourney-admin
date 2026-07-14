<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import logoLightUrl from '@/assets/Logos/logo-clara-em-row.png'
import logoDarkUrl from '@/assets/Logos/logo-for-dark-theme.png'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import ValidarCupomDialog from '@/components/parceiro/ValidarCupomDialog.vue'
import {
  filterNavigationGroups,
  getSectionLandingPath,
  isHomeMenuContext,
  navItemMatches,
  parseNavTarget,
  resolveActiveSectionId,
  resolvePageLabel,
  stripHomeMenuContext,
  useAppNavigation,
  type AppNavigationItem,
  type AppNavigationSection,
} from '@/composables/useAppNavigation'
import { useCupomResgateModal } from '@/composables/useCupomResgateModal'
import { clearAuthSession, getAuthUser } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { currentColors, isDarkMode, toggleColorMode } from '@/theme/color-mode'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

/** Alinhado a `.theme-switch__thumb { transition: transform 240ms }` */
const THEME_SWITCH_DURATION_MS = 240

const router = useRouter()
const route = useRoute()
const drawerOpen = ref(true)
const userMenuOpen = ref(false)
const logoutConfirmVisible = ref(false)
const parceiroStore = useParceiroStore()
const usuarioPerfilStore = useUsuarioPerfilStore()
const { open: openCupomResgate, canOpen: canOpenCupomResgate } = useCupomResgateModal()
const { navigationSections, hasClinicalProfile } = useAppNavigation()
const activeSectionId = ref('home')
const defaultLandingPath = computed(() => getDefaultLandingPath())
const themeSwitchDark = ref(isDarkMode.value)
const themeTogglePending = ref(false)
let themeToggleTimer: ReturnType<typeof setTimeout> | undefined

watch(isDarkMode, (dark) => {
  if (!themeTogglePending.value) {
    themeSwitchDark.value = dark
  }
})

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function handleThemeToggle() {
  if (themeTogglePending.value) {
    return
  }

  themeSwitchDark.value = !themeSwitchDark.value

  if (prefersReducedMotion()) {
    toggleColorMode()
    return
  }

  themeTogglePending.value = true
  window.clearTimeout(themeToggleTimer)
  themeToggleTimer = window.setTimeout(() => {
    toggleColorMode()
    themeTogglePending.value = false
  }, THEME_SWITCH_DURATION_MS)
}
// const searchQuery = ref('') // busca do header (temporariamente desligada)
const panelFilterQuery = ref('')
const authUser = computed(() => getAuthUser())
const logoMarkUrl = computed(() => (isDarkMode.value ? '/pata-escura.png' : '/pata-clara.png'))
const logoHeaderUrl = computed(() => (isDarkMode.value ? logoDarkUrl : logoLightUrl))

type NavigationItem = AppNavigationItem

type NavigationSection = AppNavigationSection

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
    '--rail-logout-red': colors.red,
    '--rail-logout-mix-base': isDark ? colors.bg.card : colors.auth.white,
    '--rail-logout-icon': colors.auth.white,
  }
})

const fallbackSection = computed(() => navigationSections.value[0] as NavigationSection)
const activeSection = computed<NavigationSection>(
  () =>
    navigationSections.value.find((section) => section.id === activeSectionId.value) ??
    fallbackSection.value,
)

function isNavItemActive(item: NavigationItem) {
  const { path: itemPath, hash: itemHash } = parseNavTarget(item.to)

  const hashOk = itemHash ? itemHash === route.hash : true
  const pathOk = navItemMatches(itemPath, route.path)

  if (!pathOk || !hashOk) {
    return false
  }

  if (activeSectionId.value === 'home' && itemPath !== '/inicio') {
    return isHomeMenuContext(route.query)
  }

  if (activeSectionId.value !== 'home' && isHomeMenuContext(route.query)) {
    return false
  }

  return true
}

const filteredNavigationGroups = computed(() => {
  if (!activeSection.value.groups?.length) {
    return []
  }

  return filterNavigationGroups(activeSection.value.groups, panelFilterQuery.value)
})

const hasPanelFilter = computed(() => Boolean(activeSection.value.groups?.length))
const panelFilterHasNoResults = computed(
  () => hasPanelFilter.value && panelFilterQuery.value.trim().length > 0 && filteredNavigationGroups.value.length === 0,
)

const activePageLabel = computed(() =>
  resolvePageLabel(route.path, route.hash, navigationSections.value),
)

const activeSectionLabel = computed(() => activeSection.value.label)

function handleSectionChange(sectionId: string) {
  const section =
    navigationSections.value.find((entry) => entry.id === sectionId) ?? fallbackSection.value
  let target = getSectionLandingPath(section)

  activeSectionId.value = sectionId
  drawerOpen.value = true
  panelFilterQuery.value = ''

  if (!target) {
    return
  }

  if (sectionId !== 'home') {
    target = stripHomeMenuContext(target)
  }

  const { path: targetPath, hash: targetHash } = parseNavTarget(target)
  const samePath = targetPath === route.path
  const sameHash = targetHash ? targetHash === route.hash : true
  const sameHomeContext =
    sectionId === 'home'
      ? isHomeMenuContext(route.query) || targetPath === '/inicio'
      : !isHomeMenuContext(route.query)

  if (!samePath || !sameHash || !sameHomeContext) {
    void router.push(target)
  }
}

const initials = computed(() => usuarioPerfilStore.initials)

const headerDisplayName = computed(
  () => usuarioPerfilStore.displayName || authUser.value?.nome || 'Veterinário',
)

const headerAvatarUrl = computed(() => usuarioPerfilStore.avatarUrl)

const shellClasses = computed(() => ({
  'app-shell--navigator-hidden': !drawerOpen.value,
}))

watch(
  () => [route.path, route.query.menu] as const,
  () => {
    activeSectionId.value = resolveActiveSectionId(
      route.path,
      hasClinicalProfile.value,
      route.query,
    )
  },
  { immediate: true },
)

function requestLogout() {
  userMenuOpen.value = false
  logoutConfirmVisible.value = true
}

async function handleLogout() {
  parceiroStore.reset()
  usuarioPerfilStore.clear()
  clearAuthSession()
  userMenuOpen.value = false
  await router.replace('/auth/login')
}

onMounted(() => {
  usuarioPerfilStore.hydrate()
  usuarioPerfilStore.syncFromAuth()
  void parceiroStore.bootstrap().catch(() => undefined)
})

onUnmounted(() => {
  window.clearTimeout(themeToggleTimer)
})
</script>

<template>
  <div class="app-shell" :class="shellClasses" :style="shellStyle">
    <aside class="app-navigator" :aria-hidden="!drawerOpen">
      <nav class="section-rail" aria-label="Seções do painel">
        <RouterLink class="rail-brand" :to="defaultLandingPath" aria-label="PetJourney">
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
          <span class="rail-button__icon" aria-hidden="true">
            <i :class="section.icon" />
          </span>
        </button>

        <div class="rail-bottom-actions">
          <button
            class="rail-button rail-button--danger"
            type="button"
            aria-label="Sair"
            title="Sair"
            @click="requestLogout"
          >
            <span class="rail-button__icon" aria-hidden="true">
              <i class="pi pi-sign-out" />
            </span>
          </button>
        </div>
      </nav>

      <section class="navigator-panel">
        <header class="navigator-brand">
          <RouterLink
            class="navigator-brand__link"
            :to="defaultLandingPath"
            aria-label="PetJourney — início"
          >
            <span class="navigator-brand__meta">
              <img class="navigator-brand__wordmark" :src="logoHeaderUrl" alt="" />
              <small>Painel parceiro</small>
            </span>
          </RouterLink>
        </header>

        <div class="navigator-section-heading">
          <span>Menu</span>
          <strong>{{ activeSection.label }}</strong>
          <small v-if="activeSection.panelSubtitle">{{ activeSection.panelSubtitle }}</small>
        </div>

        <label v-if="hasPanelFilter" class="page-nav__filter" for="panel-nav-filter">
          <i class="pi pi-search" aria-hidden="true" />
          <input
            id="panel-nav-filter"
            v-model="panelFilterQuery"
            type="search"
            placeholder="Filtrar telas..."
            autocomplete="off"
          />
        </label>

        <nav class="page-nav" :aria-label="`Páginas de ${activeSection.label}`">
          <template v-if="activeSection.groups?.length">
            <p v-if="panelFilterHasNoResults" class="page-nav__empty">
              Nenhuma tela encontrada para “{{ panelFilterQuery.trim() }}”.
            </p>

            <div
              v-for="group in filteredNavigationGroups"
              :key="group.id"
              class="page-nav__group"
            >
              <p class="page-nav__group-label">{{ group.label }}</p>
              <RouterLink
                v-for="item in group.items"
                :key="`${group.id}-${item.to}`"
                class="page-nav__link"
                :class="{ 'router-link-active': isNavItemActive(item) }"
                :to="item.to"
                active-class=""
              >
                <span class="page-nav__icon" aria-hidden="true">
                  <i :class="item.icon" />
                </span>
                <span>{{ item.label }}</span>
              </RouterLink>
            </div>
          </template>

          <template v-else>
            <RouterLink
              v-for="item in activeSection.items"
              :key="item.label"
              class="page-nav__link"
              :class="{ 'router-link-active': isNavItemActive(item) }"
              :to="item.to"
              active-class=""
            >
              <span class="page-nav__icon" aria-hidden="true">
                <i :class="item.icon" />
              </span>
              <span>{{ item.label }}</span>
            </RouterLink>
          </template>
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
          <span>{{ activeSectionLabel }}</span>
          <strong>{{ activePageLabel }}</strong>
        </div>
      </div>

      <div class="app-header__right">
        <!-- Busca global: ocultada temporariamente
        <label class="header-search" for="header-search">
          <i class="pi pi-search" aria-hidden="true" />
          <input id="header-search" v-model="searchQuery" type="search" placeholder="Pesquisar" />
        </label>
        -->

        <button
          class="header-resgate"
          type="button"
          :disabled="!canOpenCupomResgate"
          :title="
            canOpenCupomResgate
              ? 'Validar cupom'
              : 'Disponível apenas para parceiros com operação liberada'
          "
          :aria-label="
            canOpenCupomResgate
              ? 'Validar cupom'
              : 'Validar cupom indisponível: conta sem acesso de parceiro'
          "
          @click="openCupomResgate"
        >
          <span class="header-resgate__icon" aria-hidden="true">
            <i class="pi pi-ticket" />
          </span>
          <span class="header-resgate__label">Validar cupom</span>
        </button>

        <button
          class="theme-switch"
          :class="{ 'theme-switch--dark': themeSwitchDark }"
          type="button"
          :aria-label="themeSwitchDark ? 'Ativar tema claro' : 'Ativar tema escuro'"
          :title="themeSwitchDark ? 'Tema claro' : 'Tema escuro'"
          :aria-pressed="themeSwitchDark"
          :aria-busy="themeTogglePending || undefined"
          @click="handleThemeToggle"
        >
          <span class="theme-switch__rail">
            <span class="theme-switch__thumb" aria-hidden="true">
              <i class="pi pi-sun theme-switch__icon theme-switch__icon--sun" />
              <i class="pi pi-moon theme-switch__icon theme-switch__icon--moon" />
            </span>
            <span class="theme-switch__label theme-switch__label--light">Light</span>
            <span class="theme-switch__label theme-switch__label--dark">Dark</span>
          </span>
        </button>

        <div class="user-menu">
          <button
            class="user-menu__trigger"
            type="button"
            :aria-expanded="userMenuOpen"
            aria-haspopup="menu"
            @click="userMenuOpen = !userMenuOpen"
          >
            <span class="user-avatar">
              <img v-if="headerAvatarUrl" :src="headerAvatarUrl" alt="" />
              <template v-else>{{ initials }}</template>
            </span>
            <span class="user-menu__identity">
              <strong>{{ headerDisplayName }}</strong>
              <small>Conta parceiro</small>
            </span>
            <i class="pi pi-angle-down" aria-hidden="true" />
          </button>

          <div v-if="userMenuOpen" class="user-menu__dropdown" role="menu">
            <RouterLink role="menuitem" to="/settings?aba=perfil" @click="userMenuOpen = false">
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

    <ValidarCupomDialog />
  </div>
</template>

<style scoped>
.app-shell {
  --navigator-width: 19.5rem;
  --header-height: 4.25rem;
  min-height: 100vh;
  max-width: 100%;
  overflow-x: clip;
  background: var(--shell-bg);
  color: var(--shell-text);
}

.app-navigator {
  position: fixed;
  z-index: 50;
  inset: 0 auto 0 0;
  display: grid;
  width: var(--navigator-width);
  height: 100vh;
  grid-template-columns: 4.25rem minmax(0, 1fr);
  background: var(--shell-surface);
  box-shadow:
    1px 0 0 var(--shell-line),
    16px 0 40px rgb(var(--shell-shadow-rgb) / 0.05);
  transition: transform 180ms ease;
}

.app-shell--navigator-hidden .app-navigator {
  transform: translateX(-100%);
}

.section-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 1rem 0.55rem 0.85rem;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--shell-brand) 88%, white) 0%,
      var(--shell-brand) 42%,
      color-mix(in srgb, var(--shell-brand) 94%, black) 100%
    ),
    var(--shell-brand);
}

.rail-brand {
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  margin-bottom: 1rem;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--shell-on-brand) 22%, transparent);
  border-radius: 0.95rem;
  background: color-mix(in srgb, var(--shell-on-brand) 14%, transparent);
  box-shadow:
    inset 0 1px 0 color-mix(in srgb, var(--shell-on-brand) 18%, transparent),
    0 12px 24px rgb(var(--shell-shadow-rgb) / 0.1);
  transition:
    transform 160ms ease,
    background 160ms ease;
}

.rail-brand:hover {
  transform: translateY(-1px);
  background: color-mix(in srgb, var(--shell-on-brand) 20%, transparent);
}

.rail-brand img {
  width: 1.5rem;
  height: 1.5rem;
  object-fit: contain;
  filter: drop-shadow(0 1px 1px rgb(var(--shell-shadow-rgb) / 0.12));
}

.rail-button {
  position: relative;
  display: grid;
  width: 2.75rem;
  height: 2.75rem;
  place-items: center;
  border: 0;
  border-radius: 0.92rem;
  background: transparent;
  color: color-mix(in srgb, var(--shell-on-brand) 72%, transparent);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.rail-button__icon {
  display: grid;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
}

.rail-button__icon i {
  font-size: 1.08rem;
  line-height: 1;
}

.rail-button:hover:not(.rail-button--danger) {
  background: color-mix(in srgb, var(--shell-on-brand) 12%, transparent);
  color: var(--shell-on-brand);
  transform: translateY(-1px);
}

.rail-button--active {
  background: var(--shell-rail-active-bg);
  color: var(--shell-accent-strong);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--shell-accent) 20%, transparent),
    0 12px 22px rgb(var(--shell-shadow-rgb) / 0.12);
}

.rail-button--active .rail-button__icon i {
  color: var(--shell-accent-strong);
}

.rail-button--active::after {
  position: absolute;
  right: -0.48rem;
  width: 0.28rem;
  height: 1.55rem;
  border-radius: 999px;
  background: var(--shell-on-brand);
  content: '';
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--shell-on-brand) 30%, transparent);
}

.rail-bottom-actions {
  display: grid;
  gap: 0.45rem;
  margin-top: auto;
  padding-top: 0.85rem;
}

.rail-bottom-actions::before {
  width: 1.65rem;
  height: 1px;
  margin: 0 auto 0.35rem;
  background: color-mix(in srgb, var(--shell-on-brand) 24%, transparent);
  content: '';
}

.rail-button--danger {
  background: color-mix(in srgb, var(--rail-logout-red) 16%, transparent);
  color: color-mix(in srgb, var(--rail-logout-red) 88%, var(--rail-logout-icon));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rail-logout-red) 28%, transparent);
}

.rail-button--danger .rail-button__icon i {
  font-size: 1rem;
}

.rail-button--danger:hover {
  background: color-mix(in srgb, var(--rail-logout-red) 26%, transparent);
  color: var(--rail-logout-icon);
  transform: translateY(-1px);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--rail-logout-red) 48%, transparent);
}

.navigator-panel {
  display: flex;
  min-width: 0;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 1.05rem 0.95rem;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--shell-surface-soft) 22%, transparent),
      transparent 10rem
    ),
    var(--shell-surface);
}

.navigator-brand {
  flex-shrink: 0;
  padding: 0.15rem;
  border: 1px solid color-mix(in srgb, var(--shell-line) 92%, transparent);
  border-radius: 1.05rem;
  background:
    radial-gradient(
      130% 160% at 0% 0%,
      color-mix(in srgb, var(--shell-accent) 18%, transparent),
      transparent 58%
    ),
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--shell-surface-soft) 88%, var(--shell-surface)),
      var(--shell-surface)
    );
  box-shadow: inset 0 1px 0 color-mix(in srgb, white 55%, transparent);
}

.navigator-brand__link {
  display: block;
  min-width: 0;
  padding: 0.85rem 0.9rem;
  border-radius: 0.9rem;
  text-decoration: none;
  text-align: center;
  transition: background 140ms ease;
}

.navigator-brand__link:hover {
  background: color-mix(in srgb, var(--shell-accent) 8%, transparent);
}

.navigator-brand__link:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--shell-accent) 55%, transparent);
  outline-offset: 2px;
}

.navigator-brand__meta {
  display: grid;
  gap: 0.28rem;
  justify-items: center;
  min-width: 0;
}

.navigator-brand__wordmark {
  display: block;
  width: min(100%, 9.5rem);
  max-height: 1.75rem;
  margin-inline: auto;
  object-fit: contain;
  object-position: center;
}

.navigator-brand__meta small {
  color: var(--shell-soft);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-align: center;
  text-transform: uppercase;
}

.navigator-section-heading {
  display: grid;
  gap: 0.18rem;
  margin-top: 1.15rem;
  margin-bottom: 0.75rem;
  padding: 0 0.2rem;
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
  font-size: 1.02rem;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.navigator-section-heading small {
  color: var(--shell-muted);
  font-size: 0.78rem;
  font-weight: 500;
  line-height: 1.35;
}

.page-nav {
  display: grid;
  gap: 0.75rem;
  overflow: auto;
  padding-right: 0.1rem;
}

.page-nav__filter {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin-bottom: 0.15rem;
  padding: 0 0.2rem;
  border: 1px solid var(--shell-line);
  border-radius: 0.75rem;
  background: var(--shell-surface);
  color: var(--shell-soft);
}

.page-nav__filter:focus-within {
  border-color: color-mix(in srgb, var(--shell-accent) 28%, var(--shell-line));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--shell-accent) 12%, transparent);
}

.page-nav__filter i {
  margin-left: 0.65rem;
  font-size: 0.82rem;
}

.page-nav__filter input {
  width: 100%;
  min-width: 0;
  padding: 0.55rem 0.65rem 0.55rem 0;
  border: 0;
  background: transparent;
  color: var(--shell-text);
  font: inherit;
  font-size: 0.82rem;
  outline: none;
}

.page-nav__filter input::placeholder {
  color: var(--shell-soft);
}

.page-nav__empty {
  margin: 0;
  padding: 0.75rem 0.55rem;
  color: var(--shell-muted);
  font-size: 0.8rem;
  line-height: 1.45;
}

.page-nav__group {
  display: grid;
  gap: 0.32rem;
}

.page-nav__group + .page-nav__group {
  padding-top: 0.55rem;
  border-top: 1px solid color-mix(in srgb, var(--shell-line) 80%, transparent);
}

.page-nav__group-label {
  margin: 0 0 0.15rem;
  padding: 0 0.2rem;
  color: var(--shell-soft);
  font-size: 0.64rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.page-nav__link {
  position: relative;
  display: flex;
  min-height: 2.55rem;
  align-items: center;
  justify-content: flex-start;
  gap: 0.68rem;
  padding: 0 0.72rem;
  border: 1px solid transparent;
  border-radius: 0.82rem;
  color: var(--shell-muted);
  font-size: 0.84rem;
  font-weight: 650;
  text-decoration: none;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease,
    transform 160ms ease;
}

.page-nav__icon {
  display: grid;
  width: 1.85rem;
  height: 1.85rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.68rem;
  background: color-mix(in srgb, var(--shell-accent-soft) 16%, var(--shell-surface));
  color: var(--shell-soft);
  transition:
    background 160ms ease,
    color 160ms ease,
    box-shadow 160ms ease;
}

.page-nav__icon i {
  font-size: 0.82rem;
  line-height: 1;
}

.page-nav__link:hover,
.page-nav__link.router-link-active {
  border-color: color-mix(in srgb, var(--shell-accent) 18%, var(--shell-line));
  background: color-mix(in srgb, var(--shell-accent-soft) 30%, var(--shell-surface));
  color: var(--shell-accent-strong);
}

.page-nav__link.router-link-active {
  box-shadow: 0 10px 24px rgb(var(--shell-shadow-rgb) / 0.06);
}

.page-nav__link:hover {
  transform: translateX(1px);
}

.page-nav__link:hover .page-nav__icon,
.page-nav__link.router-link-active .page-nav__icon {
  background: color-mix(in srgb, var(--shell-accent) 18%, var(--shell-surface));
  color: var(--shell-accent-strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-accent) 12%, transparent);
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
  border-radius: 0.72rem;
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
  border-radius: 0.72rem;
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

.header-resgate {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  min-height: 2.45rem;
  padding: 0.22rem 0.78rem 0.22rem 0.28rem;
  border: 1px solid var(--shell-line);
  border-radius: 0.72rem;
  background: var(--shell-surface);
  color: var(--shell-text);
  font: inherit;
  font-size: 0.78rem;
  font-weight: 700;
  cursor: pointer;
  transition:
    background 160ms ease,
    border-color 160ms ease;
}

.header-resgate:hover:not(:disabled) {
  background: var(--shell-surface-soft);
  border-color: color-mix(in srgb, var(--shell-accent) 28%, var(--shell-line));
}

.header-resgate:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.header-resgate__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.58rem;
  background: color-mix(in srgb, var(--shell-accent) 22%, var(--shell-surface));
  color: var(--shell-accent-strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-accent) 18%, transparent);
  font-size: 0.86rem;
}

.header-resgate__label {
  line-height: 1;
  white-space: nowrap;
}

.theme-switch {
  display: inline-flex;
  align-items: center;
  min-height: 2.45rem;
  padding: 0.22rem;
  border: 1px solid var(--shell-line);
  border-radius: 0.72rem;
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

.theme-switch__rail {
  --theme-thumb: 2rem;
  --theme-rail-w: 5.5rem;
  --theme-ease: cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  width: var(--theme-rail-w);
  height: var(--theme-thumb);
}

.theme-switch__thumb {
  position: absolute;
  top: 0;
  left: 0;
  z-index: 1;
  display: grid;
  width: var(--theme-thumb);
  height: var(--theme-thumb);
  place-items: center;
  border-radius: 0.58rem;
  background: color-mix(in srgb, var(--shell-accent) 22%, var(--shell-surface));
  color: var(--shell-accent-strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-accent) 18%, transparent);
  transform: translateX(0);
  transition: transform 240ms var(--theme-ease);
  will-change: transform;
}

.theme-switch--dark .theme-switch__thumb {
  transform: translateX(calc(var(--theme-rail-w) - var(--theme-thumb)));
}

.theme-switch__icon {
  grid-area: 1 / 1;
  font-size: 0.86rem;
  transition:
    opacity 180ms var(--theme-ease),
    transform 240ms var(--theme-ease);
}

.theme-switch__icon--sun {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

.theme-switch__icon--moon {
  opacity: 0;
  transform: rotate(-14deg) scale(0.88);
}

.theme-switch--dark .theme-switch__icon--sun {
  opacity: 0;
  transform: rotate(14deg) scale(0.88);
}

.theme-switch--dark .theme-switch__icon--moon {
  opacity: 1;
  transform: rotate(0deg) scale(1);
}

.theme-switch__label {
  position: absolute;
  top: 0;
  bottom: 0;
  z-index: 0;
  display: grid;
  place-items: center;
  line-height: 1;
  transition:
    opacity 200ms var(--theme-ease),
    transform 240ms var(--theme-ease);
}

.theme-switch__label--light {
  left: var(--theme-thumb);
  right: 0;
  opacity: 1;
  transform: translateX(0);
}

.theme-switch__label--dark {
  left: 0;
  right: var(--theme-thumb);
  opacity: 0;
  pointer-events: none;
  transform: translateX(0.2rem);
}

.theme-switch--dark .theme-switch__label--light {
  opacity: 0;
  pointer-events: none;
  transform: translateX(-0.2rem);
}

.theme-switch--dark .theme-switch__label--dark {
  opacity: 1;
  pointer-events: auto;
  transform: translateX(0);
}

@media (prefers-reduced-motion: reduce) {
  .theme-switch__thumb,
  .theme-switch__icon,
  .theme-switch__label {
    transition: none;
  }

  .theme-switch__thumb {
    will-change: auto;
  }
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
  max-width: 100%;
  padding-top: var(--header-height);
  padding-left: var(--navigator-width);
  overflow-x: clip;
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
  border-radius: 0.78rem;
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
  overflow: hidden;
  border-radius: 0.62rem;
  background: color-mix(in srgb, var(--shell-accent) 18%, var(--shell-surface));
  color: var(--shell-accent-strong);
  font-size: 0.78rem;
  font-weight: 600;
}

.user-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
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
  .theme-switch__label,
  .header-resgate__label {
    display: none;
  }

  .theme-switch__rail {
    --theme-rail-w: 3.85rem;
  }

  .header-resgate {
    padding: 0.22rem;
  }

  .header-search {
    width: 2.5rem;
    min-width: 2.5rem;
    padding: 0;
    justify-content: center;
  }
}
</style>
