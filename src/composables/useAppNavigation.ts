import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import i18n from '@/i18n'
import {
  useClinicoPendencias,
  type ContagemDePendencia,
} from '@/features/clinico/composables/useClinicoPendencias'
import { useHotelPendencias } from '@/features/hotel/composables/useHotelPendencias'
import { hasVeterinarioProfile } from '@/service/auth/auth-session'
import { useModuloClinico } from '@/composables/useModuloClinico'
import { useModuloHotel } from '@/composables/useModuloHotel'
import { useParceiroStore } from '@/stores/parceiro'

export type AppNavigationItem = {
  label: string
  to: string
  icon: string
  /** Item visível, mas bloqueado com teaser (ex.: cupom em desenvolvimento). */
  comingSoon?: boolean
  /** Cadastro suspenso: item visível com cadeado; a tela destino mostra o gate. */
  locked?: boolean
  /**
   * Quanto trabalho está parado atrás deste link.
   *
   * Só conta o que **alguém precisa fazer** — nunca volume de rotina. Zero não vira selo: um
   * "0" ao lado de cada tela é ruído que ensina a não olhar para a coluna.
   */
  badge?: number
  /** Gravidade do selo, na mesma escada de tom do módulo clínico. */
  badgeTom?: 'neutro' | 'atencao' | 'risco'
  /** O que o número quer dizer, para quem passa o mouse e para o leitor de tela. */
  badgeTitulo?: string
}

/**
 * Um bloco de telas dentro de uma seção, com rótulo próprio.
 *
 * Existe por causa da seção **Clínica**, que tem dez destinos. Dez links seguidos, sem hierarquia
 * nenhuma, obrigam quem chega a ler os dez para descobrir qual responde à pergunta do momento —
 * e foi essa lista plana que produziu a reclamação de "fluxo confuso". Os blocos não tiram nem
 * escondem nada: dão à lista a mesma ordem que a cabeça de quem opera já usa — o que é **agora**,
 * o que está **em curso**, o que **ficou para trás** e o que se olha **depois**.
 */
export type AppNavigationBloco = {
  id: string
  label: string
  items: AppNavigationItem[]
}

export type AppNavigationGroup = {
  id: string
  label: string
  items: AppNavigationItem[]
  /** Subdivisão rotulada de `items`. Quando ausente, a lista é plana como sempre foi. */
  blocos?: AppNavigationBloco[]
}

export type AppNavigationSection = {
  id: string
  label: string
  icon: string
  items: AppNavigationItem[]
  blocos?: AppNavigationBloco[]
}

/**
 * Menu clínico. Ligado com a entrada do módulo `src/features/clinico`, que substituiu os
 * stubs de `/veterinario/*` por telas com camada de dados própria.
 *
 * A camada é mocada e determinística (`features/clinico/data`), com a mesma forma da API
 * futura — nenhum dado fictício vaza para fora do módulo.
 */
export const CLINICAL_MENU_ENABLED = true

/**
 * Modo demonstração do módulo clínico.
 *
 * Com `true`, o menu clínico aparece para **qualquer conta do portal**, mesmo sem perfil
 * veterinário — é o que permite apresentar o módulo a partir de uma conta de parceiro enquanto
 * a API clínica não existe.
 *
 * O interruptor é uma constante e não uma variável de ambiente de propósito: ele precisa ser
 * revisto por quem lê o código, não esquecido ligado num painel de deploy. **Vire para `false`
 * junto com a primeira entrega da API clínica** — a partir daí o que está atrás do menu é
 * prontuário de paciente real
 */
export const CLINICAL_MENU_DEMO = true

/**
 * Menu do hotel. Ligado com a entrada do módulo `src/features/hotel`.
 *
 * A camada é mocada e determinística (`features/hotel/data`), com a mesma forma da API futura —
 * nenhum dado fictício vaza para fora do módulo.
 */
export const HOTEL_MENU_ENABLED = true

/**
 * Modo demonstração do módulo hotel.
 *
 * Mesma constante e mesma razão do clínico: enquanto o módulo roda sobre dados de demonstração,
 * ele é apresentável a partir de qualquer conta do portal. **Vire para `false` junto com a
 * primeira entrega da API de hospedagem** — a partir daí o que está atrás do menu é a rotina de um
 * animal de verdade, com o telefone de um responsável de verdade.
 */
