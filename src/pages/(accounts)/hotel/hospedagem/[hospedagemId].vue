<script setup lang="ts">
/**
 * A estadia — o trabalho de dias sobre um animal.
 *
 * Quem assume o turno precisa entender o hóspede em trinta segundos, e é isso que decide a ordem
 * da página.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * 1. **Quem é** — a capa: o rosto grande, o nome, espécie e porte, o responsável com o telefone e
 *    como ele está se adaptando (que se muda dali mesmo). Embaixo, os números da estadia numa
 *    folha só: acomodação, noites, entrada, saída, peso e saldo.
 * 2. **O que pede atenção agora** — o quadro de estado: ocorrência grave sem contato (com o botão
 *    que registra a ligação), boletim retido, remédio atrasado ou na hora, rotina atrasada, e a
 *    saída do dia com o que falta para liberar. Sem nada, uma linha calma com a próxima tarefa.
 * 3. **O que fazer** — a ação cheia muda com o momento: "Registrar ligação" enquanto houver
 *    ocorrência grave sem contato, "Fazer check-out" no dia da saída, "Registrar no diário" nos
 *    outros. A segunda ação fica contornada ao lado; os botões do quadro de estado, também.
 * 4. **O trabalho** — seis abas com contagem, na ordem do dia: Rotina, Medicação, Diário,
 *    Ocorrências, Boletins e Saída. Ao lado, a ficha que se consulta por telefone — alimentação,
 *    autorizações, quem pode buscar, emergência — sempre à vista.
 *
 * As duas regras continuam inteiras:
 *
 * - **R3**: a ocorrência grave sem contato abre o quadro de estado, com o botão que registra a
 *   ligação. Enquanto ela existe, o boletim fica retido e o turno não passa.
 * - **R4**: o check-out é uma conferência (`CheckOutDialog`), e não um botão de confirmar. A aba
 *   Saída mostra a lista do que ainda impede antes de alguém chegar ao balcão.
 *
 * A aba vive na URL (`?aba=`), como na internação. `?checkout=1` é o pedido do "Fazer check-out"
 * do Painel do dia: leva à aba Saída, abre a conferência e sai da URL, para que voltar no
 * navegador não reabra o diálogo.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter, type LocationQuery } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelSelo from '@/features/hotel/components/base/HotelSelo.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import CheckOutDialog from '@/features/hotel/components/estadia/CheckOutDialog.vue'
import DiarioDialog from '@/features/hotel/components/estadia/DiarioDialog.vue'
import OcorrenciaDialog from '@/features/hotel/components/estadia/OcorrenciaDialog.vue'
import PlanoDaEstadia from '@/features/hotel/components/estadia/PlanoDaEstadia.vue'
import AcrescentarNaRotina from '@/features/hotel/components/rotina/AcrescentarNaRotina.vue'
import PropostaDeRotinaDialog from '@/features/hotel/components/rotina/PropostaDeRotinaDialog.vue'
import TarefaLinha from '@/features/hotel/components/rotina/TarefaLinha.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import {
  ajustesDoHospede,
  hospedesParaRotina,
  propostaRepository,
  rotinaPadraoRepository,
  type HospedeParaRotina,
} from '@/features/hotel/data/repositories'
import type {
  Adaptacao,
  ItemDeRotina,
  RegistroDoDiario,
  RegistroKind,
  TarefaStatus,
} from '@/features/hotel/data/types'
import {
  minutosAteASaida,
  noitesNaCasa,
  tomDaAdaptacao,
  tomDaGravidade,
  variacaoDePeso,
} from '@/features/hotel/domain/estadia'
import { dataDe, diffDays } from '@/features/hotel/domain/hotel-time'
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

/** A escada, do melhor para o pior — é a ordem em que a pessoa pensa no hóspede. */
const ADAPTACOES: Adaptacao[] = ['tranquilo', 'em-adaptacao', 'estressado']

type Aba = 'rotina' | 'medicacao' | 'diario' | 'ocorrencias' | 'boletins' | 'saida'

const ABAS: Aba[] = ['rotina', 'medicacao', 'diario', 'ocorrencias', 'boletins', 'saida']

const ICONE_DA_ABA: Record<Aba, string> = {
  rotina: 'ph ph-list-checks',
  medicacao: 'ph ph-pill',
  diario: 'ph ph-notebook',
  ocorrencias: 'ph ph-flag',
  boletins: 'ph ph-envelope-simple',
  saida: 'ph ph-sign-out',
}

/** O desenho de cada registro do diário: quem varre a lista lê o desenho antes da palavra. */
const ICONE_DO_REGISTRO: Record<RegistroKind, string> = {
  refeicao: 'ph ph-bowl-food',
  passeio: 'ph ph-paw-print',
  brincadeira: 'ph ph-tennis-ball',
  sono: 'ph ph-moon-stars',
  eliminacao: 'ph ph-drop',
  banho: 'ph ph-bathtub',
  carinho: 'ph ph-heart',
  observacao: 'ph ph-note-pencil',
}

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const hospedagem = useHospedagemStore()

const hospedagemId = computed(() => String(route.params.hospedagemId ?? ''))

const ocorrenciaAberta = ref(false)
const diarioAberto = ref(false)
const checkOutAberto = ref(false)
const acrescentarAberto = ref(false)

/* O plano deste animal: o que a casa faz por todos, menos o que muda para ele. */
const propostaAberta = ref(false)
const ajustes = ref<ReturnType<typeof ajustesDoHospede>>([])
const hospedes = ref<HospedeParaRotina[]>([])
const rotinaDaCasa = ref<ItemDeRotina[]>([])

function recarregarAjustes() {
  ajustes.value = ajustesDoHospede(hospedagemId.value)
  hospedes.value = hospedesParaRotina()
}

async function abrirProposta() {
  recarregarAjustes()
  propostaAberta.value = true
  await hospedagem.proporRotina(hospedagemId.value)
}

async function aprovarProposta(payload: Parameters<typeof hospedagem.aprovarProposta>[0]) {
  if (await hospedagem.aprovarProposta(payload)) {
    propostaAberta.value = false
    recarregarAjustes()
  }
}

async function revogarAjuste(ajusteId: string) {
  await propostaRepository.revogar(ajusteId)
  recarregarAjustes()
  await hospedagem.carregarEstadia(hospedagemId.value)
}

// ------------------------------------------------------------------------------ as abas e a URL

function abaDaUrl(): Aba {
  const pedida = String(route.query.aba ?? '')

  return ABAS.includes(pedida as Aba) ? (pedida as Aba) : 'rotina'
}

const aba = ref<Aba>(abaDaUrl())

/** A URL sem o pedido de check-out: ele é consumido uma vez, e não pode voltar com o histórico. */
function semCheckout(): LocationQuery {
  const query = { ...route.query }

  delete query.checkout

  return query
}

watch(aba, (valor) => {
  void router.replace({ path: route.path, query: { ...semCheckout(), aba: valor } })
})

async function carregar() {
  await hospedagem.carregarEstadia(hospedagemId.value)
  recarregarAjustes()
  atenderCheckoutPedido()
}

onMounted(async () => {
  await carregar()
  rotinaDaCasa.value = (await rotinaPadraoRepository.atual()).itens
})

watch(hospedagemId, () => void carregar())

watch(
  () => hotelStore.revisao,
  () => void hospedagem.carregarEstadia(hospedagemId.value),
)

// ------------------------------------------------------------------------------ o registro

/** A estadia aberta — só quando é **esta**: a store guarda a última que alguém abriu. */
const estadia = computed(() =>
  hospedagem.estadia?.hospedagem.id === hospedagemId.value ? hospedagem.estadia : null,
)
const registro = computed(() => estadia.value?.hospedagem ?? null)
const pet = computed(() => (registro.value ? hotelStore.pet(registro.value.petId) : null))
const tutor = computed(() => (registro.value ? hotelStore.tutor(registro.value.tutorId) : null))
const acomodacao = computed(() =>
  registro.value ? hotelStore.acomodacao(registro.value.acomodacaoId) : null,
)

const encerrada = computed(() => registro.value?.status === 'encerrada')

/**
 * `?checkout=1` — o "Fazer check-out" do Painel do dia.
 *
 * Leva à aba Saída, tira o pedido da URL e abre a conferência assim que a estadia estiver
 * carregada. Estadia já encerrada só mostra a aba: não há o que conferir.
 */
const checkoutPedido = ref(false)

watch(
  () => route.query.checkout,
  (pedido) => {
    if (pedido !== '1') {
      return
    }

    checkoutPedido.value = true
    aba.value = 'saida'
    void router.replace({ path: route.path, query: { ...semCheckout(), aba: 'saida' } })
    atenderCheckoutPedido()
  },
  { immediate: true },
)

function atenderCheckoutPedido() {
  if (!checkoutPedido.value || estadia.value?.hospedagem.id !== hospedagemId.value) {
    return
  }

  checkoutPedido.value = false

  if (!encerrada.value) {
    checkOutAberto.value = true
  }
}

const boletimRetido = computed(
  () => (estadia.value?.boletins ?? []).find((item) => item.status === 'retido') ?? null,
)

const naoEncontrada = computed(
  () => !hospedagem.carregando && !hospedagem.erro && hospedagem.estadia !== null && !estadia.value,
)

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

