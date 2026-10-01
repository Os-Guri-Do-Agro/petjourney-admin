<script setup lang="ts">
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Popover from 'primevue/popover'
import ToggleSwitch from 'primevue/toggleswitch'
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import logoLightUrl from '@/assets/Logos/logo-clara-em-row.png'
import logoDarkUrl from '@/assets/Logos/logo-for-dark-theme.png'
import ComingSoonFeatureDialog from '@/components/common/ComingSoonFeatureDialog.vue'
import AppNavLink from '@/components/layout/AppNavLink.vue'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'
import ValidarCupomDialog from '@/components/parceiro/ValidarCupomDialog.vue'
import {
  filterNavigationGroups,
  getSectionLandingPath,
  navItemMatches,
  OVERVIEW_SECTION_ID,
  parseNavTarget,
  resolveActiveSectionId,
  resolvePageLabel,
  useAppNavigation,
  type AppNavigationGroup,
  type AppNavigationItem,
  type AppNavigationSection,
} from '@/composables/useAppNavigation'
import { useCupomComingSoon } from '@/composables/useCupomComingSoon'
import { useCupomResgateModal } from '@/composables/useCupomResgateModal'
import { isCompactDensity, isListNavigator } from '@/composables/useLayoutPreferences'
import { useLogout } from '@/composables/useLogout'
import CronometroConsulta from '@/features/cronometro/components/CronometroConsulta.vue'
import { CUPOM_FEATURE_ENABLED } from '@/features/cupom-feature'
import { getAuthUser } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { currentColors, isDarkMode, toggleColorMode } from '@/theme/color-mode'
import { getDefaultLandingPath } from '@/utils/navigation/default-landing'

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
const { navigationSections, navigationGroups, overviewItem, hasClinicalProfile } =
  useAppNavigation()
const { logout } = useLogout()
const cupomFeatureEnabled = CUPOM_FEATURE_ENABLED
const activeSectionId = ref(OVERVIEW_SECTION_ID)
const defaultLandingPath = computed(() => getDefaultLandingPath())
let compactQuery: MediaQueryList | undefined

function matchesCompactViewport() {
  return typeof window !== 'undefined' && window.matchMedia(COMPACT_VIEWPORT_QUERY).matches
}

function readCollapsedPreference() {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(NAVIGATOR_COLLAPSED_STORAGE_KEY) === 'true'
}

/**
 * No modo seções o trilho permanece navegável quando recolhido — só a lista de páginas some.
 * No modo lista não há trilho, então recolher esconde o menu inteiro; deixar uma tira vazia de
 * 4,6 rem ocupando a lateral seria pior que nada.
 */
const drawerOpen = computed(() =>
  compactViewport.value ? compactDrawerOpen.value : !railCollapsed.value,
)

const navigatorHidden = computed(() =>
  compactViewport.value
    ? !compactDrawerOpen.value
    : isListNavigator.value && railCollapsed.value,
)

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
  /*
   * `Ctrl/⌘ + K` abre a busca do módulo, e atravessa campo de texto de propósito: é a única
   * tecla do portal que precisa funcionar **enquanto** alguém digita — quem está no meio de uma
   * anamnese e precisa conferir o histórico do paciente não vai clicar fora antes.
   *
   * A agenda tem atalhos de uma letra, e nenhum deles colide: o ouvinte de lá ignora tudo o que
   * vem com `Ctrl`, `Alt` ou `Meta`.
   */
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
    if (!hasClinicalProfile.value) {
      return
    }

    event.preventDefault()
    buscaAberta.value = !buscaAberta.value

    return
  }

  if (event.key !== 'Escape') {
    return
  }

  if (compactViewport.value && compactDrawerOpen.value) {
    compactDrawerOpen.value = false
  }
}

/**
 * O tema mora no menu da conta, e não no cabeçalho: é escolha de uma vez, e o botão largo com sol e
 * lua ocupava o espaço que o título da página precisava (ele era cortado por baixo dos controles).
 */
function alternarTema(escuro: boolean) {
  if (escuro !== isDarkMode.value) {
    toggleColorMode()
  }
}
// const searchQuery = ref('') // busca do header do portal (temporariamente desligada)
const panelFilterQuery = ref('')

/**
 * Busca global do módulo clínico, aberta por `Ctrl/⌘ + K` de qualquer tela.
 *
 * Mora no shell, e não numa página, porque o valor dela é justamente **não depender de onde se
 * está**: quem está perdido não vai primeiro à tela certa para então procurar.
 */
const buscaAberta = ref(false)

/**
 * Assíncrona de propósito.
 *
 * A busca consulta o repositório de pacientes, e um `import` estático arrastaria a camada de
 * dados clínicos inteira — pacientes, agenda, internação, bulário — para o primeiro
 * carregamento de **toda** conta do portal, inclusive as que não têm o módulo. Aqui ela só
 * chega quando o `v-if` do módulo permite montá-la.
 */
const ClinicBuscaGlobal = defineAsyncComponent(
  () => import('@/features/clinico/components/base/ClinicBuscaGlobal.vue'),
)

