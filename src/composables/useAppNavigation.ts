import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  useClinicoPendencias,
  type ContagemDePendencia,
  type TomDePendencia,
} from '@/features/clinico/composables/useClinicoPendencias'
import { useHotelPendencias } from '@/features/hotel/composables/useHotelPendencias'
import { useAcessoAosModulos } from '@/composables/useAcessoAosModulos'
import { usePendenciasDoPortal } from '@/composables/usePendenciasDoPortal'
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
      { key: 'hotel.mapa.titulo', to: '/hotel/mapa', icon: 'ph ph-squares-four' },
      { key: 'hotel.reservas.titulo', to: '/hotel/reservas', icon: 'ph ph-calendar-blank' },
      /* O pedido do app e do link é venda esperando o balcão dizer sim: mora junto da reserva. */
      { key: 'hotel.pedidos.titulo', to: '/hotel/pedidos', icon: 'ph ph-calendar-plus' },
    ],
  },
  {
    /* Receber, cuidar e entregar acontecem no mesmo dia e pelas mesmas mãos: um bloco só. */
    id: 'hotel-dia',
    key: 'hotel.navegacao.dia',
    rotas: [
      { key: 'hotel.painel.titulo', to: '/hotel/painel', icon: 'ph ph-sun' },
      { key: 'hotel.rotina.titulo', to: '/hotel/rotina', icon: 'ph ph-list-checks' },
      { key: 'hotel.hospedes.titulo', to: '/hotel/hospedes', icon: 'ph ph-heart' },
    ],
  },
  {
    id: 'hotel-casa',
    key: 'hotel.navegacao.casa',
    rotas: [
      { key: 'hotel.acomodacoes.titulo', to: '/hotel/acomodacoes', icon: 'ph ph-building' },
      /*
       * Fica ao lado de Acomodações porque é a mesma classe de trabalho: configuração que se abre
       * no dia da mudança, e não um painel que se consulta todo dia. A rota é `rotina-padrao` e
       * não `rotinas` — `/hotel/rotina` já é a prancheta do turno, e "Rotina" ao lado de "Rotinas"
       * no menu é a armadilha que `rotas-do-hotel.spec.ts` existe para evitar do lado do código.
       */
      { key: 'hotel.rotinaPadrao.titulo', to: '/hotel/rotina-padrao', icon: 'ph ph-timer' },
      { key: 'hotel.resumo.titulo', to: '/hotel/resumo', icon: 'ph ph-chart-bar' },
    ],
  },
]

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
      { key: 'clinico.meuDia.titulo', to: '/clinica/meu-dia', icon: 'ph ph-sun' },
      { key: 'clinico.agenda.titulo', to: '/clinica/agenda', icon: 'ph ph-calendar-blank' },
      /*
       * Logo depois da agenda: o pedido do app e do link é horário esperando alguém da recepção
       * dizer sim — trabalho de agora, com prazo prometido a quem pediu.
       */
      {
        key: 'clinico.pedidos.titulo',
        to: '/clinica/pedidos',
        icon: 'ph ph-calendar-plus',
      },
      { key: 'clinico.fila.titulo', to: '/clinica/fila', icon: 'ph ph-hourglass' },
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
        to: '/clinica/atendimentos',
        icon: 'ph ph-note-pencil',
      },
      { key: 'clinico.internacao.titulo', to: '/clinica/internacao', icon: 'ph ph-building' },
    ],
  },
  {
    id: 'pendencias',
    key: 'clinico.navegacao.pendencias',
    rotas: [
      { key: 'clinico.atividades.titulo', to: '/clinica/atividades', icon: 'ph ph-list-bullets' },
      { key: 'clinico.faltas.titulo', to: '/clinica/faltas', icon: 'ph ph-user-minus' },
      /* Vacinas fica no menu clínico, não em Pets: é fila de trabalho da recepção, não cadastro. */
      { key: 'clinico.vacinas.titulo', to: '/clinica/vacinas', icon: 'ph ph-shield' },
      /*
       * Logo abaixo de Vacinas: é a geladeira das mesmas vacinas, e o selo é o que falta comprar —
       * pendência de verdade, que cancela a consulta que a lista de chamada trouxe de volta.
       */
      { key: 'clinico.estoque.titulo', to: '/clinica/estoque', icon: 'ph ph-package' },
      /* Pelo mesmo motivo: é onde mora o alerta de adesão — para quem a clínica precisa ligar. */
      {
        key: 'clinico.adesao.titulo',
        to: '/clinica/tratamentos',
        icon: 'ph ph-calendar-check',
      },
    ],
  },
  {
    id: 'analise',
    key: 'clinico.navegacao.analise',
    rotas: [{ key: 'clinico.resumo.titulo', to: '/clinica/resumo', icon: 'ph ph-chart-bar' }],
  },
]

