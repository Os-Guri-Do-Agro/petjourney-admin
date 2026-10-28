<script setup lang="ts">
/**
 * A reserva — o contrato, antes de virar estadia.
 *
 * É a tela em que a recepção precisa **fazer o check-in inteiro sem abrir outra**. Por isso ela
 * reúne o que em outros sistemas mora em quatro lugares: o período, a vaga, a conta e os
 * documentos. Quem atende com o cliente na frente não navega.
 *
 * De cima para baixo, na ordem da conversa:
 *
 * 1. **Quem e quando** — o rosto e o nome do hóspede, o responsável com o telefone, a situação da
 *    reserva; logo abaixo, o quadro com a entrada, a saída, a acomodação e o saldo.
 * 2. **O próximo passo**, no alto à direita: registrar o sinal (pendente), fazer o check-in
 *    (confirmada, quando a regra R1 deixa) ou abrir a estadia (já na casa). Registrar comprovante e
 *    cancelar ficam ao lado, em contorno e em texto.
 * 3. **O que falta para a entrada** — a documentação como lista de checagem, com a ação de
 *    resolver em cada linha, ao lado da conta linha a linha.
 *
 * O check-in só acende quando a documentação deixa. Quando não deixa, a tela diz por quê no alto,
 * em vez de deixar o botão apagado sem explicação.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import Message from 'primevue/message'
import Popover from 'primevue/popover'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRoute, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import CheckInDialog from '@/features/hotel/components/estadia/CheckInDialog.vue'
import AlterarReservaGaveta from '@/features/hotel/components/reserva/AlterarReservaGaveta.vue'
import ExigenciaDialog from '@/features/hotel/components/reserva/ExigenciaDialog.vue'
import ExigenciasLista from '@/features/hotel/components/reserva/ExigenciasLista.vue'
import OrcamentoTabela from '@/features/hotel/components/reserva/OrcamentoTabela.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import type {
  ExigenciaKind,
  ISODate,
  ISODateTime,
  MedicacaoDaEstadia,
  MotivoDeCancelamento,
  ReservaStatus,
} from '@/features/hotel/data/types'
import { dataDe, diffDays, horaDe } from '@/features/hotel/domain/hotel-time'
import { useHospedagemStore } from '@/features/hotel/stores/hospedagem'
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'
import { useReservasStore } from '@/features/hotel/stores/reservas'
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

const { t, locale } = useI18n()
const route = useRoute()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const reservas = useReservasStore()
const hospedagem = useHospedagemStore()
const idCampo = useId()

const reservaId = computed(() => String(route.params.reservaId ?? ''))
const alvoDaExigencia = ref<{ kind: ExigenciaKind; modo: 'registrar' | 'dispensar' } | null>(null)
const checkInAberto = ref(false)

/** A primeira leitura terminou: antes dela, "não encontrada" seria só "ainda não chegou". */
const abriu = ref(false)

async function carregar() {
  await reservas.abrir(reservaId.value)
  abriu.value = true
}

onMounted(carregar)

/* Da reserva de um para a de outro sem sair da tela (o resultado de um pedido, o histórico). */
watch(reservaId, () => {
  abriu.value = false
  void carregar()
})

watch(
  () => hotelStore.revisao,
  () => void reservas.abrir(reservaId.value),
)

const detalhe = computed(() => reservas.detalhe)
const reserva = computed(() => detalhe.value?.reserva ?? null)
const pet = computed(() => (reserva.value ? hotelStore.pet(reserva.value.petId) : null))
const acompanhante = computed(() =>
  reserva.value?.acompanhantePetId ? hotelStore.pet(reserva.value.acompanhantePetId) : null,
)
const tutor = computed(() => (reserva.value ? hotelStore.tutor(reserva.value.tutorId) : null))
const acomodacao = computed(() =>
  reserva.value ? hotelStore.acomodacao(reserva.value.acomodacaoId) : null,
)

/** O detalhe na store é o desta rota — e não o de outra reserva aberta antes. */
const daRota = computed(() => detalhe.value?.reserva.id === reservaId.value)

/** A leitura terminou e a reserva da rota não existe: a tela diz isso, em vez de mostrar a velha. */
const naoEncontrada = computed(
  () => abriu.value && !reservas.carregando && !reservas.erro && !daRota.value,
)

const podeFazerCheckIn = computed(
  () =>
    reserva.value?.status === 'confirmada' ||
    (reserva.value?.status === 'pendente' && detalhe.value?.admissao.liberada === true),
)

const ativa = computed(
  () => reserva.value?.status === 'pendente' || reserva.value?.status === 'confirmada',
)

/**
 * O acréscimo de saída, mostrado **na reserva** e não descoberto no balcão.
 *
 * É a regra que mais gera discussão, e discussão de balcão se resolve mostrando a regra na tela
 * antes de o cliente chegar.
 */
const acrescimoDeSaida = computed(
  () =>
    reserva.value?.orcamento.linhas.find((linha) => linha.kind === 'meia-diaria')?.totalCentavos ??
    0,
)

