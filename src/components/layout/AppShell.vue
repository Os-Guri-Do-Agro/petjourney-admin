<script setup lang="ts">
import Button from 'primevue/button'
import Popover from 'primevue/popover'
import ToggleSwitch from 'primevue/toggleswitch'
import { computed, defineAsyncComponent, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import logoDarkUrl from '@/assets/Logos/logo-for-dark-theme.png'
import ComingSoonFeatureDialog from '@/components/common/ComingSoonFeatureDialog.vue'
import AppNavLink from '@/components/layout/AppNavLink.vue'
import ConfirmActionDialog from '@/components/common/ConfirmActionDialog.vue'
import LanguageSwitcher from '@/components/common/LanguageSwitcher.vue'
import FeedbackSaqueDialog from '@/components/parceiro/FeedbackSaqueDialog.vue'
import ValidarCupomDialog from '@/components/parceiro/ValidarCupomDialog.vue'
import {
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
import { CUPOM_FEATURE_ENABLED } from '@/features/cupom-feature'
import { getAuthUser } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'
import { useUsuarioPerfilStore } from '@/stores/usuario-perfil'
import { currentColors, isDarkMode, toggleColorMode } from '@/theme/color-mode'
import { lugarDaSecao, useDesignTrilha } from '@/theme/trilha/rotas'
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
const { visible: cupomComingSoonVisible, open: openCupomComingSoon } = useCupomComingSoon()
const { navigationSections, navigationGroups, overviewItem, hasClinicalProfile } =
  useAppNavigation()
const { logout } = useLogout()
const cupomFeatureEnabled = CUPOM_FEATURE_ENABLED
const activeSectionId = ref(OVERVIEW_SECTION_ID)
const defaultLandingPath = computed(() => getDefaultLandingPath())
/**
 * A tela aberta está no design Trilha (`theme/trilha/rotas.ts`)? Então a moldura veste a pele dele:
 * trilho escuro com o lugar aceso, painel na cor do lugar e, no cabeçalho, a trilha no lugar do
 * rótulo. O comportamento é o mesmo; muda só o que se vê.
 */
const trilhaAtiva = useDesignTrilha()
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
  compactViewport.value ? !compactDrawerOpen.value : isListNavigator.value && railCollapsed.value,
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
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl+K',
)
const authUser = computed(() => getAuthUser())
/*
 * A pata do trilho: no claro, a pata sálvia num ladrilho branco (sobre a moldura sálvia, a pata
 * sálvia num ladrilho sálvia sumia); no escuro, a pata clara sobre o ladrilho sálvia da ação cheia.
 */
const logoMarkUrl = computed(() =>
  trilhaAtiva.value || !isDarkMode.value ? '/pata-escura.png' : '/pata-clara.png',
)
/* O logotipo de letra clara; na moldura sálvia ele escurece por filtro (`--shell-wordmark-filtro`). */
const logoHeaderUrl = logoDarkUrl

type NavigationItem = AppNavigationItem

type NavigationSection = AppNavigationSection

const shellStyle = computed(() => {
  const colors = currentColors.value
  const isDark = isDarkMode.value

  const estilo = {
    '--brand-navy': colors.auth.text,
    '--profile-primary': colors.vet.primary,
    '--profile-secondary': colors.vet.secondary,
    '--clinical-muted': colors.auth.muted,
    /*
     * A moldura clara (30/09/2026): trilho, painel e cabeçalho no branco dos cartões, com fio fino,
     * sobre o fundo das telas. As cores vêm dos tokens do portal (`theme/hc-tokens.css`), que já
     * trocam sozinhos no escuro. O verde fica no logotipo e no que está aberto.
     */
    '--shell-bg': 'var(--hc-pagina)',
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
    /** O ícone dentro do ladrilho `--shell-accent-deep` do item aberto. */
    '--shell-on-accent-deep': '#ffffff',
    '--shell-nav-active-text': 'var(--hc-marca-forte)',
    '--shell-cream': 'var(--hc-marca-clara)',
    /** O fundo do botão do trilho sob o cursor. */
    '--shell-hover': 'var(--hc-linha)',
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
    /** O chip de sair no trilho. */
    '--rail-logout-bg': 'var(--hc-coral-fundo)',
    /** Ícone sobre o chip tingido do trilho. */
    '--rail-logout-icon': 'var(--hc-coral-tinta)',
    /** "Sair" escrito sobre superfície clara (painel e menu da conta). */
    '--rail-logout-text': colors.dashboard.warmText,
  }

  return trilhaAtiva.value ? { ...estilo, ...trilhaShellStyle } : estilo
})

/**
 * A moldura no Trilha: as mesmas variáveis `--shell-*`, apontadas para os tokens do Trilha
 * (`theme/trilha/trilha-tokens.css`), que já trocam sozinhos no escuro. O que está aberto pinta na
 * cor do lugar: essas variáveis moram no CSS do painel e do cabeçalho (fim do `<style>`), porque
 * `--pj-lugar-*` só tem valor onde a classe `pj-lugar--*` está.
 */
const trilhaShellStyle = {
  '--shell-bg': 'var(--fundo)',
  '--shell-surface': 'var(--superficie)',
  '--shell-surface-soft': 'var(--superficie-2)',
  '--shell-line': 'var(--linha)',
  '--shell-text': 'var(--tinta)',
  '--shell-muted': 'var(--tinta-2)',
  '--shell-soft': 'var(--tinta-3)',
  '--shell-brand': 'var(--rail)',
  '--shell-on-brand': 'var(--sobre-rail-2)',
  '--shell-hover': 'var(--superficie-2)',
  '--shell-nav-hover': 'var(--superficie-2)',
  '--shell-accent': 'var(--musgo)',
  '--shell-accent-strong': 'var(--musgo)',
  '--shell-on-accent-deep': 'var(--superficie)',
  '--shell-rail-active-bg': 'transparent',
  '--shell-nav-icone': '1.0625rem',
  '--shell-rail-icone': '1.1875rem',
  '--shell-attention': 'var(--atencao-tinta)',
  '--shell-attention-bg': 'var(--atencao-fundo)',
  '--shell-attention-line': 'var(--atencao-fundo)',
  '--rail-logout-red': 'var(--risco-tinta)',
  '--rail-logout-bg': 'transparent',
  '--rail-logout-icon': 'var(--sobre-rail-2)',
  '--rail-logout-text': 'var(--risco-tinta)',
} as const

/*
 * A moldura sálvia (16/10/2026): no claro, menu e cabeçalho na Folha de Sálvia (#84C1B4), a cor da
 * casa. Antes era o teal escuro da pílula cheia (#1F6457, 15/10), e o usuário pediu a sálvia de
 * volta. O escuro fica como está. Só a moldura troca de tokens: o conteúdo continua na paleta clara,
 * e o menu da conta, que sai para o `body`, também.
 *
 * Branco sobre #84C1B4 fica em 2:1, então a tinta da moldura é escura: #10302A dá 7,6:1 no painel
 * e 6,4:1 no trilho, um degrau mais fundo; o apagado #1D4038, 6,1:1 e 5:1 — acima de 4,5:1 nos
 * rótulos de 11 px. O que está aberto ganha um chip branco translúcido.
 */
const molduraStyle = computed(() =>
  trilhaAtiva.value || isDarkMode.value
    ? {}
    : {
        '--shell-surface': '#84c1b4',
        '--shell-surface-soft': 'rgb(255 255 255 / 30%)',
        '--shell-brand': '#78b8aa',
        '--shell-line': 'rgb(16 48 42 / 14%)',
        '--shell-text': '#10302a',
        '--shell-muted': '#1d4038',
        '--shell-soft': '#1d4038',
        '--shell-on-brand': '#1d4038',
        '--shell-hover': 'rgb(255 255 255 / 30%)',
        '--shell-nav-hover': 'rgb(255 255 255 / 30%)',
        /* Ícone um degrau maior: o traço fino lê melhor com mais corpo. */
        '--shell-nav-icone': '1rem',
        '--shell-rail-icone': '1.15rem',
        '--shell-accent': '#10302a',
        '--shell-accent-strong': '#10302a',
        '--shell-accent-soft': 'rgb(255 255 255 / 45%)',
        '--shell-cream': 'rgb(255 255 255 / 45%)',
        '--shell-rail-active-bg': 'rgb(255 255 255 / 55%)',
        '--shell-nav-active-text': '#10302a',
        /* No item aberto o ladrilho é branco, com o ícone na tinta da moldura. */
        '--shell-accent-deep': '#ffffff',
        '--shell-on-accent-deep': '#10302a',
        '--shell-wordmark-filtro': 'brightness(0) opacity(0.82)',
        /* A pata num ladrilho branco: a sálvia dela some num ladrilho sálvia. */
        '--rail-marca-fundo': '#ffffff',
        '--rail-marca-sombra': '0 1px 2px rgb(16 48 42 / 12%), 0 6px 14px -8px rgb(16 48 42 / 35%)',
        '--rail-marca-sombra-forte':
          '0 1px 2px rgb(16 48 42 / 14%), 0 10px 20px -8px rgb(16 48 42 / 42%)',
        '--rail-logout-red': '#9b1c1c',
        '--rail-logout-bg': 'rgb(255 255 255 / 40%)',
        '--rail-logout-icon': '#9b1c1c',
        '--rail-logout-text': '#9b1c1c',
      },
)

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
    (navigationSections.value.find(temPainel) ?? navigationSections.value[0]) as NavigationSection,
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

/** No modo lista o painel mostra o menu inteiro; no modo seções, só a seção aberta. */
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

/** O lugar da tela aberta e o do painel: no Trilha, cada um pinta na própria cor. */
const lugarDaPagina = computed(() => lugarDaSecao(activeSectionId.value))
const lugarDoPainel = computed(() => lugarDaSecao(activeSection.value.id))

/** A seção da tela aberta, para a trilha do cabeçalho: ícone, nome e para onde o nó leva. */
const secaoDaPagina = computed(() =>
  navigationSections.value.find((entry) => entry.id === activeSectionId.value),
)
const iconeDoLugar = computed(() =>
  naVisaoGeral.value
    ? overviewItem.value.icon
    : (secaoDaPagina.value?.icon ?? activeSection.value.icon),
)
const destinoDoLugar = computed(() => {
  if (naVisaoGeral.value) {
    return overviewItem.value.to
  }

  return (
    (secaoDaPagina.value && getSectionLandingPath(secaoDaPagina.value)) ?? defaultLandingPath.value
  )
})

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
  () => usuarioPerfilStore.displayName || authUser.value?.nome || t('shell.user.fallbackName'),
)

