<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import logoLightUrl from '@/assets/Logos/logo-clara-em-row.png'
import logoDarkUrl from '@/assets/Logos/logo-for-dark-theme.png'
import ComingSoonFeatureDialog from '@/components/common/ComingSoonFeatureDialog.vue'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'
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
import { useCupomComingSoon } from '@/composables/useCupomComingSoon'
import { useCupomResgateModal } from '@/composables/useCupomResgateModal'
import { useLogout } from '@/composables/useLogout'
import { CUPOM_FEATURE_ENABLED } from '@/features/cupom-feature'
import { getAuthUser } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { LightColors } from '@/theme/colors'
import { currentColors, isDarkMode, toggleColorMode } from '@/theme/color-mode'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

/** Alinhado a `.theme-switch__thumb { transition: transform 240ms }` */
const THEME_SWITCH_DURATION_MS = 240
/** Preferência de layout (não é sessão): recolhido deixa só o rail de seções. */
const NAVIGATOR_COLLAPSED_STORAGE_KEY = 'petjourney-navigator-collapsed'
/** Espelha o breakpoint de `@media (max-width: 900px)` do estilo abaixo. */
const COMPACT_VIEWPORT_QUERY = '(max-width: 900px)'

const { t } = useI18n()
const router = useRouter()
const route = useRoute()
const railCollapsed = ref(readCollapsedPreference())
const compactViewport = ref(matchesCompactViewport())
const compactDrawerOpen = ref(false)
const userMenuOpen = ref(false)
const logoutConfirmVisible = ref(false)
const parceiroStore = useParceiroStore()
const usuarioPerfilStore = useUsuarioPerfilStore()
const { open: openCupomResgate, canOpen: canOpenCupomResgate } = useCupomResgateModal()
const {
  visible: cupomComingSoonVisible,
  open: openCupomComingSoon,
} = useCupomComingSoon()
const { navigationSections, hasClinicalProfile } = useAppNavigation()
const { logout } = useLogout()
const cupomFeatureEnabled = CUPOM_FEATURE_ENABLED
const activeSectionId = ref('home')
const defaultLandingPath = computed(() => getDefaultLandingPath())
const themeSwitchDark = ref(isDarkMode.value)
const themeTogglePending = ref(false)
let themeToggleTimer: ReturnType<typeof setTimeout> | undefined
let compactQuery: MediaQueryList | undefined

watch(isDarkMode, (dark) => {
  if (!themeTogglePending.value) {
    themeSwitchDark.value = dark
  }
})

function matchesCompactViewport() {
  return typeof window !== 'undefined' && window.matchMedia(COMPACT_VIEWPORT_QUERY).matches
}

function readCollapsedPreference() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(NAVIGATOR_COLLAPSED_STORAGE_KEY) === 'true'
}

/** No desktop o rail permanece navegável; só a lista de páginas recolhe. */
const drawerOpen = computed(() =>
  compactViewport.value ? compactDrawerOpen.value : !railCollapsed.value,
)
const navigatorHidden = computed(() => compactViewport.value && !compactDrawerOpen.value)
const panelHidden = computed(() => !compactViewport.value && railCollapsed.value)

function setRailCollapsed(collapsed: boolean) {
  railCollapsed.value = collapsed

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(NAVIGATOR_COLLAPSED_STORAGE_KEY, String(collapsed))
  }
}

function toggleNavigator() {
  if (compactViewport.value) {
    compactDrawerOpen.value = !compactDrawerOpen.value
    return
  }

  setRailCollapsed(!railCollapsed.value)
}

function closeCompactDrawer() {
  if (compactViewport.value) {
    compactDrawerOpen.value = false
  }
}

function handleViewportChange(event: MediaQueryListEvent) {
  compactViewport.value = event.matches

  if (!event.matches) {
    compactDrawerOpen.value = false
  }
}