export const HOTEL_MENU_DEMO = true

/**
 * Rotas do hotel, agrupadas pela pergunta que respondem.
 *
 * Os três blocos nasceram com o módulo, e não depois de alguém reclamar — é a lição que o menu
 * clínico aprendeu caro (ver `docs/clinico/08-orientacao-do-fluxo.md`): uma lista plana de nove
 * destinos obriga quem chega a ler os nove para descobrir qual responde à pergunta do momento.
 *
 * 1. **Hoje** — o que acontece agora e onde cabe mais alguém.
 * 2. **Hospedagem** — o que está vendido e quem está na casa.
 * 3. **A casa** — como o hotel é configurado, e como ele foi.
 */
const HOTEL_BLOCKS: readonly BlocoDeModulo[] = [
  /*
   * O ensino não é um destino do menu: é o botão "Como usar" dentro de cada tela.
   *
   * Existiu aqui uma tela "Como funciona", primeira da lista, que explicava o fluxo inteiro num
   * lugar só. Saiu porque ensinava longe do que ensinava — quem lia "a coluna de documentação é
   * ordenável" ainda não tinha visto coluna nenhuma. Agora cada tela tem o próprio tutorial, e a
   * frase aparece apontando para o objeto de que fala.
   */
  {
    id: 'hotel-vender',
    key: 'hotel.navegacao.vender',
    rotas: [
      { key: 'hotel.mapa.titulo', to: '/hotel/mapa', icon: 'pi pi-th-large' },
      { key: 'hotel.reservas.titulo', to: '/hotel/reservas', icon: 'pi pi-calendar' },
    ],
  },
  {
    /* Receber, cuidar e entregar acontecem no mesmo dia e pelas mesmas mãos: um bloco só. */
    id: 'hotel-dia',
    key: 'hotel.navegacao.dia',
    rotas: [
      { key: 'hotel.painel.titulo', to: '/hotel/painel', icon: 'pi pi-sun' },
      { key: 'hotel.rotina.titulo', to: '/hotel/rotina', icon: 'pi pi-list-check' },
      { key: 'hotel.hospedes.titulo', to: '/hotel/hospedes', icon: 'pi pi-heart' },
    ],
  },
  {
    id: 'hotel-casa',
    key: 'hotel.navegacao.casa',
    rotas: [
      { key: 'hotel.acomodacoes.titulo', to: '/hotel/acomodacoes', icon: 'pi pi-building' },
      /*
       * Fica ao lado de Acomodações porque é a mesma classe de trabalho: configuração que se abre
       * no dia da mudança, e não um painel que se consulta todo dia. A rota é `rotina-padrao` e
       * não `rotinas` — `/hotel/rotina` já é a prancheta do turno, e "Rotina" ao lado de "Rotinas"
       * no menu é a armadilha que `rotas-do-hotel.spec.ts` existe para evitar do lado do código.
       */
      { key: 'hotel.rotinaPadrao.titulo', to: '/hotel/rotina-padrao', icon: 'pi pi-stopwatch' },
      { key: 'hotel.resumo.titulo', to: '/hotel/resumo', icon: 'pi pi-chart-bar' },
    ],
  },
]

/** Equipe oculta no go-live até a operação do time estar pronta no portal. */
export const EQUIPE_MENU_ENABLED = false

/**
 * Seção de destino quando a rota atual não pertence a nenhuma — hoje só a visão geral.
 *
 * O menu tinha uma seção "Início" cujo painel repetia **todas** as outras: doze links existiam
 * em dois lugares, e o trilho prometia seções que a primeira seção desfazia. A visão geral virou
 * um link direto no topo do trilho.
 *
 * A página `/inicio` também deixou de ser inventário de telas: a grade de atalhos repetia o painel
 * que está aberto ao lado dela. Ela agora responde o que o menu não sabe — quanto a parceria
 * rendeu e o que está parado em cada módulo.
 */
export const OVERVIEW_SECTION_ID = 'overview'

