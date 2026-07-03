<script setup lang="ts">
import Button from 'primevue/button'
import { computed, onMounted, ref, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import logoHeaderUrl from '@/assets/Logos/logo-clara-em-row.png'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import {
  navItemMatches,
  resolveActiveSectionId,
  resolvePageLabel,
  useAppNavigation,
  type AppNavigationItem,
} from '@/composables/useAppNavigation'
import { clearAuthSession, getAuthUser } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { currentColors, isDarkMode, toggleColorMode } from '@/theme/color-mode'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

const router = useRouter()
const route = useRoute()
const drawerOpen = ref(true)
const userMenuOpen = ref(false)
const logoutConfirmVisible = ref(false)
const parceiroStore = useParceiroStore()
const { navigationSections, hasClinicalProfile } = useAppNavigation()
const activeSectionId = ref('portal')
const defaultLandingPath = computed(() => getDefaultLandingPath())
const searchQuery = ref('')
const user = computed(() => getAuthUser())
const logoMarkUrl = computed(() => (isDarkMode.value ? '/pata-escura.png' : '/pata-clara.png'))

type NavigationItem = AppNavigationItem

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
    '--rail-logout-bg': isDark
      ? color-mix(in srgb, colors.red 42%, colors.bg.card)
      : color-mix(in srgb, colors.red 48%, colors.auth.white),
    '--rail-logout-bg-hover': isDark
      ? color-mix(in srgb, colors.red 58%, colors.bg.card)
      : color-mix(in srgb, colors.red 62%, colors.auth.white),
    '--rail-logout-border': color-mix(in srgb, colors.red 70%, transparent),
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
  const [itemPath = '', itemHash = ''] = item.to.split('#')

  if (itemHash) {
    return itemPath === route.path && `#${itemHash}` === route.hash
  }

  return navItemMatches(itemPath, route.path)
}

const activePageLabel = computed(() =>
  resolvePageLabel(route.path, route.hash, navigationSections.value),
)

const activeSectionLabel = computed(() => activeSection.value.label)

function handleSectionChange(sectionId: string) {
  const section =
    navigationSections.value.find((entry) => entry.id === sectionId) ?? fallbackSection.value
  const target = section.items[0]?.to

  activeSectionId.value = sectionId
  drawerOpen.value = true

  if (!target) {
    return
  }

  const [targetPath = '', targetHash = ''] = target.split('#')
  const samePath = targetPath === route.path
  const sameHash = targetHash ? `#${targetHash}` === route.hash : true

  if (!samePath || !sameHash) {
    void router.push(target)
  }
}

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

watch(
  () => route.path,
  (path) => {
    activeSectionId.value = resolveActiveSectionId(path, hasClinicalProfile.value)
  },
  { immediate: true },
)

function requestLogout() {
  userMenuOpen.value = false
  logoutConfirmVisible.value = true
}

async function handleLogout() {
  parceiroStore.reset()
  clearAuthSession()
  userMenuOpen.value = false
  await router.replace('/auth/login')
}

onMounted(() => {
  void parceiroStore.bootstrap().catch(() => undefined)
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
          <i :class="section.icon" aria-hidden="true" />
        </button>

        <div class="rail-bottom-actions">
          <button
            class="rail-button rail-button--danger"
            type="button"
            aria-label="Sair"
            title="Sair"
            @click="requestLogout"
          >
            <i class="pi pi-sign-out" aria-hidden="true" />
          </button>
        </div>
      </nav>

      <section class="navigator-panel">
        <RouterLink class="navigator-logo" :to="defaultLandingPath">
          <img :src="logoHeaderUrl" alt="PetJourney" />
        </RouterLink>

        <div class="navigator-section-heading">
          <span>Menu</span>
          <strong>{{ activeSection.label }}</strong>
        </div>

        <nav class="page-nav" :aria-label="`Páginas de ${activeSection.label}`">
          <RouterLink
            v-for="item in activeSection.items"
            :key="item.label"
            class="page-nav__link"
            :class="{ 'router-link-active': isNavItemActive(item) }"
            :to="item.to"
            active-class=""
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
          <span>{{ activeSectionLabel }}</span>
          <strong>{{ activePageLabel }}</strong>
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
  gap: 0.5rem;
  padding: 0.9rem 0.55rem;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--shell-brand) 92%, white) 0%,
      var(--shell-brand) 48%
    ),
    var(--shell-brand);
}

