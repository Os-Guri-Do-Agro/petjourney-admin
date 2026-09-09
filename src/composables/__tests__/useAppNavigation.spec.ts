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
    items: [{ label: 'Configurações', to: '/settings', icon: 'pi pi-cog' }],
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
        items: [{ label: 'Configurações', to: '/settings', icon: 'pi pi-cog' }],
      },
    ])
  })

  it('retorna lista vazia quando não há match', () => {
    expect(filterNavigationGroups(sampleGroups, 'agenda')).toEqual([])
  })
})

/**
 * A seção clínica tem dez destinos e passou a dividi-los em blocos rotulados. O filtro precisa
 * atravessar os blocos, e não só a lista achatada: sem isso, buscar "fila" devolveria o grupo
 * inteiro com os dez itens, porque `items` continua sendo a lista completa.
 */
const clinicalGroup: AppNavigationGroup = {
  id: 'clinical',
  label: 'Clínica',
  items: [
    { label: 'Meu dia', to: '/veterinario/meu-dia', icon: 'pi pi-sun' },
    { label: 'Fila de espera', to: '/veterinario/fila', icon: 'pi pi-hourglass' },
    { label: 'Faltas', to: '/veterinario/faltas', icon: 'pi pi-user-minus' },
  ],
  blocos: [
    {
      id: 'agora',
      label: 'Agora',
      items: [
        { label: 'Meu dia', to: '/veterinario/meu-dia', icon: 'pi pi-sun' },
        { label: 'Fila de espera', to: '/veterinario/fila', icon: 'pi pi-hourglass' },
      ],
    },
    {
      id: 'pendencias',
      label: 'Pendências',
      items: [{ label: 'Faltas', to: '/veterinario/faltas', icon: 'pi pi-user-minus' }],
    },
  ],
}

/** O primeiro grupo do resultado, falhando o teste — e não o compilador — quando não há nenhum. */
function primeiro(grupos: AppNavigationGroup[]): AppNavigationGroup {
  expect(grupos.length).toBeGreaterThan(0)

  return grupos[0] as AppNavigationGroup
}

describe('filterNavigationGroups com blocos', () => {
  it('filtra dentro dos blocos e sincroniza a lista achatada', () => {
    const grupo = primeiro(filterNavigationGroups([clinicalGroup], 'fila'))

    expect(grupo.blocos).toHaveLength(1)
    expect(grupo.blocos?.[0]?.id).toBe('agora')
    expect(grupo.items).toEqual([
      { label: 'Fila de espera', to: '/veterinario/fila', icon: 'pi pi-hourglass' },
    ])
  })

  it('descarta o bloco que esvazia, para a busca não devolver rótulo de nada', () => {
    const grupo = primeiro(filterNavigationGroups([clinicalGroup], 'faltas'))

    expect(grupo.blocos?.map((bloco) => bloco.id)).toEqual(['pendencias'])
  })

  /* O rótulo do bloco é termo de busca: quem digita "pendências" espera as telas do bloco. */
  it('encontra pelo nome do bloco, mesmo que nenhuma tela se chame assim', () => {
    const grupo = primeiro(filterNavigationGroups([clinicalGroup], 'pendências'))

    expect(grupo.items.map((item) => item.label)).toEqual(['Faltas'])
  })

  it('não inventa a chave de blocos em grupo que não tem', () => {
    const grupo = primeiro(filterNavigationGroups(sampleGroups, 'divul'))

    expect('blocos' in grupo).toBe(false)
  })
})