const headerAvatarUrl = computed(() => usuarioPerfilStore.avatarUrl)

const shellClasses = computed(() => ({
  'app-shell--rail-only': panelHidden.value && !isListNavigator.value,
  'app-shell--navigator-hidden': navigatorHidden.value,
  'app-shell--navigator-overlay': compactViewport.value && compactDrawerOpen.value,
  'app-shell--list-nav': isListNavigator.value,
  'app-shell--dense': isCompactDensity.value,
  'app-shell--trilha': trilhaAtiva.value,
}))

watch(
  () => route.path,
  () => {
    activeSectionId.value = resolveActiveSectionId(route.path, hasClinicalProfile.value)

    const secao = navigationSections.value.find((entry) => entry.id === activeSectionId.value)

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

    <aside class="app-navigator" :style="molduraStyle" :inert="navigatorHidden || undefined">
      <nav v-if="!isListNavigator" class="section-rail" :aria-label="t('shell.aria.sections')">
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
          :class="[{ 'rail-button--active': naVisaoGeral }, trilhaAtiva && 'pj-lugar--inicio']"
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
            :class="[
              { 'rail-button--active': activeSectionId === section.id },
              trilhaAtiva && `pj-lugar--${lugarDaSecao(section.id)}`,
            ]"
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
            :class="[
              { 'rail-button--active': activeSectionId === section.id },
              trilhaAtiva && `pj-lugar--${lugarDaSecao(section.id)}`,
            ]"
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
            icon="ph ph-caret-double-left"
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
            icon="ph ph-sign-out"
            :aria-label="t('shell.logout')"
            :title="t('shell.logout')"
            @click="requestLogout"
          />
        </div>
      </nav>

      <section
        class="navigator-panel"
        :class="trilhaAtiva && `pj-lugar--${lugarDoPainel}`"
        :inert="panelHidden || undefined"
      >
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
              {{
                t(
                  'shell.telasNaSecao',
                  { contagem: activeSection.items.length },
                  activeSection.items.length,
                )
              }}
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

        <nav
          ref="listaDeNavegacao"
          class="page-nav"
          :aria-label="t('shell.aria.pagesOf', { label: activeSection.label })"
        >
          <div v-for="group in gruposDoPainel" :key="group.id" class="page-nav__group">
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
            icon="ph ph-sign-out"
            :label="t('shell.logout')"
            @click="requestLogout"
          />
        </div>
      </section>
    </aside>

    <header
      class="app-header"
      :class="trilhaAtiva && `pj-lugar--${lugarDaPagina}`"
      :style="molduraStyle"
    >
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
          icon="ph ph-list"
          @click="toggleNavigator"
        />

        <!--
          No Trilha, o rótulo vira a trilha: o lugar (com o ícone, que leva ao início da seção) e a
          tela aberta, ligados na cor do lugar. Diz onde se está antes de qualquer leitura.
        -->
        <nav
          v-if="trilhaAtiva"
          class="pj-trilha shell-trilha"
          :aria-label="t('shell.trilha.rotulo')"
        >
          <ol>
            <li>
              <RouterLink class="pj-trilha__passo pj-trilha__passo--lugar" :to="destinoDoLugar">
                <span class="pj-trilha__no" aria-hidden="true"><i :class="iconeDoLugar" /></span>
                {{ activeSectionLabel }}
              </RouterLink>
            </li>
            <li v-if="activePageLabel && activePageLabel !== activeSectionLabel">
              <span class="pj-trilha__passo" aria-current="page">
                <span class="pj-trilha__no" aria-hidden="true" />
                <span class="pj-trilha__rotulo">{{ activePageLabel }}</span>
              </span>
            </li>
          </ol>
        </nav>

        <div v-else class="header-context">
          <span>{{ activeSectionLabel }}</span>
          <strong>{{ activePageLabel }}</strong>
        </div>
      </div>

      <div class="app-header__right">
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
          <i class="ph ph-magnifying-glass" aria-hidden="true" />
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
            <i class="ph ph-ticket" />
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
            <i class="ph ph-caret-down" aria-hidden="true" />
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
                <i class="ph ph-user" aria-hidden="true" />
                {{ t('shell.user.perfil') }}
              </RouterLink>
              <RouterLink role="menuitem" to="/settings" @click="closeUserMenu">
                <i class="ph ph-gear" aria-hidden="true" />
                {{ t('shell.user.settings') }}
              </RouterLink>
              <RouterLink role="menuitem" to="/parceiro/selecionar" @click="closeUserMenu">
                <i class="ph ph-building" aria-hidden="true" />
                {{ t('shell.user.trocarEmpresa') }}
              </RouterLink>
              <div class="user-menu__locale" role="none">
                <span class="user-menu__locale-label">{{ t('languageSwitcher.label') }}</span>
                <LanguageSwitcher variant="menu" />
              </div>
              <div class="user-menu__tema" role="none">
                <i class="ph ph-moon" aria-hidden="true" />
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
                icon="ph ph-sign-out"
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
      O questionário pós-saque mora no shell, e não na carteira: lá ele morria no meio da resposta
      ao trocar de rota. Quem abre é a carteira, depois de um saque concluído.
    -->
    <FeedbackSaqueDialog />

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