function handleShellKeydown(event: KeyboardEvent) {
  if (event.key !== 'Escape') {
    return
  }

  if (compactViewport.value && compactDrawerOpen.value) {
    compactDrawerOpen.value = false
  }
}

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
    '--shell-on-brand': isDark ? colors.text.primary : LightColors.auth.white,
    '--shell-on-brand-muted': isDark ? colors.auth.soft : '#ffffffC2',
    '--shell-rail-active-bg': isDark ? colors.auth.sageTint : LightColors.auth.white,
    '--shell-accent': colors.vet.primary,
    '--shell-accent-strong': colors.auth.sageStrong,
    '--shell-accent-soft': colors.vet.secondary,
    '--shell-cream': colors.auth.sageTint,
    '--shell-shadow-rgb': colors.auth.shadowRgb,
    '--rail-logout-red': colors.red,
    '--rail-logout-mix-base': isDark ? colors.bg.card : LightColors.auth.white,
    /** Branco real — `auth.white` no dark é superfície escura. */
    '--rail-logout-icon': LightColors.auth.white,
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
  panelFilterQuery.value = ''

  if (!compactViewport.value) {
    setRailCollapsed(false)
  }

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
  () =>
    usuarioPerfilStore.displayName ||
    authUser.value?.nome ||
    t('shell.user.fallbackName'),
)

const headerAvatarUrl = computed(() => usuarioPerfilStore.avatarUrl)

