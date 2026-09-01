/**
 * Preferências de visualização do módulo clínico.
 *
 * Densidade e zoom são escolha de quem opera, não do desenvolvedor: a recepção que passa o dia
 * na grade quer ver o dia inteiro; quem confere prontuário quer respiro. Persistem em
 * `localStorage` e são aplicados como atributos no `<html>`, para que overlay teleportado do
 * PrimeVue também os enxergue.
 *
 * Estado global de módulo (não por componente): dois painéis abertos com densidades
 * diferentes seria um bug, não um recurso.
 */

import { computed, ref, watch } from 'vue'

export const DENSIDADES = ['compacta', 'media', 'confortavel'] as const
export const ZOOMS = ['reduzido', 'medio', 'ampliado'] as const

export type ClinicDensidade = (typeof DENSIDADES)[number]
export type ClinicZoom = (typeof ZOOMS)[number]

const CHAVE_DENSIDADE = 'clinic.density'
const CHAVE_ZOOM = 'clinic.zoom'
const CHAVE_OCULTAR_CANCELADOS = 'clinic.hideCancelled'
/**
 * Legenda recolhida ou aberta.
 *
 * Nasce **aberta**: fechada por padrão, ninguém descobriria que a faixa colorida do card tem
 * significado, e a legenda existiria só para quem já não precisa dela. Quem conhece a grade
 * de cor fecha uma vez e a preferência persiste.
 */
const CHAVE_LEGENDA = 'clinic.legendOpen'

/** Altura em pixels do slot de 15 minutos, espelhando `clinic-tokens.css`. */
const ALTURA_POR_ZOOM: Record<ClinicZoom, number> = {
  reduzido: 10,
  medio: 14,
  ampliado: 20,
}

function lerArmazenado<T extends string>(chave: string, aceitos: readonly T[], padrao: T): T {
  if (typeof window === 'undefined') {
    return padrao
  }

  const valor = window.localStorage.getItem(chave)

  return aceitos.includes(valor as T) ? (valor as T) : padrao
}

const densidade = ref<ClinicDensidade>(lerArmazenado(CHAVE_DENSIDADE, DENSIDADES, 'media'))
const zoom = ref<ClinicZoom>(lerArmazenado(CHAVE_ZOOM, ZOOMS, 'medio'))
const ocultarCancelados = ref(
  typeof window === 'undefined'
    ? false
    : window.localStorage.getItem(CHAVE_OCULTAR_CANCELADOS) === 'true',
)

const legendaAberta = ref(
  typeof window === 'undefined'
    ? true
    : window.localStorage.getItem(CHAVE_LEGENDA) !== 'false',
)

function aplicarNoDocumento() {
  if (typeof document === 'undefined') {
    return
  }

  document.documentElement.dataset.clinicDensity = densidade.value
  document.documentElement.dataset.clinicZoom = zoom.value
}

watch(
  densidade,
  (valor) => {
    aplicarNoDocumento()
    window.localStorage.setItem(CHAVE_DENSIDADE, valor)
  },
  { immediate: true },
)

watch(zoom, (valor) => {
  aplicarNoDocumento()
  window.localStorage.setItem(CHAVE_ZOOM, valor)
})

watch(ocultarCancelados, (valor) => {
  window.localStorage.setItem(CHAVE_OCULTAR_CANCELADOS, String(valor))
})

watch(legendaAberta, (valor) => {
  window.localStorage.setItem(CHAVE_LEGENDA, String(valor))
})

function proximo<T>(lista: readonly T[], atual: T): T {
  const indice = lista.indexOf(atual)

  return lista[(indice + 1) % lista.length] ?? (lista[0] as T)
}

export function useClinicPrefs() {
  return {
    densidade,
    zoom,
    ocultarCancelados,
    legendaAberta,
    alternarLegenda: () => {
      legendaAberta.value = !legendaAberta.value
    },
    /** Pixels por minuto — a grade calcula posição a partir daqui, nunca de número solto. */
    pixelsPorMinuto: computed(() => ALTURA_POR_ZOOM[zoom.value] / 15),
    alturaDoSlot: computed(() => ALTURA_POR_ZOOM[zoom.value]),
    alternarDensidade: () => {
      densidade.value = proximo(DENSIDADES, densidade.value)
    },
    alternarZoom: () => {
      zoom.value = proximo(ZOOMS, zoom.value)
    },
    definirDensidade: (valor: ClinicDensidade) => {
      densidade.value = valor
    },
    definirZoom: (valor: ClinicZoom) => {
      zoom.value = valor
    },
  }
}