/**
 * Rotas do módulo clínico, agrupadas pela pergunta que respondem.
 *
 * Os rótulos vêm dos catálogos; nada fixo em português aqui.
 *
 * A lista era plana e tinha dez itens em ordem de construção — Meu dia, Resumo, Agenda,
 * Prontuários, Fila, Internação, Faltas, Vacinas, Atividades. Ordem de construção não é ordem de
 * uso: o Resumo, que se olha na segunda de manhã uma vez por semana, ficava em segundo lugar,
 * acima da Agenda; e a Fila aparecia depois dos Prontuários, embora as duas coisas aconteçam em
 * momentos opostos do dia.
 *
 * Os quatro blocos abaixo são as quatro perguntas, na ordem em que a clínica as faz:
 *
 * 1. **Agora** — o que está acontecendo neste minuto e onde cabe mais alguém.
 * 2. **Em curso** — o trabalho aberto que atravessa o dia: prontuário sem fecho, animal internado.
 * 3. **Pendências** — o que ficou para trás e envelhece calado.
 * 4. **Análise** — o que só faz sentido olhar depois que o dia acabou.
 *
 * Nada saiu da lista. O que mudou é que ela deixou de exigir que se leia inteira.
 */
/** Um destino de menu de um módulo. Compartilhado entre a clínica e o hotel. */
type RotaDeModulo = { key: string; to: string; icon: string }

type BlocoDeModulo = { id: string; key: string; rotas: readonly RotaDeModulo[] }

const CLINICAL_BLOCKS: readonly BlocoDeModulo[] = [
  {
    id: 'agora',
    key: 'clinico.navegacao.agora',
    rotas: [
      { key: 'clinico.meuDia.titulo', to: '/veterinario/meu-dia', icon: 'pi pi-sun' },
      { key: 'clinico.agenda.titulo', to: '/veterinario/agenda', icon: 'pi pi-calendar' },
      { key: 'clinico.fila.titulo', to: '/veterinario/fila', icon: 'pi pi-hourglass' },
    ],
  },
  {
    /*
     * Internação vem logo depois do prontuário porque é a mesma pergunta com outro relógio: o
     * prontuário é o trabalho de vinte minutos, a internação é o de três dias. As duas são
     * trabalho **aberto**, e nenhuma delas cabe na agenda.
     */
    id: 'em-curso',
    key: 'clinico.navegacao.emCurso',
    rotas: [
      {
        key: 'clinico.atendimentos.titulo',
        to: '/veterinario/atendimentos',
        icon: 'pi pi-file-edit',
      },
      { key: 'clinico.internacao.titulo', to: '/veterinario/internacao', icon: 'pi pi-building' },
    ],
  },
  {
    id: 'pendencias',
    key: 'clinico.navegacao.pendencias',
    rotas: [
      { key: 'clinico.atividades.titulo', to: '/veterinario/atividades', icon: 'pi pi-list' },
      { key: 'clinico.faltas.titulo', to: '/veterinario/faltas', icon: 'pi pi-user-minus' },
      /* Vacinas fica no menu clínico, não em Pets: é fila de trabalho da recepção, não cadastro. */
      { key: 'clinico.vacinas.titulo', to: '/veterinario/vacinas', icon: 'pi pi-shield' },
      /* Pelo mesmo motivo: é onde mora o alerta de adesão — para quem a clínica precisa ligar. */
      {
        key: 'clinico.adesao.titulo',
        to: '/veterinario/tratamentos',
        icon: 'pi pi-calendar-clock',
      },
    ],
  },
  {
    id: 'analise',
    key: 'clinico.navegacao.analise',
    rotas: [{ key: 'clinico.resumo.titulo', to: '/veterinario/resumo', icon: 'pi pi-chart-bar' }],
  },
]

const PATIENT_ROUTES = [
  { key: 'clinico.pacientes.titulo', to: '/veterinario/pacientes', icon: 'pi pi-users' },
  { key: 'clinico.bulario.titulo', to: '/veterinario/bulario', icon: 'pi pi-book' },
] as const