const shellClasses = computed(() => ({
  'app-shell--rail-only': panelHidden.value,
  'app-shell--navigator-hidden': navigatorHidden.value,
  'app-shell--navigator-overlay': compactViewport.value && compactDrawerOpen.value,
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

function handleNavItemClick(event: Event, item: NavigationItem) {
  if (!item.comingSoon) {
    closeCompactDrawer()
    return
  }

  event.preventDefault()
  openCupomComingSoon()
}

function handleHeaderCupomClick() {
  if (!cupomFeatureEnabled) {
    openCupomComingSoon()
    return
  }

  openCupomResgate()
}

async function handleLogout() {
  userMenuOpen.value = false
  await logout()
}

onMounted(() => {
  compactQuery = window.matchMedia(COMPACT_VIEWPORT_QUERY)
  compactViewport.value = compactQuery.matches
  compactQuery.addEventListener('change', handleViewportChange)
  window.addEventListener('keydown', handleShellKeydown)

  usuarioPerfilStore.hydrate()
  usuarioPerfilStore.syncFromAuth()
  void usuarioPerfilStore.ensureFotoCarregada()
  void parceiroStore.bootstrap().catch(() => undefined)
})

onUnmounted(() => {
  window.clearTimeout(themeToggleTimer)
  compactQuery?.removeEventListener('change', handleViewportChange)
  window.removeEventListener('keydown', handleShellKeydown)
})
</script>

<template>
  <div class="app-shell" :class="shellClasses" :style="shellStyle">
    <button
      v-if="compactViewport && compactDrawerOpen"
      class="navigator-scrim"
      type="button"
      :aria-label="t('shell.drawer.close')"
      @click="closeCompactDrawer"
    />

    <aside class="app-navigator" :inert="navigatorHidden || undefined">
      <nav class="section-rail" :aria-label="t('shell.aria.sections')">
        <RouterLink
          class="rail-brand"
          :to="defaultLandingPath"
          :aria-label="t('shell.aria.brand')"
          @click="closeCompactDrawer"
        >
          <img :src="logoMarkUrl" alt="" />
        </RouterLink>

        <button
          v-for="section in navigationSections"
          :key="section.id"
          class="rail-button"
          :class="{ 'rail-button--active': activeSectionId === section.id }"
          type="button"
          :aria-current="activeSectionId === section.id ? 'true' : undefined"
          :title="section.label"
          @click="handleSectionChange(section.id)"
        >
          <span class="rail-button__icon" aria-hidden="true">
            <i :class="section.icon" />
          </span>
          <span class="rail-button__label">{{ section.label }}</span>
        </button>

        <div class="rail-bottom-actions">
          <button
            class="rail-action rail-action--collapse"
            type="button"
            :aria-label="railCollapsed ? t('shell.drawer.expand') : t('shell.drawer.collapse')"
            :title="railCollapsed ? t('shell.drawer.expand') : t('shell.drawer.collapse')"
            :aria-expanded="!railCollapsed"
            @click="toggleNavigator"
          >
            <i class="pi pi-angle-double-left" aria-hidden="true" />
          </button>

          <button
            class="rail-action rail-action--danger"
            type="button"
            :aria-label="t('shell.logout')"
            :title="t('shell.logout')"
            @click="requestLogout"
          >
            <i class="pi pi-sign-out" aria-hidden="true" />
          </button>
        </div>
      </nav>

      <section class="navigator-panel" :inert="panelHidden || undefined">
        <header class="navigator-brand">
          <RouterLink
            class="navigator-brand__link"
            :to="defaultLandingPath"
            :aria-label="t('shell.aria.brandHome')"
            @click="closeCompactDrawer"
          >
            <img class="navigator-brand__wordmark" :src="logoHeaderUrl" alt="" />
            <small>{{ t('shell.brand.badge') }}</small>
          </RouterLink>
        </header>

        <div class="navigator-section-heading">
          <span>{{ t('shell.menuHeading') }}</span>
          <strong>{{ activeSection.label }}</strong>
          <small v-if="activeSection.panelSubtitle">{{ activeSection.panelSubtitle }}</small>
        </div>

        <div v-if="hasPanelFilter" class="page-nav__filter">
          <label class="page-nav__filter-field" for="panel-nav-filter">
            <i class="pi pi-search" aria-hidden="true" />
            <input
              id="panel-nav-filter"
              v-model="panelFilterQuery"
              type="search"
              :placeholder="t('shell.filterPlaceholder')"
              autocomplete="off"
            />
          </label>
          <button
            v-if="panelFilterQuery"
            class="page-nav__filter-clear"
            type="button"
            :aria-label="t('shell.filterClear')"
            :title="t('shell.filterClear')"
            @click="panelFilterQuery = ''"
          >
            <i class="pi pi-times" aria-hidden="true" />
          </button>
        </div>

        <nav
          class="page-nav"
          :aria-label="t('shell.aria.pagesOf', { label: activeSection.label })"
        >
          <template v-if="activeSection.groups?.length">
            <p v-if="panelFilterHasNoResults" class="page-nav__empty">
              {{ t('shell.filterEmpty', { q: panelFilterQuery.trim() }) }}
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
                :class="{
                  'router-link-active': isNavItemActive(item),
                  'page-nav__link--soon': item.comingSoon,
                  'page-nav__link--locked': item.locked,
                }"
                :aria-current="isNavItemActive(item) ? 'page' : undefined"
                :to="item.to"
                active-class=""
                @click="handleNavItemClick($event, item)"
              >
                <span class="page-nav__icon" aria-hidden="true">
                  <i :class="item.icon" />
                </span>
                <span class="page-nav__label">{{ item.label }}</span>
                <span v-if="item.comingSoon" class="page-nav__soon">{{
                  t('comingSoon.cupom.badge')
                }}</span>
                <span
                  v-else-if="item.locked"
                  class="page-nav__lock"
                  :title="t('frame.suspended.title')"
                  aria-hidden="true"
                >
                  <i class="pi pi-lock" />
                </span>
              </RouterLink>
            </div>
          </template>

          <template v-else>
            <RouterLink
              v-for="item in activeSection.items"
              :key="item.label"
              class="page-nav__link"
              :class="{
                'router-link-active': isNavItemActive(item),
                'page-nav__link--soon': item.comingSoon,
                'page-nav__link--locked': item.locked,
              }"
              :aria-current="isNavItemActive(item) ? 'page' : undefined"
              :to="item.to"
              active-class=""
              @click="handleNavItemClick($event, item)"
            >
              <span class="page-nav__icon" aria-hidden="true">
                <i :class="item.icon" />
              </span>
              <span class="page-nav__label">{{ item.label }}</span>
              <span v-if="item.comingSoon" class="page-nav__soon">{{
                t('comingSoon.cupom.badge')
              }}</span>
              <span
                v-else-if="item.locked"
                class="page-nav__lock"
                :title="t('frame.suspended.title')"
                aria-hidden="true"
              >
                <i class="pi pi-lock" />
              </span>
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
          :aria-label="
            compactViewport
              ? drawerOpen
                ? t('shell.drawer.close')
                : t('shell.drawer.open')
              : drawerOpen
                ? t('shell.drawer.collapse')
                : t('shell.drawer.expand')
          "
          :aria-expanded="drawerOpen"
          icon="pi pi-bars"
          @click="toggleNavigator"
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
          :disabled="cupomFeatureEnabled && !canOpenCupomResgate"
          :title="
            !cupomFeatureEnabled
              ? t('comingSoon.cupom.navHint')
              : canOpenCupomResgate
                ? t('shell.cupom.cta')
                : t('shell.cupom.disabledTitle')
          "
          :aria-label="
            !cupomFeatureEnabled
              ? t('comingSoon.cupom.navHint')
              : canOpenCupomResgate
                ? t('shell.cupom.cta')
                : t('shell.cupom.disabledAria')
          "
          @click="handleHeaderCupomClick"
        >
          <span class="header-resgate__icon" aria-hidden="true">
            <i class="pi pi-ticket" />
          </span>
          <span class="header-resgate__label">{{ t('shell.cupom.cta') }}</span>
          <span v-if="!cupomFeatureEnabled" class="header-resgate__soon">{{
            t('comingSoon.cupom.badge')
          }}</span>
        </button>

        <button
          class="theme-switch"
          :class="{ 'theme-switch--dark': themeSwitchDark }"
          type="button"
          :aria-label="
            themeSwitchDark ? t('shell.theme.activateLight') : t('shell.theme.activateDark')
          "
          :title="themeSwitchDark ? t('shell.theme.lightTitle') : t('shell.theme.darkTitle')"
          :aria-pressed="themeSwitchDark"
          :aria-busy="themeTogglePending || undefined"
          @click="handleThemeToggle"
        >
          <span class="theme-switch__rail">
            <span class="theme-switch__thumb" aria-hidden="true">
              <i class="pi pi-sun theme-switch__icon theme-switch__icon--sun" />
              <i class="pi pi-moon theme-switch__icon theme-switch__icon--moon" />
            </span>
            <span class="theme-switch__label theme-switch__label--light">{{
              t('shell.theme.lightLabel')
            }}</span>
            <span class="theme-switch__label theme-switch__label--dark">{{
              t('shell.theme.darkLabel')
            }}</span>
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
              <small>{{ t('shell.user.role') }}</small>
            </span>
            <i class="pi pi-angle-down" aria-hidden="true" />
          </button>

          <div v-if="userMenuOpen" class="user-menu__dropdown" role="menu">
            <RouterLink role="menuitem" to="/settings?aba=perfil" @click="userMenuOpen = false">
              <i class="pi pi-user" aria-hidden="true" />
              {{ t('shell.user.perfil') }}
            </RouterLink>
            <RouterLink role="menuitem" to="/settings" @click="userMenuOpen = false">
              <i class="pi pi-cog" aria-hidden="true" />
              {{ t('shell.user.settings') }}
            </RouterLink>
            <RouterLink
              role="menuitem"
              to="/parceiro/selecionar"
              @click="userMenuOpen = false"
            >
              <i class="pi pi-building" aria-hidden="true" />
              {{ t('shell.user.trocarEmpresa') }}
            </RouterLink>
            <div class="user-menu__locale" role="none">
              <span class="user-menu__locale-label">{{ t('languageSwitcher.label') }}</span>
              <LanguageSwitcher variant="menu" />
            </div>
            <Button type="button" role="menuitem" text severity="danger" @click="requestLogout">
              <i class="pi pi-sign-out" aria-hidden="true" />
              {{ t('shell.user.logout') }}
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
      :title="t('shell.logoutConfirm.title')"
      :message="t('shell.logoutConfirm.message')"
      :confirm-label="t('shell.logout')"
      :cancel-label="t('shell.logoutConfirm.cancel')"
      severity="danger"
      @confirm="handleLogout"
    />

    <ValidarCupomDialog v-if="cupomFeatureEnabled" />
    <ComingSoonFeatureDialog v-model:visible="cupomComingSoonVisible" />
  </div>
</template>

<style scoped>
.app-shell {
  --navigator-width: 19.5rem;
  --navigator-rail: 4.6rem;
  --navigator-offset: var(--navigator-width);
  --navigator-ease: cubic-bezier(0.32, 0.72, 0, 1);
  --header-height: var(--pj-shell-header-height, 4.25rem);
  min-height: 100vh;
  max-width: 100%;
  overflow-x: clip;
  background: var(--shell-bg);
  color: var(--shell-text);
}

/** Recolhido no desktop: o rail continua visível e navegável. */
.app-shell--rail-only {
  --navigator-offset: var(--navigator-rail);
}

.app-shell--navigator-hidden {
  --navigator-offset: 0rem;
}

.navigator-scrim {
  position: fixed;
  z-index: 45;
  inset: 0;
  border: 0;
  background: rgb(var(--shell-shadow-rgb) / 0.42);
  cursor: pointer;
}

.app-navigator {
  position: fixed;
  z-index: 50;
  inset: 0 auto 0 0;
  display: grid;
  width: var(--navigator-width);
  height: 100vh;
  grid-template-columns: var(--navigator-rail) calc(var(--navigator-width) - var(--navigator-rail));
  overflow: hidden;
  border-right: 1px solid var(--shell-line);
  background: var(--shell-surface);
  transition:
    width 220ms var(--navigator-ease),
    transform 220ms var(--navigator-ease);
}

.app-shell--rail-only .app-navigator {
  width: var(--navigator-rail);
}

.app-shell--navigator-hidden .app-navigator {
  transform: translateX(-100%);
}

.app-shell--navigator-overlay .app-navigator {
  box-shadow: 18px 0 48px rgb(var(--shell-shadow-rgb) / 0.22);
}

.section-rail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.2rem;
  padding: 0.9rem 0.42rem 0.7rem;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--shell-brand) 94%, white),
    var(--shell-brand)
  );
}