/**
 * Os tipos de serviço vendidos nesta reserva.
 *
 * O contrato guarda `servicoId`; quem recebe o animal precisa do **kind**, porque é ele que diz
 * qual autorização o serviço exige. A tradução mora aqui, que é quem tem o catálogo à mão.
 */
const servicosVendidos = computed(() =>
  (reserva.value?.servicos ?? [])
    .map((contratado) => hotelStore.servico(contratado.servicoId)?.kind)
    .filter((kind): kind is NonNullable<typeof kind> => Boolean(kind)),
)

/** Tudo o que o diálogo coleta; a reserva é acrescentada aqui, que é quem a conhece. */
type DadosDoCheckIn = Omit<Parameters<typeof hospedagem.checkIn>[0], 'reservaId' | 'medicacoes'> & {
  medicacoes: {
    descricao: string
    via: MedicacaoDaEstadia['via']
    doseTexto: string
    horarios: string[]
    receita: string
    observacao: string
  }[]
}

async function fazerCheckIn(payload: DadosDoCheckIn) {
  if (!reserva.value) {
    return
  }

  const criada = await hospedagem.checkIn({
    ...payload,
    reservaId: reserva.value.id,
    /*
     * A janela da medicação é a estadia inteira, e é decidida aqui e não no diálogo: perguntar
     * duas datas em toda entrada para atender o caso raro é o tipo de campo que a recepção passa a
     * preencher no automático. Suspender no meio já existe na tela da estadia.
     */
    medicacoes: payload.medicacoes.map((item) => ({
      ...item,
      horarios: item.horarios as MedicacaoDaEstadia['horarios'],
      inicio: hotelClock.today(),
      fim: null,
      suspensaEm: null,
    })),
  })

  if (criada) {
    checkInAberto.value = false
    await router.push(`/hotel/hospedagem/${criada.id}`)
  }
}

/*
 * `?checkin=1` é o pedido do "Fazer check-in" do Painel do dia: abre o check-in assim que a
 * reserva chega e tira o pedido da URL, para que voltar no navegador não abra o diálogo de novo.
 * Sem poder fazer check-in agora (documento que impede, reserva que não está confirmada, hóspede
 * já na casa), só tira o pedido: o aviso no alto da tela diz o porquê.
 */
watch(
  () => [route.query.checkin, abriu.value, reservas.carregando] as const,
  ([checkin, jaAbriu, carregando]) => {
    if (checkin !== '1' || !jaAbriu || carregando) {
      return
    }

    const query = { ...route.query }

    delete query.checkin
    void router.replace({ path: route.path, query })

    if (
      daRota.value &&
      podeFazerCheckIn.value &&
      detalhe.value?.admissao.liberada === true &&
      !detalhe.value.hospedagemId
    ) {
      checkInAberto.value = true
    }
  },
  { immediate: true },
)

// ------------------------------------------------------------------ o que falta

/** A primeira exigência por resolver, na ordem da urgência: é a que "Registrar comprovante" abre. */
const primeiraPendente = computed(() => {
  const itens = detalhe.value?.admissao.itens ?? []
  const ordem = ['ausente', 'vencido', 'vence-durante']

  return (
    [...itens]
      .filter((item) => ordem.includes(item.situacao))
      .sort((um, outro) => ordem.indexOf(um.situacao) - ordem.indexOf(outro.situacao))[0] ?? null
  )
})

/** O que impede a entrada, pelo nome: "Vacina contra giárdia, Vermífugo". */
const impedimentosPorNome = computed(() =>
  (detalhe.value?.admissao.impedimentos ?? []).map((item) => formato.exigencia(item.kind)).join(', '),
)

// ------------------------------------------------------------------ o cabeçalho e o quadro

const tag = computed(() => INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE])

function semana(data: ISODate) {
  return new Intl.DateTimeFormat(tag.value, { weekday: 'long', timeZone: 'UTC' }).format(
    new Date(`${data}T12:00:00Z`),
  )
}

const nomes = computed(() =>
  new Intl.ListFormat(tag.value, { type: 'conjunction' }).format(
    [pet.value?.nome, acompanhante.value?.nome].filter((nome): nome is string => Boolean(nome)),
  ),
)

const descricaoDoPet = computed(() =>
  [
    pet.value ? formato.especie(pet.value.especie) : '',
    pet.value?.porte ? formato.porte(pet.value.porte) : '',
    pet.value?.raca ?? '',
  ]
    .filter(Boolean)
    .join(' · '),
)

type Tom = 'risco' | 'atencao' | 'ok' | 'lugar' | 'neutro' | 'contorno'

const SELO_DO_STATUS: Record<ReservaStatus, { tom: Tom; icone: string }> = {
  pendente: { tom: 'atencao', icone: 'ph-hourglass-medium' },
  confirmada: { tom: 'lugar', icone: 'ph-check' },
  hospedado: { tom: 'ok', icone: 'ph-house-line' },
  encerrada: { tom: 'neutro', icone: 'ph-flag-checkered' },
  cancelada: { tom: 'contorno', icone: 'ph-x' },
  'nao-compareceu': { tom: 'contorno', icone: 'ph-user-minus' },
}

