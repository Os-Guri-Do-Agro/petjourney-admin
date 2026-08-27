import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import i18n from '@/i18n'
import { hasVeterinarioProfile } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'

export type AppNavigationItem = {
  label: string
  to: string
  icon: string
  /** Item visível, mas bloqueado com teaser (ex.: cupom em desenvolvimento). */
  comingSoon?: boolean
  /** Cadastro suspenso: item visível com cadeado; a tela destino mostra o gate. */
  locked?: boolean
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
}

/**
 * Menu clínico. Ligado com a entrada do módulo `src/features/clinico`, que substituiu os
 * stubs de `/veterinario/*` por telas com camada de dados própria.
 *
 * A camada é mocada e determinística (`features/clinico/data`), com a mesma forma da API
 * futura — nenhum dado fictício vaza para fora do módulo.
 */
export const CLINICAL_MENU_ENABLED = true

/** Equipe oculta no go-live até a operação do time estar pronta no portal. */
export const EQUIPE_MENU_ENABLED = false

/**
 * Seção de destino quando a rota atual não pertence a nenhuma — hoje só a visão geral.
 *
 * O menu tinha uma seção "Início" cujo painel repetia **todas** as outras: doze links existiam
 * em dois lugares, e o trilho prometia seções que a primeira seção desfazia. A visão geral virou
 * um link direto no topo do trilho; o inventário completo de telas vive na própria página
 * `/inicio`, que existe para isso.
 */
export const OVERVIEW_SECTION_ID = 'overview'

/** Rotas do módulo clínico. Os rótulos vêm dos catálogos; nada fixo em português aqui. */
const CLINICAL_ROUTES = [
  { key: 'clinico.meuDia.titulo', to: '/veterinario/meu-dia', icon: 'pi pi-sun' },
  { key: 'clinico.resumo.titulo', to: '/veterinario/resumo', icon: 'pi pi-chart-bar' },
  { key: 'clinico.agenda.titulo', to: '/veterinario/agenda', icon: 'pi pi-calendar' },
  { key: 'clinico.atendimentos.titulo', to: '/veterinario/atendimentos', icon: 'pi pi-file-edit' },
  { key: 'clinico.fila.titulo', to: '/veterinario/fila', icon: 'pi pi-hourglass' },
  { key: 'clinico.faltas.titulo', to: '/veterinario/faltas', icon: 'pi pi-user-minus' },
  { key: 'clinico.atividades.titulo', to: '/veterinario/atividades', icon: 'pi pi-list' },
] as const

const PATIENT_ROUTES = [
  { key: 'clinico.pacientes.titulo', to: '/veterinario/pacientes', icon: 'pi pi-users' },
  { key: 'clinico.bulario.titulo', to: '/veterinario/bulario', icon: 'pi pi-book' },
] as const

export function parseNavTarget(to: string) {
  const hashIndex = to.indexOf('#')
  const hash = hashIndex >= 0 ? to.slice(hashIndex) : ''
  const pathAndQuery = hashIndex >= 0 ? to.slice(0, hashIndex) : to
  const queryIndex = pathAndQuery.indexOf('?')
  const path = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery

  return { path, hash }
}