.rail-brand {
  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  margin: 0 auto 0.9rem;
  place-items: center;
  border-radius: 0.85rem;
  background: color-mix(in srgb, var(--shell-on-brand) 12%, transparent);
  transition: background 160ms ease;
}

.rail-brand:hover {
  background: color-mix(in srgb, var(--shell-on-brand) 20%, transparent);
}

.rail-brand img {
  width: 1.45rem;
  height: 1.45rem;
  object-fit: contain;
}

.rail-button {
  position: relative;
  display: grid;
  width: 100%;
  gap: 0.2rem;
  justify-items: center;
  padding: 0.5rem 0.15rem 0.42rem;
  border: 0;
  border-radius: 0.85rem;
  background: transparent;
  color: color-mix(in srgb, var(--shell-on-brand) 74%, transparent);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.rail-button__icon {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  place-items: center;
}

.rail-button__icon i {
  font-size: 1.06rem;
  line-height: 1;
}

.rail-button__label {
  max-width: 100%;
  overflow: hidden;
  font-size: 0.58rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  line-height: 1.2;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rail-button:hover {
  background: color-mix(in srgb, var(--shell-on-brand) 12%, transparent);
  color: var(--shell-on-brand);
}

.rail-button--active,
.rail-button--active:hover {
  background: var(--shell-rail-active-bg);
  /* Sobre o pill claro o sage puro fica fraco no texto de 0.58rem. */
  color: color-mix(in srgb, var(--shell-accent-strong) 55%, var(--shell-text));
}

/** Marca a seção ativa também para quem não distingue a cor do pill. */
.rail-button--active::before {
  position: absolute;
  top: 50%;
  left: -0.42rem;
  width: 0.22rem;
  height: 1.5rem;
  border-radius: 0 999px 999px 0;
  background: var(--shell-on-brand);
  content: '';
  transform: translateY(-50%);
}

.rail-bottom-actions {
  display: grid;
  justify-items: center;
  gap: 0.3rem;
  margin-top: auto;
  padding-top: 0.7rem;
}

.rail-bottom-actions::before {
  width: 1.65rem;
  height: 1px;
  margin: 0 auto 0.35rem;
  background: color-mix(in srgb, var(--shell-on-brand) 22%, transparent);
  content: '';
}

.rail-action {
  display: grid;
  width: 2.35rem;
  height: 2.35rem;
  place-items: center;
  border: 0;
  border-radius: 0.75rem;
  background: color-mix(in srgb, var(--shell-on-brand) 10%, transparent);
  color: color-mix(in srgb, var(--shell-on-brand) 78%, transparent);
  cursor: pointer;
  font-size: 0.92rem;
  transition:
    background 160ms ease,
    color 160ms ease;
}

.rail-action:hover {
  background: color-mix(in srgb, var(--shell-on-brand) 18%, transparent);
  color: var(--shell-on-brand);
}

.rail-action--collapse i {
  transition: transform 220ms var(--navigator-ease);
}

.app-shell--rail-only .rail-action--collapse i {
  transform: rotate(180deg);
}

.rail-action--danger {
  background: color-mix(in srgb, var(--rail-logout-red) 16%, transparent);
  color: color-mix(in srgb, var(--rail-logout-red) 88%, var(--rail-logout-icon));
}

.rail-action--danger:hover {
  background: color-mix(in srgb, var(--rail-logout-red) 30%, transparent);
  color: var(--rail-logout-icon);
}

.rail-brand:focus-visible,
.rail-button:focus-visible,
.rail-action:focus-visible {
  outline: 2px solid var(--shell-on-brand);
  outline-offset: 2px;
}

.navigator-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 1rem 0.9rem 0.35rem;
  background: var(--shell-surface);
  opacity: 1;
  transition: opacity 160ms ease;
}

.app-shell--rail-only .navigator-panel {
  opacity: 0;
}

.navigator-brand {
  flex-shrink: 0;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--shell-line);
}

