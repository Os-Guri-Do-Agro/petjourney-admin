/**
 * A pauta da visão geral: o que está parado em cada módulo, como dado.
 *
 * Morava dentro de `HomePauta`. Saiu porque o cabeçalho da página também precisa dela: a linha
 * abaixo do "Olá" diz quantos assuntos pedem atenção, e dois cálculos da mesma pauta divergiriam
 * na primeira mudança de régua. A régua é a dos selos do menu (`useClinicoPendencias`,
 * `useHotelPendencias`): um número em um lugar só, e zero não vira linha.
 */

import {
  PhBed,
  PhCalendarPlus,
  PhCalendarX,
  PhClipboardText,
  PhHourglassMedium,
  PhHouseLine,
  PhListChecks,
  PhPill,
  PhStethoscope,
  PhSyringe,
} from '@phosphor-icons/vue'
import { computed, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import type { SituacaoDaConferencia } from '@/composables/conferencia'
import { useAppNavigation } from '@/composables/useAppNavigation'
import type {
  ContagemDePendencia,
  TomDePendencia,
} from '@/features/clinico/composables/useClinicoPendencias'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

export type LinhaDaPauta = {
  id: string
  to: string
  icone: Component
  total: number
  tom: TomDePendencia
  frase: string
  /** De que o total é feito: "1 boletim retido · 1 administração atrasada". Vazio quando não há. */
  detalhe: string
}

export type ModuloDaPauta = {
  id: 'clinica' | 'hotel'
  titulo: string
  icone: Component
  atalho: { to: string; rotulo: string }
  linhas: LinhaDaPauta[]
  carregado: boolean
  /** Como foi a última conferência deste módulo. */
  situacao: SituacaoDaConferencia | null
  /** Já houve uma conferência que deu certo — os números na tela são dela. */
  jaConferiu: boolean
  recarregar: () => unknown
}

/**
 * O resumo que o cabeçalho da página põe em palavras.
 *
 * - `semModulos`: conta sem clínica nem hotel — não há pauta.
 * - `conferindo`: algum módulo ainda não terminou a primeira conferência.
 * - `urgentes` / `esperando`: há linhas; `total` é quantas (urgentes: só as de risco).
 * - `falhou`: não há linha e alguma conferência não deu certo — não dá para dizer "em dia".
 * - `emDia`: tudo conferido e nada pedindo ação.
 */
export type ResumoDaPauta =
  | { estado: 'semModulos' | 'conferindo' | 'falhou' | 'emDia' }
  | { estado: 'urgentes' | 'esperando'; total: number }

/** Risco primeiro, depois atenção, depois o neutro — a ordem de quem precisa de alguém antes. */
const PESO_DO_TOM: Record<TomDePendencia, number> = { risco: 0, atencao: 1, neutro: 2 }

function porGravidade(linhas: LinhaDaPauta[]) {
  return [...linhas].sort((uma, outra) => PESO_DO_TOM[uma.tom] - PESO_DO_TOM[outra.tom])
}

export function usePautaDaHome() {
  const { t, locale } = useI18n()
  const { hasClinicalProfile, hasHotelProfile, pendenciasClinicas, pendenciasDoHotel } =
    useAppNavigation()

  function linha(
    id: string,
    to: string,
    icone: Component,
    contagem: ContagemDePendencia,
  ): LinhaDaPauta {
    return {
      id,
      to,
      icone,
      total: contagem.total,
      tom: contagem.tom,
      frase: t(`inicio.pauta.${id}`, { total: contagem.total }, contagem.total),
      /* Cada parte é uma frase inteira do catálogo; o separador não é traduzido porque não é texto. */
      detalhe: (contagem.partes ?? [])
        .map((parte) => t(`inicio.pauta.parte.${parte.chave}`, { total: parte.total }, parte.total))
        .join(' · '),
    }
  }

  const modulos = computed<ModuloDaPauta[]>(() => {
    const lista: ModuloDaPauta[] = []

    if (hasClinicalProfile.value) {
      lista.push({
        id: 'clinica',
        titulo: t('clinico.navegacao.secao'),
        icone: PhStethoscope,
        atalho: { to: '/veterinario/meu-dia', rotulo: t('clinico.meuDia.titulo') },
        carregado: pendenciasClinicas.carregado.value,
        situacao: pendenciasClinicas.situacao.value,
        jaConferiu: pendenciasClinicas.conferidoEm.value !== null,
        recarregar: pendenciasClinicas.recarregar,
        linhas: porGravidade(
          [
            linha(
              'pedidos',
              '/veterinario/pedidos',
              PhCalendarPlus,
              pendenciasClinicas.pedidos.value,
            ),
            linha('fila', '/veterinario/fila', PhHourglassMedium, pendenciasClinicas.fila.value),
            linha(
              'internacao',
              '/veterinario/internacao',
              PhBed,
              pendenciasClinicas.internacao.value,
            ),
            linha(
              'atividades',
              '/veterinario/atividades',
              PhClipboardText,
              pendenciasClinicas.atividades.value,
            ),
            linha('vacinas', '/veterinario/vacinas', PhSyringe, pendenciasClinicas.vacinas.value),
            linha(
              'tratamentos',
              '/veterinario/tratamentos',
              PhPill,
              pendenciasClinicas.tratamentos.value,
            ),
          ].filter((item) => item.total > 0),
        ),
      })
    }

    if (hasHotelProfile.value) {
      lista.push({
        id: 'hotel',
        titulo: t('hotel.navegacao.secao'),
        icone: PhHouseLine,
        atalho: { to: '/hotel/painel', rotulo: t('hotel.painel.titulo') },
        carregado: pendenciasDoHotel.carregado.value,
        situacao: pendenciasDoHotel.situacao.value,
        jaConferiu: pendenciasDoHotel.conferidoEm.value !== null,
        recarregar: pendenciasDoHotel.recarregar,
        linhas: porGravidade(
          [
            linha('rotina', '/hotel/rotina', PhListChecks, pendenciasDoHotel.rotina.value),
            linha('vespera', '/hotel/reservas', PhCalendarX, pendenciasDoHotel.vespera.value),
            linha(
              'pedidosDeReserva',
              '/hotel/pedidos',
              PhCalendarPlus,
              pendenciasDoHotel.pedidos.value,
            ),
          ].filter((item) => item.total > 0),
        ),
      })
    }

    return lista
  })

  /** A pauta só existe para quem tem ao menos um módulo de operação. */
  const visivel = computed(() => modulos.value.length > 0)

  /** Algum módulo ainda não terminou a primeira conferência. */
  const algumModuloCarregando = computed(() => modulos.value.some((modulo) => !modulo.carregado))

  /** Alguma conferência está em andamento — a primeira ou uma reconferência. */
  const conferindo = computed(() =>
    [
      hasClinicalProfile.value && pendenciasClinicas.carregando.value,
      hasHotelProfile.value && pendenciasDoHotel.carregando.value,
    ].some(Boolean),
  )

  /**
   * A hora da conferência, só quando **todos** os módulos terminaram, e a mais antiga entre eles:
   * é ela que diz quão velho pode estar um número da pauta.
   */
  const conferidoEm = computed(() => {
    if (algumModuloCarregando.value) return ''

    const datas = [
      hasClinicalProfile.value ? pendenciasClinicas.conferidoEm.value : null,
      hasHotelProfile.value ? pendenciasDoHotel.conferidoEm.value : null,
    ].filter((data): data is Date => data !== null)

    if (datas.length === 0) return ''

    const maisAntiga = new Date(Math.min(...datas.map((data) => data.getTime())))

    return maisAntiga.toLocaleTimeString(INTL_LOCALE[locale.value as Locale], {
      hour: '2-digit',
      minute: '2-digit',
    })
  })

  /**
   * Todos os módulos falharam juntos — quase sempre a rede, não um módulo. Aí vai um aviso só, no
   * topo da pauta, em vez do mesmo aviso repetido em cada módulo com um "Tentar de novo" em cada.
   */
  const falhaGeral = computed(
    () =>
      modulos.value.length > 0 &&
      modulos.value.every((modulo) => modulo.carregado && modulo.situacao === 'falhou'),
  )

  const avisoGeral = computed(() => {
    if (!falhaGeral.value) return ''

    return modulos.value.every((modulo) => modulo.jaConferiu)
      ? t('inicio.pauta.falhouDeNovo')
      : t('inicio.pauta.falhou')
  })

  /** O que dizer quando a conferência de um módulo não deu certo. Vazio quando deu. */
  function avisoDe(modulo: ModuloDaPauta) {
    if (falhaGeral.value) return ''
    if (modulo.situacao === 'parcial') return t('inicio.pauta.parcial')
    if (modulo.situacao !== 'falhou') return ''

    return modulo.jaConferiu ? t('inicio.pauta.falhouDeNovo') : t('inicio.pauta.falhou')
  }

  function reconferir() {
    for (const modulo of modulos.value) {
      void modulo.recarregar()
    }
  }

  const resumo = computed<ResumoDaPauta>(() => {
    if (!visivel.value) return { estado: 'semModulos' }
    if (algumModuloCarregando.value) return { estado: 'conferindo' }

    const linhas = modulos.value.flatMap((modulo) => modulo.linhas)
    const urgentes = linhas.filter((item) => item.tom === 'risco').length

    if (urgentes > 0) return { estado: 'urgentes', total: urgentes }
    if (linhas.length > 0) return { estado: 'esperando', total: linhas.length }
    if (modulos.value.some((modulo) => modulo.situacao !== 'ok')) return { estado: 'falhou' }

    return { estado: 'emDia' }
  })

  return {
    modulos,
    visivel,
    algumModuloCarregando,
    conferindo,
    conferidoEm,
    avisoGeral,
    avisoDe,
    reconferir,
    resumo,
  }
}