/** Quanto falta para chegar: "chega amanhã", "chega em 3 dias" — só enquanto a reserva vale. */
const chegada = computed(() => {
  if (!reserva.value || !ativa.value) {
    return ''
  }

  const dias = diffDays(hotelClock.today(), dataDe(reserva.value.entradaPrevista))

  if (dias < 0) {
    return ''
  }

  return dias === 0
    ? t('hotel.reservas.chegaHoje')
    : t('hotel.reservas.chegaEm', { dias }, dias)
})

/** O dinheiro em uma palavra, como na lista: quitado, sinal pago ou sem sinal. */
const pagamento = computed(() => {
  const atual = reserva.value

  if (!atual) {
    return null
  }

  if (atual.orcamento.saldoCentavos <= 0 && atual.pagoCentavos > 0) {
    return { tom: 'ok' as Tom, icone: 'ph-check', rotulo: t('hotel.reservas.tela.pagamento.quitado') }
  }

  if (atual.pagoCentavos > 0) {
    return { tom: 'neutro' as Tom, icone: 'ph-coins', rotulo: t('hotel.reservas.tela.pagamento.sinalPago') }
  }

  if (atual.status === 'cancelada' || atual.status === 'nao-compareceu') {
    return {
      tom: 'contorno' as Tom,
      icone: 'ph-minus',
      rotulo: t('hotel.reservas.tela.pagamento.semPagamento'),
    }
  }

  return { tom: 'atencao' as Tom, icone: 'ph-warning', rotulo: t('hotel.reservas.tela.pagamento.semSinal') }
})

// ------------------------------------------------------------------ cancelar

const MOTIVOS: MotivoDeCancelamento[] = [
  'responsavel-desistiu',
  'viagem-cancelada',
  'animal-doente',
  'hotel-indisponivel',
  'preco',
  'outro',
]

const cancelarAberto = ref(false)
const motivoDoCancelamento = ref<MotivoDeCancelamento>('responsavel-desistiu')
const naoCompareceu = ref(false)

const opcoesDeMotivo = computed(() =>
  MOTIVOS.map((valor) => ({ valor, rotulo: formato.motivoCancelamento(valor) })),
)

/** Não comparecimento só existe depois que a entrada passou: antes disso, é cancelamento. */
const entradaJaPassou = computed(
  () =>
    reserva.value !== null && dataDe(reserva.value.entradaPrevista) <= hotelClock.today(),
)

function abrirCancelamento() {
  motivoDoCancelamento.value = 'responsavel-desistiu'
  naoCompareceu.value = false
  cancelarAberto.value = true
}

async function confirmarCancelamento() {
  if (!reserva.value) {
    return
  }

  const feita = await reservas.cancelar(
    reserva.value.id,
    motivoDoCancelamento.value,
    naoCompareceu.value && entradaJaPassou.value,
  )

  if (feita) {
    cancelarAberto.value = false
  }
}

/** A reserva que caiu diz quando e por quê, na primeira linha. */
const fraseDoCancelamento = computed(() => {
  const atual = reserva.value

  if (!atual || (atual.status !== 'cancelada' && atual.status !== 'nao-compareceu')) {
    return ''
  }

  const motivo = atual.motivoCancelamento ? formato.motivoCancelamento(atual.motivoCancelamento) : ''
  const quando = atual.canceladaEm ? formato.quando(atual.canceladaEm) : ''

  return atual.status === 'nao-compareceu'
    ? t('hotel.reserva.tela.naoCompareceuEm', { quando, motivo })
    : t('hotel.reserva.tela.canceladaEm', { quando, motivo })
})

// ------------------------------------------------------------------ alterar datas

/** Mudar datas ou acomodação; para quem já está na casa, prorrogar a saída. */
const alterarAberto = ref(false)

const podeAlterar = computed(() => ativa.value || reserva.value?.status === 'hospedado')

function abrirAlteracao() {
  alterarAberto.value = true
}

async function salvarAlteracao(payload: {
  inicio: ISODateTime
  fim: ISODateTime
  acomodacaoId: string
}) {
  if (!reserva.value) {
    return
  }

  const feita = await reservas.editar({ reservaId: reserva.value.id, ...payload })

  if (feita) {
    alterarAberto.value = false
  }
}

// ------------------------------------------------------------------ o sinal

/**
 * Quanto entrou de sinal, perguntado antes de gravar.
 *
 * O botão gravava o sinal **sugerido** num clique só: o responsável que pagou R$ 100 de um sinal de
 * R$ 98,10, ou metade dele, ficava com um valor que ninguém recebeu, e a conta da saída saía
 * errada. O valor nasce no sugerido, que é o caso comum, e muda com o teclado.
 */
const popoverDoSinal = ref<InstanceType<typeof Popover> | null>(null)
const valorDoSinal = ref<number | null>(null)

function abrirSinal(evento?: Event) {
  const atual = reserva.value

  if (!atual || !evento) {
    return
  }

  valorDoSinal.value = atual.orcamento.sinalCentavos / 100
  popoverDoSinal.value?.show(evento)
}

