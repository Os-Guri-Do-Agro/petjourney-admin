import { computed, inject, provide, type InjectionKey } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import {
  useAppNavigation,
  type AppNavigationItem,
  type AppNavigationSection,
} from '@/composables/useAppNavigation'
import type { LugarDoTrilha } from '@/theme/trilha/rotas'

/**
 * O mapa do portal: **espaços**, e dentro deles **destinos** de trabalho.
 *
 * O menu antigo tinha uma tela por linha — doze só na clínica — e obrigava quem chegava a ler a
 * lista inteira para achar a que respondia a pergunta do momento. Aqui, telas que respondem à
 * mesma pergunta viram **um destino com abas**: Agenda, Pedidos e Fila de espera são o mesmo
 * trabalho (pôr gente na agenda), e as cinco listas do que ficou para trás são Pendências.
 *
 * As URLs não mudaram: cada aba é a rota que já existia. Link salvo, favorito e atalho continuam
 * caindo no mesmo lugar, agora com a vizinhança visível.
 *
 * Permissão e contagem continuam vindo de `useAppNavigation` — quem vê o quê, e os selos de
 * pendência —, e este arquivo só reorganiza.
 */

export type IdDoEspaco = 'inicio' | 'clinica' | 'hotel' | 'portal' | 'conta'

export type TomDoSelo = 'neutro' | 'atencao' | 'risco'

export type Aba = {
  rotulo: string
  to: string
  icone: string
  selo?: number
  tom?: TomDoSelo
  tituloDoSelo?: string
  bloqueado?: boolean
}

export type Destino = {
  id: string
  rotulo: string
  icone: string
  /** Onde o destino abre: a primeira aba. */
  to: string
  abas: Aba[]
  /** Rotas de detalhe que moram neste destino sem ser aba (ficha, prontuário, leito…). */
  prefixos: string[]
  selo?: number
  tom?: TomDoSelo
  tituloDoSelo?: string
  bloqueado?: boolean
}

export type Espaco = {
  id: IdDoEspaco
  rotulo: string
  icone: string
  lugar: LugarDoTrilha
  to: string
  destinos: Destino[]
  selo?: number
  tom?: TomDoSelo
}

/** Como um destino junta as rotas do menu antigo. */
type ReceitaDeDestino = {
  id: string
  chave: string
  icone: string
  abas: { rota: string; chave: string }[]
  prefixos?: string[]
}

const RECEITA_DA_CLINICA: ReceitaDeDestino[] = [
  {
    id: 'hoje',
    chave: 'espacos.clinica.hoje',
    icone: 'ph ph-sun-horizon',
    abas: [{ rota: '/veterinario/meu-dia', chave: 'espacos.clinica.hoje' }],
  },
  {
    id: 'agenda',
    chave: 'espacos.clinica.agenda',
    icone: 'ph ph-calendar-dots',
    abas: [
      { rota: '/veterinario/agenda', chave: 'espacos.abas.agenda' },
      { rota: '/veterinario/pedidos', chave: 'espacos.abas.pedidos' },
      { rota: '/veterinario/fila', chave: 'espacos.abas.fila' },
    ],
  },
  {
    id: 'pacientes',
    chave: 'espacos.clinica.pacientes',
    icone: 'ph ph-paw-print',
    abas: [
      { rota: '/veterinario/pacientes', chave: 'espacos.abas.pacientes' },
      { rota: '/veterinario/atendimentos', chave: 'espacos.abas.atendimentos' },
      { rota: '/veterinario/bulario', chave: 'espacos.abas.bulario' },
    ],
    prefixos: ['/veterinario/paciente/', '/veterinario/atendimento/'],
  },
  {
    id: 'internacao',
    chave: 'espacos.clinica.internacao',
    icone: 'ph ph-bed',
    abas: [{ rota: '/veterinario/internacao', chave: 'espacos.clinica.internacao' }],
  },
  {
    id: 'pendencias',
    chave: 'espacos.clinica.pendencias',
    icone: 'ph ph-list-checks',
    abas: [
      { rota: '/veterinario/atividades', chave: 'espacos.abas.atividades' },
      { rota: '/veterinario/faltas', chave: 'espacos.abas.faltas' },
      { rota: '/veterinario/vacinas', chave: 'espacos.abas.vacinas' },
      { rota: '/veterinario/tratamentos', chave: 'espacos.abas.tratamentos' },
      { rota: '/veterinario/estoque', chave: 'espacos.abas.estoque' },
    ],
  },
  {
    id: 'relatorios',
    chave: 'espacos.clinica.relatorios',
    icone: 'ph ph-chart-line-up',
    abas: [{ rota: '/veterinario/resumo', chave: 'espacos.clinica.relatorios' }],
  },
]

