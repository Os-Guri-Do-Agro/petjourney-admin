import { computed } from 'vue'

import { hasVeterinarioProfile } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'

export type AppNavigationItem = {
  label: string
  to: string
  icon: string
}

export type AppNavigationGroup = {
  id: string
  label: string
  items: AppNavigationItem[]
}

export type AppNavigationSection = {
  id: string
  label: string
  icon: string
  items: AppNavigationItem[]
  groups?: AppNavigationGroup[]
  panelSubtitle?: string
}

/**
 * Menu clínico desligado no go-live: as telas estavam com dados mocados.
 * Implementações em `src/_mocks/`; stubs em `/veterinario/*` sem dados fictícios.
 * Reative quando a API clínica estiver integrada.
 */
export const CLINICAL_MENU_ENABLED = false

/** Equipe oculta no go-live até a operação do time estar pronta no portal. */
export const EQUIPE_MENU_ENABLED = false

const accountItems: AppNavigationItem[] = [
  { label: 'Configurações', to: '/settings', icon: 'pi pi-cog' },
]

const clinicalItems: AppNavigationItem[] = [
  { label: 'Agenda', to: '/veterinario/agenda', icon: 'pi pi-calendar' },
  { label: 'Atividades', to: '/veterinario/atividades', icon: 'pi pi-list' },
]

const patientItems: AppNavigationItem[] = [
  { label: 'Pacientes', to: '/veterinario/pacientes', icon: 'pi pi-users' },
  { label: 'Prontuários', to: '/veterinario/prontuarios', icon: 'pi pi-file-edit' },
  {
    label: 'Compartilhamentos',
    to: '/veterinario/compartilhamentos',
    icon: 'pi pi-share-alt',
  },
]

export const HOME_MENU_QUERY_KEY = 'menu'
export const HOME_MENU_QUERY_VALUE = 'inicio'

export function parseNavTarget(to: string) {
  const hashIndex = to.indexOf('#')
  const hash = hashIndex >= 0 ? to.slice(hashIndex) : ''
  const pathAndQuery = hashIndex >= 0 ? to.slice(0, hashIndex) : to
  const queryIndex = pathAndQuery.indexOf('?')
  const path = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery

  return { path, hash }
}

export function isHomeMenuContext(query: Record<string, unknown>) {
  const value = query[HOME_MENU_QUERY_KEY]

  if (value === HOME_MENU_QUERY_VALUE) {
    return true
  }

  return Array.isArray(value) && value.includes(HOME_MENU_QUERY_VALUE)
}

export function withHomeMenuContext(routePath: string) {
  if (routePath === '/inicio') {
    return routePath
  }

  const { path, hash } = parseNavTarget(routePath)
  const queryIndex = routePath.indexOf('?')
  const pathAndQuery = hash ? routePath.slice(0, routePath.indexOf('#')) : routePath
  const existingQuery =
    queryIndex >= 0
      ? pathAndQuery.slice(pathAndQuery.indexOf('?') + 1)
      : ''

  const params = new URLSearchParams(existingQuery)
  params.set(HOME_MENU_QUERY_KEY, HOME_MENU_QUERY_VALUE)

  const query = params.toString()

  return `${path}?${query}${hash}`
}

export function stripHomeMenuContext(routePath: string) {
  const { path, hash } = parseNavTarget(routePath)
  const pathAndQuery = hash ? routePath.slice(0, routePath.indexOf('#')) : routePath
  const queryIndex = pathAndQuery.indexOf('?')

  if (queryIndex < 0) {
    return `${path}${hash}`
  }

  const params = new URLSearchParams(pathAndQuery.slice(queryIndex + 1))
  params.delete(HOME_MENU_QUERY_KEY)

  const query = params.toString()

  return `${path}${query ? `?${query}` : ''}${hash}`
}

function mapHomeMenuItems(items: AppNavigationItem[]) {
  return items.map((item) => ({
    ...item,
    to: withHomeMenuContext(item.to),
  }))
}

function flattenSectionItems(section: AppNavigationSection) {
  if (section.groups?.length) {
    return section.groups.flatMap((group) => group.items)
  }

  return section.items
}