async function confirmarSinal() {
  const atual = reserva.value
  const centavos = Math.round((valorDoSinal.value ?? 0) * 100)

  if (!atual || centavos <= 0) {
    return
  }

  const feito = await reservas.confirmar(atual.id, centavos)

  if (feito) {
    popoverDoSinal.value?.hide()
  }
}

// ------------------------------------------------------------------ o próximo passo

/**
 * A ação cheia é o próximo passo da reserva, e muda com ela: sinal, check-in ou estadia. Uma só,
 * para a tela nunca oferecer dois caminhos com o mesmo peso.
 */
const acaoPrincipal = computed(() => {
  const atual = reserva.value

  if (!atual || !detalhe.value) {
    return null
  }

  if (detalhe.value.hospedagemId) {
    return {
      id: 'estadia',
      rotulo: t('hotel.reserva.irParaEstadia'),
      icone: 'ph ph-house-line',
      desabilitada: false,
      executar: () => router.push(`/hotel/hospedagem/${detalhe.value!.hospedagemId}`),
    }
  }

  if (atual.status === 'pendente') {
    return {
      id: 'sinal',
      rotulo: t('hotel.reserva.confirmarSinal'),
      icone: 'ph ph-check',
      desabilitada: false,
      executar: (evento?: Event) => abrirSinal(evento),
    }
  }

  if (podeFazerCheckIn.value) {
    return {
      id: 'checkin',
      rotulo: t('hotel.reserva.fazerCheckIn'),
      icone: 'ph ph-sign-in',
      desabilitada: !detalhe.value.admissao.liberada,
      executar: () => (checkInAberto.value = true),
    }
  }

  return null
})

/** Pendente e já liberada: o check-in também pode acontecer agora, ao lado do sinal. */
const checkInAoLado = computed(
  () => acaoPrincipal.value?.id === 'sinal' && podeFazerCheckIn.value,
)

/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.reserva.pergunta.titulo'),
    texto: t('hotel.tour.reserva.pergunta.texto'),
  },
  {
    alvo: '.periodo',
    titulo: t('hotel.tour.reserva.periodo.titulo'),
    texto: t('hotel.tour.reserva.periodo.texto'),
  },
  {
    alvo: '.exig',
    titulo: t('hotel.tour.reserva.exigencias.titulo'),
    texto: t('hotel.tour.reserva.exigencias.texto'),
  },
  {
    alvo: '.acao-principal',
    titulo: t('hotel.tour.reserva.checkin.titulo'),
    texto: t('hotel.tour.reserva.checkin.texto'),
  },
])
</script>