const RECEITA_DO_HOTEL: ReceitaDeDestino[] = [
  {
    id: 'hoje',
    chave: 'espacos.hotel.hoje',
    icone: 'ph ph-sun-horizon',
    abas: [
      { rota: '/hotel/painel', chave: 'espacos.abas.painel' },
      { rota: '/hotel/rotina', chave: 'espacos.abas.rotina' },
      { rota: '/hotel/hospedes', chave: 'espacos.abas.hospedes' },
    ],
    prefixos: ['/hotel/hospedagem/'],
  },
  {
    id: 'reservas',
    chave: 'espacos.hotel.reservas',
    icone: 'ph ph-calendar-dots',
    abas: [
      { rota: '/hotel/mapa', chave: 'espacos.abas.mapa' },
      { rota: '/hotel/reservas', chave: 'espacos.abas.reservas' },
      { rota: '/hotel/pedidos', chave: 'espacos.abas.pedidosDeReserva' },
    ],
    prefixos: ['/hotel/reserva/'],
  },
  {
    id: 'casa',
    chave: 'espacos.hotel.casa',
    icone: 'ph ph-house-line',
    abas: [
      { rota: '/hotel/acomodacoes', chave: 'espacos.abas.acomodacoes' },
      { rota: '/hotel/rotina-padrao', chave: 'espacos.abas.rotinaPadrao' },
    ],
  },
  {
    id: 'relatorios',
    chave: 'espacos.hotel.relatorios',
    icone: 'ph ph-chart-line-up',
    abas: [{ rota: '/hotel/resumo', chave: 'espacos.hotel.relatorios' }],
  },
]

const ICONE_DO_PORTAL: Record<string, string> = {
  '/parceiro/programas': 'ph ph-squares-four',
  '/parceiro/divulgacao': 'ph ph-megaphone-simple',
  '/parceiro/acessos': 'ph ph-key',
  '/parceiro/carteira': 'ph ph-wallet',
  '/parceiro/equipe': 'ph ph-users-three',
  '/parceiro/profissionais': 'ph ph-stethoscope',
  '/parceiro/estabelecimento': 'ph ph-buildings',
  '/parceiro/auditoria': 'ph ph-list-magnifying-glass',
}

/**
 * Telas do portal que moram como aba de outra: Profissionais e Auditoria são abas de Equipe. Pessoas
 * são os logins da empresa; Profissionais, as fichas que a agenda e o prontuário citam (E1-03);
 * Auditoria, o que cada um fez com dado clínico (E1-05).
 */
const ABA_DE: Record<string, { pai: string; rotuloDoPai: string }> = {
  '/parceiro/profissionais': { pai: '/parceiro/equipe', rotuloDoPai: 'parceiro.equipe.pessoas' },
  '/parceiro/auditoria': { pai: '/parceiro/equipe', rotuloDoPai: 'parceiro.equipe.pessoas' },
}