.navigator-brand__link {
  display: grid;
  min-width: 0;
  gap: 0.3rem;
  justify-items: start;
  padding: 0.5rem 0.55rem;
  border-radius: 0.8rem;
  text-decoration: none;
  transition: background 140ms ease;
}

.navigator-brand__link:hover {
  background: color-mix(in srgb, var(--shell-accent) 8%, transparent);
}

.navigator-brand__link:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--shell-accent) 55%, transparent);
  outline-offset: 2px;
}

.navigator-brand__wordmark {
  display: block;
  width: min(100%, 9.25rem);
  max-height: 1.7rem;
  object-fit: contain;
  object-position: left center;
}

.navigator-brand__link small {
  color: var(--shell-soft);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.navigator-section-heading {
  display: grid;
  gap: 0.16rem;
  margin-top: 0.95rem;
  margin-bottom: 0.7rem;
  padding: 0 0.25rem;
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
  min-height: 0;
  flex: 1 1 auto;
  align-content: start;
  gap: 0.7rem;
  overflow-y: auto;
  padding: 0.1rem 0.25rem 1rem 0;
  scrollbar-color: color-mix(in srgb, var(--shell-muted) 32%, transparent) transparent;
  scrollbar-width: thin;
}

.page-nav::-webkit-scrollbar {
  width: 6px;
}

.page-nav::-webkit-scrollbar-thumb {
  border-radius: 999px;
  background: color-mix(in srgb, var(--shell-muted) 28%, transparent);
}

.page-nav__filter {
  display: flex;
  align-items: center;
  gap: 0.15rem;
  margin-bottom: 0.2rem;
  padding-right: 0.25rem;
  border: 1px solid var(--shell-line);
  border-radius: 0.75rem;
  background: var(--shell-surface-soft);
  color: var(--shell-soft);
}

.page-nav__filter:focus-within {
  border-color: color-mix(in srgb, var(--shell-accent) 32%, var(--shell-line));
  background: var(--shell-surface);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--shell-accent) 12%, transparent);
}

