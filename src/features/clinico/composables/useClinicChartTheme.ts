/**
 * Tema dos gráficos do módulo clínico.
 *
 * O ApexCharts desenha em SVG e escreve cor, fonte e tamanho como atributo — ele não enxerga
 * `var(--clinic-accent)` no meio de um `fill`. Como a regra da casa é que **nenhum componente
 * do módulo escreve cor literal**, este arquivo é a ponte: lê os tokens já resolvidos do
 * `:root` e entrega valores concretos para a configuração do gráfico.
 *
 * Três detalhes que custaram tempo e por isso viraram código explícito:
 *
 * - **A leitura precisa reagir à troca de tema.** O modo escuro entra por uma classe no
 *   `<html>`, não por remontagem de componente. Um `MutationObserver` no elemento raiz avisa a
 *   troca de classe (tema) e a de `data-clinic-density`, e a paleta inteira é relida.
 * - **Tamanho de fonte vai em pixel, nunca em `rem`.** O Apex mede texto com
 *   `parseFloat(fontSize)` para decidir se um rótulo cabe; `parseFloat('0.6875rem')` vira
 *   `0.6875` e ele conclui que qualquer texto cabe em qualquer lugar. Os tokens são
 *   convertidos aqui, uma vez.
 * - **Animação é opcional.** `prefers-reduced-motion` desliga as transições do gráfico junto
 *   com as do resto do módulo.
 */

import type { ApexOptions } from 'apexcharts'
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

/** Tokens que os gráficos consomem. O prefixo `--clinic-` é acrescentado na leitura. */
const TOKENS = [
  'surface',
  'surface-soft',
  'surface-sunken',
  'line',
  'line-soft',
  'line-strong',
  'text',
  'muted',
  'faint',
  'accent',
  'accent-strong',
  'accent-deep',
  'accent-tint',
  'accent-soft',
  'on-accent',
  'heat-ink',
  'heat-1',
  'heat-2',
  'heat-3',
  'heat-4',
  'series-1',
  'series-2',
  'series-3',
  'series-4',
  'series-5',
  'series-6',
  'risk-text',
  'attention-text',
  'ok-text',
  'font-sans',
  'font-label',
  'font-value',
] as const

export type ClinicChartToken = (typeof TOKENS)[number]
export type ClinicChartPalette = Record<ClinicChartToken, string>

/**
 * Espelho de emergência da paleta clara.
 *
 * Existe para um caso só: o gráfico ser montado antes de a folha de estilo do módulo estar
 * aplicada — em teste com DOM sintético, por exemplo. Sem ele o Apex receberia `fill=""` e
 * desenharia em preto. No navegador, com `clinic-tokens.css` carregado, nenhum destes valores
 * chega a ser usado.
 */
const RESERVA: ClinicChartPalette = {
  surface: '#ffffff',
  'surface-soft': '#f8faf9',
  'surface-sunken': '#eef3f1',
  line: '#e6eeeb',
  'line-soft': '#eef4f2',
  'line-strong': '#d3e0dc',
  text: '#1f2f2b',
  muted: '#485753',
  faint: '#5c6b65',
  accent: '#84c1b4',
  'accent-strong': '#456a60',
  'accent-deep': '#5c7e76',
  'accent-tint': '#e2efeb',
  'accent-soft': '#dcebe7',
  'on-accent': '#ffffff',
  'heat-ink': '#1f2f2b',
  'heat-1': '#e4f1ef',
  'heat-2': '#c8e3dd',
  'heat-3': '#819a93',
  'heat-4': '#456a60',
  'series-1': '#009962',
  'series-2': '#2389e2',
  'series-3': '#a067ac',
  'series-4': '#8d1c5f',
  'series-5': '#4640a7',
  'series-6': '#485d00',
  'risk-text': '#a2503a',
  'attention-text': '#856112',
  'ok-text': '#517d71',
  'font-sans': "'DM Sans', 'Segoe UI', system-ui, sans-serif",
  'font-label': '11px',
  'font-value': '14px',
}

const RAIZ_PADRAO = 16

function hexParaRgb(cor: string): [number, number, number] | null {
  const hex = cor.trim().replace('#', '')
  const cheio = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex

  if (!/^[0-9a-fA-F]{6}$/.test(cheio)) {
    return null
  }

  return [0, 2, 4].map((i) => Number.parseInt(cheio.slice(i, i + 2), 16)) as [
    number,
    number,
    number,
  ]
}