export function parseNavTarget(to: string) {
  const hashIndex = to.indexOf('#')
  const hash = hashIndex >= 0 ? to.slice(hashIndex) : ''
  const pathAndQuery = hashIndex >= 0 ? to.slice(0, hashIndex) : to
  const queryIndex = pathAndQuery.indexOf('?')
  const path = queryIndex >= 0 ? pathAndQuery.slice(0, queryIndex) : pathAndQuery

  return { path, hash }
}

export function useAppNavigation() {
  const { t, locale } = useI18n()
  const parceiroStore = useParceiroStore()

  /**
   * Quem vê o módulo clínico.
   *
   * Exigia `hasVeterinarioProfile()` — o claim `veterinarioId` no token. Conta de parceiro não
   * traz esse claim, então o menu não montava para ninguém do portal, e o módulo só era
   * alcançável digitando `/veterinario/...` na barra de endereço (a rota nunca exigiu o perfil;
   * o guard só pede sessão).
   *
   * Enquanto o módulo roda sobre a camada mocada, o menu está aberto a qualquer conta do portal,
   * para poder ser demonstrado. **Quando a API clínica existir, isto volta a exigir o perfil** —
   * aí o que está atrás do menu é prontuário de paciente real, e prontuário não se mostra a quem
   * não é do corpo clínico.
   */
  const { ativo: moduloClinicoAtivo } = useModuloClinico()
  const { ativo: moduloHotelAtivo } = useModuloHotel()

  const hasClinicalProfile = computed(
    () =>
      /*
       * O interruptor oculto vem **antes** de tudo: enquanto as telas rodam sobre dados
       * mocados, elas não aparecem para quem abriu o portal para trabalhar. Um menu
       * "Pacientes" com bichos que não existem é indistinguível de um defeito.
       *
       * Ligar é decisão de quem vai demonstrar — ver `useModuloClinico`.
       */
      moduloClinicoAtivo.value &&
      CLINICAL_MENU_ENABLED &&
      (CLINICAL_MENU_DEMO || hasVeterinarioProfile()),
  )

  /**
   * Quem vê o módulo hotel.
   *
   * Mesma regra e mesma ordem do clínico: o interruptor oculto vem antes de tudo. Uma casa pode
   * ter os dois módulos, um só, ou nenhum — e por isso os dois portões são independentes.
   */
  const hasHotelProfile = computed(
    () => moduloHotelAtivo.value && HOTEL_MENU_ENABLED && HOTEL_MENU_DEMO,
  )

  const hotelBlocos = computed<AppNavigationBloco[]>(() => {
    void locale.value

    return HOTEL_BLOCKS.map((bloco) => ({
      id: bloco.id,
      label: t(bloco.key),
      items: bloco.rotas.map(decorarRota),
    }))
  })

  const hotelItems = computed<AppNavigationItem[]>(() =>
    hotelBlocos.value.flatMap((bloco) => bloco.items),
  )

  const accountItems = computed<AppNavigationItem[]>(() => {
    void locale.value
    return [{ label: t('nav.items.settings'), to: '/settings', icon: 'pi pi-cog' }]
  })

  /**
   * Trabalho parado atrás de cada tela clínica.
   *
   * Carrega sozinho quando o módulo está ligado para esta conta, e fica zerado quando não está —
   * ver `useClinicoPendencias`.
   */
  const pendencias = useClinicoPendencias(() => hasClinicalProfile.value)

  /** O mesmo para o hotel: rotina atrasada e véspera travada. Ver `useHotelPendencias`. */
  const pendenciasDoHotel = useHotelPendencias(() => hasHotelProfile.value)

  /**
   * Contadores por rota, com a frase que explica o número.
   *
   * A frase é por rota e não uma só para todas: "3" ao lado de Fila e "3" ao lado de Vacinas
   * são três coisas diferentes, e um `title` genérico de "3 pendências" desperdiça o único
   * lugar em que a tela pode dizer *o quê*. É também o texto que o leitor de tela lê — para
   * quem não vê a cor do selo, ele é a informação inteira.
   *
   * Rota sem entrada aqui simplesmente não ganha selo.
   */
  const contagemPorRota = computed<
    Record<string, { contagem: ContagemDePendencia; frase: string } | undefined>
  >(() => ({
    '/veterinario/fila': { contagem: pendencias.fila.value, frase: 'clinico.navegacao.selo.fila' },
    '/veterinario/internacao': {
      contagem: pendencias.internacao.value,
      frase: 'clinico.navegacao.selo.internacao',
    },
    '/veterinario/atividades': {
      contagem: pendencias.atividades.value,
      frase: 'clinico.navegacao.selo.atividades',
    },
    '/veterinario/vacinas': {
      contagem: pendencias.vacinas.value,
      frase: 'clinico.navegacao.selo.vacinas',
    },
    '/veterinario/tratamentos': {
      contagem: pendencias.tratamentos.value,
      frase: 'clinico.navegacao.selo.tratamentos',
    },
    '/hotel/rotina': {
      contagem: pendenciasDoHotel.rotina.value,
      frase: 'hotel.navegacao.selo.rotina',
    },
    '/hotel/reservas': {
      contagem: pendenciasDoHotel.vespera.value,
      frase: 'hotel.navegacao.selo.vespera',
    },
  }))

  function decorarRota(rota: { key: string; to: string; icon: string }): AppNavigationItem {
    const selo = contagemPorRota.value[rota.to]
    const item: AppNavigationItem = { label: t(rota.key), to: rota.to, icon: rota.icon }

    /* Zero não vira selo: um "0" em cada linha é ruído que ensina a não olhar para a coluna. */
    if (selo && selo.contagem.total > 0) {
      item.badge = selo.contagem.total
      item.badgeTom = selo.contagem.tom
      item.badgeTitulo = t(selo.frase, { total: selo.contagem.total }, selo.contagem.total)
    }

    return item
  }

  const clinicalBlocos = computed<AppNavigationBloco[]>(() => {
    void locale.value

    return CLINICAL_BLOCKS.map((bloco) => ({
      id: bloco.id,
      label: t(bloco.key),
      items: bloco.rotas.map(decorarRota),
    }))
  })

  const clinicalItems = computed<AppNavigationItem[]>(() =>
    clinicalBlocos.value.flatMap((bloco) => bloco.items),
  )

  const patientItems = computed<AppNavigationItem[]>(() => {
    void locale.value

    return PATIENT_ROUTES.map((rota) => ({ label: t(rota.key), to: rota.to, icon: rota.icon }))
  })

  const portalItems = computed<AppNavigationItem[]>(() => {
    void locale.value
    const items: AppNavigationItem[] = [
      { label: t('nav.items.programas'), to: '/parceiro/programas', icon: 'pi pi-th-large' },
      { label: t('nav.items.divulgacao'), to: '/parceiro/divulgacao', icon: 'pi pi-share-alt' },
      {
        label: t('nav.items.acessos'),
        to: '/parceiro/acessos',
        icon: 'pi pi-clipboard',
      },
    ]

    if (parceiroStore.statusAfiliadoAtivo) {
      items.push({
        label: t('nav.items.financeiro'),
        to: '/parceiro/carteira',
        icon: 'pi pi-wallet',
      })
    }

    if (EQUIPE_MENU_ENABLED) {
      items.push({ label: 'Equipe', to: '/parceiro/equipe', icon: 'pi pi-users' })
    }

    if (parceiroStore.cadastroSuspenso) {
      return items.map((item) => ({ ...item, locked: true }))
    }

    return items
  })

  /** A visão geral não é seção: é um destino só, e aparece como link no topo do trilho. */
  const overviewItem = computed<AppNavigationItem>(() => {
    void locale.value
    return { label: t('nav.items.overview'), to: '/inicio', icon: 'pi pi-home' }
  })

  const navigationSections = computed<AppNavigationSection[]>(() => {
    void locale.value
    const sections: AppNavigationSection[] = [
      {
        id: 'portal',
        label: t('nav.sections.portal'),
        icon: 'pi pi-briefcase',
        items: portalItems.value,
      },
    ]

    if (hasClinicalProfile.value) {
      sections.push(
        {
          id: 'clinical',
          /*
           * `clinico.modulo` é um objeto — `{ visivel, oculto }`, as duas frases do interruptor
           * do módulo. Usado como rótulo, `t()` não achava texto e devolvia o próprio caminho:
           * a seção clínica se chamava **"clinico.modulo"** no trilho e no cabeçalho da página.
           */
          label: t('clinico.navegacao.secao'),
          icon: 'pi pi-calendar',
          items: clinicalItems.value,
          blocos: clinicalBlocos.value,
        },
        {
          id: 'patients',
          label: t('nav.groups.pets'),
          icon: 'pi pi-heart',
          items: patientItems.value,
        },
      )
    }

    if (hasHotelProfile.value) {
      sections.push({
        id: 'hotel',
        label: t('hotel.navegacao.secao'),
        icon: 'pi pi-building',
        items: hotelItems.value,
        blocos: hotelBlocos.value,
      })
    }

    sections.push({
      id: 'account',
      label: t('nav.sections.account'),
      icon: 'pi pi-user',
      items: accountItems.value,
    })

    return sections
  })

  /**
   * As mesmas seções em forma de lista, para o modo "lista única" do menu. Uma origem só: seção
   * nova aparece no trilho e na lista sem ninguém lembrar disso.
   *
   * `homeShortcutGroups` sobrevive como alias: alimentava a grade de atalhos da visão geral, que
   * saiu da página, e o componente continua no repositório para quem quiser remontá-lo.
   */
  const navigationGroups = computed<AppNavigationGroup[]>(() =>
    navigationSections.value.map((section) => ({
      id: section.id,
      label: section.label,
      items: section.items,
      blocos: section.blocos,
    })),
  )

  const homeShortcutGroups = navigationGroups

  return {
    navigationSections,
    navigationGroups,
    overviewItem,
    hasClinicalProfile,
    hasHotelProfile,
    homeShortcutGroups,
    pendenciasClinicas: pendencias,
    pendenciasDoHotel,
  }
}

