import { computed, inject, provide, type InjectionKey } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRoute } from 'vue-router'

import {
  useAppNavigation,
  type AppNavigationItem,
  type AppNavigationSection,
} from '@/composables/useAppNavigation'
import { saudePublicaNoMenu } from '@/features/saude-publica/prototipo'
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

export type IdDoEspaco = 'inicio' | 'clinica' | 'hotel' | 'portal' | 'saude' | 'conta'

export type TomDoSelo = 'neutro' | 'atencao' | 'risco'

/**
 * As seções de um espaço: o título diz o que mora embaixo dele antes de a pessoa ler a lista
 * (pedido do Luís, 16/11/2026: "seções onde o usuário olhe e já saiba o que vai ter dentro").
 * Clínica e Hotel: o **dia a dia** (o que se abre toda hora), o **atendimento** (o paciente e o
 * cuidado) e a **gestão** (números e ajustes). Portal: os **clientes** (os pets compartilhados e o
 * convite a quem ainda não usa) e a **empresa** (programas, carteira, equipe, estabelecimento). Até
 * 17/11/2026 havia a seção "Parceria"; com Programas fora do menu quando os dois estão ativos e
 * Indicados virando aba da Divulgação, ela e Clientes ficavam com um item cada.
 * Saúde pública (protótipo): o **acompanhamento** (painel e relatório) e a **ação** (campanhas,
 * ONGs).
 */
export type IdDaSecao =
  | 'dia'
  | 'atendimento'
  | 'gestao'
  | 'clientes'
  | 'empresa'
  | 'acompanhamento'
  | 'acao'

export type SecaoDoEspaco = {
  id: IdDaSecao
  rotulo: string
  destinos: Destino[]
}

export type Aba = {
  rotulo: string
  to: string
  icone: string
  selo?: number
  tom?: TomDoSelo
  tituloDoSelo?: string
  bloqueado?: boolean
  /** Só o caminho exato acende a aba: o que vem depois dele é tela de detalhe do destino. */
  exata?: boolean
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
  /** A seção do espaço em que o destino mora (o título que o agrupa na barra e no menu do alto). */
  secao?: IdDaSecao
}

export type Espaco = {
  id: IdDoEspaco
  rotulo: string
  icone: string
  lugar: LugarDoTrilha
  to: string
  destinos: Destino[]
  /** Os mesmos destinos, na ordem deles, agrupados pelas seções. */
  secoes: SecaoDoEspaco[]
  selo?: number
  tom?: TomDoSelo
}

/** Como um destino junta as rotas do menu antigo. */
type ReceitaDeDestino = {
  id: string
  chave: string
  icone: string
  secao: IdDaSecao
  abas: { rota: string; chave: string; exata?: boolean }[]
  prefixos?: string[]
}

/*
 * A Clínica por trabalho, não por tipo de lista (análise de usabilidade de 16/11/2026,
 * `docs/clinico/usabilidade/ANALISE.md`). Antes, prontuários, bulário e cópias eram abas de
 * "Pacientes" (três de cinco não eram da recepção), vacinas e estoque eram abas de "Pendências", e
 * o plantão, os boletins e as vagas da internação não tinham porta. Agora cada destino responde uma
 * pergunta de quem trabalha, e nenhum passa de quatro abas: a fileira cabe no tablet sem rolar.
 */
