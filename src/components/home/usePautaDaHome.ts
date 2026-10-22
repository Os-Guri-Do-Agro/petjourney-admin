/**
 * A pauta da visão geral: o que está parado em cada módulo, como dado.
 *
 * Morava dentro de `HomePauta`. Saiu porque o cabeçalho da página também precisa dela: a linha
 * abaixo do "Olá" diz quantos assuntos pedem atenção, e dois cálculos da mesma pauta divergiriam
 * na primeira mudança de régua. A régua é a dos selos do menu: um número em um lugar só, e zero não
 * vira linha. Na demonstração os números são contados sobre os dados locais (`useClinicoPendencias`,
 * `useHotelPendencias`); fora dela vêm do servidor (`usePendenciasDoPortal`, E1-06).
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
  PhStorefront,
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
import { pendenciasComValor, tomDaPendencia } from '@/composables/usePendenciasDoPortal'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'
import type { ModuloDaPendencia } from '@/service/parceiro/pendencias-service'

export type LinhaDaPauta = {
  id: string
  to: string
  icone: Component
  total: number
  tom: TomDePendencia
  frase: string
  /** De que o total é feito: "1 boletim retido · 1 administração atrasada". Vazio quando não há. */
  detalhe: string
  /** O nome da tela aonde a linha leva, quando não é o do catálogo da pauta (`inicio.pauta.onde`). */
  onde?: string
}

