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
const NAVIGATOR_WIDTH_KEY = 'petjourney-navigator-width'
const NAVIGATOR_BADGES_KEY = 'petjourney-navigator-badges'
/** Antes da largura de três valores, a barra só guardava se estava recolhida. */
const LEGACY_COLLAPSED_KEY = 'petjourney-navigator-collapsed'
const GUIDANCE_KEY = 'petjourney-guidance'

/**
 * `lista` — todos os espaços abertos, cada um recolhível pelo título (o que a pessoa recolhe fica
 * lembrado). `secoes` — só o espaço da tela atual aberto; os outros numa linha, com o total de
 * pendências.
 */
export const NAVIGATOR_MODES = ['secoes', 'lista'] as const
export const NAVIGATOR_DENSITIES = ['confortavel', 'compacta'] as const

/**
 * `larga` — ícone e nome. `icones` — só a coluna dos ícones, o nome no `title`. `auto` — larga a
 * partir de 1440 px e só ícones abaixo disso, para o notebook de 1280 não perder a tela para a barra.
 * O botão de recolher, no alto da barra, troca entre as duas primeiras.
 */
export const NAVIGATOR_WIDTHS = ['larga', 'icones', 'auto'] as const

/** Os avisos de pendência na barra: o número, ou só um ponto na cor do estado. */
export const NAVIGATOR_BADGES = ['numero', 'ponto'] as const

/** Onde a largura `auto` deixa a barra larga. */
export const NAVIGATOR_AUTO_MIN_WIDTH = 1440

/**
 * Texto de apoio das telas: a frase que explica o que a seção faz.
 *
 * Fica **desligado por padrão**, e não é descuido. Esse texto serve a quem abre a tela pela
 * primeira vez; para quem trabalha nela todo dia ele vira um parágrafo entre o título e a
 * primeira coisa clicável, repetido em cada bloco da página. Ele não some — troca de forma: um
 * botão no cabeçalho traz tudo de volta, e a escolha atravessa sessões.
 */
export const GUIDANCE_STATES = ['off', 'on'] as const

export type NavigatorMode = (typeof NAVIGATOR_MODES)[number]
export type NavigatorDensity = (typeof NAVIGATOR_DENSITIES)[number]
export type NavigatorWidth = (typeof NAVIGATOR_WIDTHS)[number]
export type NavigatorBadges = (typeof NAVIGATOR_BADGES)[number]
export type GuidanceState = (typeof GUIDANCE_STATES)[number]

/** Todos abertos: é a barra do app, e a que o portal mostra desde 26/10/2026. */
export const DEFAULT_NAVIGATOR_MODE: NavigatorMode = 'lista'
export const DEFAULT_NAVIGATOR_DENSITY: NavigatorDensity = 'confortavel'
export const DEFAULT_NAVIGATOR_WIDTH: NavigatorWidth = 'larga'
export const DEFAULT_NAVIGATOR_BADGES: NavigatorBadges = 'numero'
export const DEFAULT_GUIDANCE: GuidanceState = 'off'

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

/** Sem a chave nova, quem tinha deixado a barra recolhida continua com ela só de ícones. */
function lerLargura(): NavigatorWidth {
  if (
    typeof window !== 'undefined' &&
    window.localStorage.getItem(NAVIGATOR_WIDTH_KEY) === null &&
    window.localStorage.getItem(LEGACY_COLLAPSED_KEY) === 'true'
  ) {
    return 'icones'
  }

  return ler(NAVIGATOR_WIDTH_KEY, NAVIGATOR_WIDTHS, DEFAULT_NAVIGATOR_WIDTH)
}

export const navigatorWidth = ref<NavigatorWidth>(lerLargura())

export const navigatorBadges = ref<NavigatorBadges>(
  ler(NAVIGATOR_BADGES_KEY, NAVIGATOR_BADGES, DEFAULT_NAVIGATOR_BADGES),
)

export const guidance = ref<GuidanceState>(ler(GUIDANCE_KEY, GUIDANCE_STATES, DEFAULT_GUIDANCE))

export const isListNavigator = computed(() => navigatorMode.value === 'lista')
export const isCompactDensity = computed(() => navigatorDensity.value === 'compacta')
export const isGuidanceVisible = computed(() => guidance.value === 'on')

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
watch(navigatorWidth, gravar(NAVIGATOR_WIDTH_KEY))
watch(navigatorBadges, gravar(NAVIGATOR_BADGES_KEY))
watch(guidance, gravar(GUIDANCE_KEY))

export function setNavigatorMode(mode: NavigatorMode) {
  navigatorMode.value = mode
}

export function setNavigatorDensity(density: NavigatorDensity) {
  navigatorDensity.value = density
}

export function setNavigatorWidth(width: NavigatorWidth) {
  navigatorWidth.value = width
}

export function setNavigatorBadges(badges: NavigatorBadges) {
  navigatorBadges.value = badges
}

export function toggleGuidance() {
  guidance.value = guidance.value === 'on' ? 'off' : 'on'
}