const RECEITA_DA_CLINICA: ReceitaDeDestino[] = [
  {
    id: 'hoje',
    chave: 'espacos.clinica.hoje',
    icone: 'ph ph-sun-horizon',
    secao: 'dia',
    abas: [{ rota: '/clinica/meu-dia', chave: 'espacos.clinica.hoje' }],
  },
  {
    id: 'agenda',
    chave: 'espacos.clinica.agenda',
    icone: 'ph ph-calendar-dots',
    secao: 'dia',
    abas: [
      { rota: '/clinica/agenda', chave: 'espacos.abas.calendario' },
      { rota: '/clinica/pedidos', chave: 'espacos.abas.pedidos' },
      { rota: '/clinica/fila', chave: 'espacos.abas.fila' },
    ],
  },
  {
    /* O que ficou para trás é trabalho do dia: mora ao lado do Hoje e da Agenda. */
    id: 'pendencias',
    chave: 'espacos.clinica.pendencias',
    icone: 'ph ph-list-checks',
    secao: 'dia',
    abas: [
      { rota: '/clinica/atividades', chave: 'espacos.abas.visaoGeral' },
      { rota: '/clinica/faltas', chave: 'espacos.abas.faltas' },
      { rota: '/clinica/retornos-pendentes', chave: 'espacos.abas.retornos' },
      { rota: '/clinica/tratamentos', chave: 'espacos.abas.tratamentos' },
    ],
  },
  {
    id: 'pacientes',
    chave: 'espacos.clinica.pacientes',
    icone: 'ph ph-paw-print',
    secao: 'atendimento',
    abas: [
      { rota: '/clinica/pacientes', chave: 'espacos.abas.cadastros' },
      { rota: '/clinica/correcoes', chave: 'espacos.abas.correcoes' },
      { rota: '/clinica/historico-liberado', chave: 'espacos.abas.historicoLiberado' },
    ],
    prefixos: ['/clinica/paciente/', '/clinica/ficha/'],
  },
  {
    /* O prontuário é a consulta, não o cadastro: quem não lê prontuário nem vê este destino. */
    id: 'prontuarios',
    chave: 'espacos.clinica.prontuarios',
    icone: 'ph ph-clipboard-text',
    secao: 'atendimento',
    abas: [
      { rota: '/clinica/atendimentos', chave: 'espacos.abas.atendimentos' },
      { rota: '/clinica/copias-do-prontuario', chave: 'espacos.abas.copias' },
      { rota: '/clinica/bulario', chave: 'espacos.abas.bulario' },
    ],
    prefixos: ['/clinica/atendimento/'],
  },
  {
    /*
     * As quatro perguntas da ala: quem está onde, o que dar agora, a quem avisar e se tem vaga.
     * `exata` no mapa: `/clinica/internacao/<id>` é o detalhe de um internado, não uma aba.
     */
    id: 'internacao',
    chave: 'espacos.clinica.internacao',
    icone: 'ph ph-bed',
    secao: 'atendimento',
    abas: [
      { rota: '/clinica/internacao', chave: 'espacos.abas.mapa', exata: true },
      { rota: '/clinica/internacao/plantao', chave: 'espacos.abas.plantao' },
      { rota: '/clinica/internacao/boletins-pendentes', chave: 'espacos.abas.boletins' },
      { rota: '/clinica/internacao/vagas', chave: 'espacos.abas.vagas' },
    ],
    prefixos: ['/clinica/internacao/'],
  },
  {
    /* Quem vacinar e o que há na geladeira: estoque e aplicadas não são pendência. */
    id: 'vacinas',
    chave: 'espacos.clinica.vacinas',
    icone: 'ph ph-syringe',
    secao: 'atendimento',
    abas: [
      { rota: '/clinica/vacinas', chave: 'espacos.abas.reforcos' },
      { rota: '/clinica/estoque', chave: 'espacos.abas.estoque' },
    ],
  },
  {
    /*
     * O dinheiro da clínica e o dos veterinários (protótipo de 18/11/2026, `features/financeiro`):
     * o caixa do balcão, as contas, as notas fiscais, os repasses e o resultado. `exata` no Caixa:
     * as outras abas moram embaixo do mesmo caminho.
     */
    id: 'financeiro',
    chave: 'espacos.clinica.financeiro',
    icone: 'ph ph-coins',
    secao: 'gestao',
    abas: [
      { rota: '/clinica/financeiro', chave: 'espacos.abas.caixa', exata: true },
      { rota: '/clinica/financeiro/contas', chave: 'espacos.abas.contas' },
      { rota: '/clinica/financeiro/notas', chave: 'espacos.abas.notasFiscais' },
      { rota: '/clinica/financeiro/repasses', chave: 'espacos.abas.repasses' },
      { rota: '/clinica/financeiro/resultado', chave: 'espacos.abas.resultado' },
    ],
  },
  {
    id: 'relatorios',
    chave: 'espacos.clinica.relatorios',
    icone: 'ph ph-chart-line-up',
    secao: 'gestao',
    abas: [{ rota: '/clinica/resumo', chave: 'espacos.clinica.relatorios' }],
  },
  {
    id: 'configuracao',
    chave: 'espacos.clinica.configuracao',
    icone: 'ph ph-sliders-horizontal',
    secao: 'gestao',
    abas: [{ rota: '/clinica/configuracao', chave: 'espacos.clinica.configuracao' }],
  },
]