.page-nav__filter-field {
  display: flex;
  min-width: 0;
  flex: 1 1 auto;
  align-items: center;
  gap: 0.55rem;
}

.page-nav__filter-field i {
  margin-left: 0.65rem;
  font-size: 0.8rem;
}

.page-nav__filter input {
  width: 100%;
  min-width: 0;
  padding: 0.55rem 0.35rem 0.55rem 0;
  border: 0;
  background: transparent;
  color: var(--shell-text);
  font: inherit;
  font-size: 0.82rem;
  outline: none;
}

.page-nav__filter input::-webkit-search-cancel-button {
  appearance: none;
}

.page-nav__filter input::placeholder {
  color: var(--shell-soft);
}

.page-nav__filter-clear {
  display: grid;
  width: 1.5rem;
  height: 1.5rem;
  flex: 0 0 auto;
  place-items: center;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: var(--shell-muted);
  cursor: pointer;
  font-size: 0.68rem;
}

.page-nav__filter-clear:hover {
  background: color-mix(in srgb, var(--shell-muted) 16%, transparent);
  color: var(--shell-text);
}

.page-nav__filter-clear:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--shell-accent) 55%, transparent);
  outline-offset: 1px;
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
  gap: 0.22rem;
}

.page-nav__group + .page-nav__group {
  margin-top: 0.35rem;
}

.page-nav__group-label {
  margin: 0 0 0.2rem;
  padding: 0 0.3rem;
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
  gap: 0.55rem;
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
    color 160ms ease;
}

.page-nav__label {
  min-width: 0;
  flex: 1 1 auto;
}

.page-nav__soon {
  flex-shrink: 0;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shell-accent) 16%, transparent);
  color: var(--shell-accent-strong);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.2;
}

.page-nav__lock {
  display: grid;
  flex-shrink: 0;
  width: 1.35rem;
  height: 1.35rem;
  place-items: center;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shell-muted) 14%, transparent);
  color: var(--shell-muted);
  font-size: 0.68rem;
}