export function navItemMatches(itemPath: string, currentPath: string) {
  return currentPath === itemPath || currentPath.startsWith(`${itemPath}/`)
}

export function resolveActiveSectionId(path: string, hasClinical: boolean) {
  /*
   * O hotel vem antes das outras comparações porque `/hotel` não colide com nenhuma delas — e
   * porque deixá-lo no fim o faria cair no `return 'portal'` quando o módulo estivesse desligado,
   * marcando a seção errada no trilho durante a navegação que o guard ainda vai interromper.
   */
  if (path.startsWith('/hotel')) {
    return 'hotel'
  }

  if (path === '/inicio') {
    return OVERVIEW_SECTION_ID
  }

  if (path.startsWith('/parceiro')) {
    return 'portal'
  }

  /*
   * As rotas de "Pets" precisam estar listadas aqui uma a uma.
   *
   * Tudo em `/veterinario` que não caia neste teste vira "Clínica" no último `if`, e o bulário
   * — que mora na seção Pets — marcava "Clínica" no trilho enquanto o painel mostrava Pets.
   */
  if (
    path.startsWith('/veterinario/pacientes') ||
    path.startsWith('/veterinario/paciente/') ||
    path.startsWith('/veterinario/bulario')
  ) {
    return 'patients'
  }

  if (path.startsWith('/settings') || path.startsWith('/perfil')) {
    return 'account'
  }

  if (hasClinical && path.startsWith('/veterinario')) {
    return 'clinical'
  }

  return 'portal'
}