export function useAppNavigation() {
  const parceiroStore = useParceiroStore()

  const hasClinicalProfile = computed(
    () => CLINICAL_MENU_ENABLED && hasVeterinarioProfile(),
  )

  const portalItems = computed<AppNavigationItem[]>(() => {
    const items: AppNavigationItem[] = [
      { label: 'Programas', to: '/parceiro/programas', icon: 'pi pi-th-large' },
      { label: 'Divulgação', to: '/parceiro/divulgacao', icon: 'pi pi-share-alt' },
    ]

    if (parceiroStore.statusAfiliadoAtivo) {
      items.push({ label: 'Financeiro', to: '/parceiro/carteira', icon: 'pi pi-wallet' })
    }

    if (EQUIPE_MENU_ENABLED) {
      items.push({ label: 'Equipe', to: '/parceiro/equipe', icon: 'pi pi-users' })
    }

    return items
  })

  const homeGroups = computed<AppNavigationGroup[]>(() => {
    const groups: AppNavigationGroup[] = [
      {
        id: 'overview',
        label: 'Painel',
        items: [{ label: 'Visão geral', to: '/inicio', icon: 'pi pi-home' }],
      },
      {
        id: 'portal',
        label: 'Portal',
        items: mapHomeMenuItems(portalItems.value),
      },
    ]

    if (hasClinicalProfile.value) {
      groups.push(
        { id: 'clinical', label: 'Clínica', items: mapHomeMenuItems(clinicalItems) },
        { id: 'patients', label: 'Pets', items: mapHomeMenuItems(patientItems) },
      )
    }

    groups.push({
      id: 'account',
      label: 'Conta',
      items: mapHomeMenuItems(accountItems),
    })

    return groups
  })

  /** Atalhos da visão geral: mesmas seções do menu Início, sem o link para si mesma. */
  const homeShortcutGroups = computed<AppNavigationGroup[]>(() =>
    homeGroups.value
      .filter((group) => group.id !== 'overview')
      .map((group) => ({
        ...group,
        items: group.items.map((item) => ({
          ...item,
          to: stripHomeMenuContext(item.to),
        })),
      })),
  )

  const navigationSections = computed<AppNavigationSection[]>(() => {
    const sections: AppNavigationSection[] = [
      {
        id: 'home',
        label: 'Início',
        icon: 'pi pi-home',
        items: [],
        groups: homeGroups.value,
        panelSubtitle: 'Conteúdo geral',
      },
      {
        id: 'portal',
        label: 'Portal',
        icon: 'pi pi-briefcase',
        items: portalItems.value,
      },
    ]

    if (hasClinicalProfile.value) {
      sections.push(
        {
          id: 'clinical',
          label: 'Clínica',
          icon: 'pi pi-calendar',
          items: clinicalItems,
        },
        {
          id: 'patients',
          label: 'Pets',
          icon: 'pi pi-heart',
          items: patientItems,
        },
      )
    }

    sections.push({
      id: 'account',
      label: 'Conta',
      icon: 'pi pi-user',
      items: accountItems,
    })

    return sections
  })

  return {
    navigationSections,
    hasClinicalProfile,
    homeShortcutGroups,
  }
}

export function navItemMatches(itemPath: string, currentPath: string) {
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
}

export function resolveActiveSectionId(
  path: string,
  hasClinical: boolean,
  query: Record<string, unknown> = {},
) {
  if (isHomeMenuContext(query)) {
    return 'home'
  }

  if (path === '/inicio') {
    return 'home'
  }

  if (path.startsWith('/parceiro')) {
    return 'portal'
  }

  if (
    path.startsWith('/veterinario/pacientes') ||
    path.startsWith('/veterinario/prontuarios') ||
    path.startsWith('/veterinario/compartilhamentos')
  ) {
    return 'patients'
  }

  if (path.startsWith('/settings') || path.startsWith('/perfil')) {
    return 'account'
  }

  if (hasClinical && path.startsWith('/veterinario')) {
    return 'clinical'
  }

  if (path === '/parceiro/selecionar') {
    return 'portal'
  }

  return 'home'
}

export function resolvePageLabel(path: string, hash: string, sections: AppNavigationSection[]) {
  if (path === '/inicio') {
    return 'Visão geral'
  }

  const partnerLabels = [
    { prefix: '/parceiro/carteira/saques', label: 'Detalhe do saque' },
    { prefix: '/parceiro/carteira', label: 'Financeiro' },
    { prefix: '/parceiro/programas', label: 'Programas de participação' },
    { prefix: '/parceiro/divulgacao', label: 'Divulgação' },
    { prefix: '/parceiro/equipe', label: 'Equipe' },
    { prefix: '/parceiro/convite', label: 'Aceitar convite' },
    { prefix: '/parceiro/selecionar', label: 'Selecionar parceiro' },
  ] as const

  for (const item of partnerLabels) {
    if (path === item.prefix || path.startsWith(`${item.prefix}/`)) {
      return item.label
    }
  }

  if (path.startsWith('/parceiro')) {
    return 'Portal'
  }

  for (const section of sections) {
    const matchedItem = flattenSectionItems(section).find((item) => {
      const { path: itemPath, hash: itemHash } = parseNavTarget(item.to)

      if (itemHash) {
        return itemPath === path && itemHash === hash
      }

      return navItemMatches(itemPath, path)
    })

    if (matchedItem) {
      return matchedItem.label
    }
  }

  if (path.startsWith('/settings')) {
    return 'Configurações'
  }

  return 'Painel'
}

export function filterNavigationGroups(
  groups: AppNavigationGroup[],
  query: string,
): AppNavigationGroup[] {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return groups
  }

  return groups
    .map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(normalized) ||
          group.label.toLowerCase().includes(normalized),
      ),
    }))
    .filter((group) => group.items.length > 0)
}

export function getSectionLandingPath(section: AppNavigationSection) {
  const groupedItem = section.groups?.[0]?.items[0]
  if (groupedItem) {
    return groupedItem.to
  }

  return section.items[0]?.to
}
