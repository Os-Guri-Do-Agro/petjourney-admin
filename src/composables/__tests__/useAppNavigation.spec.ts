import { describe, expect, it } from 'vitest'

import { filterNavigationGroups, type AppNavigationGroup } from '@/composables/useAppNavigation'

const sampleGroups: AppNavigationGroup[] = [
  {
    id: 'portal',
    label: 'Portal',
    items: [
      { label: 'Programas', to: '/parceiro/programas', icon: 'pi pi-th-large' },
      { label: 'Divulgação', to: '/parceiro/divulgacao', icon: 'pi pi-share-alt' },
    ],
  },
  {
    id: 'account',
    label: 'Conta',
    items: [
      { label: 'Perfil', to: '/perfil', icon: 'pi pi-user' },
      { label: 'Configurações', to: '/settings', icon: 'pi pi-cog' },
    ],
  },
]

describe('filterNavigationGroups', () => {
  it('retorna tudo sem filtro', () => {
    expect(filterNavigationGroups(sampleGroups, '')).toEqual(sampleGroups)
  })

  it('filtra pelo nome da tela', () => {
    expect(filterNavigationGroups(sampleGroups, 'divul')).toEqual([
      {
        id: 'portal',
        label: 'Portal',
        items: [{ label: 'Divulgação', to: '/parceiro/divulgacao', icon: 'pi pi-share-alt' }],
      },
    ])
  })

  it('filtra pelo nome da seção e mantém as telas do grupo', () => {
    expect(filterNavigationGroups(sampleGroups, 'conta')).toEqual([
      {
        id: 'account',
        label: 'Conta',
        items: [
          { label: 'Perfil', to: '/perfil', icon: 'pi pi-user' },
          { label: 'Configurações', to: '/settings', icon: 'pi pi-cog' },
        ],
      },
    ])
  })

  it('retorna lista vazia quando não há match', () => {
    expect(filterNavigationGroups(sampleGroups, 'agenda')).toEqual([])
  })
})