export type ModuloDaPauta = {
  id: 'clinica' | 'hotel' | 'portal'
  titulo: string
  icone: Component
  atalho?: { to: string; rotulo: string }
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

/** Os módulos dos contadores do servidor, na ordem da barra, e o grupo de cada um na pauta. */
const GRUPO_DO_MODULO: Record<
  ModuloDaPendencia,
  { id: ModuloDaPauta['id']; chave: string; icone: Component }
> = {
  CLINICA: { id: 'clinica', chave: 'clinico.navegacao.secao', icone: PhStethoscope },
  HOTEL: { id: 'hotel', chave: 'hotel.navegacao.secao', icone: PhHouseLine },
  PORTAL: { id: 'portal', chave: 'nav.sections.portal', icone: PhStorefront },
}

export function usePautaDaHome() {
  const { t, locale } = useI18n()
  const {
    clinicaNaDemonstracao: hasClinicalProfile,
    hotelNaDemonstracao: hasHotelProfile,
    hasClinicalProfile: temClinica,
    hasHotelProfile: temHotel,
    modoDemonstracao,
    navigationSections,
    pendenciasClinicas,
    pendenciasDoHotel,
    pendenciasDoPortal,
    fraseDaPendencia,
  } = useAppNavigation()

  /**
   * As telas que a barra oferece a esta conta, com o nome de cada uma. Uma linha do servidor só
   * entra na pauta se leva a uma delas: o módulo pode estar ligado antes de a tela dele chegar ao
   * portal, e uma linha que abre uma tela fechada é um clique que volta para o Início.
   */
  const destinos = computed(
    () =>
      new Map(
        navigationSections.value.flatMap((secao) =>
          secao.items.map((item) => [item.to, item.label]),
        ),
      ),
  )

  /** A pauta fora da demonstração: os contadores do servidor, agrupados por módulo. */
  const modulosDoServidor = computed<ModuloDaPauta[]>(() => {
    const lista = pendenciasDoPortal.lista.value
    const comValor = pendenciasComValor(lista)

    return (Object.keys(GRUPO_DO_MODULO) as ModuloDaPendencia[]).flatMap((modulo) => {
      const grupo = GRUPO_DO_MODULO[modulo]
      const linhas = comValor
        .filter((item) => item.modulo === modulo && destinos.value.has(item.rota))
        .map<LinhaDaPauta>((item) => ({
          id: item.chave,
          to: item.rota,
          icone: grupo.icone,
          total: item.valor,
          tom: tomDaPendencia(item.tom),
          frase: fraseDaPendencia(item.chave, item.valor),
          detalhe: '',
          onde: destinos.value.get(item.rota),
        }))

      if (linhas.length === 0) return []

      /* Um contador deste módulo que falhou no servidor deixa o grupo "parcial". */
      const falhouAqui = lista.some((item) => item.modulo === modulo && item.valor === null)
      const situacao = pendenciasDoPortal.situacao.value

      return [
        {
          id: grupo.id,
          titulo: t(grupo.chave),
          icone: grupo.icone,
          linhas: porGravidade(linhas),
          carregado: true,
          situacao: situacao === 'falhou' ? 'falhou' : falhouAqui ? 'parcial' : 'ok',
          jaConferiu: pendenciasDoPortal.conferidoEm.value !== null,
          recarregar: pendenciasDoPortal.recarregar,
        },
      ]
    })
  })

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

  const modulosDaDemonstracao = computed<ModuloDaPauta[]>(() => {
    const lista: ModuloDaPauta[] = []

    if (hasClinicalProfile.value) {
      lista.push({
        id: 'clinica',
        titulo: t('clinico.navegacao.secao'),
        icone: PhStethoscope,
        atalho: { to: '/clinica/meu-dia', rotulo: t('clinico.meuDia.titulo') },
        carregado: pendenciasClinicas.carregado.value,
        situacao: pendenciasClinicas.situacao.value,
        jaConferiu: pendenciasClinicas.conferidoEm.value !== null,
        recarregar: pendenciasClinicas.recarregar,
        linhas: porGravidade(
          [
            linha('pedidos', '/clinica/pedidos', PhCalendarPlus, pendenciasClinicas.pedidos.value),
            linha('fila', '/clinica/fila', PhHourglassMedium, pendenciasClinicas.fila.value),
            linha('internacao', '/clinica/internacao', PhBed, pendenciasClinicas.internacao.value),
            linha(
              'atividades',
              '/clinica/atividades',
              PhClipboardText,
              pendenciasClinicas.atividades.value,
            ),
            linha('vacinas', '/clinica/vacinas', PhSyringe, pendenciasClinicas.vacinas.value),
            linha(
              'tratamentos',
              '/clinica/tratamentos',
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

  const modulos = computed(() =>
    modoDemonstracao.value ? modulosDaDemonstracao.value : modulosDoServidor.value,
  )

  /**
   * Na demonstração, a pauta existe para quem tem ao menos um módulo de operação. Fora dela, só
   * quando o servidor devolve alguma coisa a fazer numa tela que a conta abre.
   */
  const visivel = computed(() => modulos.value.length > 0)

  /** Algum módulo ainda não terminou a primeira conferência. */
  const algumModuloCarregando = computed(() => modulos.value.some((modulo) => !modulo.carregado))

  /** Alguma conferência está em andamento — a primeira ou uma reconferência. */
  const conferindo = computed(() =>
    modoDemonstracao.value
      ? [
          hasClinicalProfile.value && pendenciasClinicas.carregando.value,
          hasHotelProfile.value && pendenciasDoHotel.carregando.value,
        ].some(Boolean)
      : pendenciasDoPortal.carregando.value,
  )

  /**
   * A hora da conferência, só quando **todos** os módulos terminaram, e a mais antiga entre eles:
   * é ela que diz quão velho pode estar um número da pauta.
   */
  const conferidoEm = computed(() => {
    if (algumModuloCarregando.value) return ''

    const datas = (
      modoDemonstracao.value
        ? [
            hasClinicalProfile.value ? pendenciasClinicas.conferidoEm.value : null,
            hasHotelProfile.value ? pendenciasDoHotel.conferidoEm.value : null,
          ]
        : [pendenciasDoPortal.conferidoEm.value]
    ).filter((data): data is Date => data !== null)

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

  /**
   * Fora da demonstração e sem nada a fazer: quem tem Clínica ou Hotel na barra ouve que está em
   * dia (ou que não deu para conferir); a conta só do Portal segue com a frase do Portal.
   */
  function resumoSemLinhas(): ResumoDaPauta {
    if (!temClinica.value && !temHotel.value) return { estado: 'semModulos' }
    if (!pendenciasDoPortal.carregado.value) return { estado: 'conferindo' }
    if (pendenciasDoPortal.situacao.value === 'falhou') return { estado: 'falhou' }

    return { estado: 'emDia' }
  }

  const resumo = computed<ResumoDaPauta>(() => {
    if (!visivel.value) {
      return modoDemonstracao.value ? { estado: 'semModulos' } : resumoSemLinhas()
    }

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