<template>
  <UiPagina
    class="tela-reserva"
    :titulo="(daRota && pet?.nome) || t('hotel.reserva.titulo')"
    :carregando="!abriu && !reservas.erro"
    :erro="reservas.erro ? t(reservas.erro) : ''"
    :vazio="naoEncontrada"
    :vazio-titulo="t('hotel.reserva.tela.naoEncontradaTitulo')"
    :vazio-descricao="t('hotel.reserva.tela.naoEncontradaDescricao')"
    vazio-icone="ph ph-calendar-x"
    tour
    @tour="tourAberto = true"
    @tentar-de-novo="carregar"
  >
    <template #voltar>
      <RouterLink to="/hotel/reservas" class="voltar">
        <i class="ph ph-arrow-left" aria-hidden="true" />
        {{ t('hotel.reservas.titulo') }}
      </RouterLink>
    </template>

    <template v-if="reserva && daRota" #cabecalho>
      <!--
        Os retratos abrem a tela. Dois quando a reserva tem acompanhante: é a única pista visual
        de que a baia recebe dois animais, e ela precisa aparecer antes da conta.
      -->
      <div class="cabeca">
        <span class="cabeca__rostos">
          <PetAvatar
            v-if="pet"
            :nome="pet.nome"
            :iniciais="pet.iniciais"
            :especie="pet.especie"
            :foto-url="pet.fotoUrl"
            tamanho="xl"
          />
          <PetAvatar
            v-if="acompanhante"
            class="cabeca__acompanhante"
            :nome="acompanhante.nome"
            :iniciais="acompanhante.iniciais"
            :especie="acompanhante.especie"
            :foto-url="acompanhante.fotoUrl"
            tamanho="lg"
          />
        </span>

        <div class="cabeca__texto">
          <h1 class="cabeca__nome">{{ nomes || t('hotel.reserva.titulo') }}</h1>
          <p class="cabeca__linha">
            <span v-if="descricaoDoPet">{{ descricaoDoPet }}</span>
          </p>
          <p v-if="tutor" class="cabeca__linha">
            <i class="ph ph-user" aria-hidden="true" />
            <span>{{ tutor.nome }}</span>
            <a class="cabeca__telefone ui-num" :href="`tel:${tutor.telefone}`">
              <i class="ph ph-phone" aria-hidden="true" />
              <bdi dir="ltr">{{ tutor.telefone }}</bdi>
            </a>
          </p>
          <div class="cabeca__selos">
            <span class="ui-selo" :class="`ui-selo--${SELO_DO_STATUS[reserva.status].tom}`">
              <i class="ph" :class="SELO_DO_STATUS[reserva.status].icone" aria-hidden="true" />
              {{ formato.statusDaReserva(reserva.status) }}
            </span>
            <span v-if="chegada" class="ui-selo ui-selo--lugar">
              <i class="ph ph-calendar-dot" aria-hidden="true" />
              {{ chegada }}
            </span>
            <span class="ui-selo ui-selo--contorno">
              <i class="ph ph-tag" aria-hidden="true" />
              {{ t('hotel.reserva.tela.origem', { origem: formato.origem(reserva.origem) }) }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <template v-if="reserva && detalhe && daRota" #acoes>
      <Button
        v-if="ativa"
        type="button"
        severity="secondary"
        text
        icon="ph ph-x-circle"
        :label="t('hotel.reserva.tela.cancelar')"
        @click="abrirCancelamento"
      />
      <Button
        v-if="podeAlterar"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-calendar-dots"
        :label="
          reserva.status === 'hospedado'
            ? t('hotel.reserva.alterar.prorrogar')
            : t('hotel.reserva.alterar.abrir')
        "
        @click="abrirAlteracao"
      />
      <Button
        v-if="primeiraPendente && !detalhe.hospedagemId && ativa"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-file-plus"
        :label="t('hotel.reserva.tela.registrarComprovante')"
        @click="alvoDaExigencia = { kind: primeiraPendente.kind, modo: 'registrar' }"
      />
      <Button
        v-if="checkInAoLado"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-sign-in"
        :label="t('hotel.reserva.fazerCheckIn')"
        @click="checkInAberto = true"
      />
      <Button
        v-if="acaoPrincipal"
        type="button"
        class="acao-principal"
        :icon="acaoPrincipal.icone"
        :label="acaoPrincipal.rotulo"
        :disabled="acaoPrincipal.desabilitada"
        :loading="acaoPrincipal.id === 'sinal' && reservas.salvando"
        :aria-haspopup="acaoPrincipal.id === 'sinal' ? 'dialog' : undefined"
        @click="acaoPrincipal.executar($event)"
      />

      <Popover ref="popoverDoSinal" class="clinic-overlay">
        <form class="sinal" @submit.prevent="confirmarSinal">
          <label :for="`${idCampo}-sinal`" class="sinal__rotulo">
            {{ t('hotel.reserva.tela.sinalValor') }}
          </label>
          <InputNumber
            v-model="valorDoSinal"
            :input-id="`${idCampo}-sinal`"
            mode="currency"
            currency="BRL"
            :locale="tag"
            :min="0"
            :max="(reserva?.orcamento.totalCentavos ?? 0) / 100"
            :max-fraction-digits="2"
            autofocus
            fluid
          />
          <small class="sinal__dica">
            {{
              t('hotel.reserva.tela.sinalSugerido', {
                valor: formato.moeda(reserva?.orcamento.sinalCentavos ?? 0),
              })
            }}
          </small>
          <div class="sinal__acoes">
            <Button
              type="button"
              severity="secondary"
              text
              :label="t('hotel.comum.cancelar')"
              @click="popoverDoSinal?.hide()"
            />
            <Button
              type="submit"
              icon="ph ph-check"
              :label="t('hotel.reserva.tela.sinalConfirmar')"
              :loading="reservas.salvando"
              :disabled="!valorDoSinal"
            />
          </div>
        </form>
      </Popover>
    </template>

    <div v-if="reserva && detalhe && daRota" class="reserva">
      <!-- O que impede ou mudou a reserva vem antes de tudo, numa linha só. -->
      <p v-if="fraseDoCancelamento" class="aviso aviso--neutro" role="status">
        <i class="ph ph-x-circle aviso__icone" aria-hidden="true" />
        <span class="aviso__texto">{{ fraseDoCancelamento }}</span>
      </p>

      <p v-if="detalhe.hospedagemId" class="aviso aviso--ok" role="status">
        <i class="ph ph-house-line aviso__icone" aria-hidden="true" />
        <span class="aviso__texto">{{ t('hotel.reserva.jaHospedado') }}</span>
        <RouterLink class="ui-mais" :to="`/hotel/hospedagem/${detalhe.hospedagemId}`">
          {{ t('hotel.reserva.irParaEstadia') }}
          <i class="ph ph-arrow-right" aria-hidden="true" />
        </RouterLink>
      </p>

      <p
        v-else-if="ativa && !detalhe.admissao.liberada"
        class="aviso aviso--risco"
        role="status"
      >
        <i class="ph ph-lock-simple aviso__icone" aria-hidden="true" />
        <span class="aviso__texto">
          <strong>{{ t('hotel.reserva.checkInBloqueado') }}</strong>
          {{ t('hotel.reserva.tela.falta', { itens: impedimentosPorNome }) }}
        </span>
      </p>

      <!--
        A vaga é reavaliada agora: a acomodação pode ter saído de operação depois da venda, e
        descobrir isso no dia da chegada é descobrir tarde.
      -->
      <p v-if="ativa && detalhe.vaga.impedimentos.length > 0" class="aviso aviso--risco" role="alert">
        <i class="ph ph-warning aviso__icone" aria-hidden="true" />
        <span class="aviso__texto">{{ t(`hotel.impedimento.${detalhe.vaga.impedimentos[0]}`) }}</span>
      </p>

      <p v-if="reservas.erroDeAcao && !alvoDaExigencia && !cancelarAberto" class="aviso aviso--risco" role="alert">
        <i class="ph ph-warning-circle aviso__icone" aria-hidden="true" />
        <span class="aviso__texto">{{ t(reservas.erroDeAcao) }}</span>
      </p>

      <!-- O quadro da reserva: quando entra, quando sai, onde fica e quanto falta receber. -->
      <section class="quadro periodo ui-folha" :aria-label="t('hotel.reserva.periodo')">
        <dl class="quadro__numeros">
          <div class="dado">
            <dt>
              {{ t('hotel.reserva.tela.entrada') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-sign-in" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">
                {{ formato.data(dataDe(reserva.entradaPrevista)) }}
              </strong>
              <small class="ui-num">
                {{ semana(dataDe(reserva.entradaPrevista)) }} · {{ horaDe(reserva.entradaPrevista) }}
              </small>
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('hotel.reserva.tela.saida') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-sign-out" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">
                {{ formato.data(dataDe(reserva.saidaPrevista)) }}
              </strong>
              <small class="ui-num">
                {{ semana(dataDe(reserva.saidaPrevista)) }} · {{ horaDe(reserva.saidaPrevista) }}
              </small>
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('hotel.reserva.tela.acomodacao') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-bed" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande">{{ acomodacao?.nome }}</strong>
              <small>
                <template v-if="acomodacao">
                  {{ hotelStore.tipoDeAcomodacao(acomodacao.tipoId)?.nome }} ·
                </template>
                {{ t('hotel.reserva.diarias', { total: reserva.diarias }, reserva.diarias) }}
              </small>
            </dd>
          </div>
          <div class="dado">
            <dt>
              {{ t('hotel.orcamento.saldo') }}
              <span class="ui-ladrilho ui-ladrilho--p dado__icone" aria-hidden="true">
                <i class="ph ph-wallet" />
              </span>
            </dt>
            <dd>
              <strong class="dado__grande ui-num">
                {{ formato.moeda(reserva.orcamento.saldoCentavos) }}
              </strong>
              <small class="ui-num">
                {{ t('hotel.reserva.tela.deTotal', { total: formato.moeda(reserva.orcamento.totalCentavos) }) }}
              </small>
            </dd>
          </div>
        </dl>

        <div
          v-if="acrescimoDeSaida > 0 || reserva.observacao"
          class="quadro__notas"
        >
          <!--
            A saída tardia é dita aqui, com o valor, e não no balcão. É a regra que mais gera
            discussão — e discussão de balcão se resolve mostrando a regra antes.
          -->
          <p v-if="acrescimoDeSaida > 0" class="nota nota--atencao">
            <i class="ph ph-clock-afternoon" aria-hidden="true" />
            {{ t('hotel.reserva.saidaTardia', { valor: formato.moeda(acrescimoDeSaida) }) }}
          </p>

          <p v-if="reserva.observacao" class="nota">
            <i class="ph ph-quotes" aria-hidden="true" />
            {{ reserva.observacao }}
          </p>
        </div>
      </section>

      <div class="colunas">
        <UiSecao
          class="coluna-falta"
          :titulo="t('hotel.reserva.tela.oQueFalta')"
          :descricao="t('hotel.reserva.tela.oQueFaltaDescricao')"
          icone="ph ph-files"
        >
          <div class="ui-folha folha-exig">
            <ExigenciasLista
              :admissao="detalhe.admissao"
              @registrar="(kind) => (alvoDaExigencia = { kind, modo: 'registrar' })"
              @dispensar="(kind) => (alvoDaExigencia = { kind, modo: 'dispensar' })"
            />
          </div>
        </UiSecao>

        <UiSecao
          class="coluna-conta"
          :titulo="t('hotel.reserva.tela.pagamento')"
          icone="ph ph-receipt"
        >
          <template v-if="pagamento" #acoes>
            <span class="ui-selo" :class="`ui-selo--${pagamento.tom}`">
              <i class="ph" :class="pagamento.icone" aria-hidden="true" />
              {{ pagamento.rotulo }}
            </span>
          </template>

          <div class="ui-folha conta">
            <OrcamentoTabela
              :orcamento="reserva.orcamento"
              :pago-centavos="reserva.pagoCentavos"
              sem-titulo
            />

            <p v-if="ativa" class="conta__politica">
              <i class="ph ph-info" aria-hidden="true" />
              {{
                detalhe.sinalDevolve
                  ? t('hotel.reserva.sinalDevolve')
                  : t('hotel.reserva.sinalNaoDevolve')
              }}
            </p>
          </div>
        </UiSecao>
      </div>
    </div>

    <template #sempre>
      <ExigenciaDialog
        :alvo="alvoDaExigencia"
        :exigencias="hotelStore.exigencias"
        :cuidadores="hotelStore.cuidadores"
        :salvando="reservas.salvando"
        :erro="reservas.erroDeAcao"
        @fechar="alvoDaExigencia = null"
        @registrar="
          async (payload) => {
            if (!reserva) return
            await reservas.registrarComprovante({ ...payload, petId: reserva.petId })
            alvoDaExigencia = null
          }
        "
        @dispensar="
          async (payload) => {
            if (!reserva) return
            await reservas.dispensar({ ...payload, reservaId: reserva.id })
            alvoDaExigencia = null
          }
        "
      />

      <AlterarReservaGaveta
        :aberta="alterarAberto"
        :reserva="reserva"
        :salvando="reservas.salvando"
        :erro="alterarAberto ? reservas.erroDeAcao : ''"
        @fechar="alterarAberto = false"
        @salvar="salvarAlteracao"
      />

      <CheckInDialog
        :aberto="checkInAberto"
        :pet-nome="pet?.nome ?? ''"
        :peso-cadastro-kg="pet?.pesoKg ?? null"
        :responsavel-nome="tutor?.nome ?? ''"
        :telefone-responsavel="tutor?.telefone ?? ''"
        :contatos-conhecidos="detalhe?.contatosDaFamilia ?? []"
        :autorizados-da-reserva="reserva?.autorizadosARetirar ?? []"
        :veterinario-conhecido="detalhe?.veterinarioDoPet ?? null"
        :admissao="detalhe?.admissao ?? null"
        :servicos-vendidos="servicosVendidos"
        :observacao-da-reserva="reserva?.observacao ?? ''"
        :salvando="hospedagem.salvando"
        :erro="hospedagem.erroDeAcao"
        @fechar="checkInAberto = false"
        @confirmar="fazerCheckIn"
      />

      <!--
        Cancelar é decisão com consequência (o sinal pode não voltar), então pede o motivo e diz a
        política antes do botão. Não comparecimento só aparece depois que a entrada passou.
      -->
      <Dialog
        v-model:visible="cancelarAberto"
        modal
        :header="t('hotel.reserva.tela.cancelarTitulo', { pet: nomes })"
        :style="{ width: 'min(32rem, 94vw)' }"
        class="clinic-scope pj-lugar--hotel"
      >
        <div class="cancelar">
          <div class="cancelar__campo">
            <span :id="`${idCampo}-motivo`" class="cancelar__rotulo">
              {{ t('hotel.reserva.tela.cancelarMotivo') }}
            </span>
            <SelectButton
              v-model="motivoDoCancelamento"
              class="cancelar__motivos"
              :options="opcoesDeMotivo"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              :aria-labelledby="`${idCampo}-motivo`"
            />
          </div>

          <label v-if="entradaJaPassou" class="cancelar__chave">
            <Checkbox v-model="naoCompareceu" binary />
            <span>{{ t('hotel.reserva.tela.naoCompareceu') }}</span>
          </label>

          <p v-if="detalhe" class="cancelar__politica">
            <i class="ph ph-info" aria-hidden="true" />
            {{
              detalhe.sinalDevolve
                ? t('hotel.reserva.sinalDevolve')
                : t('hotel.reserva.sinalNaoDevolve')
            }}
          </p>

          <Message v-if="reservas.erroDeAcao" severity="error" :closable="false">
            {{ t(reservas.erroDeAcao) }}
          </Message>
        </div>

        <template #footer>
          <Button
            type="button"
            :label="t('hotel.reserva.tela.manter')"
            severity="secondary"
            text
            @click="cancelarAberto = false"
          />
          <Button
            type="button"
            icon="ph ph-x-circle"
            severity="danger"
            :label="t('hotel.reserva.tela.cancelar')"
            :loading="reservas.salvando"
            @click="confirmarCancelamento"
          />
        </template>
      </Dialog>

      <HotelDevPanel />

      <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
    </template>
  </UiPagina>
</template>

<style scoped>
.reserva {
  display: grid;
  gap: 24px;
}

/* O valor do sinal, perguntado ao lado do botão que o grava. */
.sinal {
  display: grid;
  gap: 8px;
  width: min(24rem, 80vw);
}

.sinal__acoes :deep(.p-button) {
  white-space: nowrap;
}

.sinal__rotulo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.sinal__dica {
  color: var(--tinta-2);
  font-size: 13px;
}

.sinal__acoes {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

/* ------------------------------------------------------------------ topo */

.voltar .ph {
  font-size: 13px;
}

[dir='rtl'] .voltar .ph {
  scale: -1 1;
}

.cabeca {
  display: flex;
  min-width: 0;
  flex: 1 1 340px;
  align-items: center;
  gap: 20px;
}

/* O retrato sobe da folha: um anel de papel e a sombra do cartão. */
.cabeca__rostos > :first-child {
  border-radius: 50%;
  box-shadow:
    0 0 0 4px var(--superficie),
    var(--sombra-2);
}

.cabeca__rostos {
  display: flex;
  flex: none;
  align-items: flex-end;
}

/* O acompanhante encosta no principal, sobrepondo de leve: são um par, não dois hóspedes. */
.cabeca__acompanhante {
  margin-inline-start: -16px;
  border-radius: 50%;
  box-shadow:
    0 0 0 4px var(--superficie),
    var(--sombra-1);
}

.cabeca__texto {
  display: grid;
  min-width: 0;
  gap: 4px;
}

.cabeca__nome {
  margin: 0;
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.15;
}

.cabeca__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
}

.cabeca__linha > i {
  color: var(--tinta-3);
}

.cabeca__telefone {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tinta);
  font-weight: 550;
  text-decoration: none;
}

.cabeca__telefone:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.cabeca__telefone:focus-visible {
  border-radius: 4px;
  outline: 2px solid var(--pj-lugar);
  outline-offset: 2px;
}

.cabeca__selos {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

/* A ação do momento nomeia o passo: pode ser longa, e quebra em vez de empurrar a página. */
.acao-principal {
  max-width: 100%;
  white-space: normal;
  text-align: start;
}

/* ------------------------------------------------------------------ avisos */

.aviso {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--linha);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.aviso__icone {
  flex: none;
  font-size: 20px;
}

.aviso__texto {
  flex: 1 1 18rem;
  min-width: 0;
}

.aviso__texto strong {
  font-weight: 600;
}

.aviso--ok {
  border-color: color-mix(in oklab, var(--ok) 35%, transparent);
  background: var(--ok-fundo);
}

.aviso--ok .aviso__icone {
  color: var(--ok-tinta);
}

.aviso--risco {
  border-color: color-mix(in oklab, var(--risco) 35%, transparent);
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.aviso--neutro .aviso__icone {
  color: var(--tinta-2);
}

/* ------------------------------------------------------------------ quadro */

.quadro {
  display: grid;
  overflow: hidden;
}

/*
 * Fileira que quebra: cada célula traz a divisória à esquerda e em cima, deslocada um pixel para
 * fora — as da primeira coluna e da primeira fileira caem fora do recorte, e o fio só aparece
 * **entre** células, em qualquer largura.
 */
.quadro__numeros {
  display: flex;
  flex-wrap: wrap;
  overflow: hidden;
  margin: 0;
}

.dado {
  position: relative;
  display: grid;
  min-width: 0;
  flex: 1 1 170px;
  align-content: start;
  gap: 6px;
  margin-block-start: -1px;
  margin-inline-start: -1px;
  padding: 18px 24px;
  border-block-start: 1px solid var(--linha);
  border-inline-start: 1px solid var(--linha);
}

.dado dt {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.dado__icone {
  position: absolute;
  top: 16px;
  inset-inline-end: 16px;
}

.dado dd {
  display: grid;
  min-width: 0;
  gap: 2px;
  margin: 0;
}

.dado__grande {
  overflow: hidden;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 26px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.1;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dado dd small {
  color: var(--tinta-2);
  font-size: 13px;
}

.quadro__notas {
  display: grid;
  gap: 8px;
  padding: 12px 24px 14px;
  border-top: 1px solid var(--linha);
}

.nota {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.45;
}

.nota > i {
  flex: none;
  color: var(--tinta-3);
  font-size: 16px;
  transform: translateY(2px);
}

.nota--atencao,
.nota--atencao > i {
  color: var(--atencao-tinta);
  font-weight: 550;
}

/* ------------------------------------------------------------------ colunas */

.colunas {
  display: grid;
  align-items: start;
  gap: 28px 24px;
  grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr);
}

.folha-exig {
  overflow: hidden;
}

.conta {
  display: grid;
  gap: 12px;
  padding: 12px 12px 16px;
}

.conta__politica {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  padding: 0 10px;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.conta__politica i {
  flex: none;
  transform: translateY(2px);
}

/* ------------------------------------------------------------------ cancelar */

.cancelar {
  display: grid;
  gap: 16px;
}

.cancelar__campo {
  display: grid;
  gap: 8px;
}

.cancelar__rotulo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.cancelar__motivos {
  display: flex;
  flex-wrap: wrap;
}

.cancelar__motivos :deep(.p-togglebutton-checked .p-togglebutton-content) {
  background: var(--superficie);
  color: var(--tinta);
}

.cancelar__chave {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--tinta);
  font-size: 14px;
  cursor: pointer;
}

.cancelar__politica {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

@media (max-width: 1100px) {
  .colunas {
    grid-template-columns: minmax(0, 1fr);
  }
}

@media (max-width: 720px) {
  .cabeca {
    align-items: flex-start;
    gap: 14px;
  }

  .cabeca__nome {
    font-size: 26px;
  }

  .dado {
    flex-basis: 140px;
    padding: 14px 16px;
  }

  .dado__grande {
    font-size: 21px;
  }
}
</style>