const RECEITA_DO_HOTEL: ReceitaDeDestino[] = [
  {
    id: 'hoje',
    chave: 'espacos.hotel.hoje',
    icone: 'ph ph-sun-horizon',
    secao: 'dia',
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
    secao: 'dia',
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
    secao: 'gestao',
    abas: [
      { rota: '/hotel/acomodacoes', chave: 'espacos.abas.acomodacoes' },
      { rota: '/hotel/rotina-padrao', chave: 'espacos.abas.rotinaPadrao' },
    ],
  },
  {
    id: 'relatorios',
    chave: 'espacos.hotel.relatorios',
    icone: 'ph ph-chart-line-up',
    secao: 'gestao',
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

/** A seção de cada destino do portal; o que não estiver aqui cai em "Empresa". */
const SECAO_DO_PORTAL: Record<string, IdDaSecao> = {
  '/parceiro/acessos': 'clientes',
  '/parceiro/divulgacao': 'clientes',
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
      const rotuloDaPrimeira = filhas.length ? t(ABA_DE[filhas[0]!.to]!.rotuloDoPai) : item.label
      const abas = [
        abaDoItem(item, rotuloDaPrimeira),
        ...filhas.map((filha) => abaDoItem(filha, filha.label)),
      ]

      return destinoDe(
        item.to,
        item.label,
        ICONE_DO_PORTAL[item.to] ?? item.icon,
        abas,
        abas.map((aba) => `${aba.to}/`),
        SECAO_DO_PORTAL[item.to] ?? 'empresa',
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

function destinoDe(
  id: string,
  rotulo: string,
  icone: string,
  abas: Aba[],
  prefixos: string[] = [],
  secao?: IdDaSecao,
) {
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
    secao,
  } satisfies Destino
}

const ORDEM_DAS_SECOES: IdDaSecao[] = [
  'dia',
  'atendimento',
  'acompanhamento',
  'acao',
  'clientes',
  'gestao',
  'empresa',
]

/**
 * Os destinos agrupados pelas seções, na ordem fixa delas; dentro de cada uma, a ordem da receita.
 * Seção sem destino (permissão, módulo desligado) some.
 */
export function agruparEmSecoes(
  destinos: Destino[],
  t: (chave: string) => string,
): SecaoDoEspaco[] {
  return ORDEM_DAS_SECOES.flatMap((id) => {
    const daSecao = destinos.filter((destino) => (destino.secao ?? 'gestao') === id)

    return daSecao.length ? [{ id, rotulo: t(`espacos.secoes.${id}`), destinos: daSecao }] : []
  })
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
    const abas = passo.abas.flatMap(({ rota, chave, exata }) => {
      const item = porRota.get(rota)

      return item ? [{ ...abaDoItem(item, t(chave)), ...(exata ? { exata } : {}) }] : []
    })

    return abas.length > 0
      ? [destinoDe(passo.id, t(passo.chave), passo.icone, abas, passo.prefixos, passo.secao)]
      : []
  })
}

function espacoDe(
  id: IdDoEspaco,
  rotulo: string,
  icone: string,
  lugar: LugarDoTrilha,
  destinosDaReceita: Destino[],
  t: (chave: string) => string,
): Espaco {
  /* A lista plana segue a ordem das seções: a barra, o menu do alto e a busca leem igual. */
  const secoes = agruparEmSecoes(destinosDaReceita, t)
  const destinos = secoes.flatMap((secao) => secao.destinos)
  const selo = somaDosSelos(destinos)

  return {
    id,
    rotulo,
    icone,
    lugar,
    to: destinos[0]?.to ?? '/inicio',
    destinos,
    secoes,
    selo,
    tom: selo
      ? tomMaisGrave(destinos.map((destino) => (destino.selo ? destino.tom : undefined)))
      : undefined,
  }
}

/**
 * Saúde pública: o protótipo para a apresentação à Câmara de Campo Grande e à Subea
 * (`features/saude-publica`, Ofícios 001 e 002/2026). Destinos fixos, sem permissão nem módulo:
 * o protótipo não toca dado de ninguém. O painel mora em `/saude-publica/painel`, e não no prefixo
 * puro, para a aba dele não acender nas outras telas do espaço.
 */
function destinosDaSaudePublica(t: (chave: string) => string): Destino[] {
  const destino = (id: string, icone: string, secao: IdDaSecao): Destino => {
    const rotulo = t(`espacos.saude.${id}`)
    const to = `/saude-publica/${id}`

    return destinoDe(id, rotulo, icone, [{ rotulo, to, icone }], [], secao)
  }

  return [
    destino('painel', 'ph ph-map-trifold', 'acompanhamento'),
    destino('piloto', 'ph ph-van', 'acao'),
    destino('campanhas', 'ph ph-megaphone', 'acao'),
    destino('ongs', 'ph ph-hand-heart', 'acao'),
    destino('relatorio', 'ph ph-file-text', 'acompanhamento'),
  ]
}

export function montarEspacos(
  secoes: AppNavigationSection[],
  t: (chave: string) => string,
  opcoes: { saudePublica?: boolean } = {},
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
        t,
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
        t,
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
        t,
      ),
    )
  }

  if (opcoes.saudePublica) {
    espacos.push(
      espacoDe(
        'saude',
        t('espacos.saude.rotulo'),
        'ph ph-city',
        'pets',
        destinosDaSaudePublica(t),
        t,
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

/**
 * A aba acesa: entre as que casam com a rota, a de caminho mais longo. Sem isso,
 * `/clinica/internacao/plantao` acenderia o mapa (`/clinica/internacao`), que vem antes na fileira.
 */
function abaDaRota(destino: Destino, caminho: string): Aba | null {
  return (
    destino.abas
      .filter((aba) => (aba.exata ? caminho === aba.to : casaComRota(caminho, aba.to)))
      .sort((uma, outra) => outra.to.length - uma.to.length)[0] ?? null
  )
}

/** Onde a rota aberta mora no mapa — espaço, destino e aba. */
export function localizar(espacos: Espaco[], caminho: string): Localizacao {
  for (const espaco of espacos) {
    for (const destino of espaco.destinos) {
      if (destinoContemRota(destino, caminho)) {
        return { espaco, destino, aba: abaDaRota(destino, caminho) }
      }
    }
  }

  return { espaco: null, destino: null, aba: null }
}

/** O lugar (cor) de uma rota que não está no mapa: Início e Conta são neutros. */
export function lugarDaRota(caminho: string): LugarDoTrilha {
  if (caminho.startsWith('/clinica')) {
    return 'clinica'
  }

  if (caminho.startsWith('/hotel')) {
    return 'hotel'
  }

  if (caminho.startsWith('/parceiro')) {
    return 'portal'
  }

  if (caminho.startsWith('/saude-publica')) {
    return 'pets'
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

    return montarEspacos(navegacao.navigationSections.value, t, {
      /* Aberto fora da produção; em produção, só enquanto se está numa tela do protótipo. */
      saudePublica: saudePublicaNoMenu(route.path),
    })
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
