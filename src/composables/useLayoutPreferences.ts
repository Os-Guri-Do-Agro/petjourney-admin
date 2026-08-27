/**
 * Preferências de layout do painel.
 *
 * Mesma mecânica de `theme/color-mode`: estado reativo em módulo, gravado em `localStorage` por
 * um watcher. É preferência de exibição, não sessão — sobrevive ao logout de propósito, porque
 * quem escolheu "lista única" quer lista única no próximo login também.
 *
 * O valor lido do armazenamento é sempre validado contra a lista de opções: chave adulterada
 * ou preferência de uma versão antiga do painel cai no padrão em vez de quebrar o menu.
 */

import { computed, ref, watch } from 'vue'

const NAVIGATOR_MODE_KEY = 'petjourney-navigator-mode'
const NAVIGATOR_DENSITY_KEY = 'petjourney-navigator-density'

/**
 * `secoes` — trilho de ícones à esquerda e painel com as páginas **da seção atual**.
 * `lista` — uma coluna só, com todos os grupos abertos ao mesmo tempo.
 */
export const NAVIGATOR_MODES = ['secoes', 'lista'] as const
export const NAVIGATOR_DENSITIES = ['confortavel', 'compacta'] as const

export type NavigatorMode = (typeof NAVIGATOR_MODES)[number]
export type NavigatorDensity = (typeof NAVIGATOR_DENSITIES)[number]

export const DEFAULT_NAVIGATOR_MODE: NavigatorMode = 'secoes'
export const DEFAULT_NAVIGATOR_DENSITY: NavigatorDensity = 'confortavel'

function ler<T extends string>(chave: string, permitidos: readonly T[], padrao: T): T {
  if (typeof window === 'undefined') {
    return padrao
  }

  const guardado = window.localStorage.getItem(chave)

  return permitidos.includes(guardado as T) ? (guardado as T) : padrao
}

export const navigatorMode = ref<NavigatorMode>(
  ler(NAVIGATOR_MODE_KEY, NAVIGATOR_MODES, DEFAULT_NAVIGATOR_MODE),
)

export const navigatorDensity = ref<NavigatorDensity>(
  ler(NAVIGATOR_DENSITY_KEY, NAVIGATOR_DENSITIES, DEFAULT_NAVIGATOR_DENSITY),
)

export const isListNavigator = computed(() => navigatorMode.value === 'lista')
export const isCompactDensity = computed(() => navigatorDensity.value === 'compacta')

function gravar(chave: string) {
  return (valor: string) => {
    if (typeof window === 'undefined') {
      return
    }

    window.localStorage.setItem(chave, valor)
  }
}

watch(navigatorMode, gravar(NAVIGATOR_MODE_KEY))
watch(navigatorDensity, gravar(NAVIGATOR_DENSITY_KEY))

export function setNavigatorMode(mode: NavigatorMode) {
  navigatorMode.value = mode
}

export function setNavigatorDensity(density: NavigatorDensity) {
  navigatorDensity.value = density
}
