import { computed } from 'vue'

import { hasVeterinarioProfile } from '@/service/auth/auth-session'
import { useParceiroStore } from '@/stores/parceiro'

export type AppNavigationItem = {
  label: string
  to: string
  icon: string
}

export type AppNavigationSection = {
  id: string
  label: string
  icon: string
  items: AppNavigationItem[]
}

export function useAppNavigation() {
  const parceiroStore = useParceiroStore()

  const hasClinicalProfile = computed(() => hasVeterinarioProfile())

  const portalItems = computed<AppNavigationItem[]>(() => {
    const items: AppNavigationItem[] = [
      { label: 'Programas', to: '/parceiro/programas', icon: 'pi pi-shield' },
      { label: 'Divulgação', to: '/parceiro/divulgacao', icon: 'pi pi-megaphone' },
      { label: 'Equipe', to: '/parceiro/equipe', icon: 'pi pi-users' },
    ]

    if (parceiroStore.statusAfiliadoAtivo) {
      items.splice(2, 0, { label: 'Financeiro', to: '/parceiro/carteira', icon: 'pi pi-wallet' })
    }

    return items
  })

  const navigationSections = computed<AppNavigationSection[]>(() => {
    const sections: AppNavigationSection[] = [
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
          icon: 'pi pi-th-large',
          items: [
            { label: 'Agenda', to: '/veterinario/agenda', icon: 'pi pi-calendar' },
            { label: 'Atividades', to: '/veterinario/atividades', icon: 'pi pi-list' },
          ],
        },
        {
          id: 'patients',
          label: 'Pets',
          icon: 'pi pi-heart',
          items: [
            { label: 'Pacientes', to: '/veterinario/pacientes', icon: 'pi pi-users' },
            { label: 'Prontuários', to: '/veterinario/prontuarios', icon: 'pi pi-file-edit' },
            {
              label: 'Compartilhamentos',
              to: '/veterinario/compartilhamentos',
              icon: 'pi pi-share-alt',
            },
          ],
        },
      )
    }

    sections.push({
      id: 'account',
      label: 'Conta',
      icon: 'pi pi-user',
      items: [
        { label: 'Perfil', to: '/perfil', icon: 'pi pi-user' },
        { label: 'Configurações', to: '/settings#seguranca', icon: 'pi pi-cog' },
      ],
    })

    return sections
  })

  return {
    navigationSections,
    hasClinicalProfile,
  }
}

export function navItemMatches(itemPath: string, currentPath: string) {
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
}

export function resolveActiveSectionId(path: string, hasClinical: boolean) {
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

  return 'portal'
}

export function resolvePageLabel(path: string, hash: string, sections: AppNavigationSection[]) {
  const partnerLabels = [
    { prefix: '/parceiro/carteira/saques', label: 'Detalhe do saque' },
    { prefix: '/parceiro/carteira', label: 'Financeiro' },
    { prefix: '/parceiro/divulgacao', label: 'Divulgação' },
    { prefix: '/parceiro/programas', label: 'Programas' },
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
    const matchedItem = section.items.find((item) => {
      const [itemPath = '', itemHash = ''] = item.to.split('#')

      if (itemHash) {
        return itemPath === path && `#${itemHash}` === hash
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