/* O ladrilho da pata: o degradê da ação cheia no escuro; branco na moldura sálvia do claro. */
.rail-brand {
  --marca-sombra: var(--rail-marca-sombra, 0 6px 16px -8px var(--hc-marca-sombra));

  display: grid;
  width: 2.6rem;
  height: 2.6rem;
  margin: 0 auto 0.9rem;
  place-items: center;
  border-radius: 0.85rem;
  background: var(--rail-marca-fundo, var(--hc-degrade-botao));
  box-shadow: var(--marca-sombra);
  transition: box-shadow 160ms ease-out;
}

.rail-brand:hover {
  --marca-sombra: var(--rail-marca-sombra-forte, 0 10px 22px -8px var(--hc-marca-sombra-forte));
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
  font-size: var(--shell-rail-icone, 1.06rem);
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
  background: var(--shell-hover);
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
  background: var(--rail-logout-bg);
  color: var(--rail-logout-icon);
}

.rail-action--danger.p-button:not(:disabled):hover,
.rail-action--danger.p-button:not(:disabled):active {
  border-color: color-mix(in srgb, var(--rail-logout-red) 45%, transparent);
  background: var(--rail-logout-bg);
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
  filter: var(--shell-wordmark-filtro, none);
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

.header-search .ph {
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

.user-menu__tema > .ph {
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
/* ===================================================================================== Trilha
 * A pele do design Trilha (`theme/trilha/`), só nas telas da lista de `rotas.ts`. O trilho é
 * escuro nos dois temas, para o lugar aberto acender: o ícone dele ganha um nó na cor do lugar
 * (`--pj-lugar-claro`). O painel e o cabeçalho pintam o que está aberto na mesma cor.
 */

.app-shell--trilha:not(.app-shell--list-nav) {
  --navigator-rail: 4.85rem;
}

/* O que está aberto, na cor do lugar: declarado onde a classe `pj-lugar--*` está. */
.app-shell--trilha .navigator-panel,
.app-shell--trilha .app-header {
  --shell-accent-soft: var(--pj-lugar-fundo);
  --shell-cream: var(--pj-lugar-fundo);
  --shell-nav-active-text: var(--pj-lugar-tinta);
  --shell-accent-deep: var(--pj-lugar);
}

.app-shell--trilha .section-rail {
  gap: 0.25rem;
  padding: 0.85rem 0.45rem 0.7rem;
  border-inline-end: 0;
  background: var(--rail);
}

.app-shell--trilha .app-navigator {
  border-inline-end-color: var(--linha);
}

.app-shell--trilha .rail-brand,
.app-shell--trilha .rail-brand:hover {
  --marca-sombra: none;

  width: 2.75rem;
  height: 2.75rem;
  border-radius: 50%;
  background: transparent;
}

.app-shell--trilha .rail-brand img {
  width: 2.05rem;
  height: 2.05rem;
}

.app-shell--trilha .rail-button,
.app-shell--trilha .rail-button.p-button {
  gap: 0.25rem;
  padding: 0.3rem 0.1rem 0.4rem;
  border-radius: 0.875rem;
  color: var(--sobre-rail-2);
}

.app-shell--trilha .rail-button__icon {
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 50%;
  transition:
    background-color var(--pj-tempo-medio) var(--pj-curva-chega),
    color var(--pj-tempo-curto) ease;
}

.app-shell--trilha .rail-button__label {
  font-size: 0.6875rem;
  font-weight: 500;
  letter-spacing: 0;
}

.app-shell--trilha .rail-button:hover,
.app-shell--trilha .rail-button.p-button:not(:disabled):hover,
.app-shell--trilha .rail-button.p-button:not(:disabled):active {
  background: var(--rail-ativo);
  color: var(--sobre-rail);
}

.app-shell--trilha .rail-button:hover .rail-button__icon {
  color: var(--pj-lugar-claro);
}

.app-shell--trilha .rail-button--active,
.app-shell--trilha .rail-button--active:hover,
.app-shell--trilha .rail-button--active.p-button,
.app-shell--trilha .rail-button--active.p-button:not(:disabled):hover,
.app-shell--trilha .rail-button--active.p-button:not(:disabled):active {
  background: transparent;
  color: var(--sobre-rail);
}

.app-shell--trilha .rail-button--active .rail-button__icon,
.app-shell--trilha .rail-button--active:hover .rail-button__icon {
  background: var(--pj-lugar-claro);
  color: var(--rail);
}

.app-shell--trilha .rail-divider {
  background: color-mix(in oklab, var(--sobre-rail) 16%, transparent);
}

.app-shell--trilha .rail-action.p-button,
.app-shell--trilha .rail-action--danger.p-button {
  border-color: transparent;
  background: transparent;
  color: var(--sobre-rail-2);
}

.app-shell--trilha .rail-action.p-button:not(:disabled):hover,
.app-shell--trilha .rail-action.p-button:not(:disabled):active {
  border-color: transparent;
  background: var(--rail-ativo);
  color: var(--sobre-rail);
}

.app-shell--trilha .rail-button:focus-visible,
.app-shell--trilha .rail-action:focus-visible,
.app-shell--trilha .rail-brand:focus-visible {
  outline: 2px solid var(--sobre-rail);
  outline-offset: 2px;
  box-shadow: none;
}

/* Painel: o disco do lugar ao lado do nome, como na trilha; rótulos de grupo em caixa normal. */
.app-shell--trilha .navigator-section-heading {
  margin-bottom: 0.5rem;
}

.app-shell--trilha .navigator-section-heading__icone {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 1rem;
}

.app-shell--trilha .navigator-section-heading__texto strong {
  font-size: 1rem;
  font-weight: 600;
  letter-spacing: 0;
}

.app-shell--trilha .page-nav__group-label {
  color: var(--tinta-3);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}

/* Cabeçalho: mais próximo do chão do que do cartão, com a trilha ocupando o lado de início. */
.app-shell--trilha .app-header {
  background: color-mix(in oklab, var(--fundo) 70%, var(--superficie));
  box-shadow: 0 1px 0 var(--linha);
  backdrop-filter: none;
}

.app-shell--trilha .app-header__left {
  min-width: 0;
  flex: 1 1 auto;
}

.shell-trilha {
  min-width: 0;
}

.app-shell--trilha .header-icon-button,
.app-shell--trilha .header-search,
.app-shell--trilha .header-resgate.p-button,
.app-shell--trilha .user-menu__trigger.p-button {
  --controle-sombra: none;
}
</style>