const PATIENT_ROUTES = [
  { key: 'clinico.pacientes.titulo', to: '/clinica/pacientes', icon: 'ph ph-users' },
  { key: 'clinico.bulario.titulo', to: '/clinica/bulario', icon: 'ph ph-book-open' },
] as const

export function useAppNavigation() {
  const { t, te, locale } = useI18n()
  const parceiroStore = useParceiroStore()

  /**
   * Quem vê cada tela da Clínica e do Hotel: o módulo ligado no servidor, a permissão da conta e a
   * tela já integrada à API, ou tudo no modo demonstração (`navegacao/rotas-dos-modulos.ts`).
   * Uma casa pode ter os dois módulos, um só, ou nenhum: os portões são independentes.
   */
  const { podeAbrir, demonstracao } = useAcessoAosModulos()

  /** Os blocos de um módulo só com os destinos que esta conta abre; bloco vazio sai. */
  function blocosVisiveis(blocos: readonly BlocoDeModulo[]): AppNavigationBloco[] {
    return blocos
      .map((bloco) => ({
        id: bloco.id,
        label: t(bloco.key),
        items: bloco.rotas.filter((rota) => podeAbrir(rota.to)).map(decorarRota),
      }))
      .filter((bloco) => bloco.items.length > 0)
  }

  const hotelBlocos = computed<AppNavigationBloco[]>(() => {
    void locale.value

    return blocosVisiveis(HOTEL_BLOCKS)
  })

  /*
   * Se o módulo aparece decide-se pelas rotas, e não pelos itens já decorados: os itens levam os
   * selos, os selos vêm das pendências, e as pendências perguntam se o módulo aparece.
   */
  const hasClinicalProfile = computed(
    () =>
      CLINICAL_BLOCKS.some((bloco) => bloco.rotas.some((rota) => podeAbrir(rota.to))) ||
      PATIENT_ROUTES.some((rota) => podeAbrir(rota.to)),
  )

  const hasHotelProfile = computed(() =>
    HOTEL_BLOCKS.some((bloco) => bloco.rotas.some((rota) => podeAbrir(rota.to))),
  )

  const hotelItems = computed<AppNavigationItem[]>(() =>
    hotelBlocos.value.flatMap((bloco) => bloco.items),
  )

  const accountItems = computed<AppNavigationItem[]>(() => {
    void locale.value
    return [{ label: t('nav.items.settings'), to: '/settings', icon: 'ph ph-gear' }]
  })

  /**
   * Trabalho parado atrás de cada tela, contado sobre os dados locais: só no modo demonstração.
   * Fora dela os selos vêm da API (`GET /parceiro/portal/pendencias`, E1-06).
   */
  const pendencias = useClinicoPendencias(() => demonstracao.value && hasClinicalProfile.value)

  /** O mesmo para o hotel: rotina atrasada e véspera travada. Ver `useHotelPendencias`. */
  const pendenciasDoHotel = useHotelPendencias(() => demonstracao.value && hasHotelProfile.value)

  /**
   * Clínica e Hotel nos painéis que ainda contam sobre os dados locais: as fitas do dia, a busca
   * global, o menu de criar, a pauta e a agenda do Início. Fora da demonstração eles somem até a
   * rota da API de cada um chegar, em vez de mostrar números de mentira ao lado dos de verdade.
   */
  const clinicaNaDemonstracao = computed(() => demonstracao.value && hasClinicalProfile.value)
  const hotelNaDemonstracao = computed(() => demonstracao.value && hasHotelProfile.value)

  /**
   * Os contadores do servidor (`GET /parceiro/portal/pendencias`, E1-06), fora da demonstração. A
   * API já filtra pelo que a conta pode ver; o portal só omite o zero.
   */
  const pendenciasDoPortal = usePendenciasDoPortal(
    () =>
      !demonstracao.value &&
      parceiroStore.loadState === 'ready' &&
      !parceiroStore.semAcessoParceiro &&
      !parceiroStore.cadastroSuspenso,
  )

  /**
   * A frase de um contador do servidor: "2 convites esperando resposta". A `chave` é a do contador;
   * um contador que a API registrar antes de o portal ganhar a frase dele cai na genérica, em vez
   * de mostrar o nome cru.
   */
  function fraseDaPendencia(chave: string, total: number) {
    const caminho = te(`pendencias.contador.${chave}`)
      ? `pendencias.contador.${chave}`
      : 'pendencias.contador.outra'

    return t(caminho, { total }, total)
  }

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
  const seloPorRota = computed<Map<string, { total: number; tom: TomDePendencia; titulo: string }>>(
    () => {
      const selos = new Map<string, { total: number; tom: TomDePendencia; titulo: string }>()

      if (!demonstracao.value) {
        for (const [rota, selo] of pendenciasDoPortal.selos.value) {
          selos.set(rota, {
            total: selo.total,
            tom: selo.tom,
            /* O separador não é traduzido porque não é texto. */
            titulo: selo.partes.map((parte) => fraseDaPendencia(parte.chave, parte.total)).join(' · '),
          })
        }

        return selos
      }

      for (const [rota, { contagem, frase }] of Object.entries(contagemDaDemonstracao.value)) {
        if (contagem.total > 0) {
          selos.set(rota, {
            total: contagem.total,
            tom: contagem.tom,
            titulo: t(frase, { total: contagem.total }, contagem.total),
          })
        }
      }

      return selos
    },
  )

  /** Os contadores sobre os dados locais, na demonstração. */
  const contagemDaDemonstracao = computed<
    Record<string, { contagem: ContagemDePendencia; frase: string }>
  >(() => ({
    '/clinica/pedidos': {
      contagem: pendencias.pedidos.value,
      frase: 'clinico.navegacao.selo.pedidos',
    },
    '/clinica/fila': { contagem: pendencias.fila.value, frase: 'clinico.navegacao.selo.fila' },
    '/clinica/internacao': {
      contagem: pendencias.internacao.value,
      frase: 'clinico.navegacao.selo.internacao',
    },
    '/clinica/atividades': {
      contagem: pendencias.atividades.value,
      frase: 'clinico.navegacao.selo.atividades',
    },
    '/clinica/vacinas': {
      contagem: pendencias.vacinas.value,
      frase: 'clinico.navegacao.selo.vacinas',
    },
    '/clinica/estoque': {
      contagem: pendencias.estoque.value,
      frase: 'clinico.navegacao.selo.estoque',
    },
    '/clinica/tratamentos': {
      contagem: pendencias.tratamentos.value,
      frase: 'clinico.navegacao.selo.tratamentos',
    },
    '/hotel/rotina': {
      contagem: pendenciasDoHotel.rotina.value,
      frase: 'hotel.navegacao.selo.rotina',
    },
    '/hotel/pedidos': {
      contagem: pendenciasDoHotel.pedidos.value,
      frase: 'hotel.navegacao.selo.pedidos',
    },
    '/hotel/reservas': {
      contagem: pendenciasDoHotel.vespera.value,
      frase: 'hotel.navegacao.selo.vespera',
    },
  }))

  /* Zero não vira selo: um "0" em cada linha é ruído que ensina a não olhar para a coluna. */
  function comSelo(item: AppNavigationItem): AppNavigationItem {
    const selo = seloPorRota.value.get(item.to)

    return selo
      ? { ...item, badge: selo.total, badgeTom: selo.tom, badgeTitulo: selo.titulo }
      : item
  }

  function decorarRota(rota: { key: string; to: string; icon: string }): AppNavigationItem {
    return comSelo({ label: t(rota.key), to: rota.to, icon: rota.icon })
  }

  const clinicalBlocos = computed<AppNavigationBloco[]>(() => {
    void locale.value

    return blocosVisiveis(CLINICAL_BLOCKS)
  })

  const clinicalItems = computed<AppNavigationItem[]>(() =>
    clinicalBlocos.value.flatMap((bloco) => bloco.items),
  )

  const patientItems = computed<AppNavigationItem[]>(() => {
    void locale.value

    return PATIENT_ROUTES.filter((rota) => podeAbrir(rota.to)).map(decorarRota)
  })

  const portalItems = computed<AppNavigationItem[]>(() => {
    void locale.value
    const items: AppNavigationItem[] = [
      { label: t('nav.items.programas'), to: '/parceiro/programas', icon: 'ph ph-squares-four' },
      { label: t('nav.items.divulgacao'), to: '/parceiro/divulgacao', icon: 'ph ph-share-network' },
      {
        label: t('nav.items.acessos'),
        to: '/parceiro/acessos',
        icon: 'ph ph-clipboard-text',
      },
    ]

    if (parceiroStore.statusAfiliadoAtivo) {
      items.push({
        label: t('nav.items.financeiro'),
        to: '/parceiro/carteira',
        icon: 'ph ph-wallet',
      })
    }

    items.push({ label: t('parceiro.equipe.titulo'), to: '/parceiro/equipe', icon: 'ph ph-users' })

    /*
     * As fichas de profissional (E1-03) e o estabelecimento (E1-01: horários, fuso, página pública)
     * só fazem sentido para quem tem ou pode ter Clínica ou Hotel: módulo ligado ou pedido, categoria
     * elegível, ou a ficha do próprio login. Pet shop sem nada disso não ganha nenhum dos dois.
     */
    const eu = parceiroStore.eu

    if (
      eu &&
      (eu.elegiveis.length > 0 ||
        eu.modulos.some((modulo) => modulo.podeLer || modulo.status !== null) ||
        eu.profissional)
    ) {
      items.push({
        label: t('parceiro.profissionais.titulo'),
        to: '/parceiro/profissionais',
        icon: 'ph ph-stethoscope',
      })

      /* A trilha de auditoria (E1-05) é de quem responde pela casa: dono e gestão. */
      if (parceiroStore.temPermissao('auditoria.ler')) {
        items.push({
          label: t('parceiro.auditoria.titulo'),
          to: '/parceiro/auditoria',
          icon: 'ph ph-list-magnifying-glass',
        })
      }

      items.push({
        label: t('parceiro.estabelecimento.titulo'),
        to: '/parceiro/estabelecimento',
        icon: 'ph ph-buildings',
      })
    }

    if (parceiroStore.cadastroSuspenso) {
      return items.map((item) => ({ ...item, locked: true }))
    }

    return items.map(comSelo)
  })

  /** A visão geral não é seção: é um destino só, e aparece como link no topo do trilho. */
  const overviewItem = computed<AppNavigationItem>(() => {
    void locale.value
    return { label: t('nav.items.overview'), to: '/inicio', icon: 'ph ph-house' }
  })

  const navigationSections = computed<AppNavigationSection[]>(() => {
    void locale.value
    const sections: AppNavigationSection[] = [
      {
        id: 'portal',
        label: t('nav.sections.portal'),
        icon: 'ph ph-briefcase',
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
          icon: 'ph ph-calendar-blank',
          items: clinicalItems.value,
          blocos: clinicalBlocos.value,
        },
        {
          id: 'patients',
          label: t('nav.groups.pets'),
          icon: 'ph ph-heart',
          items: patientItems.value,
        },
      )
    }

    if (hasHotelProfile.value) {
      sections.push({
        id: 'hotel',
        label: t('hotel.navegacao.secao'),
        icon: 'ph ph-building',
        items: hotelItems.value,
        blocos: hotelBlocos.value,
      })
    }

    sections.push({
      id: 'account',
      label: t('nav.sections.account'),
      icon: 'ph ph-user',
      items: accountItems.value,
    })

    return sections
  })

  /**
   * As mesmas seções em forma de lista. Uma origem só: seção nova aparece no mapa da barra
   * (`navegacao/espacos.ts`) e na busca sem ninguém lembrar disso.
   */
  const navigationGroups = computed<AppNavigationGroup[]>(() =>
    navigationSections.value.map((section) => ({
      id: section.id,
      label: section.label,
      items: section.items,
      blocos: section.blocos,
    })),
  )

  return {
    navigationSections,
    navigationGroups,
    overviewItem,
    hasClinicalProfile,
    hasHotelProfile,
    modoDemonstracao: demonstracao,
    clinicaNaDemonstracao,
    hotelNaDemonstracao,
    pendenciasClinicas: pendencias,
    pendenciasDoHotel,
    pendenciasDoPortal,
    fraseDaPendencia,
  }
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
   * Tudo em `/clinica` que não caia neste teste vira "Clínica" no último `if`, e o bulário
   * — que mora na seção Pets — marcava "Clínica" no trilho enquanto o painel mostrava Pets.
   */
  if (
    path.startsWith('/clinica/pacientes') ||
    path.startsWith('/clinica/paciente/') ||
    path.startsWith('/clinica/bulario')
  ) {
    return 'patients'
  }

  if (path.startsWith('/settings') || path.startsWith('/perfil')) {
    return 'account'
  }

  if (hasClinical && path.startsWith('/clinica')) {
    return 'clinical'
  }

  return 'portal'
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