.page-nav__link--locked {
  opacity: 0.78;
}

.page-nav__link--soon:hover,
.page-nav__link--soon:focus-visible {
  border-color: color-mix(in srgb, var(--shell-accent) 18%, var(--shell-line));
  background: color-mix(in srgb, var(--shell-accent-soft) 30%, var(--shell-surface));
  color: var(--shell-accent-strong);
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

/** Hover é convite; ativo é estado — pesos visuais distintos de propósito. */
.page-nav__link:hover {
  background: color-mix(in srgb, var(--shell-accent) 7%, var(--shell-surface));
  color: var(--shell-text);
}

.page-nav__link:focus-visible {
  outline: 2px solid color-mix(in srgb, var(--shell-accent) 55%, transparent);
  outline-offset: 2px;
}

.page-nav__link.router-link-active {
  border-color: color-mix(in srgb, var(--shell-accent) 24%, transparent);
  background: color-mix(in srgb, var(--shell-accent-soft) 34%, var(--shell-surface));
  color: var(--shell-accent-strong);
  font-weight: 750;
}

.page-nav__link.router-link-active::after {
  width: 0.35rem;
  height: 0.35rem;
  flex: 0 0 auto;
  border-radius: 999px;
  background: var(--shell-accent-strong);
  content: '';
}

.page-nav__link:hover .page-nav__icon {
  background: color-mix(in srgb, var(--shell-accent) 12%, var(--shell-surface));
  color: var(--shell-accent-strong);
}

.page-nav__link.router-link-active .page-nav__icon {
  background: color-mix(in srgb, var(--shell-accent) 22%, var(--shell-surface));
  color: var(--shell-accent-strong);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--shell-accent) 16%, transparent);
}

.app-header {
  position: fixed;
  z-index: 40;
  top: 0;
  right: 0;
  left: var(--navigator-offset);
  display: flex;
  height: var(--header-height);
  align-items: center;
  justify-content: space-between;
  padding: 0 1.25rem;
  background: var(--shell-surface);
  box-shadow: 0 1px 0 var(--shell-line);
  backdrop-filter: blur(14px);
  transition: left 220ms var(--navigator-ease);
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

.header-resgate__soon {
  margin-left: 0.15rem;
  padding: 0.12rem 0.4rem;
  border-radius: 999px;
  background: color-mix(in srgb, var(--shell-accent) 18%, transparent);
  color: var(--shell-accent-strong);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.2;
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
  .app-navigator,
  .app-header,
  .app-content,
  .navigator-panel,
  .rail-action--collapse i,
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
  padding-left: var(--navigator-offset);
  /* Painéis laterais não-modais empurram o conteúdo (var setada por useSidePanelOffset) */
  padding-right: var(--pj-side-panel-offset, 0px);
  overflow-x: clip;
  transition:
    padding-left 220ms var(--navigator-ease),
    padding-right 0.5s cubic-bezier(0.32, 0.72, 0, 1);
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

.user-menu__dropdown > a,
.user-menu__dropdown > .p-button {
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

.user-menu__dropdown > a:hover,
.user-menu__dropdown > .p-button:hover {
  background: var(--shell-surface-soft);
}

.user-menu__locale {
  display: grid;
  gap: 0.35rem;
  padding: 0.35rem 0.2rem 0.55rem;
  border-block: 1px solid var(--shell-line);
  margin-block: 0.2rem;
}

.user-menu__locale-label {
  padding: 0 0.55rem;
  color: var(--shell-muted);
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.user-menu__dropdown > .p-button {
  color: color-mix(in srgb, var(--danger-soft) 80%, var(--shell-text));
}

@media (max-width: 900px) {
  /* Em tela estreita o navegador sobrepõe: nunca empurra o conteúdo. */
  .app-shell {
    --navigator-offset: 0rem;
  }

  .app-navigator,
  .app-shell--rail-only .app-navigator {
    width: min(var(--navigator-width), 88vw);
    grid-template-columns: var(--navigator-rail) minmax(0, 1fr);
  }

  .app-shell--rail-only .navigator-panel {
    opacity: 1;
  }

  .rail-action--collapse {
    display: none;
  }

  .app-content {
    /* Em telas estreitas o painel lateral sobrepõe em vez de empurrar */
    padding-right: 0;
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