/**
 * `peso` de `cor` sobre `fundo`, em hex — o `color-mix` que o Apex não entende.
 *
 * Existe para a série "prevista" dos gráficos de coluna: no design novo a marca e a marca forte
 * são dois verdes vizinhos, e "previsto" e "concluído" pintados com eles liam como a mesma série.
 * Misturada ao fundo do cartão, a marca clareia no claro e escurece no escuro, e a diferença volta.
 * Cor que não for hex volta sem mistura.
 */
export function misturar(cor: string, fundo: string, peso: number): string {
  const a = hexParaRgb(cor)
  const b = hexParaRgb(fundo)

  if (!a || !b) {
    return cor
  }

  return `#${a
    .map((canal, i) => Math.round(canal * peso + b[i]! * (1 - peso)))
    .map((canal) => canal.toString(16).padStart(2, '0'))
    .join('')}`
}

/** `0.6875rem` → `11px`. O Apex mede texto com `parseFloat`, então a unidade tem que ser px. */
function emPixels(valor: string, raiz: number): string {
  const numero = Number.parseFloat(valor)

  if (Number.isNaN(numero)) {
    return valor
  }

  if (valor.endsWith('rem') || valor.endsWith('em')) {
    return `${Math.round(numero * raiz * 100) / 100}px`
  }

  return valor.endsWith('px') ? valor : `${numero}px`
}

function lerPaleta(): ClinicChartPalette {
  if (typeof document === 'undefined') {
    return { ...RESERVA }
  }

  /*
   * A tela no design novo (`.hc-tema`, 30/09/2026) reaponta os `--clinic-*` para os tokens do
   * portal na própria raiz dela, e não no `<html>`. Lido do `<html>`, o gráfico desenhava o linho
   * antigo dentro de um cartão branco. O tamanho de fonte continua vindo do `<html>`: é a raiz do
   * `rem`.
   */
  const alvo = document.querySelector('.hc-tema') ?? document.documentElement
  const estilo = getComputedStyle(alvo)
  const raiz =
    Number.parseFloat(getComputedStyle(document.documentElement).fontSize) || RAIZ_PADRAO
  const lida = { ...RESERVA }

  for (const token of TOKENS) {
    const valor = estilo.getPropertyValue(`--clinic-${token}`).trim()

    if (valor) {
      lida[token] =
        token.startsWith('font-') && token !== 'font-sans' ? emPixels(valor, raiz) : valor
    }
  }

  return lida
}

const paleta = ref<ClinicChartPalette>({ ...RESERVA })
const escuroRef = ref(false)

let observando = false

function sincronizar() {
  paleta.value = lerPaleta()
  escuroRef.value =
    typeof document !== 'undefined' && document.documentElement.classList.contains('app-dark')
}

/**
 * Observa a raiz do documento uma única vez por página.
 *
 * O gancho é o próprio `<html>` em vez do `colorMode` da aplicação de propósito: o que decide a
 * cor lida é a classe estar aplicada, não a intenção de aplicá-la. Assim a paleta continua
 * correta se a troca de tema passar a vir de outro lugar.
 */
function observarRaiz() {
  sincronizar()

  if (observando || typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return
  }

  observando = true

  new MutationObserver(sincronizar).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'data-clinic-density'],
  })
}