/** O rótulo da tecla segue a máquina: num Mac, `Ctrl` é a combinação errada e ninguém a usa. */
const atalhoDaBusca = computed(() =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
    ? '⌘K'
    : 'Ctrl+K',
)
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
    /*
     * A moldura clara (30/09/2026): trilho, painel e cabeçalho no branco dos cartões, com fio fino,
     * sobre o fundo das telas. As cores vêm dos tokens do portal (`theme/hc-tokens.css`), que já
     * trocam sozinhos no escuro. O verde fica no logotipo e no que está aberto.
     */
    '--shell-bg': 'var(--hc-fundo)',
    '--shell-surface': 'var(--hc-cartao)',
    '--shell-surface-soft': 'var(--hc-fundo)',
    '--shell-line': 'var(--hc-borda)',
    '--shell-text': 'var(--hc-tinta)',
    '--shell-muted': 'var(--hc-tinta-2)',
    /* O terceiro cinza fica abaixo de 4,5:1 nos rótulos de 11 px do menu: aqui o apagado é o segundo. */
    '--shell-soft': 'var(--hc-tinta-2)',
    '--shell-brand': 'var(--hc-cartao)',
    '--shell-on-brand': 'var(--hc-tinta-2)',
    '--shell-rail-active-bg': 'var(--hc-marca-clara)',
    '--shell-accent': 'var(--hc-marca)',
    '--shell-accent-strong': 'var(--hc-marca-forte)',
    '--shell-accent-soft': 'var(--hc-marca-clara)',
    /** Teal da marca escurecido: superfície cheia com ícone branco por cima, nos dois modos. */
    '--shell-accent-deep': '#1f6457',
    '--shell-nav-active-text': 'var(--hc-marca-forte)',
    '--shell-cream': 'var(--hc-marca-clara)',
    '--shell-shadow-rgb': isDark ? '0 0 0' : '20 32 28',
    /*
     * Tons do selo de pendência do menu: o par pêssego que diz "atenção" nas telas, para o número do
     * menu e o selo da pauta falarem com a mesma cor.
     */
    '--shell-attention': 'var(--hc-pessego-tinta)',
    '--shell-attention-bg': 'var(--hc-pessego-fundo)',
    '--shell-attention-line': 'var(--hc-pessego-fundo)',
    /** Só tinge o chip; quem carrega o significado legível é a tinta abaixo. */
    '--rail-logout-red': 'var(--hc-coral-tinta)',
    /** Ícone sobre o chip tingido do trilho. */
    '--rail-logout-icon': 'var(--hc-coral-tinta)',
    /** "Sair" escrito sobre superfície clara (painel e menu da conta). */
    '--rail-logout-text': colors.dashboard.warmText,
  }
})

/**
 * Seção com uma tela só não abre painel: vira link direto no trilho.
 *
 * "Conta" tem exatamente um destino, e abrir um painel de 18 rem para exibir um único link é
 * gastar meia tela para dizer o que o próprio botão já dizia.
 */
function temPainel(section: NavigationSection) {
  return section.items.length > 1
}

const fallbackSection = computed(
  () =>
    (navigationSections.value.find(temPainel) ??
      navigationSections.value[0]) as NavigationSection,
)

/**
 * Seção mostrada no painel. Na visão geral nenhuma seção está ativa, e o painel **mantém a
 * última** em vez de saltar para a primeira: quem abre o resumo do dia e volta continua no
 * mesmo lugar do menu.
 */
const painelSectionId = ref(fallbackSection.value.id)

const activeSection = computed<NavigationSection>(
  () =>
    navigationSections.value.find((section) => section.id === painelSectionId.value) ??
    fallbackSection.value,
)

const naVisaoGeral = computed(() => activeSectionId.value === OVERVIEW_SECTION_ID)

function isNavItemActive(item: NavigationItem) {
  const { path: itemPath, hash: itemHash } = parseNavTarget(item.to)
  const hashOk = itemHash ? itemHash === route.hash : true

  return navItemMatches(itemPath, route.path) && hashOk
}

/** No modo lista o filtro varre o menu inteiro; no modo seções, só a seção aberta. */
const gruposDoPainel = computed<AppNavigationGroup[]>(() =>
  isListNavigator.value
    ? navigationGroups.value
    : [
        {
          id: activeSection.value.id,
          label: activeSection.value.label,
          items: activeSection.value.items,
          blocos: activeSection.value.blocos,
        },
      ],
)

const filteredNavigationGroups = computed(() =>
  filterNavigationGroups(gruposDoPainel.value, panelFilterQuery.value),
)

/**
 * O filtro só se paga quando há lista para varrer. Com cinco links visíveis ele é mais um campo
 * ocupando altura do que um atalho.
 */
const hasPanelFilter = computed(
  () => gruposDoPainel.value.reduce((total, grupo) => total + grupo.items.length, 0) >= 8,
)

const panelFilterHasNoResults = computed(
  () =>
    panelFilterQuery.value.trim().length > 0 && filteredNavigationGroups.value.length === 0,
)

const activePageLabel = computed(() =>
  resolvePageLabel(route.path, route.hash, navigationSections.value),
)

/**
 * O cabeçalho nomeia a seção **da página aberta**, não a que está no painel.
 *
 * Numa seção sem painel — Conta — o painel segue mostrando a anterior, e o cabeçalho anunciava
 * "Portal · Configurações" enquanto a própria página dizia "Conta".
 */
const activeSectionLabel = computed(() => {
  if (naVisaoGeral.value) {
    return overviewItem.value.label
  }

  const secao = navigationSections.value.find((entry) => entry.id === activeSectionId.value)

  return secao?.label ?? activeSection.value.label
})

function handleSectionChange(sectionId: string) {
  const section =
    navigationSections.value.find((entry) => entry.id === sectionId) ?? fallbackSection.value

  painelSectionId.value = section.id
  panelFilterQuery.value = ''

  if (!compactViewport.value) {
    setRailCollapsed(false)
  }

  const target = getSectionLandingPath(section)

  if (!target) {
    return
  }

  const { path: targetPath, hash: targetHash } = parseNavTarget(target)
  const sameHash = targetHash ? targetHash === route.hash : true

  if (targetPath !== route.path || !sameHash) {
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
  'app-shell--rail-only': panelHidden.value && !isListNavigator.value,
  'app-shell--navigator-hidden': navigatorHidden.value,
  'app-shell--navigator-overlay': compactViewport.value && compactDrawerOpen.value,
  'app-shell--list-nav': isListNavigator.value,
  'app-shell--dense': isCompactDensity.value,
}))

watch(
  () => route.path,
  () => {
    activeSectionId.value = resolveActiveSectionId(route.path, hasClinicalProfile.value)

    const secao = navigationSections.value.find(
      (entry) => entry.id === activeSectionId.value,
    )

    if (secao && temPainel(secao)) {
      painelSectionId.value = secao.id
    }
  },
  { immediate: true },
)

/**
 * Traz o item ativo para a vista quando a lista não cabe inteira.
 *
 * No modo lista são treze telas numa coluna só: num monitor mais baixo o último grupo nasce
 * abaixo da dobra, e quem abre Configurações não vê onde está no menu.
 */
const listaDeNavegacao = ref<HTMLElement | null>(null)

watch(
  () => route.path,
  async () => {
    await nextTick()

    const ativo = listaDeNavegacao.value?.querySelector('.router-link-active')

    ativo?.scrollIntoView({ block: 'nearest' })
  },
)