export function resolvePageLabel(path: string, hash: string, sections: AppNavigationSection[]) {
  const t = i18n.global.t.bind(i18n.global)

  if (path === '/inicio') {
    return t('nav.pageLabels.overview')
  }

  const partnerLabels = [
    { prefix: '/parceiro/carteira/saques', label: t('nav.pageLabels.saqueDetail') },
    { prefix: '/parceiro/carteira', label: t('nav.pageLabels.financeiro') },
    { prefix: '/parceiro/programas', label: t('nav.pageLabels.programas') },
    { prefix: '/parceiro/divulgacao', label: t('nav.pageLabels.divulgacao') },
    { prefix: '/parceiro/acessos', label: t('nav.pageLabels.acessos') },
    { prefix: '/parceiro/equipe', label: 'Equipe' },
    { prefix: '/parceiro/convite', label: t('nav.pageLabels.convite') },
    { prefix: '/parceiro/selecionar', label: t('nav.pageLabels.selecionar') },
  ] as const

  for (const item of partnerLabels) {
    if (path === item.prefix || path.startsWith(`${item.prefix}/`)) {
      return item.label
    }
  }

  if (path.startsWith('/parceiro')) {
    return t('nav.pageLabels.portal')
  }

  /* Reserva e estadia não são itens de menu: sem estas linhas o cabeçalho diria 'Painel' nas duas. */
  if (path.startsWith('/hotel/reserva/')) {
    return t('hotel.reserva.titulo')
  }

  if (path.startsWith('/hotel/hospedagem/')) {
    return t('hotel.estadia.titulo')
  }

  /* Cadastro e importação de pacientes não são itens de menu: sem estas linhas o cabeçalho dizia 'Painel'. */
  /* O rótulo curto: o título inteiro quebrava em duas linhas no cabeçalho e espremia a conta. */
  if (path.startsWith('/veterinario/paciente/importar')) {
    return t('clinico.migracao.atalho')
  }

  if (path.startsWith('/veterinario/paciente/novo')) {
    return t('clinico.paciente.novo.titulo')
  }

  /* A ficha do paciente também não: sem estas linhas o histórico e o resumo diziam 'Painel'. */
  if (/^\/veterinario\/paciente\/[^/]+\/historico/.test(path)) {
    return t('clinico.prontuario.timeline.titulo')
  }

  if (/^\/veterinario\/paciente\/[^/]+\/resumo/.test(path)) {
    return t('clinico.resumoDoPaciente.verResumo')
  }

  /* A carteira de vacinas do paciente também não é item de menu. Rótulo curto, pelo mesmo motivo. */
  if (/^\/veterinario\/paciente\/[^/]+\/vacinas/.test(path)) {
    return t('clinico.vacinas.titulo')
  }

  if (/^\/veterinario\/paciente\/[^/]+\/tratamento/.test(path)) {
    return t('clinico.ficha.tratamento.pilula')
  }

  /* O atendimento não é item de menu — sem esta linha o cabeçalho dizia 'Painel' no prontuário. */
  if (path.startsWith('/veterinario/atendimento')) {
    return t('clinico.prontuario.titulo')
  }

  for (const section of sections) {
    const matchedItem = section.items.find((item) => {
      const { path: itemPath, hash: itemHash } = parseNavTarget(item.to)

      if (itemHash) {
        return itemPath === path && itemHash === hash
      }

      return navItemMatches(itemPath, path)
    })

    if (matchedItem) {
      return matchedItem.label
    }
  }

  if (path.startsWith('/settings')) {
    return t('nav.pageLabels.settings')
  }

  return t('nav.pageLabels.fallback')
}