function prefereMenosMovimento(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** Nome do dicionário de idioma registrado em cada gráfico. Um só, trocado junto com o app. */
const IDIOMA_DO_MODULO = 'clinico'

/** Nomes de mês e de dia no idioma de quem lê, curtos e longos, para o Apex desenhar datas. */
function nomesDeCalendario(tag: string) {
  const mes = (estilo: 'long' | 'short') =>
    Array.from({ length: 12 }, (_, indice) =>
      new Intl.DateTimeFormat(tag, { month: estilo, timeZone: 'UTC' })
        .format(new Date(Date.UTC(2021, indice, 15)))
        /* `jan.` vira `jan`: o ponto abreviativo some contra a barra de `jan/26`. */
        .replace(/\.$/, ''),
    )

  const dia = (estilo: 'long' | 'short') =>
    /* 2024-01-07 é um domingo, que é o índice 0 que o Apex espera. */
    Array.from({ length: 7 }, (_, indice) =>
      new Intl.DateTimeFormat(tag, { weekday: estilo, timeZone: 'UTC' })
        .format(new Date(Date.UTC(2024, 0, 7 + indice)))
        .replace(/\.$/, ''),
    )

  return {
    months: mes('long'),
    shortMonths: mes('short'),
    days: dia('long'),
    shortDays: dia('short'),
  }
}

export function useClinicChartTheme() {
  observarRaiz()
  /*
   * Relida depois de montar: no `setup` a página nova ainda não está no documento, e a raiz
   * `.hc-tema` que decide as cores não existe para ser lida.
   */
  onMounted(sincronizar)

  const { locale } = useI18n()

  /**
   * O calendário do Apex, no idioma do app.
   *
   * O Apex embute os nomes de mês **em inglês** e só troca com um dicionário registrado por
   * gráfico. Sem isto, a linha do tempo dos lotes desenhava `Jul/25` embaixo de uma tela que
   * escrevia `jul/26` em todo o resto — duas réguas na mesma página. Vale para a dica também,
   * que é onde a data aparece por extenso.
   */
  const idioma = computed<NonNullable<ApexOptions['chart']>>(() => {
    const tag = INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE]

    return {
      defaultLocale: IDIOMA_DO_MODULO,
      locales: [{ name: IDIOMA_DO_MODULO, options: nomesDeCalendario(tag) }],
    }
  })

  const cor = computed(() => paleta.value)
  const escuro = computed(() => escuroRef.value)

  const fonte = computed(() => ({
    familia: cor.value['font-sans'],
    rotulo: cor.value['font-label'],
    valor: cor.value['font-value'],
  }))

  /** Base do `chart`: sem barra de ferramentas, sem zoom, sem fundo próprio. */
  const grafico = computed<NonNullable<ApexOptions['chart']>>(() => ({
    ...idioma.value,
    background: 'transparent',
    foreColor: cor.value.muted,
    fontFamily: fonte.value.familia,
    parentHeightOffset: 0,
    toolbar: { show: false },
    zoom: { enabled: false },
    animations: { enabled: !prefereMenosMovimento(), speed: 320 },
    /*
     * Teclado ligado: o painel do módulo precisa andar sem mouse, e num gráfico essa é a única
     * forma de alcançar o valor de cada ponto sem depender de passar o cursor por cima.
     */
    accessibility: { enabled: true, keyboard: { enabled: true, navigation: { enabled: true } } },
  }))

  const grade = computed<NonNullable<ApexOptions['grid']>>(() => ({
    borderColor: cor.value['line-soft'],
    strokeDashArray: 4,
    padding: { top: 0, right: 4, bottom: 0, left: 4 },
    xaxis: { lines: { show: false } },
    yaxis: { lines: { show: true } },
  }))

  const legenda = computed<NonNullable<ApexOptions['legend']>>(() => ({
    show: true,
    position: 'bottom',
    horizontalAlign: 'left',
    offsetY: 2,
    fontFamily: fonte.value.familia,
    fontSize: fonte.value.rotulo,
    fontWeight: 650,
    labels: { colors: cor.value.muted },
    markers: { size: 5, strokeWidth: 0, shape: 'circle' },
    itemMargin: { horizontal: 8, vertical: 2 },
  }))

  const dica = computed<NonNullable<ApexOptions['tooltip']>>(() => ({
    enabled: true,
    theme: escuro.value ? 'dark' : 'light',
    style: { fontFamily: fonte.value.familia, fontSize: fonte.value.rotulo },
  }))

  const estados = computed<NonNullable<ApexOptions['states']>>(() => ({
    hover: { filter: { type: escuro.value ? 'lighten' : 'darken', value: 0.08 } },
    active: { filter: { type: 'none' } },
  }))

  /**
   * A paleta de identidade, na ordem fixa dos tokens.
   *
   * Devolvida como lista porque é assim que o Apex a consome (`colors`), e porque a **posição
   * é o contrato**: quem pinta uma série pega o slot pelo índice do item no catálogo, nunca
   * pelo lugar dele no ranking daquele dia. Circular a lista para uma sétima série é proibido —
   * duas séries da mesma cor no mesmo gráfico é pior do que não desenhar a sétima.
   */
  const serie = computed(() => [
    cor.value['series-1'],
    cor.value['series-2'],
    cor.value['series-3'],
    cor.value['series-4'],
    cor.value['series-5'],
    cor.value['series-6'],
  ])

  /** Estilo dos rótulos de eixo, reaproveitado nos três gráficos. */
  const rotuloDeEixo = computed(() => ({
    fontFamily: fonte.value.familia,
    fontSize: fonte.value.rotulo,
    fontWeight: 650,
    colors: cor.value.faint,
  }))

  return { cor, escuro, fonte, grafico, grade, legenda, dica, estados, rotuloDeEixo, serie }
}