const userMenu = ref<InstanceType<typeof Popover> | null>(null)

/**
 * O menu do avatar sai da árvore do shell (vai para o `body`), então as variáveis `--shell-*`
 * vão junto — e os tokens do Popover são trocados por elas, para o cartão seguir o do cabeçalho.
 */
const userMenuStyle = computed(() => ({
  ...shellStyle.value,
  '--p-popover-background': 'var(--shell-surface)',
  '--p-popover-border-color': 'var(--shell-line)',
  '--p-popover-border-radius': '1rem',
  '--p-popover-content-padding': '0.45rem',
}))

function toggleUserMenu(event: Event) {
  userMenu.value?.toggle(event)
}

function closeUserMenu() {
  userMenu.value?.hide()
}

function requestLogout() {
  closeUserMenu()
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
  closeUserMenu()
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
  compactQuery?.removeEventListener('change', handleViewportChange)
  window.removeEventListener('keydown', handleShellKeydown)
})
</script>

<template>
  <div class="app-shell" :class="shellClasses" :style="shellStyle">
    <Button
      v-if="compactViewport && compactDrawerOpen"
      class="navigator-scrim"
      type="button"
      text
      severity="secondary"
      :aria-label="t('shell.drawer.close')"
      @click="closeCompactDrawer"
    />

    <aside class="app-navigator" :inert="navigatorHidden || undefined">
      <nav
        v-if="!isListNavigator"
        class="section-rail"
        :aria-label="t('shell.aria.sections')"
      >
        <RouterLink
          class="rail-brand"
          :to="defaultLandingPath"
          :aria-label="t('shell.aria.brand')"
          @click="closeCompactDrawer"
        >
          <img :src="logoMarkUrl" alt="" />
        </RouterLink>

        <!--
          A visão geral é destino, não seção: link direto. Como seção, o painel dela repetia
          todas as outras e o menu duplicava doze itens.
        -->
        <RouterLink
          class="rail-button"
          :class="{ 'rail-button--active': naVisaoGeral }"
          :to="overviewItem.to"
          :aria-current="naVisaoGeral ? 'page' : undefined"
          :title="overviewItem.label"
          active-class=""
          @click="closeCompactDrawer"
        >
          <span class="rail-button__icon" aria-hidden="true">
            <i :class="overviewItem.icon" />
          </span>
          <span class="rail-button__label">{{ overviewItem.label }}</span>
        </RouterLink>

        <span class="rail-divider" aria-hidden="true" />

        <template v-for="section in navigationSections" :key="section.id">
          <Button
            v-if="temPainel(section)"
            class="rail-button"
            :class="{ 'rail-button--active': activeSectionId === section.id }"
            type="button"
            text
            severity="secondary"
            :aria-current="activeSectionId === section.id ? 'true' : undefined"
            :title="section.label"
            @click="handleSectionChange(section.id)"
          >
            <span class="rail-button__icon" aria-hidden="true">
              <i :class="section.icon" />
            </span>
            <span class="rail-button__label">{{ section.label }}</span>
          </Button>

          <RouterLink
            v-else
            class="rail-button"
            :class="{ 'rail-button--active': activeSectionId === section.id }"
            :to="section.items[0]?.to ?? '/'"
            :aria-current="activeSectionId === section.id ? 'page' : undefined"
            :title="section.label"
            active-class=""
            @click="closeCompactDrawer"
          >
            <span class="rail-button__icon" aria-hidden="true">
              <i :class="section.icon" />
            </span>
            <span class="rail-button__label">{{ section.label }}</span>
          </RouterLink>
        </template>

        <div class="rail-bottom-actions">
          <Button
            class="rail-action rail-action--collapse"
            type="button"
            text
            severity="secondary"
            icon="pi pi-angle-double-left"
            :aria-label="railCollapsed ? t('shell.drawer.expand') : t('shell.drawer.collapse')"
            :title="railCollapsed ? t('shell.drawer.expand') : t('shell.drawer.collapse')"
            :aria-expanded="!railCollapsed"
            @click="toggleNavigator"
          />

          <Button
            class="rail-action rail-action--danger"
            type="button"
            text
            severity="secondary"
            icon="pi pi-sign-out"
            :aria-label="t('shell.logout')"
            :title="t('shell.logout')"
            @click="requestLogout"
          />
        </div>
      </nav>

      <section class="navigator-panel" :inert="panelHidden || undefined">
        <!--
          A marca só aparece aqui quando não há trilho: com os dois, o mesmo logotipo nascia
          duas vezes lado a lado.
        -->
        <header v-if="isListNavigator" class="navigator-brand">
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

        <!--
          Cabeçalho do painel: ícone da seção, nome e quantas telas ela tem.
          O rótulo do trilho é uma micro-legenda de 9px sob o ícone; este é o título de verdade,
          e é ele que ancora a coluna na altura do cabeçalho da página.
        -->
        <header v-if="!isListNavigator" class="navigator-section-heading">
          <span class="navigator-section-heading__icone" aria-hidden="true">
            <i :class="activeSection.icon" />
          </span>
          <span class="navigator-section-heading__texto">
            <strong>{{ activeSection.label }}</strong>
            <small>
              {{ t('shell.telasNaSecao', { contagem: activeSection.items.length }, activeSection.items.length) }}
            </small>
          </span>
        </header>

        <AppNavLink
          v-if="isListNavigator"
          :item="overviewItem"
          :ativo="naVisaoGeral"
          destaque
          :rotulo-bloqueado="t('frame.suspended.title')"
          :rotulo-em-breve="t('comingSoon.cupom.badge')"
          @clique="closeCompactDrawer"
        />

        <div v-if="hasPanelFilter" class="page-nav__filter">
          <IconField class="page-nav__filter-field">
            <InputIcon class="pi pi-search" />
            <InputText
              id="panel-nav-filter"
              v-model="panelFilterQuery"
              type="search"
              size="small"
              fluid
              :placeholder="t('shell.filterPlaceholder')"
              :aria-label="t('shell.filterPlaceholder')"
              autocomplete="off"
            />
          </IconField>
          <Button
            v-if="panelFilterQuery"
            class="page-nav__filter-clear"
            type="button"
            text
            rounded
            severity="secondary"
            icon="pi pi-times"
            :aria-label="t('shell.filterClear')"
            :title="t('shell.filterClear')"
            @click="panelFilterQuery = ''"
          />
        </div>

        <nav
          ref="listaDeNavegacao"
          class="page-nav"
          :aria-label="t('shell.aria.pagesOf', { label: activeSection.label })"
        >
          <p v-if="panelFilterHasNoResults" class="page-nav__empty">
            {{ t('shell.filterEmpty', { q: panelFilterQuery.trim() }) }}
          </p>

          <div
            v-for="group in filteredNavigationGroups"
            :key="group.id"
            class="page-nav__group"
          >
            <!--
              O rótulo do grupo só serve quando há mais de um. Numa seção só, ele repetiria o
              nome que o trilho e o cabeçalho já mostram.
            -->
            <p v-if="isListNavigator" class="page-nav__group-label">{{ group.label }}</p>

            <!--
              Seção com blocos — hoje a Clínica, com dez destinos. Sem os rótulos, os dez ficam
              numa lista plana em que descobrir qual responde à pergunta do momento exige ler os
              dez. Nada saiu da lista: ela só deixou de exigir leitura inteira.
            -->
            <template v-if="group.blocos">
              <div
                v-for="bloco in group.blocos"
                :key="`${group.id}-${bloco.id}`"
                class="page-nav__bloco"
              >
                <p class="page-nav__group-label page-nav__group-label--bloco">
                  {{ bloco.label }}
                </p>

                <AppNavLink
                  v-for="item in bloco.items"
                  :key="`${group.id}-${item.to}`"
                  :item="item"
                  :ativo="isNavItemActive(item)"
                  :rotulo-bloqueado="t('frame.suspended.title')"
                  :rotulo-em-breve="t('comingSoon.cupom.badge')"
                  @clique="handleNavItemClick($event, item)"
                />
              </div>
            </template>

            <AppNavLink
              v-for="item in group.blocos ? [] : group.items"
              :key="`${group.id}-${item.to}`"
              :item="item"
              :ativo="isNavItemActive(item)"
              :rotulo-bloqueado="t('frame.suspended.title')"
              :rotulo-em-breve="t('comingSoon.cupom.badge')"
              @clique="handleNavItemClick($event, item)"
            />
          </div>
        </nav>

        <!-- Sem trilho, sair precisa de um lugar. -->
        <div v-if="isListNavigator" class="panel-bottom-actions">
          <Button
            class="panel-action"
            type="button"
            text
            severity="secondary"
            icon="pi pi-sign-out"
            :label="t('shell.logout')"
            @click="requestLogout"
          />
        </div>
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
        <!--
          O cronômetro só existe para quem atende: é tempo clínico faturável, não um relógio de
          ponto. Num perfil sem agenda ele seria um botão que não mede nada.
        -->
        <CronometroConsulta v-if="hasClinicalProfile" />

        <!--
          A busca do módulo clínico.

          O campo do portal continua desligado — ele nunca teve o que buscar. Este botão abre a
          busca do módulo, que tem: as doze telas e os pacientes com história. Aparece só para
          quem vê o módulo, porque fora dele ele abriria uma janela vazia.

          É botão e não campo de propósito: um campo permanente no cabeçalho promete busca em
          toda tela do portal, e a promessa vale só dentro da clínica.
        -->
        <Button
          v-if="hasClinicalProfile"
          class="header-search header-search--botao"
          type="button"
          text
          severity="secondary"
          :title="t('clinico.busca.abrir')"
          :aria-label="t('clinico.busca.abrir')"
          @click="buscaAberta = true"
        >
          <i class="pi pi-search" aria-hidden="true" />
          <span class="header-search__texto">{{ t('clinico.busca.abrirCurto') }}</span>
          <kbd class="header-search__tecla">{{ atalhoDaBusca }}</kbd>
        </Button>

        <Button
          class="header-resgate"
          type="button"
          text
          severity="secondary"
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
        </Button>

        <div class="user-menu">
          <Button
            class="user-menu__trigger"
            type="button"
            text
            severity="secondary"
            :aria-expanded="userMenuOpen"
            aria-haspopup="menu"
            :aria-controls="userMenuOpen ? 'user-menu-dropdown' : undefined"
            @click="toggleUserMenu"
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
          </Button>

          <!--
            Popover no `body`: fecha no clique fora e no Esc, o que o menu à mão não fazia. As
            variáveis `--shell-*` seguem junto pelo `style`, já que o overlay sai da árvore do shell.
          -->
          <Popover
            ref="userMenu"
            class="user-menu__popover"
            :style="userMenuStyle"
            @show="userMenuOpen = true"
            @hide="userMenuOpen = false"
          >
            <div id="user-menu-dropdown" class="user-menu__dropdown" role="menu">
              <RouterLink role="menuitem" to="/settings?aba=perfil" @click="closeUserMenu">
                <i class="pi pi-user" aria-hidden="true" />
                {{ t('shell.user.perfil') }}
              </RouterLink>
              <RouterLink role="menuitem" to="/settings" @click="closeUserMenu">
                <i class="pi pi-cog" aria-hidden="true" />
                {{ t('shell.user.settings') }}
              </RouterLink>
              <RouterLink role="menuitem" to="/parceiro/selecionar" @click="closeUserMenu">
                <i class="pi pi-building" aria-hidden="true" />
                {{ t('shell.user.trocarEmpresa') }}
              </RouterLink>
              <div class="user-menu__locale" role="none">
                <span class="user-menu__locale-label">{{ t('languageSwitcher.label') }}</span>
                <LanguageSwitcher variant="menu" />
              </div>
              <div class="user-menu__tema" role="none">
                <i class="pi pi-moon" aria-hidden="true" />
                <label class="user-menu__tema-rotulo" for="user-menu-tema">
                  {{ t('shell.theme.darkTitle') }}
                </label>
                <ToggleSwitch
                  input-id="user-menu-tema"
                  :model-value="isDarkMode"
                  @update:model-value="alternarTema"
                />
              </div>
              <Button
                class="user-menu__logout"
                type="button"
                role="menuitem"
                text
                severity="danger"
                icon="pi pi-sign-out"
                :label="t('shell.user.logout')"
                @click="requestLogout"
              />
            </div>
          </Popover>
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

    <!--
      A busca do módulo clínico vive no shell porque o valor dela é não depender de onde se
      está. Só é montada para quem vê o módulo — fora dele, ela abriria uma janela vazia e
      arrastaria a camada de dados clínicos para o pacote de quem nunca vai usá-la.
    -->
    <ClinicBuscaGlobal
      v-if="hasClinicalProfile"
      :aberto="buscaAberta"
      :secoes="navigationSections"
      @fechar="buscaAberta = false"
    />
  </div>