.rail-brand {
  display: grid;
  width: 2.65rem;
  height: 2.65rem;
  margin-bottom: 0.9rem;
  place-items: center;
  border: 1px solid color-mix(in srgb, var(--shell-on-brand) 18%, transparent);
  border-radius: 0.9rem;
  background: color-mix(in srgb, var(--shell-on-brand) 16%, transparent);
  box-shadow: 0 10px 24px rgb(var(--shell-shadow-rgb) / 0.08);
}

.rail-brand img {
  width: 1.45rem;
  height: 1.45rem;
  object-fit: contain;
}

.rail-button {
  position: relative;
  display: grid;
  width: 2.55rem;
  height: 2.55rem;
  place-items: center;
  border: 0;
  border-radius: 0.82rem;
  background: transparent;
  color: var(--shell-on-brand-muted);
  cursor: pointer;
  transition:
    background 160ms ease,
    color 160ms ease,
    transform 160ms ease,
    box-shadow 160ms ease;
}

.rail-button i {
  font-size: 1rem;
  line-height: 1;
}

.rail-button:hover {
  background: color-mix(in srgb, var(--shell-on-brand) 10%, transparent);
  color: var(--shell-on-brand);
  transform: translateY(-1px);
}

.rail-button--active {
  background: var(--shell-rail-active-bg);
  color: var(--shell-accent-strong);
  box-shadow:
    inset 0 0 0 1px color-mix(in srgb, var(--shell-accent) 24%, transparent),
    0 10px 20px rgb(var(--shell-shadow-rgb) / 0.08);
}

.rail-button--active::after {
  position: absolute;
  right: -0.5rem;
  width: 0.24rem;
  height: 1.45rem;
  border-radius: 999px;
  background: var(--shell-on-brand);
  content: '';
}

.rail-bottom-actions {
  display: grid;
  gap: 0.45rem;
  margin-top: auto;
  padding-top: 0.75rem;
}

.rail-button--danger {
  background: var(--rail-logout-bg);
  color: var(--rail-logout-icon);
  box-shadow:
    inset 0 0 0 1px var(--rail-logout-border),
    0 8px 20px rgb(var(--shell-shadow-rgb) / 0.14);
}

.rail-button--danger:hover {
  background: var(--rail-logout-bg-hover);
  color: var(--rail-logout-icon);
  transform: translateY(-1px);
  box-shadow:
    inset 0 0 0 1px var(--rail-logout-border),
    0 10px 24px rgb(var(--shell-shadow-rgb) / 0.18);
}

.navigator-panel {
  display: flex;
  min-width: 0;
  flex-direction: column;
  padding: 1.05rem 0.95rem;
  background:
    linear-gradient(
      180deg,
      color-mix(in srgb, var(--shell-surface-soft) 22%, transparent),
      transparent 10rem
    ),
    var(--shell-surface);
}

.navigator-logo {
  display: inline-flex;
  width: fit-content;
  align-items: center;
  text-decoration: none;
}

.navigator-logo img {
  display: block;
  width: 9.45rem;
  max-height: 2.75rem;
  object-fit: contain;
}

.navigator-section-heading {
  display: grid;
  gap: 0.18rem;
  margin-top: 1.45rem;
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

.page-nav {
  display: grid;
  gap: 0.36rem;
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

.page-nav__link i {
  display: grid;
  width: 1.72rem;
  height: 1.72rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.62rem;
  background: color-mix(in srgb, var(--shell-accent-soft) 18%, var(--shell-surface));
  color: var(--shell-soft);
  font-size: 0.78rem;
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

.theme-switch {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  min-height: 2.45rem;
  padding: 0 0.78rem 0 0.28rem;
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

.theme-switch__track {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.58rem;
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
  border-radius: 0.62rem;
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
