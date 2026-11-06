/**
 * O dia da casa no Início: a agenda de hoje da clínica e as chegadas e saídas de hoje do hotel.
 * Os blocos da Clínica e do Hotel e a agenda da semana leem daqui.
 *
 * ## Por que nada aqui é importado no topo
 *
 * A visão geral abre para toda conta, e a maioria não tem clínica nem hotel ligados. Um `import`
 * estático dos repositórios arrastaria o conjunto inteiro de demonstração (pacientes, agenda,
 * hospedagens) para o primeiro carregamento de todo mundo. O `import()` dentro da carga mantém isso
 * no pedaço do módulo, baixado só quando a faixa dele vai de fato aparecer — o mesmo acordo dos
 * contadores da pauta (`useClinicoPendencias`, `useHotelPendencias`).
 *
 * ## Uma faixa não derruba a outra
 *
 * Clínica e hotel carregam separados e falham separados. Uma agenda que não respondeu não apaga
 * as chegadas que responderam. E uma reconferência que falha não apaga o que já estava na tela:
 * o dia de cinco minutos atrás ainda é o dia, e trocar a linha inteira por um erro a cada soluço
 * da rede ensinaria a não olhar para ela.
 */

import { computed, inject, onScopeDispose, ref, watch, type InjectionKey } from 'vue'

import { criarReconferencia } from '@/composables/conferencia'
import type { Appointment } from '@/features/clinico/data/types'

import {
  estadoDoAtendimento,
  type ContaDoDia,
  type EspecieDoDia,
  type MovimentoDoDia,
} from './linha-do-dia'

export type CargaDaFaixa = 'carregando' | 'pronta' | 'falhou'

/** O pedaço do catálogo clínico que a home usa para dar nome a um atendimento. */
type CatalogoDaAgenda = {
  pet: (id: string) => {
    nome: string
    iniciais: string
    especie: EspecieDoDia
    fotoUrl?: string
  } | null
  tipo: (id: string) => { nome: string } | null
  profissional: (id: string) => { nome: string } | null
}

/**
 * Os atendimentos de um dia, no vocabulário da home. Cancelado não entra, e cirurgia em duas salas
 * (dois horários do mesmo atendimento) vira uma conta só.
 */
function montarContas(
  atendimentos: Appointment[],
  catalogo: CatalogoDaAgenda,
  data: string,
): ContaDoDia[] {
  const grupos = new Set<string>()

  return atendimentos.flatMap<ContaDoDia>((atendimento) => {
    const estado = estadoDoAtendimento(atendimento.status)

    if (!estado || atendimento.inicio.slice(0, 10) !== data) {
      return []
    }

    if (atendimento.linkedGroupId) {
      if (grupos.has(atendimento.linkedGroupId)) {
        return []
      }

      grupos.add(atendimento.linkedGroupId)
    }

    const pet = catalogo.pet(atendimento.petId)

    return [
      {
        id: atendimento.id,
        inicio: atendimento.inicio,
        fim: atendimento.fim,
        estado,
        petNome: pet?.nome ?? '',
        petIniciais: pet?.iniciais ?? '',
        petEspecie: pet?.especie ?? null,
        petFotoUrl: pet?.fotoUrl ?? '',
        tipo: catalogo.tipo(atendimento.typeId)?.nome ?? '',
        profissional: catalogo.profissional(atendimento.professionalId)?.nome ?? '',
        chegadaEm: atendimento.chegadaEm,
        rota: rotaDoAtendimento(estado, atendimento.encounterId, atendimento.petId),
      },
    ]
  })
}

/**
 * A agenda da clínica de um dia qualquer — a Agenda da home navega pela semana. Carrega sob demanda,
 * pelo mesmo motivo do resto do arquivo.
 */
export async function carregarAgendaDoDia(data: string, pelaApi = false) {
  if (pelaApi) return carregarAgendaDoDiaPelaApi(data)
  const [{ agendaRepository }, { useClinicoStore }] = await Promise.all([
    import('@/features/clinico/data/repositories'),
    import('@/features/clinico/stores/clinico'),
  ])

  const catalogo = useClinicoStore()
  const [, dia] = await Promise.all([catalogo.carregar(), agendaRepository.obterDia(data)])

  if (catalogo.erro) {
    throw new Error(catalogo.erro)
  }

  return {
    fechada: dia.clinicaFechada,
    feriado: dia.feriado?.nome ?? null,
    contas: montarContas(dia.atendimentos, catalogo, data),
  }
}

