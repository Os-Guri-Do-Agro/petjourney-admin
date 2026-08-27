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
import { computed, ref } from 'vue'

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
  'risk-text': '#a2503a',
  'attention-text': '#856112',
  'ok-text': '#517d71',
  'font-sans': "'DM Sans', 'Segoe UI', system-ui, sans-serif",
  'font-label': '11px',
  'font-value': '14px',
}

const RAIZ_PADRAO = 16

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

  const estilo = getComputedStyle(document.documentElement)
  const raiz = Number.parseFloat(estilo.fontSize) || RAIZ_PADRAO
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

export function useClinicChartTheme() {
  observarRaiz()

  const cor = computed(() => paleta.value)
  const escuro = computed(() => escuroRef.value)

  const fonte = computed(() => ({
    familia: cor.value['font-sans'],
    rotulo: cor.value['font-label'],
    valor: cor.value['font-value'],
  }))

  /** Base do `chart`: sem barra de ferramentas, sem zoom, sem fundo próprio. */
  const grafico = computed<NonNullable<ApexOptions['chart']>>(() => ({
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

  /** Estilo dos rótulos de eixo, reaproveitado nos três gráficos. */
  const rotuloDeEixo = computed(() => ({
    fontFamily: fonte.value.familia,
    fontSize: fonte.value.rotulo,
    fontWeight: 650,
    colors: cor.value.faint,
  }))

  return { cor, escuro, fonte, grafico, grade, legenda, dica, estados, rotuloDeEixo }
}