function destinosDoPortal(itens: AppNavigationItem[], t: (chave: string) => string): Destino[] {
  return itens
    .filter((item) => !ABA_DE[item.to])
    .map((item) => {
      const filhas = itens.filter((outro) => ABA_DE[outro.to]?.pai === item.to)
      const rotuloDaPrimeira = filhas.length
        ? t(ABA_DE[filhas[0]!.to]!.rotuloDoPai)
        : item.label
      const abas = [abaDoItem(item, rotuloDaPrimeira), ...filhas.map((filha) => abaDoItem(filha, filha.label))]

      return destinoDe(
        item.to,
        item.label,
        ICONE_DO_PORTAL[item.to] ?? item.icon,
        abas,
        abas.map((aba) => `${aba.to}/`),
      )
    })
}

const PESO_DO_TOM: Record<TomDoSelo, number> = { neutro: 0, atencao: 1, risco: 2 }

/** O tom mais grave entre os selos — o destino avisa pelo pior caso, não pela média. */
export function tomMaisGrave(tons: (TomDoSelo | undefined)[]): TomDoSelo | undefined {
  return tons.reduce<TomDoSelo | undefined>((pior, tom) => {
    if (!tom) {
      return pior
    }

    return !pior || PESO_DO_TOM[tom] > PESO_DO_TOM[pior] ? tom : pior
  }, undefined)
}

function somaDosSelos(itens: { selo?: number }[]) {
  const total = itens.reduce((soma, item) => soma + (item.selo ?? 0), 0)

  return total > 0 ? total : undefined
}

function abaDoItem(item: AppNavigationItem, rotulo: string): Aba {
  return {
    rotulo,
    to: item.to,
    icone: item.icon,
    selo: item.badge,
    tom: item.badgeTom,
    tituloDoSelo: item.badgeTitulo,
    bloqueado: item.locked,
  }
}

function destinoDe(id: string, rotulo: string, icone: string, abas: Aba[], prefixos: string[] = []) {
  const selo = somaDosSelos(abas)
  const comSelo = abas.filter((aba) => aba.selo)

  return {
    id,
    rotulo,
    icone,
    to: abas[0]?.to ?? '/inicio',
    abas,
    prefixos,
    selo,
    tom: selo ? tomMaisGrave(abas.map((aba) => (aba.selo ? aba.tom : undefined))) : undefined,
    /* Com uma aba só de selo, a frase dela explica o total inteiro; com mais de uma, não. */
    tituloDoSelo: comSelo.length === 1 ? comSelo[0]?.tituloDoSelo : undefined,
    bloqueado: abas.every((aba) => aba.bloqueado) || undefined,
  } satisfies Destino
}

/**
 * Monta um espaço a partir de uma receita, com as abas que a seção do menu antigo de fato tem.
 *
 * Rota que a receita pede e o menu não oferece — módulo desligado, permissão — simplesmente não
 * entra; destino que fica sem aba nenhuma some.
 */
function montarPelaReceita(
  receita: ReceitaDeDestino[],
  itens: AppNavigationItem[],
  t: (chave: string) => string,
) {
  const porRota = new Map(itens.map((item) => [item.to, item]))

  return receita.flatMap((passo) => {
    const abas = passo.abas.flatMap(({ rota, chave }) => {
      const item = porRota.get(rota)

      return item ? [abaDoItem(item, t(chave))] : []
    })

    return abas.length > 0 ? [destinoDe(passo.id, t(passo.chave), passo.icone, abas, passo.prefixos)] : []
  })
}

function espacoDe(
  id: IdDoEspaco,
  rotulo: string,
  icone: string,
  lugar: LugarDoTrilha,
  destinos: Destino[],
): Espaco {
  const selo = somaDosSelos(destinos)

  return {
    id,
    rotulo,
    icone,
    lugar,
    to: destinos[0]?.to ?? '/inicio',
    destinos,
    selo,
    tom: selo ? tomMaisGrave(destinos.map((destino) => (destino.selo ? destino.tom : undefined))) : undefined,
  }
}

