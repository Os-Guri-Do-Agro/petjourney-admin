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
const NAVIGATOR_LAYOUT_KEY = 'petjourney-navigator-layout'
const NAVIGATOR_STYLE_KEY = 'petjourney-navigator-style'
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
 * partir de 1280 px e só ícones abaixo disso, para o tablet deitado (1024) não perder um quarto da
 * tela para a barra. O botão de recolher, no alto da barra, troca entre as duas primeiras.
 */
export const NAVIGATOR_WIDTHS = ['larga', 'icones', 'auto'] as const

/** Os avisos de pendência na barra: o número, ou só um ponto na cor do estado. */
export const NAVIGATOR_BADGES = ['numero', 'ponto'] as const

/**
 * Onde o menu mora: na barra lateral, ou numa faixa no alto da tela com um menu por espaço (cada
 * menu com as seções do espaço lado a lado). Até 900 px os dois viram a mesma gaveta.
 */
export const NAVIGATOR_LAYOUTS = ['lateral', 'topo'] as const

/**
 * O desenho da barra lateral. `secoes`: as telas agrupadas sob o título da seção, com o ícone solto
 * e a linha baixa (o padrão desde 16/11/2026). `ladrilhos`: o menu do app, cada tela com o ícone no
 * quadradinho de 40 px, mais fácil de tocar.
 */
export const NAVIGATOR_STYLES = ['secoes', 'ladrilhos'] as const

/**
 * Os formatos que a pessoa escolhe (Configurações → Aparência e o menu da conta). Cada um é uma
 * combinação das preferências de baixo: `icones` é a barra lateral só de ícones, e `topo` é o menu
 * no alto. Gente diferente prefere coisas diferentes, e a escolha fica no navegador de cada um.
 */
export const LAYOUT_FORMATS = ['secoes', 'ladrilhos', 'icones', 'topo'] as const

/** Onde a largura `auto` deixa a barra larga. */
export const NAVIGATOR_AUTO_MIN_WIDTH = 1280

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
export type NavigatorLayout = (typeof NAVIGATOR_LAYOUTS)[number]
export type NavigatorStyle = (typeof NAVIGATOR_STYLES)[number]
export type LayoutFormat = (typeof LAYOUT_FORMATS)[number]

/** Todos abertos: é a barra do app, e a que o portal mostra desde 26/10/2026. */
export const DEFAULT_NAVIGATOR_MODE: NavigatorMode = 'lista'
/*
 * Desde a análise de usabilidade de 16/11/2026 (`docs/clinico/usabilidade`): a linha de 52 px dava
 * um menu de 1.262 px em 655 visíveis, e a barra larga levava 272 dos 1.024 px do tablet deitado. O
 * padrão passou a ser o formato "Seções" (linha baixa, ícone solto, telas agrupadas) e a largura
 * automática. A densidade só vale para os ladrilhos, que voltam ao tamanho do app.
 */
export const DEFAULT_NAVIGATOR_LAYOUT: NavigatorLayout = 'lateral'
export const DEFAULT_NAVIGATOR_STYLE: NavigatorStyle = 'secoes'
export const DEFAULT_NAVIGATOR_DENSITY: NavigatorDensity = 'confortavel'
export const DEFAULT_NAVIGATOR_WIDTH: NavigatorWidth = 'auto'
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

export const navigatorLayout = ref<NavigatorLayout>(
  ler(NAVIGATOR_LAYOUT_KEY, NAVIGATOR_LAYOUTS, DEFAULT_NAVIGATOR_LAYOUT),
)

export const navigatorStyle = ref<NavigatorStyle>(
  ler(NAVIGATOR_STYLE_KEY, NAVIGATOR_STYLES, DEFAULT_NAVIGATOR_STYLE),
)

/** O formato em uso, lido das preferências: o botão de recolher a barra também troca o formato. */
export const layoutFormat = computed<LayoutFormat>(() => {
  if (navigatorLayout.value === 'topo') {
    return 'topo'
  }

  return navigatorWidth.value === 'icones' ? 'icones' : navigatorStyle.value
})

export const isListNavigator = computed(() => navigatorMode.value === 'lista')
export const isCompactDensity = computed(() => navigatorDensity.value === 'compacta')
export const isGuidanceVisible = computed(() => guidance.value === 'on')
export const isTopNavigator = computed(() => navigatorLayout.value === 'topo')
/** A linha baixa: sempre no formato Seções; nos ladrilhos, só se a pessoa escolheu compacta. */
export const isCompactNavigator = computed(
  () => navigatorStyle.value === 'secoes' || navigatorDensity.value === 'compacta',
)

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
watch(navigatorLayout, gravar(NAVIGATOR_LAYOUT_KEY))
watch(navigatorStyle, gravar(NAVIGATOR_STYLE_KEY))

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

/**
 * Troca o formato inteiro de uma vez. Quem sai de "Só ícones" para um formato com nome volta à
 * largura automática (a barra larga, recolhendo sozinha nas telas menores).
 */
export function setLayoutFormat(formato: LayoutFormat) {
  if (formato === 'topo') {
    navigatorLayout.value = 'topo'
    return
  }

  navigatorLayout.value = 'lateral'

  if (formato === 'icones') {
    navigatorWidth.value = 'icones'
    return
  }

  navigatorStyle.value = formato

  if (navigatorWidth.value === 'icones') {
    navigatorWidth.value = DEFAULT_NAVIGATOR_WIDTH
  }
}

export function toggleGuidance() {
  guidance.value = guidance.value === 'on' ? 'off' : 'on'
}