export function filterNavigationGroups(
  groups: AppNavigationGroup[],
  query: string,
): AppNavigationGroup[] {
  const normalized = query.trim().toLowerCase()

  if (!normalized) {
    return groups
  }

  return groups
    .map((group) => {
      const cabe = (item: AppNavigationItem, rotuloDoBloco: string) =>
        item.label.toLowerCase().includes(normalized) ||
        group.label.toLowerCase().includes(normalized) ||
        rotuloDoBloco.toLowerCase().includes(normalized)

      /*
       * O bloco filtra junto e some quando esvazia. Deixá-lo com o rótulo e nenhuma linha faria
       * a busca devolver cabeçalhos de nada — que é como alguém conclui que a busca quebrou.
       *
       * O rótulo do bloco também é termo de busca: quem digita "pendências" espera as três
       * telas do bloco, mesmo que nenhuma delas se chame assim.
       */
      const blocos = group.blocos
        ?.map((bloco) => ({
          ...bloco,
          items: bloco.items.filter((item) => cabe(item, bloco.label)),
        }))
        .filter((bloco) => bloco.items.length > 0)

      const items = blocos
        ? blocos.flatMap((bloco) => bloco.items)
        : group.items.filter((item) => cabe(item, ''))

      return { ...group, items, ...(blocos ? { blocos } : {}) }
    })
    .filter((group) => group.items.length > 0)
}

export function getSectionLandingPath(section: AppNavigationSection) {
  return section.items[0]?.to
}