/** "seg. 15/10" — o dia da semana pesa: "sai sexta" se diz assim no balcão. */
function diaCurto(iso: string) {
  return new Intl.DateTimeFormat(intl.value, {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${dataDe(iso)}T12:00:00Z`))
}

/** Dia e hora, para o que cabe numa linha: "sex. 18/10, 19:00". */
function quando(iso: string) {
  return t('hotel.estadia.nova.quando', { dia: diaCurto(iso), hora: formato.hora(iso) })
}

function cuidador(id: string | null) {
  return id ? (hotelStore.cuidador(id)?.nome ?? '') : ''
}

// ------------------------------------------------------------------------------ a capa

const perfilDoPet = computed(() =>
  pet.value
    ? [formato.especie(pet.value.especie), pet.value.raca, pet.value.porte ? formato.porte(pet.value.porte) : '']
        .filter(Boolean)
        .join(' · ')
    : '',
)

/** O telefone em link: no celular do cuidador, tocar no número é ligar. */
const telefoneDoTutor = computed(() => (tutor.value?.telefone ?? '').replace(/[^\d+]/g, ''))

function ajustarAdaptacao(valor: Adaptacao) {
  void hospedagem.ajustarAdaptacao(hospedagemId.value, valor)
}

// ------------------------------------------------------------------------------ os números

const noitesAgora = computed(() =>
  registro.value ? noitesNaCasa(registro.value, hospedagem.agora) : 0,
)

const noitesPrevistas = computed(() =>
  registro.value
    ? Math.max(
        1,
        diffDays(
          dataDe(registro.value.entradaEm),
          dataDe(registro.value.saidaEm ?? registro.value.saidaPrevistaEm),
        ),
      )
    : 0,
)

const hoje = computed(() => hotelClock.today())

/** Sai hoje, ou já devia ter saído: o dia em que a ação cheia vira o check-out. */
const horaDeSair = computed(
  () =>
    !!registro.value &&
    !encerrada.value &&
    dataDe(registro.value.saidaPrevistaEm) <= hoje.value,
)

const minutosParaSair = computed(() =>
  registro.value ? minutosAteASaida(registro.value, hospedagem.agora) : 0,
)

/** Duração curta: acima de uma hora, só as horas — "atrasou 10 h" lê melhor que "10 h 22 min". */
function duracaoCurta(minutos: number) {
  return formato.duracao(minutos >= 60 ? Math.floor(minutos / 60) * 60 : minutos)
}

/** Meia hora de folga, como no Painel: o trânsito de quem vem buscar o cachorro não é atraso. */
const saidaAtrasada = computed(() => horaDeSair.value && minutosParaSair.value < -30)

const diaDaSaida = computed(() => {
  if (!registro.value) {
    return ''
  }

  const iso = registro.value.saidaEm ?? registro.value.saidaPrevistaEm

  return dataDe(iso) === hoje.value ? t('hotel.estadia.nova.dados.hoje') : diaCurto(iso)
})

const legendaDaSaida = computed(() => {
  if (!registro.value) {
    return ''
  }

  if (registro.value.saidaEm) {
    return t('hotel.estadia.nova.dados.horaSaiu', { hora: formato.hora(registro.value.saidaEm) })
  }

  const hora = formato.hora(registro.value.saidaPrevistaEm)

  return saidaAtrasada.value
    ? t('hotel.estadia.nova.dados.horaAtrasou', {
        hora,
        tempo: duracaoCurta(-minutosParaSair.value),
      })
    : t('hotel.estadia.nova.dados.horaPrevista', { hora })
})

const variacao = computed(() => (registro.value ? variacaoDePeso(registro.value) : null))

// ------------------------------------------------------------------------------ o dia de hoje

const tarefasDeHoje = computed(() => hospedagem.checklistDaEstadia)

const rotinaDeHoje = computed(() =>
  tarefasDeHoje.value.filter((item) => item.tarefa.kind !== 'medicacao'),
)

const dosesDeHoje = computed(() =>
  tarefasDeHoje.value.filter((item) => item.tarefa.kind === 'medicacao'),
)

const resolvidasHoje = computed(
  () => tarefasDeHoje.value.filter((item) => item.tarefa.status !== 'pendente').length,
)

const dosesAtrasadas = computed(() =>
  dosesDeHoje.value.filter((item) => item.situacao === 'atrasada'),
)

const dosesNaHora = computed(() =>
  dosesDeHoje.value.filter((item) => item.situacao === 'na-janela'),
)

const rotinaAtrasada = computed(() =>
  rotinaDeHoje.value.filter((item) => item.situacao === 'atrasada'),
)

const proximaTarefa = computed(
  () =>
    tarefasDeHoje.value
      .filter((item) => item.situacao === 'futura')
      .sort((uma, outra) => uma.tarefa.previstaPara.localeCompare(outra.tarefa.previstaPara))[0] ??
    null,
)

/** A medicação da estadia, as vigentes primeiro. */
const medicacoes = computed(() =>
  [...(estadia.value?.medicacoes ?? [])].sort(
    (uma, outra) => Number(Boolean(uma.suspensaEm)) - Number(Boolean(outra.suspensaEm)),
  ),
)

const medicacoesAtivas = computed(() => medicacoes.value.filter((item) => !item.suspensaEm).length)

/** As doses de hoje de uma medicação, para os horários dela dizerem o que já foi dado. */
function dosesDa(medicacaoId: string) {
  return dosesDeHoje.value.filter((item) => item.tarefa.origemId === medicacaoId)
}

// ------------------------------------------------------------------------------ o diário, por dia

type DiaDoDiario = { data: string; rotulo: string; registros: RegistroDoDiario[] }

const diarioPorDia = computed<DiaDoDiario[]>(() => {
  const dias = new Map<string, RegistroDoDiario[]>()

  for (const item of estadia.value?.diario ?? []) {
    const data = dataDe(item.registradoEm)

    dias.set(data, [...(dias.get(data) ?? []), item])
  }

  return [...dias.entries()]
    .sort(([um], [outro]) => outro.localeCompare(um))
    .map(([data, registros]) => ({
      data,
      rotulo:
        data === hoje.value
          ? t('hotel.estadia.nova.dados.hoje')
          : diffDays(data, hoje.value) === 1
            ? t('hotel.estadia.nova.diario.ontem')
            : formato.dataLonga(data),
      registros: registros.sort((um, outro) => outro.registradoEm.localeCompare(um.registradoEm)),
    }))
})

// ------------------------------------------------------------------------------ a saída

/** Os pertences que já têm desfecho: devolvidos, ou com o que houve escrito. */
const pertencesConferidos = computed(
  () =>
    (registro.value?.pertences ?? []).filter(
      (item) => item.devolvido || item.observacao.trim() !== '',
    ).length,
)

type Tom = 'risco' | 'atencao' | 'ok' | 'neutro' | 'lugar'

type PassoDaSaida = {
  id: string
  tom: Tom
  feito: boolean
  icone: string
  titulo: string
  detalhe: string
}

/**
 * A lista do que libera a saída, na ordem do balcão: ligar (se houver ocorrência), pesar,
 * conferir os pertences, receber o saldo. Os três primeiros são as travas do domínio
 * (`impedimentos`); o saldo não trava, mas é o que o responsável pergunta primeiro.
 */
const passosDaSaida = computed<PassoDaSaida[]>(() => {
  if (!registro.value || !estadia.value) {
    return []
  }

  const passos: PassoDaSaida[] = []
  const travadas = hospedagem.ocorrenciasTravadasDaEstadia.length

  if (travadas > 0) {
    passos.push({
      id: 'ocorrencia',
      tom: 'risco',
      feito: false,
      icone: 'ph ph-phone-call',
      titulo: t('hotel.estadia.precisaLigar', { nome: tutor.value?.nome ?? '' }),
      detalhe: t('hotel.checkout.ocorrenciaTravada', { total: travadas }, travadas),
    })
  }

  const pesado = registro.value.pesoSaidaKg !== null

  passos.push({
    id: 'peso',
    tom: pesado ? 'ok' : 'atencao',
    feito: pesado,
    icone: 'ph ph-scales',
    titulo: pesado
      ? t('hotel.estadia.stat.saidaPeso', { valor: formato.peso(registro.value.pesoSaidaKg) })
      : t('hotel.painel.faltaPesar'),
    detalhe: pesado
      ? t('hotel.estadia.nova.saida.variacao', {
          entrada: formato.peso(registro.value.pesoEntradaKg),
          variacao: formato.variacao(variacao.value),
        })
      : t('hotel.checkout.pesoEntrada', { valor: formato.peso(registro.value.pesoEntradaKg) }),
  })

  const total = registro.value.pertences.length
  const conferidos = pertencesConferidos.value

  passos.push({
    id: 'pertences',
    tom: conferidos === total ? 'ok' : 'atencao',
    feito: conferidos === total,
    icone: 'ph ph-backpack',
    titulo:
      conferidos === total
        ? t('hotel.estadia.nova.saida.pertencesOk')
        : t('hotel.hoje.selo.pertences'),
    detalhe: t('hotel.estadia.nova.saida.conferidos', { feitos: conferidos, total }),
  })

  const saldo = estadia.value.saldoCentavos

  /* Negativo é o que volta ao responsável (pagou mais do que a conta): dito como devolução. */
  passos.push({
    id: 'saldo',
    tom: saldo === 0 ? 'ok' : 'neutro',
    feito: saldo === 0,
    icone: 'ph ph-money',
    titulo:
      saldo > 0
        ? t('hotel.estadia.nova.saida.receber', { valor: formato.moeda(saldo) })
        : saldo < 0
          ? t('hotel.estadia.nova.saida.devolver', { valor: formato.moeda(-saldo) })
          : t('hotel.estadia.nova.saida.quitado'),
    detalhe:
      saldo < 0
        ? t('hotel.checkout.devolverNoBalcao')
        : estadia.value.acrescimoDeSaida > 0
          ? t('hotel.checkout.saidaTardia', { percentual: estadia.value.acrescimoDeSaida })
          : t('hotel.estadia.nova.saida.saldoNoBalcao'),
  })

  return passos
})

const faltamNaSaida = computed(() => passosDaSaida.value.filter((passo) => !passo.feito).length)

// ------------------------------------------------------------------------------ o quadro de estado

type ItemDeAtencao = {
  id: string
  tom: 'risco' | 'atencao' | 'lugar'
  icone: string
  titulo: string
  detalhe: string
  acao: { rotulo: string; icone: string; executar: () => void }
}

/**
 * O que pede atenção **agora**, do mais grave para o menos: a ligação que ninguém fez (é o único
 * trabalho que não se resolve andando pelo corredor), o remédio atrasado, o boletim parado, a
 * saída do dia, o remédio na hora e a rotina atrasada.
 */
const atencao = computed<ItemDeAtencao[]>(() => {
  if (!registro.value || encerrada.value) {
    return []
  }

  const itens: ItemDeAtencao[] = []
  const telefone = tutor.value?.telefone ?? ''

  for (const ocorrencia of hospedagem.ocorrenciasTravadasDaEstadia) {
    itens.push({
      id: `ocorrencia-${ocorrencia.id}`,
      tom: 'risco',
      icone: 'ph ph-phone-call',
      titulo: t('hotel.estadia.precisaLigar', { nome: tutor.value?.nome ?? '' }),
      detalhe: [
        `${formato.ocorrenciaKind(ocorrencia.kind)} (${formato.gravidade(ocorrencia.gravidade).toLocaleLowerCase(intl.value)})`,
        quando(ocorrencia.registradaEm),
        telefone,
      ]
        .filter(Boolean)
        .join(' · '),
      acao: {
        rotulo: t('hotel.estadia.registrarLigacao'),
        icone: 'ph ph-check',
        executar: () => void registrarContato(ocorrencia.id),
      },
    })
  }

  for (const dose of dosesAtrasadas.value) {
    itens.push({
      id: `dose-${dose.tarefa.id}`,
      tom: 'risco',
      icone: 'ph ph-pill',
      titulo: t('hotel.estadia.nova.atencao.remedioAtrasado', {
        hora: formato.hora(dose.tarefa.previstaPara),
      }),
      detalhe: dose.tarefa.descricao,
      acao: {
        rotulo: t('hotel.estadia.nova.atencao.verMedicacao'),
        icone: 'ph ph-arrow-down',
        executar: () => irPara('medicacao'),
      },
    })
  }

  if (boletimRetido.value) {
    itens.push({
      id: 'boletim',
      tom: 'atencao',
      icone: 'ph ph-envelope-simple',
      titulo: t('hotel.estadia.nova.atencao.boletim'),
      detalhe: t('hotel.estadia.boletimRetido'),
      acao: {
        rotulo: t('hotel.estadia.nova.atencao.verBoletins'),
        icone: 'ph ph-arrow-down',
        executar: () => irPara('boletins'),
      },
    })
  }

  if (horaDeSair.value) {
    const impedimentos = estadia.value?.impedimentos ?? []

    itens.push({
      id: 'saida',
      tom: saidaAtrasada.value || impedimentos.length > 0 ? 'atencao' : 'lugar',
      icone: 'ph ph-sign-out',
      titulo: saidaAtrasada.value
        ? t('hotel.estadia.nova.atencao.saidaAtrasada', {
            hora: formato.hora(registro.value.saidaPrevistaEm),
            tempo: duracaoCurta(-minutosParaSair.value),
          })
        : t('hotel.estadia.nova.atencao.saiHoje', {
            hora: formato.hora(registro.value.saidaPrevistaEm),
          }),
      detalhe:
        faltamNaSaida.value > 0
          ? t(
              'hotel.estadia.nova.atencao.faltamParaSair',
              { total: faltamNaSaida.value },
              faltamNaSaida.value,
            )
          : t('hotel.painel.prontoParaSair'),
      acao: {
        rotulo: t('hotel.estadia.nova.atencao.verSaida'),
        icone: 'ph ph-arrow-down',
        executar: () => irPara('saida'),
      },
    })
  }

  for (const dose of dosesNaHora.value) {
    itens.push({
      id: `dose-${dose.tarefa.id}`,
      tom: 'atencao',
      icone: 'ph ph-pill',
      titulo: t('hotel.estadia.nova.atencao.remedioNaHora', {
        hora: formato.hora(dose.tarefa.previstaPara),
      }),
      detalhe: dose.tarefa.descricao,
      acao: {
        rotulo: t('hotel.estadia.nova.atencao.verMedicacao'),
        icone: 'ph ph-arrow-down',
        executar: () => irPara('medicacao'),
      },
    })
  }

  if (rotinaAtrasada.value.length > 0) {
    const total = rotinaAtrasada.value.length

    itens.push({
      id: 'rotina',
      tom: 'atencao',
      icone: 'ph ph-clock-countdown',
      titulo: t('hotel.estadia.nova.atencao.rotinaAtrasada', { total }, total),
      detalhe: [...new Set(rotinaAtrasada.value.map((item) => formato.tarefaKind(item.tarefa.kind)))].join(
        ', ',
      ),
      acao: {
        rotulo: t('hotel.estadia.nova.atencao.verRotina'),
        icone: 'ph ph-arrow-down',
        executar: () => irPara('rotina'),
      },
    })
  }

  return itens
})

/** A linha calma, quando nada pede atenção: e a próxima coisa do dia, para não ficar no vazio. */
const fraseCalma = computed(() => {
  const proxima = proximaTarefa.value

  return proxima
    ? t('hotel.estadia.nova.atencao.calmaProxima', {
        tarefa: formato.tarefaKind(proxima.tarefa.kind),
        hora: formato.hora(proxima.tarefa.previstaPara),
      })
    : t('hotel.estadia.nova.atencao.calma')
})

// ------------------------------------------------------------------------------ a ação do momento

type Acao = { rotulo: string; icone: string; executar: () => void }

/**
 * A ação cheia muda com o momento. A ligação que ninguém fez vem antes de tudo (R3: ela segura o
 * boletim, o turno e a saída); no dia da saída, é o check-out; nos outros, o diário — o que o
 * responsável de fato compra é saber que o animal está bem. A outra fica contornada ao lado.
 */
const acaoPrincipal = computed<Acao | null>(() => {
  if (!registro.value || encerrada.value) {
    return null
  }

  const travada = hospedagem.ocorrenciasTravadasDaEstadia[0]

  if (travada) {
    return {
      rotulo: t('hotel.estadia.registrarLigacao'),
      icone: 'ph ph-phone-call',
      executar: () => void registrarContato(travada.id),
    }
  }

  return horaDeSair.value
    ? { rotulo: t('hotel.estadia.fazerCheckOut'), icone: 'ph ph-sign-out', executar: abrirCheckOut }
    : {
        rotulo: t('hotel.estadia.nova.acao.diario'),
        icone: 'ph ph-notebook',
        executar: () => (diarioAberto.value = true),
      }
})

const acaoSecundaria = computed<Acao | null>(() => {
  if (!registro.value || encerrada.value) {
    return null
  }

  return horaDeSair.value || hospedagem.ocorrenciasTravadasDaEstadia.length > 0
    ? {
        rotulo: t('hotel.estadia.nova.acao.diario'),
        icone: 'ph ph-notebook',
        executar: () => (diarioAberto.value = true),
      }
    : {
        rotulo: t('hotel.ocorrencia.registrar'),
        icone: 'ph ph-flag',
        executar: () => (ocorrenciaAberta.value = true),
      }
})

function abrirCheckOut() {
  aba.value = 'saida'
  checkOutAberto.value = true
}

// ------------------------------------------------------------------------------ as abas

type TomDaAba = 'risco' | 'atencao' | 'neutro'

const opcoesDeAba = computed(() =>
  ABAS.map((valor) => {
    let contagem = 0
    let tom: TomDaAba = 'neutro'

    if (valor === 'rotina') {
      contagem = rotinaDeHoje.value.filter((item) => item.tarefa.status === 'pendente').length
      tom = rotinaAtrasada.value.length > 0 ? 'atencao' : 'neutro'
    } else if (valor === 'medicacao') {
      contagem = medicacoesAtivas.value
      tom =
        dosesAtrasadas.value.length > 0
          ? 'risco'
          : dosesNaHora.value.length > 0
            ? 'atencao'
            : 'neutro'
    } else if (valor === 'diario') {
      contagem = estadia.value?.diario.length ?? 0
    } else if (valor === 'ocorrencias') {
      contagem = estadia.value?.ocorrencias.length ?? 0
      tom = hospedagem.ocorrenciasTravadasDaEstadia.length > 0 ? 'risco' : 'neutro'
    } else if (valor === 'boletins') {
      contagem = estadia.value?.boletins.length ?? 0
      tom = boletimRetido.value ? 'atencao' : 'neutro'
    } else {
      contagem = encerrada.value ? 0 : faltamNaSaida.value
      tom = hospedagem.ocorrenciasTravadasDaEstadia.length > 0 ? 'risco' : 'atencao'
    }

    return { valor, rotulo: rotuloDaAba(valor), icone: ICONE_DA_ABA[valor], contagem, tom }
  }),
)

/** Cada rótulo numa chamada explícita: chave montada por interpolação some do varredor. */
function rotuloDaAba(valor: Aba) {
  const rotulos: Record<Aba, string> = {
    rotina: t('hotel.estadia.nova.aba.rotina'),
    medicacao: t('hotel.estadia.medicacao'),
    diario: t('hotel.estadia.nova.aba.diario'),
    ocorrencias: t('hotel.estadia.ocorrencias'),
    boletins: t('hotel.estadia.nova.aba.boletins'),
    saida: t('hotel.estadia.nova.aba.saida'),
  }

  return rotulos[valor]
}

const abasEl = ref<HTMLElement | null>(null)

/** Leva à aba e traz a área de trabalho para a vista. */
function irPara(destino: Aba) {
  aba.value = destino
  void nextTick(() => {
    const reduzir = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    abasEl.value?.scrollIntoView({ block: 'start', behavior: reduzir ? 'auto' : 'smooth' })
  })
}

/** O padrão de `tablist`: setas andam e escolhem, Home e End vão às pontas. */
function aoTeclarNasAbas(evento: KeyboardEvent) {
  const atual = ABAS.indexOf(aba.value)
  const passos: Record<string, number> = {
    ArrowRight: 1,
    ArrowLeft: -1,
    Home: -atual,
    End: ABAS.length - 1 - atual,
  }
  const passo = passos[evento.key]

  if (passo === undefined) {
    return
  }

  evento.preventDefault()

  /* Em árabe a fileira inverte: a seta para a direita volta. */
  const rtl = getComputedStyle(evento.currentTarget as HTMLElement).direction === 'rtl'
  const sentido = rtl && evento.key.startsWith('Arrow') ? -passo : passo
  const proxima = ABAS[(atual + sentido + ABAS.length) % ABAS.length]!

  aba.value = proxima
  void nextTick(() => document.getElementById(`estadia-aba-${proxima}`)?.focus())
}

// ------------------------------------------------------------------------------ voltar

/**
 * O "voltar" leva de onde a pessoa veio: o Painel do dia, a Rotina, o Mapa, a reserva, a planta
 * da casa. Sem histórico (link colado, recarga), cai na lista de Hóspedes, que é a casa da estadia.
 */
const voltar = (() => {
  const anterior = typeof window === 'undefined' ? '' : String(window.history.state?.back ?? '')
  const caminho = anterior.split('?')[0] ?? ''
  const destinos: { prefixo: string; rotulo: () => string; exato?: boolean }[] = [
    { prefixo: '/hotel/painel', rotulo: () => t('espacos.abas.painel'), exato: true },
    { prefixo: '/hotel/rotina', rotulo: () => t('espacos.abas.rotina'), exato: true },
    { prefixo: '/hotel/mapa', rotulo: () => t('espacos.abas.mapa'), exato: true },
    { prefixo: '/hotel/reservas', rotulo: () => t('espacos.abas.reservas'), exato: true },
    { prefixo: '/hotel/acomodacoes', rotulo: () => t('espacos.abas.acomodacoes'), exato: true },
    { prefixo: '/hotel/reserva/', rotulo: () => t('hotel.painel.onde.reserva') },
  ]
  const achado = destinos.find((item) =>
    item.exato ? caminho === item.prefixo : caminho.startsWith(item.prefixo),
  )

  return achado
    ? { to: anterior, rotulo: achado.rotulo }
    : { to: '/hotel/hospedes', rotulo: () => t('espacos.abas.hospedes') }
})()

// ------------------------------------------------------------------------------ o trabalho

async function marcar(payload: { tarefaId: string; status: TarefaStatus }) {
  await hospedagem.marcarTarefa(payload.tarefaId, payload.status)
}

async function registrarContato(ocorrenciaId: string) {
  await hospedagem.registrarContato(ocorrenciaId, hospedagemId.value)
}

async function fecharEstadia(retiradoPor: string) {
  const encerradaAgora = await hospedagem.checkOut(hospedagemId.value, retiradoPor)

  if (encerradaAgora) {
    checkOutAberto.value = false
  }
}

function abrirAcrescentar() {
  recarregarAjustes()
  acrescentarAberto.value = true
}

/*
 * As quatro portas de acrescentar algo à rotina deste hóspede. Todas fecham o diálogo só quando a
 * gravação deu certo: fechar antes esconderia o erro que a pessoa precisa ler.
 */
async function registrarMedicacao(payload: Parameters<typeof hospedagem.registrarMedicacao>[0]) {
  if (await hospedagem.registrarMedicacao(payload)) {
    acrescentarAberto.value = false
  }
}

async function registrarCuidado(payload: Parameters<typeof hospedagem.registrarCuidado>[0]) {
  if (await hospedagem.registrarCuidado(payload)) {
    acrescentarAberto.value = false
  }
}

async function acrescentarServico(payload: Parameters<typeof hospedagem.acrescentarServico>[0]) {
  if (await hospedagem.acrescentarServico(payload)) {
    acrescentarAberto.value = false
    await hospedagem.carregarEstadia(hospedagemId.value)
  }
}

async function registrarAjuste(payload: Parameters<typeof hospedagem.registrarAjuste>[0]) {
  if (await hospedagem.registrarAjuste(payload)) {
    acrescentarAberto.value = false
    recarregarAjustes()
    await hospedagem.carregarEstadia(hospedagemId.value)
  }
}

// ------------------------------------------------------------------------------ o tutorial

/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.estadia.pergunta.titulo'),
    texto: t('hotel.tour.estadia.pergunta.texto'),
  },
  {
    alvo: '.atencao',
    titulo: t('hotel.tour.estadia.ocorrencias.titulo'),
    texto: t('hotel.tour.estadia.ocorrencias.texto'),
  },
  {
    alvo: '.abas',
    titulo: t('hotel.tour.estadia.rotina.titulo'),
    texto: t('hotel.tour.estadia.rotina.texto'),
  },
  {
    alvo: '.ficha',
    titulo: t('hotel.tour.estadia.ficha.titulo'),
    texto: t('hotel.tour.estadia.ficha.texto'),
  },
  {
    alvo: '#estadia-aba-saida',
    titulo: t('hotel.tour.estadia.checkout.titulo'),
    texto: t('hotel.tour.estadia.checkout.texto'),
  },
])
</script>

<template>
  <UiPagina
    class="tela"
    :titulo="pet?.nome ?? t('hotel.estadia.titulo')"
    :carregando="hospedagem.carregando && !estadia"
    :erro="hospedagem.erro ? t(hospedagem.erro) : ''"
    :vazio="naoEncontrada"
    :vazio-titulo="t('hotel.estadia.nova.naoEncontradaTitulo')"
    :vazio-descricao="t('hotel.estadia.nova.naoEncontradaDescricao')"
    vazio-icone="ph ph-paw-print"
    tour
    @tour="tourAberto = true"
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink :to="voltar.to" class="voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ voltar.rotulo() }}
      </RouterLink>
    </template>

    <template #cabecalho>
      <div class="capa">
        <PetAvatar
          v-if="pet"
          class="capa__rosto"
          :nome="pet.nome"
          :iniciais="pet.iniciais"
          :especie="pet.especie"
          :foto-url="pet.fotoUrl"
          tamanho="xl"
        />

        <div class="capa__texto">
          <h1 class="capa__nome">
            {{ pet?.nome ?? t('hotel.estadia.titulo') }}
            <HotelSelo
              v-if="encerrada"
              class="capa__selo"
              :rotulo="t('hotel.estadia.encerrada')"
              tom="neutro"
              icone="ph ph-check"
            />
          </h1>

          <p v-if="perfilDoPet" class="capa__perfil">{{ perfilDoPet }}</p>

          <p v-if="tutor" class="capa__tutor">
            <i class="ph ph-user" aria-hidden="true" />
            <span>{{ tutor.nome }}</span>
            <a v-if="tutor.telefone" class="capa__telefone ui-num" :href="`tel:${telefoneDoTutor}`">
              <i class="ph ph-phone" aria-hidden="true" />
              {{ tutor.telefone }}
            </a>
          </p>

          <!--
            A adaptação muda daqui: ela nasce "em adaptação" no check-in, e quem sossega no
            segundo dia — ou começa a estranhar — precisa ser remarcado sem procurar onde.
          -->
          <div v-if="registro" class="capa__adaptacao">
            <span class="capa__adaptacao-rotulo">{{ t('hotel.estadia.comoEstaSeAdaptando') }}</span>
            <SelectButton
              v-if="!encerrada"
              :model-value="registro.adaptacao"
              class="capa__escada"
              :class="`capa__escada--${tomDaAdaptacao(registro.adaptacao)}`"
              :options="ADAPTACOES.map((item) => ({ valor: item, rotulo: formato.adaptacao(item) }))"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              :disabled="hospedagem.salvando"
              :aria-label="t('hotel.estadia.comoEstaSeAdaptando')"
              @update:model-value="ajustarAdaptacao"
            />
            <HotelSelo
              v-else
              :rotulo="formato.adaptacao(registro.adaptacao)"
              :tom="tomDaAdaptacao(registro.adaptacao)"
            />
          </div>
        </div>
      </div>
    </template>

    <template v-if="registro" #acoes>
      <Button
        v-if="acaoSecundaria"
        type="button"
        :icon="acaoSecundaria.icone"
        :label="acaoSecundaria.rotulo"
        severity="secondary"
        outlined
        @click="acaoSecundaria.executar()"
      />
      <Button
        v-if="acaoPrincipal"
        type="button"
        class="acao-principal"
        :icon="acaoPrincipal.icone"
        :label="acaoPrincipal.rotulo"
        :loading="hospedagem.salvando && hospedagem.ocorrenciasTravadasDaEstadia.length > 0"
        @click="acaoPrincipal.executar()"
      />
    </template>

    <div v-if="estadia && registro" class="estadia">
      <!-- Os números da estadia, lidos da esquerda para a direita: onde, quanto tempo, quando, quanto. -->
      <section class="quadro ui-folha" :aria-label="t('hotel.estadia.nova.dados.rotulo')">
        <dl class="quadro__dados">
          <div class="dado">
            <dt>
              {{ t('hotel.estadia.nova.dados.acomodacao') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-bed" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">{{ acomodacao?.nome ?? '' }}</strong>
              <small>
                <!-- Corredor e tipo com o mesmo nome ("Gatil · Gatil") aparecem uma vez só. -->
                {{
                  [
                    ...new Set(
                      [
                        acomodacao ? hotelStore.bloco(acomodacao.blocoId)?.nome : '',
                        acomodacao ? hotelStore.tipoDeAcomodacao(acomodacao.tipoId)?.nome : '',
                      ].filter(Boolean),
                    ),
                  ].join(' · ')
                }}
              </small>
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('hotel.estadia.nova.dados.noites') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-moon-stars" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">
                {{
                  encerrada
                    ? noitesPrevistas
                    : t('hotel.estadia.nova.dados.noitesDe', {
                        atual: Math.min(noitesAgora, noitesPrevistas),
                        total: noitesPrevistas,
                      })
                }}
              </strong>
              <small>
                {{
                  t(
                    'hotel.estadia.nova.dados.noitesReservadas',
                    { total: noitesPrevistas },
                    noitesPrevistas,
                  )
                }}
              </small>
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('hotel.estadia.stat.entrada') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-sign-in" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">{{ diaCurto(registro.entradaEm) }}</strong>
              <small>
                {{
                  t('hotel.estadia.nova.dados.horaRecebido', {
                    hora: formato.hora(registro.entradaEm),
                    nome: cuidador(registro.recebidoPor),
                  })
                }}
              </small>
            </dd>
          </div>
          <div class="dado" :class="{ 'dado--atencao': saidaAtrasada }">
            <dt>
              {{ t('hotel.estadia.stat.saida') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-sign-out" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">{{ diaDaSaida }}</strong>
              <small>{{ legendaDaSaida }}</small>
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('hotel.estadia.stat.peso') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-scales" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">{{ formato.peso(registro.pesoEntradaKg) }}</strong>
              <small>
                {{
                  registro.pesoSaidaKg === null
                    ? t('hotel.estadia.stat.semPesagem')
                    : t('hotel.estadia.stat.saidaPeso', { valor: formato.peso(registro.pesoSaidaKg) })
                }}
              </small>
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('hotel.estadia.stat.saldo') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-wallet" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">
                {{ formato.moeda(Math.abs(estadia.saldoCentavos)) }}
              </strong>
              <small>
                {{
                  encerrada
                    ? t('hotel.estadia.nova.saida.quitado')
                    : estadia.saldoCentavos < 0
                      ? t('hotel.estadia.stat.saldoDevolver')
                      : t('hotel.estadia.stat.saldoDetalhe')
                }}
              </small>
            </dd>
          </div>
        </dl>
      </section>

      <!--
        A estadia encerrada continua alcançável — pelo histórico, pelo link que alguém mandou. A
        primeira linha diz que ela acabou: sem isto, a tela de um animal que foi para casa é igual
        à de um que está no canil, e alguém marca a refeição de quem já saiu.
      -->
      <p v-if="encerrada" class="aviso aviso--encerrada" role="status">
        <i class="ph ph-check-circle" aria-hidden="true" />
        {{
          t('hotel.estadia.nova.encerradaEm', {
            quando: registro.saidaEm ? quando(registro.saidaEm) : '',
            nome: registro.retiradoPor || tutor?.nome || '',
          })
        }}
      </p>

      <!-- O quadro de estado: o que pede atenção agora, do mais grave para o menos. -->
      <section v-else class="atencao" aria-labelledby="estadia-atencao">
        <h2 id="estadia-atencao" class="atencao__titulo">
          <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
            <i class="ph ph-bell-ringing" />
          </span>
          {{ t('hotel.estadia.nova.atencao.titulo') }}
          <span v-if="atencao.length" class="ui-contagem">{{ atencao.length }}</span>
        </h2>

        <ul v-if="atencao.length" class="ui-lista ui-folha">
          <li v-for="item in atencao" :key="item.id">
            <div class="ui-linha ui-marca atencao__linha" :class="`ui-marca--${item.tom}`">
              <span class="atencao__icone" :class="`atencao__icone--${item.tom}`" aria-hidden="true">
                <i :class="item.icone" />
              </span>
              <span class="ui-linha__texto">
                <strong class="ui-linha__titulo atencao__frase">{{ item.titulo }}</strong>
                <span class="ui-linha__meta atencao__detalhe">{{ item.detalhe }}</span>
              </span>
              <Button
                type="button"
                class="atencao__acao"
                :icon="item.acao.icone"
                :label="item.acao.rotulo"
                severity="secondary"
                outlined
                size="small"
                @click="item.acao.executar()"
              />
            </div>
          </li>
        </ul>

        <p v-else class="ui-folha atencao__calma">
          <i class="ph ph-check-circle" aria-hidden="true" />
          <span>{{ fraseCalma }}</span>
        </p>
      </section>

      <p v-if="hospedagem.erroDeAcao" class="aviso aviso--erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ t(hospedagem.erroDeAcao) }}
      </p>

      <div class="trabalho">
        <div class="trabalho__principal">
          <div
            ref="abasEl"
            class="abas"
            role="tablist"
            :aria-label="t('hotel.estadia.nova.abasRotulo')"
            @keydown="aoTeclarNasAbas"
          >
            <button
              v-for="opcao in opcoesDeAba"
              :id="`estadia-aba-${opcao.valor}`"
              :key="opcao.valor"
              type="button"
              role="tab"
              class="abas__aba"
              :class="{ 'abas__aba--atual': aba === opcao.valor }"
              :aria-selected="aba === opcao.valor"
              :aria-controls="`estadia-painel-${opcao.valor}`"
              :tabindex="aba === opcao.valor ? 0 : -1"
              @click="aba = opcao.valor"
            >
              <i :class="opcao.icone" aria-hidden="true" />
              <span>{{ opcao.rotulo }}</span>
              <span
                v-if="opcao.contagem > 0"
                class="abas__selo ui-num"
                :class="`abas__selo--${opcao.tom}`"
              >
                {{ opcao.contagem }}
              </span>
            </button>
          </div>

          <div
            :id="`estadia-painel-${aba}`"
            class="painel"
            role="tabpanel"
            :aria-labelledby="`estadia-aba-${aba}`"
          >
            <!-- ======================================================== rotina -->
            <template v-if="aba === 'rotina'">
              <section class="bloco">
                <header class="bloco__cabeca">
                  <div class="bloco__titulos">
                    <h3 class="bloco__titulo">{{ t('hotel.estadia.rotinaHoje') }}</h3>
                    <p v-if="tarefasDeHoje.length" class="bloco__descricao ui-num">
                      {{
                        t('hotel.estadia.nova.rotina.contagem', {
                          feitas: resolvidasHoje,
                          total: tarefasDeHoje.length,
                        })
                      }}
                    </p>
                  </div>
                  <Button
                    v-if="!encerrada"
                    type="button"
                    icon="ph ph-plus"
                    :label="t('hotel.acrescentar.titulo')"
                    severity="secondary"
                    outlined
                    size="small"
                    @click="abrirAcrescentar"
                  />
                </header>

                <p v-if="rotinaDeHoje.length === 0" class="ui-folha ui-vazio">
                  {{ t('hotel.estadia.semRotina') }}
                </p>

                <ul v-else class="ui-lista ui-folha lista-de-tarefas">
                  <TarefaLinha
                    v-for="item in rotinaDeHoje"
                    :key="item.tarefa.id"
                    :tarefa="item.tarefa"
                    :situacao="item.situacao"
                    :hora="formato.hora(item.tarefa.previstaPara)"
                    :salvando="hospedagem.salvando"
                    @marcar="marcar"
                  />
                </ul>
              </section>

              <!--
                Logo abaixo da rotina, e a posição é o argumento: a de cima responde o que falta
                hoje, esta responde por que é isso que falta.
              -->
              <PlanoDaEstadia
                :ajustes="ajustes"
                :salvando="hospedagem.salvando"
                @propor="abrirProposta"
                @revogar="revogarAjuste"
              />
            </template>

            <!-- ===================================================== medicação -->
            <template v-else-if="aba === 'medicacao'">
              <section class="bloco">
                <header class="bloco__cabeca">
                  <div class="bloco__titulos">
                    <h3 class="bloco__titulo">{{ t('hotel.estadia.nova.medicacao.titulo') }}</h3>
                    <p class="bloco__descricao">{{ t('hotel.estadia.nova.medicacao.descricao') }}</p>
                  </div>
                  <Button
                    v-if="!encerrada"
                    type="button"
                    icon="ph ph-plus"
                    :label="t('hotel.acrescentar.cuidadoIrParaMedicacao')"
                    severity="secondary"
                    outlined
                    size="small"
                    @click="abrirAcrescentar"
                  />
                </header>

                <p v-if="medicacoes.length === 0" class="ui-folha ui-vazio">
                  {{ t('hotel.estadia.nova.medicacao.vazio') }}
                </p>

                <ul v-else class="ui-lista ui-folha">
                  <li v-for="med in medicacoes" :key="med.id" class="remedio" :class="{ 'remedio--suspensa': med.suspensaEm }">
                    <span class="remedio__icone" aria-hidden="true"><i class="ph ph-pill" /></span>
                    <div class="remedio__corpo">
                      <p class="remedio__nome">
                        <strong>{{ med.descricao }}</strong>
                        <span class="ui-num">{{ med.doseTexto }}</span>
                        <span class="remedio__via">{{ formato.via(med.via) }}</span>
                        <span v-if="med.suspensaEm" class="ui-selo">
                          {{ t('hotel.estadia.nova.medicacao.suspensa') }}
                        </span>
                      </p>

                      <!-- Os horários dizem, cada um, se a dose de hoje já foi dada. -->
                      <ul class="remedio__horarios" :aria-label="t('hotel.estadia.nova.medicacao.horarios')">
                        <li
                          v-for="horario in med.horarios"
                          :key="horario"
                          class="horario ui-num"
                          :class="`horario--${dosesDa(med.id).find((dose) => formato.hora(dose.tarefa.previstaPara) === horario)?.situacao ?? 'futura'}`"
                        >
                          <i
                            v-if="dosesDa(med.id).find((dose) => formato.hora(dose.tarefa.previstaPara) === horario)?.tarefa.status === 'feita'"
                            class="ph ph-check"
                            aria-hidden="true"
                          />
                          {{ horario }}
                        </li>
                      </ul>

                      <p v-if="med.receita || med.observacao" class="remedio__meta">
                        <template v-if="med.receita">
                          <i class="ph ph-file-text" aria-hidden="true" />
                          {{ med.receita }}
                        </template>
                        <template v-if="med.receita && med.observacao"> · </template>
                        {{ med.observacao }}
                      </p>
                    </div>
                  </li>
                </ul>
              </section>

              <section v-if="dosesDeHoje.length" class="bloco">
                <header class="bloco__cabeca">
                  <h3 class="bloco__titulo">{{ t('hotel.estadia.nova.medicacao.dosesDeHoje') }}</h3>
                </header>

                <ul class="ui-lista ui-folha lista-de-tarefas">
                  <TarefaLinha
                    v-for="item in dosesDeHoje"
                    :key="item.tarefa.id"
                    :tarefa="item.tarefa"
                    :situacao="item.situacao"
                    :hora="formato.hora(item.tarefa.previstaPara)"
                    :salvando="hospedagem.salvando"
                    @marcar="marcar"
                  />
                </ul>
              </section>
            </template>

            <!-- ======================================================== diário -->
            <section v-else-if="aba === 'diario'" class="bloco">
              <header class="bloco__cabeca">
                <div class="bloco__titulos">
                  <h3 class="bloco__titulo">{{ t('hotel.estadia.diario') }}</h3>
                  <p class="bloco__descricao">{{ t('hotel.estadia.nova.diario.descricao') }}</p>
                </div>
                <Button
                  v-if="!encerrada"
                  type="button"
                  icon="ph ph-plus"
                  :label="t('hotel.estadia.nova.acao.diario')"
                  severity="secondary"
                  outlined
                  size="small"
                  @click="diarioAberto = true"
                />
              </header>

              <p v-if="diarioPorDia.length === 0" class="ui-folha ui-vazio">
                {{ t('hotel.estadia.semDiario') }}
              </p>

              <div v-for="dia in diarioPorDia" :key="dia.data" class="dia">
                <h4 class="dia__rotulo">{{ dia.rotulo }}</h4>
                <ul class="ui-lista ui-folha">
                  <li v-for="item in dia.registros" :key="item.id" class="registro">
                    <span class="registro__icone" aria-hidden="true">
                      <i :class="ICONE_DO_REGISTRO[item.kind]" />
                    </span>
                    <div class="registro__corpo">
                      <p class="registro__topo">
                        <strong>{{ formato.registroKind(item.kind) }}</strong>
                        <span class="ui-hora registro__hora">{{ formato.hora(item.registradoEm) }}</span>
                      </p>
                      <p class="registro__texto">{{ item.texto }}</p>
                      <p class="registro__quem">{{ cuidador(item.registradoPor) }}</p>
                    </div>
                    <!-- A foto do momento: no protótipo, as iniciais do hóspede no lugar da imagem. -->
                    <span v-if="item.foto" class="registro__foto" :title="t('hotel.diario.comFoto')">
                      <i class="ph ph-camera" aria-hidden="true" />
                      <span>{{ item.foto }}</span>
                    </span>
                  </li>
                </ul>
              </div>
            </section>

            <!-- =================================================== ocorrências -->
            <section v-else-if="aba === 'ocorrencias'" class="bloco">
              <header class="bloco__cabeca">
                <div class="bloco__titulos">
                  <h3 class="bloco__titulo">{{ t('hotel.estadia.ocorrencias') }}</h3>
                  <p class="bloco__descricao">{{ t('hotel.estadia.nova.ocorrencias.descricao') }}</p>
                </div>
                <Button
                  v-if="!encerrada"
                  type="button"
                  icon="ph ph-flag"
                  :label="t('hotel.ocorrencia.registrar')"
                  severity="secondary"
                  outlined
                  size="small"
                  @click="ocorrenciaAberta = true"
                />
              </header>

              <p v-if="estadia.ocorrencias.length === 0" class="ui-folha ui-vazio">
                {{ t('hotel.estadia.semOcorrencias') }}
              </p>

              <ul v-else class="ui-lista ui-folha">
                <li
                  v-for="item in estadia.ocorrencias"
                  :key="item.id"
                  class="ocorrencia ui-marca"
                  :class="`ui-marca--${tomDaGravidade(item.gravidade)}`"
                >
                  <div class="ocorrencia__topo">
                    <strong>{{ formato.ocorrenciaKind(item.kind) }}</strong>
                    <HotelSelo
                      :rotulo="formato.gravidade(item.gravidade)"
                      :tom="tomDaGravidade(item.gravidade)"
                    />
                    <HotelSelo
                      v-if="item.exigeContato"
                      :rotulo="
                        item.contatoEm
                          ? t('hotel.estadia.comunicado', { hora: formato.hora(item.contatoEm) })
                          : t('hotel.estadia.semContato')
                      "
                      :tom="item.contatoEm ? 'positivo' : 'risco'"
                      icone="ph ph-phone"
                    />
                    <HotelSelo
                      v-if="item.encaminhadaAoVeterinario"
                      :rotulo="t('hotel.estadia.nova.ocorrencias.veterinario')"
                      tom="neutro"
                      icone="ph ph-first-aid"
                    />
                    <span class="ocorrencia__quando ui-num">{{ quando(item.registradaEm) }}</span>
                  </div>

                  <p class="ocorrencia__texto">{{ item.descricao }}</p>
                  <p class="ocorrencia__conduta">
                    <span>{{ t('hotel.ocorrencia.conduta') }}:</span>
                    {{ item.conduta }}
                  </p>
                  <p class="ocorrencia__quem">{{ cuidador(item.registradaPor) }}</p>

                  <div v-if="item.exigeContato && !item.contatoEm" class="ocorrencia__ligar">
                    <span>
                      <i class="ph ph-phone-call" aria-hidden="true" />
                      {{ t('hotel.estadia.precisaLigar', { nome: tutor?.nome ?? '' }) }}
                      <a v-if="tutor?.telefone" class="ui-num" :href="`tel:${telefoneDoTutor}`">
                        {{ tutor.telefone }}
                      </a>
                    </span>
                    <Button
                      type="button"
                      icon="ph ph-check"
                      :label="t('hotel.estadia.registrarLigacao')"
                      severity="secondary"
                      outlined
                      size="small"
                      :loading="hospedagem.salvando"
                      @click="registrarContato(item.id)"
                    />
                  </div>
                </li>
              </ul>
            </section>

            <!-- ====================================================== boletins -->
            <section v-else-if="aba === 'boletins'" class="bloco">
              <header class="bloco__cabeca">
                <div class="bloco__titulos">
                  <h3 class="bloco__titulo">{{ t('hotel.estadia.boletim') }}</h3>
                  <p class="bloco__descricao">{{ t('hotel.estadia.nova.boletins.descricao') }}</p>
                </div>
                <Button
                  v-if="!encerrada"
                  type="button"
                  icon="ph ph-chat-circle-text"
                  :label="t('hotel.estadia.nova.boletins.gerar')"
                  severity="secondary"
                  outlined
                  size="small"
                  :loading="hospedagem.salvando"
                  @click="hospedagem.gerarBoletim(hospedagemId)"
                />
              </header>

              <!--
                O boletim retido é mostrado com o motivo do travamento, e não como um erro: quem lê
                precisa entender que **falta uma ligação** — não que o sistema quebrou.
              -->
              <p v-if="boletimRetido" class="aviso aviso--atencao">
                <i class="ph ph-lock" aria-hidden="true" />
                {{ t('hotel.estadia.boletimRetido') }}
              </p>

              <p v-if="estadia.boletins.length === 0" class="ui-folha ui-vazio">
                {{ t('hotel.estadia.semBoletim') }}
              </p>

              <ul v-else class="ui-lista ui-folha">
                <li v-for="boletim in estadia.boletins" :key="boletim.id" class="boletim">
                  <div class="boletim__topo">
                    <span
                      class="ui-selo"
                      :class="{
                        'ui-selo--ok': boletim.status === 'enviado',
                        'ui-selo--atencao': boletim.status === 'retido',
                      }"
                    >
                      <i
                        :class="
                          boletim.status === 'enviado'
                            ? 'ph ph-check'
                            : boletim.status === 'retido'
                              ? 'ph ph-lock'
                              : 'ph ph-pencil-simple'
                        "
                        aria-hidden="true"
                      />
                      {{
                        boletim.status === 'enviado'
                          ? t('hotel.estadia.enviado')
                          : boletim.status === 'retido'
                            ? t('hotel.estadia.nova.boletins.retido')
                            : t('hotel.estadia.nova.boletins.rascunho')
                      }}
                    </span>
                    <span class="boletim__quando ui-num">
                      {{ quando(boletim.geradoEm) }}
                      <template v-if="boletim.enviadoEm">
                        · {{ t('hotel.estadia.nova.boletins.enviadoAs', { hora: formato.hora(boletim.enviadoEm) }) }}
                      </template>
                    </span>
                    <Button
                      v-if="boletim.status !== 'enviado' && !encerrada"
                      type="button"
                      class="boletim__enviar"
                      :label="t('hotel.estadia.nova.boletins.enviar')"
                      icon="ph ph-paper-plane-tilt"
                      size="small"
                      :disabled="Boolean(boletimRetido)"
                      :loading="hospedagem.salvando"
                      @click="hospedagem.enviarBoletim(boletim.id, hospedagemId)"
                    />
                  </div>
                  <p class="boletim__texto">{{ boletim.texto }}</p>
                </li>
              </ul>
            </section>

            <!-- ========================================================= saída -->
            <section v-else class="bloco">
              <header class="bloco__cabeca">
                <div class="bloco__titulos">
                  <h3 class="bloco__titulo">
                    {{
                      encerrada
                        ? t('hotel.estadia.nova.saida.tituloEncerrada')
                        : t('hotel.estadia.nova.saida.titulo')
                    }}
                  </h3>
                  <p class="bloco__descricao">
                    {{
                      encerrada
                        ? t('hotel.estadia.nova.encerradaEm', {
                            quando: registro.saidaEm ? quando(registro.saidaEm) : '',
                            nome: registro.retiradoPor || tutor?.nome || '',
                          })
                        : t('hotel.estadia.nova.saida.descricao', {
                            quando: quando(registro.saidaPrevistaEm),
                          })
                    }}
                  </p>
                </div>
              </header>

              <!-- A lista de checagem: o que trava, e o que já foi feito. -->
              <ol v-if="!encerrada" class="ui-lista ui-folha checagem">
                <li
                  v-for="passo in passosDaSaida"
                  :key="passo.id"
                  class="checagem__passo"
                  :class="`checagem__passo--${passo.tom}`"
                >
                  <span class="checagem__marca" aria-hidden="true">
                    <i :class="passo.feito ? 'ph ph-check' : passo.icone" />
                  </span>
                  <span class="checagem__texto">
                    <strong>{{ passo.titulo }}</strong>
                    <small>{{ passo.detalhe }}</small>
                  </span>
                  <span class="ui-selo" :class="`ui-selo--${passo.feito ? 'ok' : passo.tom === 'neutro' ? 'contorno' : passo.tom}`">
                    {{
                      passo.feito
                        ? t('hotel.estadia.nova.saida.feito')
                        : passo.id === 'saldo'
                          ? t('hotel.estadia.nova.saida.noBalcao')
                          : t('hotel.estadia.nova.saida.falta')
                    }}
                  </span>
                  <Button
                    v-if="passo.id === 'ocorrencia'"
                    type="button"
                    icon="ph ph-check"
                    :label="t('hotel.estadia.registrarLigacao')"
                    severity="secondary"
                    outlined
                    size="small"
                    :loading="hospedagem.salvando"
                    @click="registrarContato(hospedagem.ocorrenciasTravadasDaEstadia[0]!.id)"
                  />
                </li>
              </ol>

              <div v-if="!encerrada" class="checagem__fim">
                <p>
                  {{
                    faltamNaSaida > 0
                      ? t('hotel.estadia.nova.saida.conferirNoBalcao')
                      : t('hotel.painel.prontoParaSair')
                  }}
                </p>
                <!--
                  Contornado: a ação cheia da tela já é o check-out no dia da saída, e nos outros
                  dias sair antes é a exceção.
                -->
                <Button
                  type="button"
                  icon="ph ph-sign-out"
                  :label="t('hotel.estadia.fazerCheckOut')"
                  severity="secondary"
                  outlined
                  @click="abrirCheckOut"
                />
              </div>

              <!-- Os pertences: o que entrou tem que sair. -->
              <h4 class="dia__rotulo">{{ t('hotel.estadia.pertences') }}</h4>
              <p v-if="registro.pertences.length === 0" class="ui-folha ui-vazio">
                {{ t('hotel.estadia.nova.saida.semPertences') }}
              </p>
              <ul v-else class="ui-lista ui-folha">
                <li v-for="item in registro.pertences" :key="item.id" class="pertence">
                  <i
                    class="pertence__icone"
                    :class="item.devolvido ? 'ph ph-check-circle' : 'ph ph-backpack'"
                    aria-hidden="true"
                  />
                  <span class="pertence__texto">
                    <strong>
                      {{ item.descricao }}
                      <span v-if="item.quantidade > 1" class="ui-num">× {{ item.quantidade }}</span>
                    </strong>
                    <small v-if="item.observacao">{{ item.observacao }}</small>
                  </span>
                  <HotelSelo
                    v-if="item.devolvido"
                    :rotulo="t('hotel.checkout.devolvido')"
                    tom="positivo"
                  />
                  <HotelSelo
                    v-else-if="item.observacao"
                    :rotulo="t('hotel.estadia.nova.saida.comObservacao')"
                    tom="atencao"
                  />
                  <HotelSelo v-else :rotulo="t('hotel.estadia.nova.saida.naCasa')" tom="neutro" />
                </li>
              </ul>
            </section>
          </div>
        </div>

        <!--
          A ficha fica ao lado das abas, sempre à vista: é a pergunta que chega por telefone no meio
          da estadia — "minha irmã pode passar aí amanhã?" — e quem atende precisa da resposta sem
          trocar de aba.
        -->
        <aside class="ficha ui-folha" :aria-label="t('hotel.estadia.ficha')">
          <h2 class="ficha__titulo">
            <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
              <i class="ph ph-identification-card" />
            </span>
            {{ t('hotel.estadia.ficha') }}
          </h2>

          <dl class="ficha__lista">
            <div class="ficha__item">
              <dt><i class="ph ph-bowl-food" aria-hidden="true" />{{ t('hotel.estadia.alimentacao') }}</dt>
              <dd>
                <!--
                  Sem marca, a origem da ração decide o texto: "Ração da casa" para quem trouxe a
                  própria contradizia o check-in. E porção zero é porção não informada, não "0 g".
                -->
                <span class="ficha__linha">
                  {{
                    registro.planoAlimentar.marca ||
                    (registro.planoAlimentar.racaoPropria
                      ? t('hotel.estadia.racaoTrazida')
                      : t('hotel.estadia.racaoDaCasa'))
                  }}
                  <template v-if="registro.planoAlimentar.porcaoGramas > 0">
                    · <span class="ui-num">{{ registro.planoAlimentar.porcaoGramas }} g</span>
                  </template>
                </span>
                <span class="ficha__linha ui-num">{{ registro.planoAlimentar.horarios.join(', ') }}</span>
                <span v-if="registro.planoAlimentar.restricoes" class="ficha__linha ficha__linha--alerta">
                  {{ registro.planoAlimentar.restricoes }}
                </span>
                <span v-if="registro.planoAlimentar.petiscos" class="ficha__linha ficha__linha--fraca">
                  {{ registro.planoAlimentar.petiscos }}
                </span>
              </dd>
            </div>

            <div class="ficha__item">
              <dt><i class="ph ph-seal-check" aria-hidden="true" />{{ t('hotel.estadia.autorizacoes') }}</dt>
              <dd>
                <ul class="ficha__autorizacoes">
                  <li
                    v-for="item in registro.autorizacoes.filter((auth) => auth.concedida)"
                    :key="item.kind"
                  >
                    <i class="ph ph-check" aria-hidden="true" />
                    {{ formato.autorizacao(item.kind) }}
                    <template v-if="item.limiteCentavos">
                      ({{ t('hotel.estadia.nova.ficha.ate', { valor: formato.moeda(item.limiteCentavos) }) }})
                    </template>
                  </li>
                </ul>
              </dd>
            </div>

            <div class="ficha__item">
              <dt><i class="ph ph-users" aria-hidden="true" />{{ t('hotel.estadia.quemBusca') }}</dt>
              <dd>
                <span class="ficha__linha">
                  <strong>{{ tutor?.nome }}</strong> · {{ t('hotel.quemBusca.responsavel') }}
                </span>
                <span
                  v-for="pessoa in estadia.autorizadosARetirar"
                  :key="pessoa.id"
                  class="ficha__linha"
                >
                  <strong>{{ pessoa.nome }}</strong>
                  <template v-if="pessoa.relacao"> · {{ pessoa.relacao }}</template>
                  <template v-if="pessoa.telefone">
                    · <span class="ui-num">{{ pessoa.telefone }}</span>
                  </template>
                </span>
              </dd>
            </div>

            <div v-if="registro.contatoEmergencia || registro.veterinario" class="ficha__item">
              <dt><i class="ph ph-first-aid-kit" aria-hidden="true" />{{ t('hotel.estadia.emergencia') }}</dt>
              <!-- Uma linha por contato: sem o do responsável, o veterinário sobe para a primeira. -->
              <dd>
                <span v-if="registro.contatoEmergencia" class="ficha__linha ui-num">
                  {{ registro.contatoEmergencia }}
                </span>
                <span v-if="registro.veterinario" class="ficha__linha">
                  <strong>{{ registro.veterinario.nome }}</strong>
                  <template v-if="registro.veterinario.clinica">
                    · {{ registro.veterinario.clinica }}
                  </template>
                  <template v-if="registro.veterinario.telefone">
                    · <span class="ui-num">{{ registro.veterinario.telefone }}</span>
                  </template>
                </span>
              </dd>
            </div>

            <div v-if="registro.inspecaoDeEntrada" class="ficha__item">
              <dt><i class="ph ph-eye" aria-hidden="true" />{{ t('hotel.estadia.inspecao') }}</dt>
              <dd>{{ registro.inspecaoDeEntrada }}</dd>
            </div>

            <div v-if="registro.observacao" class="ficha__item">
              <dt><i class="ph ph-note" aria-hidden="true" />{{ t('hotel.estadia.nova.ficha.observacao') }}</dt>
              <dd>{{ registro.observacao }}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>

    <template #sempre>
      <OcorrenciaDialog
        :aberto="ocorrenciaAberta"
        :pet-nome="pet?.nome ?? ''"
        :salvando="hospedagem.salvando"
        :erro="hospedagem.erroDeAcao"
        @fechar="ocorrenciaAberta = false"
        @confirmar="
          async (payload) => {
            if (await hospedagem.registrarOcorrencia({ ...payload, hospedagemId })) {
              ocorrenciaAberta = false
            }
          }
        "
      />

      <DiarioDialog
        :aberto="diarioAberto"
        :pet-nome="pet?.nome ?? ''"
        :pet-iniciais="pet?.iniciais ?? ''"
        :salvando="hospedagem.salvando"
        :erro="hospedagem.erroDeAcao"
        @fechar="diarioAberto = false"
        @confirmar="
          async (payload) => {
            if (await hospedagem.registrarNoDiario({ ...payload, hospedagemId })) {
              diarioAberto = false
            }
          }
        "
      />

      <CheckOutDialog
        :aberto="checkOutAberto"
        :hospedagem="registro"
        :pet-nome="pet?.nome ?? ''"
        :saldo-centavos="estadia?.saldoNaSaidaCentavos ?? estadia?.saldoCentavos ?? 0"
        :acrescimo-de-saida="estadia?.acrescimoNaSaida ?? estadia?.acrescimoDeSaida ?? 0"
        :ocorrencias-travadas="hospedagem.ocorrenciasTravadasDaEstadia"
        :responsavel-nome="tutor?.nome ?? ''"
        :responsavel-telefone="tutor?.telefone ?? ''"
        :responsavel-documento="tutor?.documento ?? ''"
        :autorizados-a-retirar="estadia?.autorizadosARetirar ?? []"
        :salvando="hospedagem.salvando"
        :erro="hospedagem.erroDeAcao"
        @fechar="checkOutAberto = false"
        @conferir="(payload) => hospedagem.conferirPertence({ ...payload, hospedagemId })"
        @pesar="(peso) => hospedagem.pesarNaSaida(hospedagemId, peso)"
        @confirmar="fecharEstadia"
      />

      <PropostaDeRotinaDialog
        :aberto="propostaAberta"
        :hospedes="hospedes"
        :hospedagem-id="hospedagemId"
        :proposta="hospedagem.proposta"
        :gerando="hospedagem.gerandoProposta"
        :salvando="hospedagem.salvando"
        :erro="hospedagem.erroDeAcao ? t(hospedagem.erroDeAcao) : ''"
        @fechar="propostaAberta = false"
        @aprovar="aprovarProposta"
      />

      <AcrescentarNaRotina
        :aberto="acrescentarAberto"
        :hospedes="hospedes"
        :hospedagem-id="hospedagemId"
        :rotina-da-casa="rotinaDaCasa"
        :servicos="hotelStore.servicos"
        :hoje="hospedagem.dia"
        :salvando="hospedagem.salvando"
        :erro="hospedagem.erroDeAcao ? t(hospedagem.erroDeAcao) : ''"
        @fechar="acrescentarAberto = false"
        @medicacao="registrarMedicacao"
        @cuidado="registrarCuidado"
        @servico="acrescentarServico"
        @ajuste="registrarAjuste"
      />

      <HotelDevPanel />

      <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
    </template>
  </UiPagina>
</template>

<style scoped>
/*
 * A largura da estadia, e não a da janela, decide se a ficha cabe ao lado das abas: com a barra
 * aberta numa tela de 1280, a janela é larga e a coluna não.
 */
.estadia {
  display: grid;
  gap: 24px;
  grid-template-columns: minmax(0, 1fr);
  container: estadia / inline-size;
}

/* ------------------------------------------------------------------ topo */

.voltar .ph {
  font-size: 13px;
}

[dir='rtl'] .voltar .ph {
  scale: -1 1;
}

.capa {
  display: flex;
  min-width: 0;
  flex: 1 1 520px;
  align-items: flex-start;
  gap: 20px;
}

/* O retrato sobe da folha: um anel de papel e a sombra do cartão. */
.capa__rosto {
  flex: none;
  border-radius: 50%;
  box-shadow:
    0 0 0 4px var(--superficie),
    var(--sombra-2);
}

/* `minmax(0, 1fr)`: sem ele, a escada da adaptação alarga a coluna e vaza da tela no celular. */
.capa__texto {
  display: grid;
  min-width: 0;
  gap: 6px;
  grid-template-columns: minmax(0, 1fr);
}

.capa__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 12px;
  margin: 0;
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.capa__selo {
  letter-spacing: 0;
}

.capa__perfil {
  margin: 0;
  color: var(--tinta-2);
  font-size: 15px;
}

.capa__tutor {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 500;
}

.capa__tutor > i {
  color: var(--tinta-2);
  font-size: 16px;
}

.capa__telefone {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--pj-lugar-tinta);
  font-weight: 600;
  text-decoration: none;
}

.capa__telefone:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.capa__telefone:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--pj-lugar);
  outline-offset: 2px;
}

.capa__adaptacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin-top: 6px;
}

.capa__adaptacao-rotulo {
  color: var(--tinta-2);
  font-size: 13px;
}

/* O degrau escolhido leva a cor do estado: âmbar em adaptação, vermelho estressado. */
/* Na palavra (`label`), e não na caixa: a caixa escolhida tem a cor dela no kit. */
/*
 * "Tranquilo" é o tom neutro e não tinha regra: herdava o branco da capa sobre a caixa branca do
 * escolhido, e a palavra sumia. Dentro da capa `--tinta` é branco; a tinta certa é a dos botões
 * claros da capa (`--app-tinta`), que acompanha o tema. Âmbar e vermelho a sobrescrevem.
 */
.capa__escada :deep(.p-togglebutton-checked .p-togglebutton-label) {
  color: var(--app-tinta);
}

.capa__escada--atencao :deep(.p-togglebutton-checked .p-togglebutton-label) {
  color: var(--atencao-tinta);
}

.capa__escada--risco :deep(.p-togglebutton-checked .p-togglebutton-label) {
  color: var(--risco-tinta);
}

/* A classe dobrada vence a regra global do kit, que dá 14px de recheio a todo segmentado. */
.capa__escada.capa__escada :deep(.p-togglebutton .p-togglebutton-content) {
  padding: 5px 12px;
  font-size: 13.5px;
}

/* A ação do momento pode ser longa: quebra em vez de empurrar a página. */
.acao-principal {
  max-width: 100%;
  white-space: normal;
  text-align: start;
}

/* ------------------------------------------------------------------ o quadro */

.quadro {
  overflow: hidden;
}

/*
 * Fileira que quebra: cada célula traz a divisória à esquerda e em cima, deslocada um pixel para
 * fora — a primeira de cada linha e as da primeira fileira caem fora do recorte, e o fio só
 * aparece **entre** células, em qualquer largura.
 */
.quadro__dados {
  display: flex;
  flex-wrap: wrap;
  overflow: hidden;
  margin: 0;
}

.dado {
  position: relative;
  display: grid;
  min-width: 0;
  flex: 1 1 160px;
  align-content: start;
  gap: 6px;
  margin-block-start: -1px;
  margin-inline-start: -1px;
  padding: 18px 24px;
  border-block-start: 1px solid var(--linha);
  border-inline-start: 1px solid var(--linha);
}

.dado dt {
  padding-inline-end: 34px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.dado__icone {
  position: absolute;
  top: 14px;
  inset-inline-end: 14px;
}

.dado dd {
  display: grid;
  min-width: 0;
  gap: 3px;
  margin: 0;
}

.dado__grande {
  overflow: hidden;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 24px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dado dd small {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.35;
}

.dado--atencao .dado__grande,
.dado--atencao dd small {
  color: var(--atencao-tinta);
}

.dado--atencao dd small {
  font-weight: 600;
}

/* ------------------------------------------------------------------ o que pede atenção */

.atencao {
  display: grid;
  gap: 14px;
}

.atencao__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.atencao__linha {
  padding-inline-start: 20px;
}

.atencao__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 18px;
}

.atencao__icone--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.atencao__icone--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.atencao__icone--lugar {
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
}

/* A frase pode ser longa ("Ligue para João Pedro Camargo antes do fim do turno"): quebra. */
.atencao__frase,
.atencao__detalhe {
  white-space: normal;
}

.atencao__acao {
  flex: none;
}

.atencao__calma {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 16px 18px;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 500;
}

.atencao__calma i {
  color: var(--ok-tinta);
  font-size: 20px;
}

/* ------------------------------------------------------------------ avisos */

.aviso {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.45;
}

.aviso i {
  flex: none;
  font-size: 18px;
}

.aviso--encerrada {
  padding: 12px 16px;
  border-radius: var(--raio-cartao-pequeno);
  background: var(--neutro-fundo);
  color: var(--tinta);
}

.aviso--erro {
  padding: 12px 16px;
  border-radius: var(--raio-cartao-pequeno);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.aviso--atencao {
  padding: 12px 16px;
  border-radius: var(--raio-cartao-pequeno);
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

/* ------------------------------------------------------------------ trabalho: abas + ficha */

.trabalho {
  display: grid;
  align-items: start;
  gap: 24px;
  margin-top: 4px;
  grid-template-columns: minmax(0, 1fr) minmax(270px, 300px);
}

.trabalho__principal {
  display: grid;
  min-width: 0;
  gap: 20px;
}

.abas {
  display: flex;
  gap: 0;
  overflow-x: auto;
  border-bottom: 1px solid var(--linha);
  scroll-margin-top: 16px;
  scrollbar-width: none;
}

.abas::-webkit-scrollbar {
  display: none;
}

.abas__aba {
  position: relative;
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 7px;
  height: 48px;
  padding: 0 11px;
  border: 0;
  background: none;
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  font-size: 14.5px;
  font-weight: 500;
  white-space: nowrap;
}

.abas__aba:first-child {
  padding-inline-start: 2px;
}

.abas__aba i {
  font-size: 17px;
}

.abas__aba:hover {
  color: var(--tinta);
}

.abas__aba:focus-visible {
  border-radius: 8px;
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -4px;
}

.abas__aba--atual {
  color: var(--tinta);
  font-weight: 600;
}

.abas__aba--atual i {
  color: var(--pj-lugar-tinta, var(--musgo));
}

.abas__aba--atual::after {
  position: absolute;
  right: 11px;
  bottom: -1px;
  left: 11px;
  height: 3px;
  border-radius: 3px 3px 0 0;
  background: var(--pj-lugar, var(--musgo));
  content: '';
}

.abas__aba--atual:first-child::after {
  left: 2px;
}

[dir='rtl'] .abas__aba--atual:first-child::after {
  right: 2px;
  left: 11px;
}

.abas__selo {
  display: inline-grid;
  min-width: 22px;
  height: 20px;
  padding: 0 6px;
  place-items: center;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 650;
}

.abas__selo--neutro {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.abas__selo--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.abas__selo--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.painel {
  display: grid;
  min-width: 0;
  gap: 28px;
}

/* Uma seção dentro da aba: título no fundo, conteúdo na folha. */
.bloco {
  display: grid;
  min-width: 0;
  gap: 12px;
}

.bloco__cabeca {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px 16px;
}

.bloco__titulos {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.bloco__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 16px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.bloco__descricao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.lista-de-tarefas {
  overflow: hidden;
}

/* ---- medicação */

.remedio {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
}

.remedio__icone {
  display: grid;
  width: 38px;
  height: 38px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 19px;
}

.remedio--suspensa .remedio__icone {
  background: var(--superficie-2);
  color: var(--tinta-3);
}

.remedio__corpo {
  display: grid;
  min-width: 0;
  gap: 8px;
}

.remedio__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
}

.remedio__nome strong {
  font-weight: 600;
}

.remedio__via {
  color: var(--tinta-2);
  font-size: 13px;
}

.remedio--suspensa .remedio__nome strong {
  color: var(--tinta-2);
  text-decoration: line-through;
}

.remedio__horarios {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.horario {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--linha);
  border-radius: 999px;
  color: var(--tinta);
  font-size: 13px;
  font-weight: 600;
}

.horario--feita {
  border-color: transparent;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.horario--na-janela {
  border-color: var(--pj-lugar);
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
}

.horario--atrasada {
  border-color: transparent;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.horario--recusada,
.horario--pulada {
  border-color: transparent;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.remedio__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

/* ---- diário */

.dia {
  display: grid;
  gap: 8px;
}

.dia__rotulo {
  margin: 4px 0 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 600;
}

.dia__rotulo::first-letter {
  text-transform: uppercase;
}

.registro {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 14px 18px;
}

.registro__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 18px;
}

.registro__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 3px;
}

.registro__topo {
  display: flex;
  align-items: baseline;
  gap: 10px;
  margin: 0;
}

.registro__topo strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.registro__hora {
  color: var(--tinta-2);
  font-size: 13px;
}

.registro__texto {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.registro__quem {
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
}

.registro__foto {
  position: relative;
  display: grid;
  width: 56px;
  height: 56px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: linear-gradient(
    135deg,
    var(--pj-lugar-fundo),
    color-mix(in oklab, var(--pj-lugar) 35%, var(--superficie))
  );
  color: var(--pj-lugar-tinta);
  font-family: var(--font-dados);
  font-size: 15px;
  font-weight: 700;
}

.registro__foto i {
  position: absolute;
  inset-block-end: 4px;
  inset-inline-end: 4px;
  font-size: 13px;
  opacity: 0.8;
}

/* ---- ocorrências */

.ocorrencia {
  position: relative;
  display: grid;
  gap: 6px;
  padding: 16px 18px 16px 22px;
}

.ocorrencia__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.ocorrencia__topo strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.ocorrencia__quando {
  margin-inline-start: auto;
  color: var(--tinta-2);
  font-size: 13px;
}

.ocorrencia__texto {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.5;
}

.ocorrencia__conduta {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.ocorrencia__conduta span {
  color: var(--tinta);
  font-weight: 600;
}

.ocorrencia__quem {
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
}

.ocorrencia__ligar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  margin-top: 6px;
  padding: 10px 12px;
  border-radius: 12px;
  background: var(--risco-fundo);
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 600;
}

.ocorrencia__ligar span {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.ocorrencia__ligar a {
  color: inherit;
}

/* ---- boletins */

.boletim {
  display: grid;
  gap: 8px;
  padding: 16px 18px;
}

.boletim__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.boletim__quando {
  color: var(--tinta-2);
  font-size: 13px;
}

.boletim__enviar {
  margin-inline-start: auto;
}

.boletim__texto {
  margin: 0;
  color: var(--tinta);
  font-size: 14.5px;
  line-height: 1.55;
  white-space: pre-line;
}

/* ---- saída */

.checagem__passo {
  display: flex;
  min-height: 64px;
  align-items: center;
  gap: 14px;
  padding: 12px 18px;
}

.checagem__marca {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border: 2px solid var(--linha-forte);
  border-radius: 50%;
  color: var(--tinta-2);
  font-size: 17px;
}

.checagem__passo--ok .checagem__marca {
  border-color: transparent;
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.checagem__passo--atencao .checagem__marca {
  border-color: var(--atencao);
  color: var(--atencao-tinta);
}

.checagem__passo--risco .checagem__marca {
  border-color: var(--risco);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.checagem__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 2px;
}

.checagem__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.checagem__passo--ok .checagem__texto strong {
  color: var(--tinta-2);
  font-weight: 500;
}

.checagem__texto small {
  color: var(--tinta-2);
  font-size: 13px;
}

.checagem__fim {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px 16px;
}

.checagem__fim p {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.pertence {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 52px;
  padding: 8px 18px;
}

.pertence__icone {
  color: var(--tinta-2);
  font-size: 18px;
}

.pertence__texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.pertence__texto strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 500;
}

.pertence__texto small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

/* ------------------------------------------------------------------ a ficha */

/* Presa ao rolar: em tela larga quem rola é a folha (`main#conteudo`), e o topo dela é o zero. */
.ficha {
  position: sticky;
  top: 16px;
  display: grid;
  gap: 4px;
  padding: 18px 24px 10px;
}

.ficha__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 6px;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
}

.ficha__lista {
  display: grid;
  margin: 0;
}

.ficha__item {
  display: grid;
  gap: 4px;
  padding: 12px 0;
}

.ficha__item + .ficha__item {
  border-top: 1px solid var(--linha-suave);
}

.ficha__item dt {
  display: flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.ficha__item dt i {
  color: var(--pj-lugar-tinta);
  font-size: 15px;
}

.ficha__item dd {
  display: grid;
  gap: 2px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

.ficha__linha {
  display: block;
}

.ficha__linha strong {
  font-weight: 600;
}

/* Telefone não quebra no hífen: "(11) 99218-" numa linha e "3305" na outra não se disca. */
.ficha__item .ui-num {
  white-space: nowrap;
}

.ficha__linha--alerta {
  color: var(--atencao-tinta);
  font-weight: 600;
}

.ficha__linha--fraca {
  color: var(--tinta-2);
}

.ficha__autorizacoes {
  display: grid;
  gap: 3px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ficha__autorizacoes li {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.ficha__autorizacoes i {
  color: var(--ok-tinta);
  font-size: 13px;
}

@container estadia (max-width: 1060px) {
  .trabalho {
    grid-template-columns: minmax(0, 1fr);
  }

  .ficha {
    position: static;
  }
}

@media (max-width: 900px) {
  .dado {
    flex-basis: 140px;
    padding: 12px 16px;
  }

  .dado__grande {
    font-size: 19px;
  }
}

@media (max-width: 640px) {
  .capa {
    gap: 14px;
  }

  .capa__nome {
    font-size: 24px;
  }

  /* A escada da adaptação ocupa a coluna inteira, e "Em adaptação" quebra em vez de vazar. */
  .capa__adaptacao,
  .capa__escada {
    width: 100%;
  }

  .capa__escada :deep(.p-togglebutton) {
    min-width: 0;
    flex: 1;
  }

  .capa__escada.capa__escada :deep(.p-togglebutton .p-togglebutton-content) {
    height: 100%;
    justify-content: center;
    padding-inline: 6px;
    font-size: 13px;
    line-height: 1.2;
    white-space: normal;
  }

  .atencao__linha {
    flex-wrap: wrap;
    padding-block: 14px;
  }

  .atencao__linha .ui-linha__texto {
    flex-basis: calc(100% - 52px);
  }

  .atencao__acao {
    margin-inline-start: 50px;
  }

  .checagem__passo {
    flex-wrap: wrap;
  }

  .checagem__texto {
    flex-basis: calc(100% - 52px);
  }

  .checagem__passo .ui-selo {
    margin-inline-start: 50px;
  }

  .registro__foto {
    width: 44px;
    height: 44px;
  }
}
</style>