export function montarEspacos(
  secoes: AppNavigationSection[],
  t: (chave: string) => string,
): Espaco[] {
  const secao = (id: string) => secoes.find((item) => item.id === id)
  const espacos: Espaco[] = []

  const clinica = secao('clinical')

  if (clinica) {
    const itens = [...clinica.items, ...(secao('patients')?.items ?? [])]

    espacos.push(
      espacoDe(
        'clinica',
        t('espacos.clinica.rotulo'),
        'ph ph-stethoscope',
        'clinica',
        montarPelaReceita(RECEITA_DA_CLINICA, itens, t),
      ),
    )
  }

  const hotel = secao('hotel')

  if (hotel) {
    espacos.push(
      espacoDe(
        'hotel',
        t('espacos.hotel.rotulo'),
        'ph ph-bed',
        'hotel',
        montarPelaReceita(RECEITA_DO_HOTEL, hotel.items, t),
      ),
    )
  }

  const portal = secao('portal')

  if (portal) {
    espacos.push(
      espacoDe(
        'portal',
        t('espacos.portal.rotulo'),
        'ph ph-storefront',
        'portal',
        destinosDoPortal(portal.items, t),
      ),
    )
  }

  return espacos
}

function casaComRota(caminho: string, alvo: string) {
  return caminho === alvo || caminho.startsWith(`${alvo}/`)
}

export function destinoContemRota(destino: Destino, caminho: string) {
  return (
    destino.abas.some((aba) => casaComRota(caminho, aba.to)) ||
    destino.prefixos.some((prefixo) => caminho.startsWith(prefixo))
  )
}

export type Localizacao = {
  espaco: Espaco | null
  destino: Destino | null
  aba: Aba | null
}

/** Onde a rota aberta mora no mapa — espaço, destino e aba. */
export function localizar(espacos: Espaco[], caminho: string): Localizacao {
  for (const espaco of espacos) {
    for (const destino of espaco.destinos) {
      if (destinoContemRota(destino, caminho)) {
        return {
          espaco,
          destino,
          aba: destino.abas.find((aba) => casaComRota(caminho, aba.to)) ?? null,
        }
      }
    }
  }

  return { espaco: null, destino: null, aba: null }
}

/** O lugar (cor) de uma rota que não está no mapa: Início e Conta são neutros. */
export function lugarDaRota(caminho: string): LugarDoTrilha {
  if (caminho.startsWith('/veterinario')) {
    return 'clinica'
  }

  if (caminho.startsWith('/hotel')) {
    return 'hotel'
  }

  if (caminho.startsWith('/parceiro')) {
    return 'portal'
  }

  if (caminho.startsWith('/settings') || caminho.startsWith('/perfil')) {
    return 'conta'
  }

  return 'inicio'
}

function criarEspacos() {
  const { t, locale } = useI18n()
  const route = useRoute()
  const navegacao = useAppNavigation()

  const espacos = computed(() => {
    void locale.value

    return montarEspacos(navegacao.navigationSections.value, t)
  })

  const aqui = computed(() => localizar(espacos.value, route.path))

  const lugar = computed<LugarDoTrilha>(() => aqui.value.espaco?.lugar ?? lugarDaRota(route.path))

  return { ...navegacao, espacos, aqui, lugar }
}

export type MapaDosEspacos = ReturnType<typeof criarEspacos>

const CHAVE_DOS_ESPACOS: InjectionKey<MapaDosEspacos> = Symbol('espacos')

/**
 * O mapa é um só por moldura: a moldura cria e oferece, a página e a busca usam o mesmo. Fora da
 * moldura (teste, tela pública), cada um cria o seu.
 */
export function useEspacos(): MapaDosEspacos {
  return inject(CHAVE_DOS_ESPACOS, null) ?? criarEspacos()
}

export function oferecerEspacos(): MapaDosEspacos {
  const mapa = criarEspacos()

  provide(CHAVE_DOS_ESPACOS, mapa)

  return mapa
}