/** O mesmo dia pela agenda da API (`agenda/dia`), fora da demonstração. Cancelado não entra. */
async function carregarAgendaDoDiaPelaApi(data: string) {
  const [{ obterDia }, { listarTipos }] = await Promise.all([
    import('@/service/parceiro/agenda-service'),
    import('@/service/parceiro/agenda-config-service'),
  ])
  const [dia, tipos] = await Promise.all([
    obterDia(data, 'PROFISSIONAL'),
    listarTipos().catch(() => []),
  ])
  const nomeDoTipo = new Map(tipos.map((tipo) => [tipo.id, tipo.nome]))
  const nomeDoProfissional = new Map(dia.profissionais.map((p) => [p.id, p.nome]))

  const contas: ContaDoDia[] = dia.agendamentos.flatMap((item) => {
    const estado = ESTADO_DO_PAINEL[item.status]
    if (!estado) return []
    const partes = item.paciente.nome.trim().split(/s+/).filter(Boolean)
    return [
      {
        id: item.id,
        inicio: item.inicio,
        fim: item.fim,
        estado,
        petNome: item.paciente.nome,
        petIniciais: [partes[0]?.[0], partes.length > 1 ? partes[partes.length - 1]![0] : '']
          .join('')
          .toLocaleUpperCase(),
        petEspecie: null,
        petFotoUrl: '',
        tipo: nomeDoTipo.get(item.tipoId) ?? '',
        profissional: nomeDoProfissional.get(item.profissionalId) ?? '',
        chegadaEm: item.chegadaEm,
        rota: `/clinica/agenda?data=${data}&horario=${encodeURIComponent(item.id)}`,
      },
    ]
  })

  return { fechada: dia.clinicaFechada, feriado: dia.feriado?.nome ?? null, contas }
}

/** As chegadas do hotel de um dia qualquer, para a Agenda da home. */
export async function carregarChegadasDoDia(data: string): Promise<MovimentoDoDia[]> {
  const { reservaRepository } = await import('@/features/hotel/data/repositories')
  const reservas = await reservaRepository.listar({ de: data, ate: data })

  return reservas
    .filter(
      (linha) =>
        linha.reserva.entradaPrevista.slice(0, 10) === data &&
        linha.reserva.status !== 'cancelada' &&
        linha.reserva.status !== 'nao-compareceu',
    )
    .map<MovimentoDoDia>((linha) => ({
      id: `chegada-${linha.reserva.id}`,
      tipo: 'chegada',
      quando: linha.reserva.entradaPrevista,
      petNome: linha.petNome,
      petIniciais: linha.petIniciais,
      petEspecie: linha.petEspecie,
      petFotoUrl: linha.petFotoUrl,
      detalhe: linha.acomodacaoNome,
      travado: linha.admissao === 'ausente' || linha.admissao === 'vencido',
      rota: `/hotel/reserva/${linha.reserva.id}`,
    }))
    .sort((um, outro) => um.quando.localeCompare(outro.quando))
}

export type FaixaDaClinica = {
  carga: CargaDaFaixa
  /** A clínica não abre hoje (fim de semana, recesso). */
  fechada: boolean
  /** Nome do feriado, quando é por isso que ela não abre. */
  feriado: string | null
  contas: ContaDoDia[]
}

export type FaixaDoHotel = {
  carga: CargaDaFaixa
  movimentos: MovimentoDoDia[]
  /** Animais na casa agora — a estadia com acompanhante conta dois. */
  hospedes: number
  /** A rotina de hoje somada de todas as estadias: feitas de quantas. */
  rotina: { feitas: number; total: number }
  /** Acomodações ocupadas hoje de quantas operando (o bloco do Hotel). `null` sem a grade. */
  ocupacao: { ocupadas: number; operando: number } | null
}

/** De quanto em quanto o fio do agora anda. Meio minuto: o rótulo mostra minutos. */
const TIQUE_MS = 30_000

/** A hora de agora na parede de um fuso, no mesmo formato das horas da API (com o offset). */
export function agoraNaParede(
  fuso: string,
  offsetDe: (fuso: string, dia: string, hora: string) => string,
) {
  const partes = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: fuso,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date())
      .map((parte) => [parte.type, parte.value]),
  )
  const dia = `${partes.year}-${partes.month}-${partes.day}`
  const hora = `${partes.hour}:${partes.minute}`
  return `${dia}T${hora}:${partes.second}${offsetDe(fuso, dia, hora)}`
}