export function useAppNavigation() {
  const { t, locale } = useI18n()
  const parceiroStore = useParceiroStore()

  const hasClinicalProfile = computed(
    () => CLINICAL_MENU_ENABLED && hasVeterinarioProfile(),
  )

  const accountItems = computed<AppNavigationItem[]>(() => {
    void locale.value
    return [{ label: t('nav.items.settings'), to: '/settings', icon: 'pi pi-cog' }]
  })

  const clinicalItems = computed<AppNavigationItem[]>(() => {
    void locale.value

    return CLINICAL_ROUTES.map((rota) => ({
      label: t(rota.key),
      to: rota.to,
      icon: rota.icon,
    }))
  })

  const patientItems = computed<AppNavigationItem[]>(() => {
    void locale.value

    return PATIENT_ROUTES.map((rota) => ({ label: t(rota.key), to: rota.to, icon: rota.icon }))
  })

  const portalItems = computed<AppNavigationItem[]>(() => {
    void locale.value
    const items: AppNavigationItem[] = [
      { label: t('nav.items.programas'), to: '/parceiro/programas', icon: 'pi pi-th-large' },
      { label: t('nav.items.divulgacao'), to: '/parceiro/divulgacao', icon: 'pi pi-share-alt' },
      {
        label: t('nav.items.acessos'),
        to: '/parceiro/acessos',
        icon: 'pi pi-clipboard',
      },
    ]

    if (parceiroStore.statusAfiliadoAtivo) {
      items.push({
        label: t('nav.items.financeiro'),
        to: '/parceiro/carteira',
        icon: 'pi pi-wallet',
      })
    }

    if (EQUIPE_MENU_ENABLED) {
      items.push({ label: 'Equipe', to: '/parceiro/equipe', icon: 'pi pi-users' })
    }

    if (parceiroStore.cadastroSuspenso) {
      return items.map((item) => ({ ...item, locked: true }))
    }

    return items
  })

  /** A visão geral não é seção: é um destino só, e aparece como link no topo do trilho. */
  const overviewItem = computed<AppNavigationItem>(() => {
    void locale.value
    return { label: t('nav.items.overview'), to: '/inicio', icon: 'pi pi-home' }
  })

  const navigationSections = computed<AppNavigationSection[]>(() => {
    void locale.value
    const sections: AppNavigationSection[] = [
      {
        id: 'portal',
        label: t('nav.sections.portal'),
        icon: 'pi pi-briefcase',
        items: portalItems.value,
      },
    ]

    if (hasClinicalProfile.value) {
      sections.push(
        {
          id: 'clinical',
          label: t('clinico.modulo'),
          icon: 'pi pi-calendar',
          items: clinicalItems.value,
        },
        {
          id: 'patients',
          label: t('nav.groups.pets'),
          icon: 'pi pi-heart',
          items: patientItems.value,
        },
      )
    }

    sections.push({
      id: 'account',
      label: t('nav.sections.account'),
      icon: 'pi pi-user',
      items: accountItems.value,
    })

    return sections
  })

  /**
   * As mesmas seções em forma de lista, para o modo "lista única" do menu e para os atalhos da
   * visão geral. Uma origem só: seção nova aparece nos dois lugares sem ninguém lembrar disso.
   */
  const navigationGroups = computed<AppNavigationGroup[]>(() =>
    navigationSections.value.map((section) => ({
      id: section.id,
      label: section.label,
      items: section.items,
    })),
  )

  const homeShortcutGroups = navigationGroups

  return {
    navigationSections,
    navigationGroups,
    overviewItem,
    hasClinicalProfile,
    homeShortcutGroups,
  }
}

export function navItemMatches(itemPath: string, currentPath: string) {
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
}

export function resolveActiveSectionId(path: string, hasClinical: boolean) {
  if (path === '/inicio') {
    return OVERVIEW_SECTION_ID
  }

  if (path.startsWith('/parceiro')) {
    return 'portal'
  }

  /*
   * As rotas de "Pets" precisam estar listadas aqui uma a uma.
   *
   * Tudo em `/veterinario` que não caia neste teste vira "Clínica" no último `if`, e o bulário
   * — que mora na seção Pets — marcava "Clínica" no trilho enquanto o painel mostrava Pets.
   */
  if (
    path.startsWith('/veterinario/pacientes') ||
    path.startsWith('/veterinario/paciente/') ||
    path.startsWith('/veterinario/bulario')
  ) {
    return 'patients'
  }

  if (path.startsWith('/settings') || path.startsWith('/perfil')) {
    return 'account'
  }

  if (hasClinical && path.startsWith('/veterinario')) {
    return 'clinical'
  }

  return 'portal'
}

export function resolvePageLabel(path: string, hash: string, sections: AppNavigationSection[]) {
  const t = i18n.global.t.bind(i18n.global)

  if (path === '/inicio') {
    return t('nav.pageLabels.overview')
  }

  const partnerLabels = [
    { prefix: '/parceiro/carteira/saques', label: t('nav.pageLabels.saqueDetail') },
    { prefix: '/parceiro/carteira', label: t('nav.pageLabels.financeiro') },
    { prefix: '/parceiro/programas', label: t('nav.pageLabels.programas') },
    { prefix: '/parceiro/divulgacao', label: t('nav.pageLabels.divulgacao') },
    { prefix: '/parceiro/acessos', label: t('nav.pageLabels.acessos') },
    { prefix: '/parceiro/equipe', label: 'Equipe' },
    { prefix: '/parceiro/convite', label: t('nav.pageLabels.convite') },
    { prefix: '/parceiro/selecionar', label: t('nav.pageLabels.selecionar') },
  ] as const

  for (const item of partnerLabels) {
    if (path === item.prefix || path.startsWith(`${item.prefix}/`)) {
      return item.label
    }
  }

  if (path.startsWith('/parceiro')) {
    return t('nav.pageLabels.portal')
  }

  /* O atendimento não é item de menu — sem esta linha o cabeçalho dizia 'Painel' no prontuário. */
  if (path.startsWith('/veterinario/atendimento')) {
    return t('clinico.prontuario.titulo')
  }

  for (const section of sections) {
    const matchedItem = section.items.find((item) => {
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
    return t('nav.pageLabels.settings')
  }

  return t('nav.pageLabels.fallback')
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
  return section.items[0]?.to
}