</template>

<style scoped>
.app-shell {
  --navigator-width: 18rem;
  --navigator-rail: 4.6rem;
  --navigator-offset: var(--navigator-width);
  /* Uma medida governa a altura da linha do menu; a densidade troca só ela. */
  --nav-row-height: 2.4rem;
  --nav-row-gap: 0.12rem;
  --nav-group-gap: 0.9rem;
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

/** Lista única: sem trilho, a coluna inteira é o menu. */
.app-shell--list-nav {
  --navigator-rail: 0rem;
  --navigator-width: 16.5rem;
}

.app-shell--dense {
  --navigator-width: 16.25rem;
  --nav-row-height: 2rem;
  --nav-row-gap: 0.02rem;
  --nav-group-gap: 0.62rem;
}

.app-shell--dense.app-shell--list-nav {
  --navigator-width: 15rem;
}

.app-shell--navigator-hidden {
  --navigator-offset: 0rem;
}

.navigator-scrim.p-button,
.navigator-scrim.p-button:not(:disabled):hover,
.navigator-scrim.p-button:not(:disabled):active {
  position: fixed;
  z-index: 45;
  inset: 0;
  width: auto;
  height: auto;
  padding: 0;
  border: 0;
  border-radius: 0;
  background: rgb(var(--shell-shadow-rgb) / 0.42);
}

.app-navigator {
  position: fixed;
  z-index: 50;
  inset-block: 0;
  inset-inline: 0 auto;
  display: grid;
  width: var(--navigator-width);
  height: 100vh;
  grid-template-columns: var(--navigator-rail) calc(var(--navigator-width) - var(--navigator-rail));
  overflow: hidden;
  border-inline-end: 1px solid var(--shell-line);
  background: var(--shell-surface);
  transition:
    width 220ms var(--navigator-ease),
    transform 220ms var(--navigator-ease);
}

.app-shell--rail-only .app-navigator {
  width: var(--navigator-rail);
}

/**
 * Sem o trilho no DOM, o painel caía na primeira coluna do grid — que vale zero — e o menu
 * inteiro renderizava numa faixa branca vazia. Uma coluna só quando não há trilho.
 */
.app-shell--list-nav .app-navigator {
  grid-template-columns: minmax(0, 1fr);
}

.app-shell--navigator-hidden .app-navigator {
  transform: translateX(-100%);
}

[dir='rtl'] .app-shell--navigator-hidden .app-navigator {
  transform: translateX(100%);
}

.app-shell--navigator-overlay .app-navigator {
  box-shadow: 18px 0 48px rgb(var(--shell-shadow-rgb) / 0.22);
}

[dir='rtl'] .app-shell--navigator-overlay .app-navigator {
  box-shadow: -18px 0 48px rgb(var(--shell-shadow-rgb) / 0.22);
}

.section-rail {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 0.2rem;
  padding: 0.9rem 0.42rem 0.7rem;
  border-inline-end: 1px solid var(--shell-line);
  background: var(--shell-brand);
}

/* O logotipo é a única superfície verde da moldura: a pata clara sobre o degradê da pílula cheia. */
.rail-brand {
  --marca-sombra: 0 6px 16px -8px rgb(31 100 87 / 70%);

  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  margin: 0 auto 0.9rem;
  place-items: center;
  border-radius: 0.85rem;
  background: var(--hc-degrade-botao);
  box-shadow: var(--marca-sombra);
  transition: box-shadow 160ms ease-out;
}

.rail-brand:hover {
  --marca-sombra: 0 10px 22px -8px rgb(31 100 87 / 80%);
}

.rail-brand img {
  width: 1.45rem;
  height: 1.45rem;
  object-fit: contain;
}

/* Seções com painel são `Button`; a de destino único é `RouterLink`. As duas leem igual. */
.rail-button,
.rail-button.p-button {
  position: relative;
  display: grid;
  width: 100%;
  gap: 0.2rem;
  justify-items: center;
  padding: 0.5rem 0.15rem 0.42rem;
  border: 0;
  border-radius: 0.85rem;
  background: transparent;
  color: var(--shell-on-brand);
  font-size: inherit;
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

.rail-button:hover,
.rail-button.p-button:not(:disabled):hover,
.rail-button.p-button:not(:disabled):active {
  border: 0;
  background: var(--hc-linha);
  color: var(--shell-text);
}

/**
 * Seção aberta: a pastilha verde-clara, com a tinta forte da marca.
 *
 * Havia também uma barrinha em `left: -0.42rem` — exatamente a medida do respiro do trilho, o
 * que a punha em cima da borda da janela e a fazia parecer falha de renderização. A pastilha já
 * distingue por **forma**, não só por cor, então a barra saiu em vez de ser empurrada para dentro
 * e brigar com o próprio pill.
 */
.rail-button--active,
.rail-button--active:hover,
.rail-button--active.p-button,
.rail-button--active.p-button:not(:disabled):hover,
.rail-button--active.p-button:not(:disabled):active {
  background: var(--shell-rail-active-bg);
  color: var(--shell-nav-active-text);
}

/** Separa o destino único (visão geral) das seções, que abrem painel. */
.rail-divider {
  display: block;
  width: 1.65rem;
  height: 1px;
  margin: 0.42rem auto;
  background: var(--shell-line);
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
  background: var(--shell-line);
  content: '';
}

/* Contornadas, como os controles do cabeçalho: no trilho branco, um fundo só tingido sumia. */
.rail-action.p-button {
  width: 2.35rem;
  height: 2.35rem;
  padding: 0;
  border: 1px solid var(--shell-line);
  border-radius: 999px;
  background: var(--shell-surface);
  color: var(--shell-muted);
  font-size: 0.92rem;
  transition:
    background 160ms ease,
    border-color 160ms ease,
    color 160ms ease;
}

.rail-action.p-button:not(:disabled):hover,
.rail-action.p-button:not(:disabled):active {
  border-color: color-mix(in srgb, var(--shell-accent) 45%, var(--shell-line));
  background: var(--shell-surface);
  color: var(--shell-text);
}

.rail-action--collapse :deep(.p-button-icon) {
  transition: transform 220ms var(--navigator-ease);
}

.app-shell--rail-only .rail-action--collapse :deep(.p-button-icon) {
  transform: rotate(180deg);
}

/*
 * Sair, no trilho. O chip tinge, a tinta informa — e a tinta não se mistura ao coral: era
 * exatamente essa mistura que devolvia o ícone ao pastel e o fazia sumir no fundo.
 */
.rail-action--danger.p-button {
  border-color: transparent;
  background: var(--hc-coral-fundo);
  color: var(--rail-logout-icon);
}

.rail-action--danger.p-button:not(:disabled):hover,
.rail-action--danger.p-button:not(:disabled):active {
  border-color: color-mix(in srgb, var(--rail-logout-red) 45%, transparent);
  background: var(--hc-coral-fundo);
  color: var(--rail-logout-icon);
}

.rail-button:focus-visible,
.rail-action:focus-visible {
  box-shadow: none;
  outline: 2px solid var(--shell-accent);
  outline-offset: 2px;
}

/* O logotipo guarda a sombra dele; o anel de foco é o contorno. */
.rail-brand:focus-visible {
  outline: 2px solid var(--shell-accent);
  outline-offset: 2px;
}

.navigator-panel {
  display: flex;
  min-height: 0;
  flex-direction: column;
  overflow: hidden;
  padding: 0 0.75rem 0.55rem;
  background: var(--shell-surface);
  opacity: 1;
  transition: opacity 160ms ease;
}

/** Sem trilho, "sair" perde o lugar dele; volta ao pé da coluna. */
.panel-bottom-actions {
  flex-shrink: 0;
  padding-top: 0.5rem;
  border-top: 1px solid var(--shell-line);
}

.panel-action.p-button {
  display: flex;
  width: 100%;
  justify-content: flex-start;
  gap: 0.6rem;
  min-height: var(--nav-row-height);
  padding: 0 0.6rem;
  border: 0;
  border-radius: 0.6rem;
  background: transparent;
  color: var(--shell-muted);
  font-size: 0.83rem;
  text-align: start;
}

.panel-action :deep(.p-button-label) {
  font-weight: 600;
}

.panel-action :deep(.p-button-icon) {
  width: 1.15rem;
  font-size: 0.9rem;
}

.panel-action.p-button:not(:disabled):hover,
.panel-action.p-button:not(:disabled):active {
  border: 0;
  background: color-mix(in srgb, var(--rail-logout-red) 10%, transparent);
  color: var(--rail-logout-text);
}

.panel-action.p-button:focus-visible {
  box-shadow: none;
  outline: 2px solid color-mix(in srgb, var(--shell-accent) 55%, transparent);
  outline-offset: 2px;
}

.app-shell--rail-only .navigator-panel {
  opacity: 0;
}

.navigator-brand__link {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
  justify-items: start;
  padding: 0.35rem 0.45rem;
  border-radius: 0.7rem;
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

/**
 * O topo do painel ocupa exatamente a altura do cabeçalho e fecha com a mesma linha.
 *
 * Sem isso o primeiro item do menu nascia no meio da faixa do cabeçalho, e a régua horizontal
 * que atravessa a tela morria na borda do navegador.
 */
.navigator-section-heading,
.navigator-brand {
  display: flex;
  height: var(--header-height);
  flex-shrink: 0;
  align-items: center;
  margin: 0 -0.75rem 0.7rem;
  padding: 0 1.35rem;
  box-shadow: 0 1px 0 var(--shell-line);
}

.navigator-section-heading {
  gap: 0.65rem;
}

/** Único ladrilho preenchido do cabeçalho: dá peso ao título sem repetir caixa em cada item. */
.navigator-section-heading__icone {
  display: grid;
  width: 2rem;
  height: 2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.65rem;
  background: var(--shell-cream);
  color: var(--shell-accent-strong);
  font-size: 0.85rem;
}

.navigator-section-heading__texto {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.navigator-section-heading__texto strong {
  overflow: hidden;
  color: var(--shell-text);
  font-size: 0.95rem;
  font-weight: 750;
  letter-spacing: -0.015em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.navigator-section-heading__texto small {
  color: var(--shell-soft);
  font-size: 0.7rem;
  font-weight: 600;
}

.header-context span {
  color: var(--shell-soft);
  font-size: 0.64rem;
  font-weight: 600;
  letter-spacing: 0.13em;
  text-transform: uppercase;
}

.page-nav {
  display: grid;
  min-height: 0;
  flex: 1 1 auto;
  align-content: start;
  gap: var(--nav-row-gap);
  overflow-y: auto;
  padding-block: 0.1rem 0.75rem;
  padding-inline: 0 0.25rem;
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
  padding-inline-end: 0.25rem;
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

/*
 * O campo do PrimeVue perde a caixa própria: quem desenha a borda e o anel de foco é o
 * `.page-nav__filter`, que também abraça o botão de limpar.
 */
.page-nav__filter-field {
  min-width: 0;
  flex: 1 1 auto;
  color: var(--shell-soft);
}

.page-nav__filter-field :deep(.p-inputicon) {
  color: inherit;
  font-size: 0.8rem;
}

.page-nav__filter-field :deep(.p-inputtext),
.page-nav__filter-field :deep(.p-inputtext:enabled:hover),
.page-nav__filter-field :deep(.p-inputtext:enabled:focus) {
  padding-block: 0.55rem;
  padding-inline-end: 0.35rem;
  border: 0;
  background: transparent;
  box-shadow: none;
  color: var(--shell-text);
  font-size: 0.82rem;
  outline: none;
}

.page-nav__filter-field :deep(.p-inputtext::-webkit-search-cancel-button) {
  appearance: none;
}

.page-nav__filter-field :deep(.p-inputtext::placeholder) {
  color: var(--shell-soft);
}

.page-nav__filter-clear.p-button {
  width: 1.5rem;
  height: 1.5rem;
  flex: 0 0 auto;
  padding: 0;
  color: var(--shell-muted);
  font-size: 0.68rem;
}

.page-nav__filter-clear.p-button:not(:disabled):hover,
.page-nav__filter-clear.p-button:not(:disabled):active {
  background: color-mix(in srgb, var(--shell-muted) 16%, transparent);
  color: var(--shell-text);
}

.page-nav__filter-clear :deep(.p-button-icon) {
  font-size: inherit;
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
  gap: var(--nav-row-gap);
}

.page-nav__group + .page-nav__group {
  margin-top: var(--nav-group-gap);
}

/** Fio à direita do rótulo: separa os grupos sem gastar mais altura entre eles. */
.page-nav__group-label {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0 0 0.35rem;
  padding: 0 0.6rem;
  color: var(--shell-soft);
  font-size: 0.62rem;
  font-weight: 700;
  letter-spacing: 0.11em;
  text-transform: uppercase;
}

.page-nav__group-label::after {
  height: 1px;
  flex: 1 1 auto;
  background: var(--shell-line);
  content: '';
}

.page-nav__bloco {
  display: grid;
  gap: var(--nav-row-gap);
}

/*
 * O ar entre blocos é o que faz a divisão funcionar. Sem ele, quatro rótulos e dez linhas
 * viram uma coluna contínua com quatro palavras em maiúscula no meio — e a lista continua
 * pedindo leitura inteira, que é o problema que os blocos existem para resolver.
 */
.page-nav__bloco + .page-nav__bloco {
  margin-top: var(--nav-group-gap);
}

/*
 * O rótulo do bloco é meio degrau abaixo do rótulo da seção: mesma família, menos peso e sem o
 * fio à direita. O fio separa **seções**, e repeti-lo aqui poria a mesma marca de fim de assunto
 * dentro de um assunto só.
 */
.page-nav__group-label--bloco {
  margin-bottom: 0.15rem;
  color: var(--shell-soft);
  font-size: 0.6rem;
  letter-spacing: 0.13em;
  opacity: 0.9;
}

.page-nav__group-label--bloco::after {
  background: color-mix(in srgb, var(--shell-line) 55%, transparent);
}

.app-header {
  position: fixed;
  z-index: 40;
  top: 0;
  inset-inline-end: 0;
  inset-inline-start: var(--navigator-offset);
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

[dir='rtl'] .app-header {
  transition: right 220ms var(--navigator-ease);
}

/*
 * Entre o estreito e o largo, com o painel aberto, o título da página e os quatro controles não
 * cabem juntos. Quem cede é a busca, que vira o mesmo botão de ícone do estreito; o título fica
 * inteiro. Medido no próprio cabeçalho, e não na janela, para seguir o painel aberto ou recolhido.
 */
.app-header {
  container-type: inline-size;
}

@container (max-width: 66rem) {
  .header-search__texto,
  .header-search__tecla {
    display: none;
  }

  .header-search.p-button {
    width: 2.5rem;
    min-width: 2.5rem;
    padding: 0;
    justify-content: center;
  }
}

.app-header__left,
.app-header__right {
  display: flex;
  align-items: center;
  gap: 0.85rem;
}

/*
 * Os controles do cabeçalho são pílulas, como as ações da Visão geral: contorno fino, sombra baixa
 * e, no hover, o contorno puxa para a marca. A sombra mora numa variável para o hover trocar só
 * ela e não apagar o anel de foco.
 */
.header-icon-button,
.header-search,
.header-resgate.p-button,
.user-menu__trigger.p-button {
  --controle-sombra: 0 1px 2px rgb(var(--shell-shadow-rgb) / 5%);

  border: 1px solid var(--shell-line);
  border-radius: 999px;
  box-shadow: var(--controle-sombra);
}

.header-icon-button:not(:disabled):hover,
.header-search--botao.p-button:not(:disabled):hover,
.header-resgate.p-button:not(:disabled):hover,
.user-menu__trigger.p-button:not(:disabled):hover {
  --controle-sombra: 0 4px 12px -6px rgb(var(--shell-shadow-rgb) / 25%);
}

.header-icon-button {
  width: 2.5rem;
  height: 2.5rem;
  background: var(--shell-surface) !important;
  color: var(--shell-text) !important;
  line-height: 1 !important;
}

.header-icon-button:not(:disabled):hover {
  border-color: color-mix(in srgb, var(--shell-accent) 45%, var(--shell-line));
}

.header-search {
  display: inline-flex;
  width: min(16rem, 24vw);
  min-width: 10.5rem;
  height: 2.5rem;
  align-items: center;
  gap: 0.55rem;
  padding: 0 0.95rem;
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

/*
 * A busca do módulo herda a caixa do campo do portal de propósito: é o mesmo lugar, o mesmo
 * tamanho e o mesmo ícone que o cabeçalho sempre teve — só que agora abre algo.
 */
.header-search--botao.p-button {
  justify-content: flex-start;
  border: 1px solid var(--shell-line);
  background: var(--shell-surface);
  color: var(--shell-soft);
  font-size: inherit;
  text-align: start;
  transition:
    border-color 150ms ease-out,
    box-shadow 150ms ease-out,
    color 150ms ease-out;
}

.header-search--botao.p-button:not(:disabled):hover,
.header-search--botao.p-button:not(:disabled):active {
  border-color: color-mix(in srgb, var(--shell-accent) 45%, var(--shell-line));
  background: var(--shell-surface);
  color: var(--shell-text);
}

.header-search--botao.p-button:focus-visible {
  box-shadow: none;
  outline: 2px solid color-mix(in srgb, var(--shell-accent) 55%, transparent);
  outline-offset: 2px;
}

.header-search__texto {
  overflow: hidden;
  flex: 1 1 auto;
  font-size: 0.84rem;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* A tecla é pista, não botão: some no toque, onde não existe atalho de teclado nenhum. */
.header-search__tecla {
  flex: 0 0 auto;
  padding: 0.1rem 0.35rem;
  border: 1px solid var(--shell-line);
  border-radius: 6px;
  background: var(--shell-surface-soft);
  color: var(--shell-soft);
  font-family: inherit;
  font-size: 0.66rem;
  font-weight: 700;
}

@media (pointer: coarse) {
  .header-search__tecla {
    display: none;
  }
}

.header-resgate.p-button {
  gap: 0.5rem;
  min-height: 2.5rem;
  padding-block: 0.22rem;
  padding-inline: 0.25rem 0.85rem;
  background: var(--shell-surface);
  color: var(--shell-text);
  font-size: 0.78rem;
  font-weight: 700;
  transition:
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}

.header-resgate.p-button:not(:disabled):hover,
.header-resgate.p-button:not(:disabled):active {
  background: var(--shell-surface);
  border-color: color-mix(in srgb, var(--shell-accent) 45%, var(--shell-line));
  color: var(--shell-text);
}

.header-resgate.p-button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.header-resgate__icon {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 999px;
  background: var(--shell-cream);
  color: var(--shell-accent-strong);
  font-size: 0.86rem;
}

.header-resgate__label {
  line-height: 1;
  white-space: nowrap;
}

.header-resgate__soon {
  margin-inline-start: 0.15rem;
  padding: 0.12rem 0.4rem;
  border-radius: 6px;
  background: var(--shell-cream);
  color: var(--shell-accent-strong);
  font-size: 0.62rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  line-height: 1.2;
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .app-navigator,
  .app-header,
  .app-content,
  .navigator-panel,
  .rail-action--collapse :deep(.p-button-icon),
  html[dir='rtl'] .app-header,
  html[dir='rtl'] .app-content {
    transition: none;
  }
}

.header-context {
  display: grid;
  gap: 0.1rem;
}

/*
 * O título da página numa linha só: quem cede espaço é a busca, que é elástica. As reticências
 * são só a última defesa; no estreito o contexto inteiro some (ver o fim deste arquivo).
 */
.header-context strong {
  overflow: hidden;
  color: var(--shell-text);
  font-size: 0.95rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.app-content {
  min-height: 100vh;
  max-width: 100%;
  padding-top: var(--header-height);
  padding-inline-start: var(--navigator-offset);
  /* Painéis laterais não-modais empurram o conteúdo (var setada por useSidePanelOffset) */
  padding-inline-end: var(--pj-side-panel-offset, 0px);
  overflow-x: clip;
  transition:
    padding-left 220ms var(--navigator-ease),
    padding-right 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

/* Em RTL os lados físicos se invertem; as durações acompanham cada lado lógico. */
[dir='rtl'] .app-content {
  transition:
    padding-right 220ms var(--navigator-ease),
    padding-left 0.5s cubic-bezier(0.32, 0.72, 0, 1);
}

.user-menu {
  position: relative;
}

.user-menu__trigger.p-button {
  gap: 0.65rem;
  min-height: 2.65rem;
  padding-block: 0.25rem;
  padding-inline: 0.25rem 0.75rem;
  background: var(--shell-surface);
  color: var(--shell-text);
  font-size: inherit;
  line-height: 1;
  transition:
    border-color 150ms ease-out,
    box-shadow 150ms ease-out;
}

.user-menu__trigger.p-button:not(:disabled):hover,
.user-menu__trigger.p-button:not(:disabled):active {
  border-color: color-mix(in srgb, var(--shell-accent) 45%, var(--shell-line));
  background: var(--shell-surface);
  color: var(--shell-text);
}

.user-avatar {
  display: grid;
  width: 2.1rem;
  height: 2.1rem;
  place-items: center;
  overflow: hidden;
  border-radius: 999px;
  background: var(--shell-cream);
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

/* A caixa (borda, raio, fundo, respiro) vem do Popover, com os tokens em `userMenuStyle`. */
.user-menu__dropdown {
  display: grid;
  min-width: 13rem;
}

.user-menu__dropdown > a,
.user-menu__logout.p-button {
  display: flex;
  align-items: center;
  justify-content: flex-start;
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
  text-align: start;
  text-decoration: none;
  cursor: pointer;
}

.user-menu__logout :deep(.p-button-label) {
  font-weight: 600;
}

.user-menu__dropdown > a:hover,
.user-menu__logout.p-button:not(:disabled):hover,
.user-menu__logout.p-button:not(:disabled):active {
  border: 0;
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

/* O tema: uma linha do menu, com o rótulo e o interruptor, logo abaixo do idioma. */
.user-menu__tema {
  /* O interruptor nas cores da moldura (o mesmo de `.hc-tema`), e não no linho do preset. */
  --p-toggleswitch-background: color-mix(in srgb, var(--hc-tinta-3) 45%, var(--hc-cartao));
  --p-toggleswitch-hover-background: color-mix(in srgb, var(--hc-tinta-3) 60%, var(--hc-cartao));
  --p-toggleswitch-checked-background: var(--hc-marca);
  --p-toggleswitch-checked-hover-background: var(--hc-marca-forte);
  --p-toggleswitch-handle-background: #ffffff;
  --p-toggleswitch-handle-hover-background: #ffffff;
  --p-toggleswitch-handle-checked-background: #ffffff;
  --p-toggleswitch-handle-checked-hover-background: #ffffff;

  display: flex;
  align-items: center;
  gap: 0.65rem;
  min-height: 2.55rem;
  padding: 0 0.75rem;
  margin-block-end: 0.2rem;
  border-block-end: 1px solid var(--shell-line);
  color: var(--shell-text);
}

.user-menu__tema > .pi {
  color: var(--shell-muted);
}

.user-menu__tema-rotulo {
  flex: 1 1 auto;
  font-size: 0.9rem;
  font-weight: 600;
  cursor: pointer;
}

.user-menu__logout.p-button,
.user-menu__logout.p-button:not(:disabled):hover,
.user-menu__logout.p-button:not(:disabled):active {
  color: var(--rail-logout-text);
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
    padding-inline-end: 0;
  }

  .user-menu__identity,
  .header-context,
  .header-search input,
  .header-search__texto,
  .header-search__tecla,
  .header-resgate__label,
  .header-resgate__soon {
    display: none;
  }

  .header-resgate.p-button {
    padding: 0.22rem;
  }

  .header-search.p-button {
    width: 2.5rem;
    min-width: 2.5rem;
    padding: 0;
    justify-content: center;
  }
}
</style>