const ESTADO_DO_PAINEL: Record<string, ContaDoDia['estado']> = {
  AGENDADO: 'marcado',
  CONFIRMADO: 'marcado',
  AGUARDANDO: 'esperando',
  EM_ATENDIMENTO: 'agora',
  FINALIZADO: 'feito',
  FALTA: 'falta',
}

export function useLinhaDoDia(opcoes: {
  clinica: () => boolean
  /** A Clínica de verdade: o dia vem da rota `meu-dia` (escopo da clínica), não dos dados locais. */
  clinicaPelaApi?: () => boolean
  hotel: () => boolean
}) {
  const clinica = ref<FaixaDaClinica>({
    carga: 'carregando',
    fechada: false,
    feriado: null,
    contas: [],
  })
  const hotel = ref<FaixaDoHotel>({
    carga: 'carregando',
    movimentos: [],
    hospedes: 0,
    rotina: { feitas: 0, total: 0 },
    ocupacao: null,
  })

  /** O instante de agora na parede da clínica, ou `null` enquanto nenhum relógio carregou. */
  const agora = ref<string | null>(null)

  /**
   * O relógio vem do módulo: é ele que sabe o fuso da operação e o deslocamento do painel de
   * desenvolvimento. Clínica primeiro; o do hotel é o mesmo fuso, e serve quando só ele está ligado.
   */
  let relogio: (() => string) | null = null
  let conferidoEm: Date | null = null
  let carregou = false
  /*
   * Uma carga em voo **por faixa**. Com uma só para as duas, ligar o hotel enquanto a agenda ainda
   * carregava devolvia a carga da clínica, e a pista do hotel ficava no esqueleto para sempre.
   */
  let cargaDaClinica: Promise<void> | null = null
  let cargaDoHotel: Promise<void> | null = null

  function tique() {
    if (relogio) {
      agora.value = relogio()
    }
  }

  /**
   * O dia da clínica pela rota `meu-dia` (E3-08), no escopo da clínica inteira. Os nomes do serviço
   * e de quem atende vêm das listas da agenda; cada conta leva ao horário na agenda.
   */
  async function carregarClinicaPelaApi() {
    try {
      const [{ lerMeuDia }, { listarTipos, offsetDoFuso }, { listarProfissionais }] =
        await Promise.all([
          import('@/service/parceiro/painel-service'),
          import('@/service/parceiro/agenda-config-service'),
          import('@/service/parceiro/profissionais-service'),
        ])
      const [lido, tipos, profissionais] = await Promise.all([
        lerMeuDia({ escopo: 'CLINICA' }),
        listarTipos().catch(() => []),
        listarProfissionais().catch(() => []),
      ])

      relogio = () => agoraNaParede(lido.fuso, offsetDoFuso)

      const nomeDoTipo = new Map(tipos.map((tipo) => [tipo.id, tipo.nome]))
      const nomeDoProfissional = new Map(profissionais.map((p) => [p.id, p.nome]))
      const sala = lido.blocos.salaDeEspera
      const chegadas = new Map(
        (sala && !sala.falhou ? sala.itens : []).map((item) => [item.id, item.quando ?? null]),
      )
      const atendimentos = lido.blocos.atendimentos
      if (!atendimentos || atendimentos.falhou) throw new Error('atendimentos')

      const contas: ContaDoDia[] = atendimentos.itens.flatMap((item) => {
        const estado = ESTADO_DO_PAINEL[item.status ?? '']
        if (!estado || !item.quando) return []
        const nome = item.pacienteNome ?? ''
        const partes = nome.trim().split(/s+/).filter(Boolean)
        return [
          {
            id: item.id,
            inicio: item.quando,
            fim: item.fim ?? item.quando,
            estado,
            petNome: nome,
            petIniciais: [partes[0]?.[0], partes.length > 1 ? partes[partes.length - 1]![0] : '']
              .join('')
              .toLocaleUpperCase(),
            petEspecie: null,
            petFotoUrl: '',
            tipo: nomeDoTipo.get(item.tipoId ?? '') ?? '',
            profissional: nomeDoProfissional.get(item.profissionalId ?? '') ?? '',
            chegadaEm: chegadas.get(item.id) ?? null,
            rota: `/clinica/agenda?horario=${encodeURIComponent(item.id)}`,
          },
        ]
      })

      clinica.value = { carga: 'pronta', fechada: false, feriado: null, contas }
    } catch {
      if (clinica.value.carga !== 'pronta') {
        clinica.value = { ...clinica.value, carga: 'falhou' }
      }
    }
  }

  async function carregarClinica() {
    if (opcoes.clinicaPelaApi?.()) return carregarClinicaPelaApi()
    try {
      const [{ agendaRepository }, { clinicClock, useClinicoStore }] = await Promise.all([
        import('@/features/clinico/data/repositories'),
        import('@/features/clinico/stores/clinico'),
      ])

      relogio = clinicClock.nowIso

      const catalogo = useClinicoStore()
      const hoje = clinicClock.today()
      const [, dia] = await Promise.all([catalogo.carregar(), agendaRepository.obterDia(hoje)])

      /* Sem o catálogo não há nome de animal nem de tipo: a agenda seria um desenho sem legenda. */
      if (catalogo.erro) {
        throw new Error(catalogo.erro)
      }

      const contas = montarContas(dia.atendimentos, catalogo, hoje)

      clinica.value = {
        carga: 'pronta',
        fechada: dia.clinicaFechada,
        feriado: dia.feriado?.nome ?? null,
        contas,
      }
    } catch {
      if (clinica.value.carga !== 'pronta') {
        clinica.value = { ...clinica.value, carga: 'falhou' }
      }
    }
  }

  async function carregarHotel() {
    try {
      const [{ hospedagemRepository, reservaRepository }, { agoraIso, hojeIso }] =
        await Promise.all([
          import('@/features/hotel/data/repositories'),
          import('@/features/hotel/data/store'),
        ])

      relogio ??= agoraIso

      const hoje = hojeIso()
      const [reservas, hospedes] = await Promise.all([
        reservaRepository.listar({ de: hoje, ate: hoje }),
        hospedagemRepository.listar(),
      ])

      /* Os mesmos recortes do painel do hotel: é o dia que ele mostra, visto daqui. */
      const chegadas = reservas
        .filter(
          (linha) =>
            linha.reserva.entradaPrevista.slice(0, 10) === hoje &&
            (linha.reserva.status === 'confirmada' || linha.reserva.status === 'pendente'),
        )
        .map<MovimentoDoDia>((linha) => ({
          id: `chegada-${linha.reserva.id}`,
          tipo: 'chegada',
          quando: linha.reserva.entradaPrevista,
          petNome: linha.petNome,
          petIniciais: linha.petIniciais,
          petEspecie: linha.petEspecie,
          petFotoUrl: linha.petFotoUrl,
          detalhe: linha.acomodacaoNome,
          travado: linha.admissao === 'ausente' || linha.admissao === 'vencido',
          rota: `/hotel/reserva/${linha.reserva.id}`,
        }))

      const saidas = hospedes
        .filter(
          (hospede) => hospede.saiHoje && hospede.hospedagem.saidaPrevistaEm.slice(0, 10) === hoje,
        )
        .map<MovimentoDoDia>((hospede) => ({
          id: `saida-${hospede.hospedagem.id}`,
          tipo: 'saida',
          quando: hospede.hospedagem.saidaPrevistaEm,
          petNome: hospede.petNome,
          petIniciais: hospede.petIniciais,
          petEspecie: hospede.petEspecie,
          petFotoUrl: hospede.petFotoUrl,
          detalhe: hospede.acomodacaoNome,
          travado: hospede.hospedagem.pesoSaidaKg === null,
          rota: `/hotel/hospedagem/${hospede.hospedagem.id}`,
        }))

      /* A ocupação é um extra do bloco do Hotel: se a grade não responder, o resto continua. */
      let ocupacao: FaixaDoHotel['ocupacao'] = null

      try {
        const grade = await reservaRepository.grade(hoje, hoje)
        const [dia] = grade.porDia
        ocupacao = dia ? { ocupadas: dia.ocupadas, operando: dia.operando } : null
      } catch {
        ocupacao = null
      }

      hotel.value = {
        carga: 'pronta',
        movimentos: [...chegadas, ...saidas].sort((um, outro) =>
          um.quando.localeCompare(outro.quando),
        ),
        hospedes: hospedes.reduce((soma, hospede) => soma + (hospede.acompanhante ? 2 : 1), 0),
        rotina: hospedes.reduce(
          (soma, hospede) => ({
            feitas: soma.feitas + hospede.rotinaDoDia.resolvidas,
            total: soma.total + hospede.rotinaDoDia.total,
          }),
          { feitas: 0, total: 0 },
        ),
        ocupacao,
      }
    } catch {
      if (hotel.value.carga !== 'pronta') {
        hotel.value = { ...hotel.value, carga: 'falhou' }
      }
    }
  }

  function cargaUnicaDaClinica() {
    cargaDaClinica ??= carregarClinica().finally(() => {
      cargaDaClinica = null
    })

    return cargaDaClinica
  }

  function cargaUnicaDoHotel() {
    cargaDoHotel ??= carregarHotel().finally(() => {
      cargaDoHotel = null
    })

    return cargaDoHotel
  }

  /** Espera as cargas pedidas e acerta o relógio. Faixa já em voo não é pedida de novo. */
  async function concluir(cargas: Promise<void>[]) {
    await Promise.all(cargas)
    carregou = true

    if (clinica.value.carga === 'pronta' || hotel.value.carga === 'pronta') {
      conferidoEm = new Date()
    }

    tique()
  }

  /** Recarrega as faixas ligadas. */
  function recarregar(): Promise<void> {
    const cargas: Promise<void>[] = []

    if (opcoes.clinica()) cargas.push(cargaUnicaDaClinica())
    if (opcoes.hotel()) cargas.push(cargaUnicaDoHotel())

    return concluir(cargas)
  }

  /** Tentar de novo depois de uma falha: a faixa volta ao esqueleto enquanto confere. */
  function tentarDeNovo() {
    if (clinica.value.carga === 'falhou') clinica.value = { ...clinica.value, carga: 'carregando' }
    if (hotel.value.carga === 'falhou') hotel.value = { ...hotel.value, carga: 'carregando' }

    return recarregar()
  }

  /* Cada faixa carrega quando o módulo dela liga — a outra, se já estiver em voo, segue sozinha. */
  watch(
    () => [opcoes.clinica(), opcoes.hotel()],
    ([comClinica, comHotel], anterior) => {
      const cargas: Promise<void>[] = []

      if (comClinica && !anterior?.[0]) cargas.push(cargaUnicaDaClinica())
      if (comHotel && !anterior?.[1]) cargas.push(cargaUnicaDoHotel())

      if (cargas.length > 0) {
        void concluir(cargas)
      }
    },
    { immediate: true },
  )

  /* O fio do agora anda sozinho, mas só com a aba à vista: ninguém olha um relógio escondido. */
  const tiques = setInterval(() => {
    if (document.visibilityState === 'visible') tique()
  }, TIQUE_MS)

  function aoVoltar() {
    if (document.visibilityState === 'visible') tique()
  }

  document.addEventListener('visibilitychange', aoVoltar)

  onScopeDispose(() => {
    clearInterval(tiques)
    document.removeEventListener('visibilitychange', aoVoltar)
  })

  /* A mesma reconferência da pauta: de cinco em cinco minutos, e ao voltar para a janela. */
  criarReconferencia({
    recarregar,
    conferidoEm: () => conferidoEm,
    carregado: () => carregou,
  }).assinar(() => opcoes.clinica() || opcoes.hotel())

  /** O dia de hoje na parede da operação (`YYYY-MM-DD`), depois do primeiro tique do relógio. */
  const hoje = computed(() => agora.value?.slice(0, 10) ?? null)

  return { clinica, hotel, agora, hoje, recarregar, tentarDeNovo }
}

export type DiaDaCasa = ReturnType<typeof useLinhaDoDia>

/**
 * A página carrega o dia uma vez e empresta às partes: os blocos da Clínica e do Hotel e a agenda da
 * semana leem a mesma agenda e o mesmo hotel, em vez de cada um pedir tudo de novo.
 */
export const CHAVE_DO_DIA: InjectionKey<DiaDaCasa> = Symbol('dia-da-casa')

export function useDiaDaCasa(): DiaDaCasa {
  const dia = inject(CHAVE_DO_DIA)

  if (!dia) {
    throw new Error('useDiaDaCasa só existe dentro da visão geral, que fornece o dia.')
  }

  return dia
}

/**
 * Para onde leva uma conta. O que já tem prontuário abre o prontuário; a falta abre o painel de
 * faltas, que é onde se liga para o responsável; o resto abre o paciente.
 */
function rotaDoAtendimento(
  estado: ContaDoDia['estado'],
  encounterId: string | null,
  petId: string,
): string {
  if (encounterId) {
    return `/clinica/atendimento/${encounterId}`
  }

  if (estado === 'falta') {
    return '/clinica/faltas'
  }

  return `/clinica/paciente/${petId}/resumo`
}
