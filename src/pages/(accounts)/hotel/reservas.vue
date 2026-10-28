<script setup lang="ts">
/**
 * Reservas — a lista do que está vendido.
 *
 * A pergunta desta aba é "o que está vendido, e o que vai dar trabalho". Por isso a lista abre no
 * que está por vir, e cada linha diz de relance as três coisas que a recepção confere: **quando**
 * (a entrada e a saída em destaque, e quanto falta para chegar), **o papel** (a documentação em
 * selo com palavra) e **o dinheiro** (sinal pago, quitado ou sem sinal, e quanto falta receber).
 *
 * Em cima de tudo, quando existe, a **véspera travada**: quem chega nos próximos três dias e ainda
 * não pode entrar. É a única coisa aqui que tem prazo — depois que o carro chega, a conversa sobre
 * documento acontece no balcão, com o cliente na frente. A mesma marca de risco aparece na linha
 * da tabela, para quem filtrou e rolou.
 *
 * A lista de espera vive no rodapé e não numa tela própria: ela só é consultada quando uma reserva
 * cai, e nesse momento quem está olhando já está aqui.
 */
import Button from 'primevue/button'
import SelectButton from 'primevue/selectbutton'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink, useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import UiSecao from '@/components/ui/UiSecao.vue'
import ClinicDataTable from '@/features/clinico/components/base/ClinicDataTable.vue'
import ClinicFilterBar from '@/features/clinico/components/base/ClinicFilterBar.vue'
import type { ColunaTabela } from '@/features/clinico/components/base/table-types'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import type { ReservaNaLista } from '@/features/hotel/data/repositories'
import type { ISODate, Reserva, ReservaStatus, SituacaoDaExigencia } from '@/features/hotel/data/types'
import { addDays, dataDe, horaDe } from '@/features/hotel/domain/hotel-time'
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'
import { useReservasStore } from '@/features/hotel/stores/reservas'
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

const { t, locale } = useI18n()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const reservas = useReservasStore()

const busca = ref('')
const selecionados = ref<Record<string, string[]>>({})

/**
 * Até onde a lista olha.
 *
 * A tela abre no que está **por vir**, e não no arquivo inteiro. A pergunta dela é "o que está
 * vendido e o que vai dar trabalho": uma lista que abre em estadias encerradas há seis semanas
 * responde outra pergunta, e empurra a resposta para a terceira página de rolagem.
 *
 * O arquivo não some — muda de lugar. É aqui que se vai buscar a estadia do mês passado, e o
 * controle fica ao lado da lista para que ninguém conclua que ela se perdeu.
 */
const horizonte = ref<'proximas' | 'todas'>('proximas')

/* Ontem, e não hoje: quem saiu ontem de manhã ainda é assunto do balcão hoje. */
const recorteDoHorizonte = computed(() =>
  horizonte.value === 'proximas' ? { de: addDays(hotelClock.today(), -1) } : undefined,
)

const opcoesDeHorizonte = computed(() => [
  { valor: 'proximas' as const, rotulo: t('hotel.reservas.horizonteProximas') },
  { valor: 'todas' as const, rotulo: t('hotel.reservas.horizonteTodas') },
])

async function carregar() {
  await reservas.carregarLista(recorteDoHorizonte.value)
}

onMounted(carregar)

watch([() => hotelStore.revisao, horizonte], () => reservas.carregarLista(recorteDoHorizonte.value))

/**
 * Os filtros são os três eixos pelos quais a recepção pergunta: em que estado está, se tem
 * documento pendente, e de que bloco é. Nada de filtro por origem — isso é pergunta do resumo, e
 * um painel com seis facetas é um painel que ninguém abre.
 */
const grupos = computed(() => [
  {
    id: 'status',
    rotulo: t('hotel.reservas.filtroStatus'),
    opcoes: (
      ['pendente', 'confirmada', 'hospedado', 'encerrada', 'cancelada', 'nao-compareceu'] as const
    ).map((status) => ({
      valor: status,
      rotulo: formato.statusDaReserva(status),
      contagem: reservas.lista.filter((linha) => linha.reserva.status === status).length,
    })),
  },
  {
    id: 'admissao',
    rotulo: t('hotel.reservas.filtroAdmissao'),
    opcoes: (['ausente', 'vencido', 'vence-durante', 'dispensado', 'ok'] as const).map(
      (situacao) => ({
        valor: situacao,
        rotulo: formato.situacaoDaExigencia(situacao),
        contagem: reservas.lista.filter((linha) => linha.admissao === situacao).length,
      }),
    ),
  },
  {
    id: 'bloco',
    rotulo: t('hotel.reservas.filtroBloco'),
    opcoes: hotelStore.blocos.map((bloco) => ({
      valor: bloco.id,
      rotulo: bloco.nome,
      contagem: reservas.lista.filter((linha) => linha.blocoId === bloco.id).length,
    })),
  },
])

const linhas = computed(() => {
  const termo = busca.value.trim().toLocaleLowerCase('pt-BR')

  return reservas.lista.filter((linha) => {
    const status = selecionados.value.status ?? []
    const admissao = selecionados.value.admissao ?? []
    const bloco = selecionados.value.bloco ?? []

    if (status.length > 0 && !status.includes(linha.reserva.status)) {
      return false
    }

    if (admissao.length > 0 && !admissao.includes(linha.admissao)) {
      return false
    }

    if (bloco.length > 0 && !bloco.includes(linha.blocoId)) {
      return false
    }

    if (!termo) {
      return true
    }

    return (
      linha.petNome.toLocaleLowerCase('pt-BR').includes(termo) ||
      linha.tutorNome.toLocaleLowerCase('pt-BR').includes(termo) ||
      linha.acomodacaoNome.toLocaleLowerCase('pt-BR').includes(termo)
    )
  })
})

/**
 * As colunas ordenáveis são as que respondem a uma pergunta de varredura: quando chega, quem é,
 * qual é a situação do documento e quanto falta receber. A de acomodação não ordena — ninguém
 * varre reservas por nome de baia.
 */
const colunas = computed<ColunaTabela<ReservaNaLista>[]>(() => [
  {
    id: 'entrada',
    rotulo: t('hotel.reservas.tela.coluna.periodo'),
    largura: 'minmax(9.5rem, 1fr)',
    ordenarPor: (linha) => linha.reserva.entradaPrevista,
    ordemInicial: 'asc',
  },
  {
    id: 'pet',
    rotulo: t('hotel.reservas.coluna.hospede'),
    largura: 'minmax(11rem, 1.4fr)',
    ordenarPor: (linha) => linha.petNome,
  },
  {
    id: 'acomodacao',
    rotulo: t('hotel.reservas.coluna.acomodacao'),
    largura: 'minmax(6.5rem, 0.75fr)',
    ocultarEmTelaEstreita: true,
  },
  {
    id: 'noites',
    rotulo: t('hotel.reservas.coluna.diarias'),
    largura: 'minmax(4rem, 0.4fr)',
    numerico: true,
    ordenarPor: (linha) => linha.reserva.diarias,
    ocultarEmTelaEstreita: true,
  },
  {
    id: 'status',
    rotulo: t('hotel.reservas.coluna.status'),
    largura: 'minmax(10rem, 0.9fr)',
    ordenarPor: (linha) => formato.statusDaReserva(linha.reserva.status),
  },
  {
    id: 'admissao',
    rotulo: t('hotel.reservas.coluna.admissao'),
    largura: 'minmax(9rem, 0.9fr)',
    /* A ordem é a da urgência, não a alfabética: o que trava precisa subir. */
    ordenarPor: (linha) =>
      ['ausente', 'vencido', 'vence-durante', 'dispensado', 'ok'].indexOf(linha.admissao),
    ordemInicial: 'asc',
  },
  {
    id: 'saldo',
    rotulo: t('hotel.reservas.tela.coluna.pagamento'),
    largura: 'minmax(8.5rem, 0.9fr)',
    ordenarPor: (linha) => linha.reserva.orcamento.saldoCentavos,
    ocultarEmTelaEstreita: true,
  },
])

const vazio = computed(() => !reservas.carregando && !reservas.erro && reservas.lista.length === 0)

/**
 * A véspera: o que chega nos próximos três dias e ainda não pode entrar.
 *
 * Três dias porque é o prazo em que ainda dá para pedir o papel e o responsável consegue trazer.
 * Uma faixa que avisasse com trinta dias seria ignorada; uma que avisasse no dia da chegada
 * avisaria tarde.
 */
const vespera = computed(() =>
  reservas.lista
    .filter(
      (linha) =>
        linha.diasAteEntrada >= 0 &&
        linha.diasAteEntrada <= 3 &&
        (linha.reserva.status === 'confirmada' || linha.reserva.status === 'pendente') &&
        (linha.admissao === 'ausente' || linha.admissao === 'vencido'),
    )
    .sort((um, outro) => um.diasAteEntrada - outro.diasAteEntrada),
)

const travadas = computed(() => new Set(vespera.value.map((linha) => linha.reserva.id)))

// ------------------------------------------------------------------ a frase de cima

const tag = computed(() => INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE])

function semana(data: ISODate) {
  return new Intl.DateTimeFormat(tag.value, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${data}T12:00:00Z`),
  )
}

const ativas: ReservaStatus[] = ['pendente', 'confirmada']

const fraseDoResumo = computed(() => {
  /* Com a leitura falhando, "0 reservas: ninguém chega nos próximos 7 dias" seria uma mentira. */
  if ((reservas.carregando && reservas.lista.length === 0) || reservas.erro) {
    return ''
  }

  const total = reservas.lista.length
  const fraseDoTotal =
    horizonte.value === 'proximas'
      ? t('hotel.reservas.tela.resumoTotal', { n: total }, total)
      : t('hotel.reservas.tela.resumoTotalTodas', { n: total }, total)

  const chegam = reservas.lista.filter(
    (linha) =>
      ativas.includes(linha.reserva.status) &&
      linha.diasAteEntrada >= 0 &&
      linha.diasAteEntrada < 7,
  ).length

  const fraseDeChegada =
    chegam === 0
      ? t('hotel.reservas.tela.resumoNinguemChega')
      : t('hotel.reservas.tela.resumoChegam', { n: chegam }, chegam)

  const semSinal = reservas.lista.filter(
    (linha) => linha.reserva.status === 'pendente' && linha.reserva.pagoCentavos === 0,
  ).length

  return semSinal > 0
    ? t('hotel.reservas.tela.resumo', {
        total: fraseDoTotal,
        chegam: fraseDeChegada,
        semSinal: t('hotel.reservas.tela.resumoSemSinal', { n: semSinal }, semSinal),
      })
    : t('hotel.reservas.tela.resumoSemPendencia', { total: fraseDoTotal, chegam: fraseDeChegada })
})

/**
 * Os números da carteira, acima da lista: quantas reservas, quem chega hoje, quem ainda não pagou
 * o sinal e quem espera uma vaga. Os mesmos da frase de cima, para quem lê de relance.
 */
const indicadores = computed(() => {
  const chegamHoje = reservas.lista.filter(
    (linha) => ativas.includes(linha.reserva.status) && linha.diasAteEntrada === 0,
  ).length
  const semSinal = reservas.lista.filter(
    (linha) => linha.reserva.status === 'pendente' && linha.reserva.pagoCentavos === 0,
  ).length

  return [
    {
      id: 'total',
      valor: reservas.lista.length,
      rotulo: t('hotel.reservas.titulo'),
      nota:
        horizonte.value === 'proximas'
          ? t('hotel.reservas.horizonteProximas')
          : t('hotel.reservas.horizonteTodas'),
      icone: 'ph ph-calendar-blank',
      tom: '',
    },
    {
      id: 'chegam',
      valor: chegamHoje,
      rotulo: t('hotel.hoje.painel.chegam'),
      nota: '',
      icone: 'ph ph-sign-in',
      tom: '',
    },
    {
      id: 'sinal',
      valor: semSinal,
      rotulo: t('hotel.reservas.tela.pagamento.semSinal'),
      nota: '',
      icone: 'ph ph-coins',
      tom: semSinal > 0 ? 'atencao' : '',
    },
    {
      id: 'espera',
      valor: reservas.espera.length,
      rotulo: t('hotel.reservas.tela.espera'),
      nota: '',
      icone: 'ph ph-hourglass',
      tom: '',
    },
  ]
})

// ------------------------------------------------------------------ selos

type Tom = 'risco' | 'atencao' | 'ok' | 'lugar' | 'neutro' | 'contorno'

const SELO_DO_STATUS: Record<ReservaStatus, { tom: Tom; icone: string }> = {
  pendente: { tom: 'atencao', icone: 'ph-hourglass-medium' },
  confirmada: { tom: 'lugar', icone: 'ph-check' },
  hospedado: { tom: 'ok', icone: 'ph-house-line' },
  encerrada: { tom: 'neutro', icone: 'ph-flag-checkered' },
  cancelada: { tom: 'contorno', icone: 'ph-x' },
  'nao-compareceu': { tom: 'contorno', icone: 'ph-user-minus' },
}

const SELO_DA_ADMISSAO: Record<SituacaoDaExigencia, { tom: Tom; icone: string }> = {
  ausente: { tom: 'risco', icone: 'ph-file-x' },
  vencido: { tom: 'risco', icone: 'ph-calendar-x' },
  'vence-durante': { tom: 'atencao', icone: 'ph-clock-countdown' },
  dispensado: { tom: 'neutro', icone: 'ph-seal-check' },
  ok: { tom: 'ok', icone: 'ph-check-circle' },
}

/** O dinheiro em uma palavra: quitado, sinal pago, sem sinal — e quanto falta receber. */
function pagamento(reserva: Reserva): { tom: Tom; icone: string; rotulo: string; falta: string } {
  const saldo = reserva.orcamento.saldoCentavos
  const encerradaSemEstadia = reserva.status === 'cancelada' || reserva.status === 'nao-compareceu'
  const falta =
    saldo > 0 && !encerradaSemEstadia
      ? t('hotel.reservas.tela.aReceber', { valor: formato.moeda(saldo) })
      : ''

  if (saldo <= 0 && reserva.pagoCentavos > 0) {
    return { tom: 'ok', icone: 'ph-check', rotulo: t('hotel.reservas.tela.pagamento.quitado'), falta }
  }

  if (reserva.pagoCentavos > 0) {
    return {
      tom: 'neutro',
      icone: 'ph-coins',
      rotulo: t('hotel.reservas.tela.pagamento.sinalPago'),
      falta,
    }
  }

  if (encerradaSemEstadia || saldo <= 0) {
    return {
      tom: 'contorno',
      icone: 'ph-minus',
      rotulo: t('hotel.reservas.tela.pagamento.semPagamento'),
      falta,
    }
  }

  return {
    tom: 'atencao',
    icone: 'ph-warning',
    rotulo: t('hotel.reservas.tela.pagamento.semSinal'),
    falta,
  }
}

/** A segunda linha do período: quanto falta para chegar, ou as horas de entrada e de saída. */
function detalheDoPeriodo(linha: ReservaNaLista) {
  if (travadas.value.has(linha.reserva.id)) {
    return {
      texto:
        linha.diasAteEntrada === 0
          ? t('hotel.reservas.tela.travadaHoje')
          : t('hotel.reservas.tela.travadaEm', { dias: linha.diasAteEntrada }, linha.diasAteEntrada),
      tom: 'risco',
    }
  }

  if (ativas.includes(linha.reserva.status) && linha.diasAteEntrada >= 0 && linha.diasAteEntrada <= 7) {
    return {
      texto:
        linha.diasAteEntrada === 0
          ? t('hotel.reservas.chegaHoje')
          : t('hotel.reservas.chegaEm', { dias: linha.diasAteEntrada }, linha.diasAteEntrada),
      tom: 'lugar',
    }
  }

  return {
    texto: `${horaDe(linha.reserva.entradaPrevista)} · ${horaDe(linha.reserva.saidaPrevista)}`,
    tom: 'neutro',
  }
}

/**
 * O tutorial desta tela, na ordem em que se lê a página.
 *
 * Os passos ficam aqui, e não num catálogo central, porque cada um carrega um seletor do próprio
 * template: separá-los faria o roteiro apontar para uma classe renomeada sem ninguém notar.
 */
const tourAberto = ref(false)

const passosDoTour = computed<PassoDoTour[]>(() => [
  {
    titulo: t('hotel.tour.reservas.pergunta.titulo'),
    texto: t('hotel.tour.reservas.pergunta.texto'),
  },
  {
    alvo: '.vespera',
    titulo: t('hotel.tour.reservas.vespera.titulo'),
    texto: t('hotel.tour.reservas.vespera.texto'),
  },
  {
    alvo: '.horizonte',
    titulo: t('hotel.tour.reservas.horizonte.titulo'),
    texto: t('hotel.tour.reservas.horizonte.texto'),
  },
  {
    alvo: '.lista .tabela',
    titulo: t('hotel.tour.reservas.tabela.titulo'),
    texto: t('hotel.tour.reservas.tabela.texto'),
  },
  {
    alvo: '.espera',
    titulo: t('hotel.tour.reservas.espera.titulo'),
    texto: t('hotel.tour.reservas.espera.texto'),
  },
])
</script>

<template>
  <UiPagina
    class="tela-reservas"
    :resumo="fraseDoResumo"
    :carregando="reservas.carregando && reservas.lista.length === 0 && !reservas.erro"
    :erro="reservas.erro ? t(reservas.erro) : ''"
    :vazio="vazio && horizonte === 'todas'"
    :vazio-titulo="t('hotel.reservas.vazioTitulo')"
    :vazio-descricao="t('hotel.reservas.vazioDescricao')"
    :vazio-acao="t('hotel.reservas.novaNoMapa')"
    vazio-icone="ph ph-calendar-blank"
    tour
    @tour="tourAberto = true"
    @tentar-de-novo="carregar"
    @acao-do-vazio="router.push('/hotel/mapa?nova=1')"
  >
    <template #acoes>
      <!-- A reserva nasce no mapa; `?nova=1` já abre lá o "onde cabe", sem um segundo clique. -->
      <Button
        type="button"
        icon="ph ph-calendar-plus"
        :label="t('hotel.reservas.novaNoMapa')"
        @click="router.push('/hotel/mapa?nova=1')"
      />
    </template>

    <div class="reservas">
      <ul class="ui-indicadores indicadores" :aria-label="t('hotel.reservas.titulo')">
        <li
          v-for="item in indicadores"
          :key="item.id"
          class="ui-indicador"
          :class="item.tom ? `ui-indicador--${item.tom}` : ''"
        >
          <span
            class="ui-ladrilho"
            :class="item.tom ? `ui-ladrilho--${item.tom}` : ''"
            aria-hidden="true"
          >
            <i :class="item.icone" />
          </span>
          <span class="ui-indicador__valor">{{ item.valor }}</span>
          <span class="ui-indicador__rotulo">{{ item.rotulo }}</span>
          <span v-if="item.nota" class="ui-indicador__nota">{{ item.nota }}</span>
        </li>
      </ul>

      <!--
        A véspera abre a tela. É a única coisa aqui que tem prazo: depois que o carro chega, a
        conversa sobre documento acontece no balcão, com o cliente na frente.
      -->
      <UiSecao
        v-if="vespera.length > 0"
        class="vespera"
        :titulo="t('hotel.reservas.tela.vespera')"
        :contagem="vespera.length"
        :descricao="t('hotel.reservas.vesperaLede')"
        icone="ph ph-lock-simple"
      >
        <ul class="ui-folha ui-lista vespera__lista">
          <li v-for="linha in vespera" :key="linha.reserva.id">
            <RouterLink
              class="ui-linha ui-marca ui-marca--risco vespera__linha"
              :to="`/hotel/reserva/${linha.reserva.id}`"
            >
              <PetAvatar
                :nome="linha.petNome"
                :iniciais="linha.petIniciais"
                :especie="linha.petEspecie"
                :foto-url="linha.petFotoUrl"
                tamanho="md"
              />
              <span class="ui-linha__texto">
                <span class="ui-linha__titulo">{{ linha.petNome }}</span>
                <span class="ui-linha__meta">
                  {{ linha.tutorNome }} · {{ linha.acomodacaoNome }}
                </span>
              </span>
              <span class="vespera__quando">
                <strong class="ui-num">
                  {{
                    linha.diasAteEntrada === 0
                      ? t('hotel.reservas.chegaHoje')
                      : t('hotel.reservas.chegaEm', { dias: linha.diasAteEntrada }, linha.diasAteEntrada)
                  }}
                </strong>
                <small class="ui-num">
                  {{ semana(dataDe(linha.reserva.entradaPrevista)) }}
                  {{ formato.quando(linha.reserva.entradaPrevista) }}
                </small>
              </span>
              <span class="ui-linha__fim">
                <span class="ui-selo ui-selo--risco">
                  <i class="ph" :class="SELO_DA_ADMISSAO[linha.admissao].icone" aria-hidden="true" />
                  {{ formato.resumoDaAdmissao(linha.admissao) }}
                </span>
                <span class="vespera__resolver">{{ t('hotel.reservas.tela.resolver') }}</span>
                <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
              </span>
            </RouterLink>
          </li>
        </ul>
      </UiSecao>

      <section class="lista" :aria-label="t('hotel.reservas.titulo')">
        <div class="lista__barra">
          <div class="horizonte">
            <span id="reservas-horizonte" class="horizonte__rotulo">
              {{ t('hotel.reservas.horizonte') }}
            </span>
            <SelectButton
              v-model="horizonte"
              :options="opcoesDeHorizonte"
              option-label="rotulo"
              option-value="valor"
              :allow-empty="false"
              aria-labelledby="reservas-horizonte"
            />
          </div>

          <ClinicFilterBar
            v-model:busca="busca"
            v-model:selecionados="selecionados"
            class="lista__filtro"
            :grupos="grupos"
            :placeholder-busca="t('hotel.reservas.buscar')"
            :resultado="linhas.length"
          />
        </div>

        <ClinicDataTable
          :colunas="colunas"
          :linhas="linhas"
          :chave="(linha: ReservaNaLista) => linha.reserva.id"
          :rotulo="t('hotel.reservas.titulo')"
          :vazio-titulo="
            reservas.lista.length === 0
              ? t('hotel.reservas.vazioTitulo')
              : t('hotel.reservas.semResultadoTitulo')
          "
          :vazio-descricao="
            reservas.lista.length === 0
              ? t('hotel.reservas.tela.semProximas')
              : t('hotel.reservas.semResultadoDescricao')
          "
          @ativar="(linha: ReservaNaLista) => router.push(`/hotel/reserva/${linha.reserva.id}`)"
        >
          <template #celula-entrada="{ linha }">
            <!-- A véspera travada leva a marca de risco também aqui, para quem filtrou e rolou. -->
            <span
              v-if="travadas.has(linha.reserva.id)"
              class="marca-travada"
              aria-hidden="true"
            />
            <span class="periodo">
              <span class="periodo__datas ui-num">
                <strong>{{ formato.data(dataDe(linha.reserva.entradaPrevista)) }}</strong>
                <i class="ph ph-arrow-right" aria-hidden="true" />
                <span>{{ formato.data(dataDe(linha.reserva.saidaPrevista)) }}</span>
              </span>
              <small
                class="periodo__detalhe ui-num"
                :class="`periodo__detalhe--${detalheDoPeriodo(linha).tom}`"
              >
                <i
                  v-if="detalheDoPeriodo(linha).tom === 'risco'"
                  class="ph ph-lock-simple"
                  aria-hidden="true"
                />
                {{ detalheDoPeriodo(linha).texto }}
              </small>
            </span>
          </template>

          <template #celula-pet="{ linha }">
            <span class="hospede">
              <PetAvatar
                :nome="linha.petNome"
                :iniciais="linha.petIniciais"
                :especie="linha.petEspecie"
                :foto-url="linha.petFotoUrl"
                tamanho="md"
              />
              <span class="hospede__texto">
                <strong>{{ linha.petNome }}</strong>
                <small>
                  {{ linha.tutorNome }}
                  <!-- Pedida pelo responsável, no app ou no link: a origem à vista, como na agenda. -->
                  <i
                    v-if="linha.reserva.origem === 'app' || linha.reserva.origem === 'link'"
                    class="ph hospede__origem"
                    :class="linha.reserva.origem === 'app' ? 'ph-device-mobile' : 'ph-globe-simple'"
                    :title="t(`hotel.origem.${linha.reserva.origem}`)"
                    :aria-label="t(`hotel.origem.${linha.reserva.origem}`)"
                  />
                </small>
              </span>
            </span>
          </template>

          <template #celula-acomodacao="{ linha }">
            <span class="acomodacao">{{ linha.acomodacaoNome }}</span>
          </template>

          <template #celula-noites="{ linha }">
            <span class="ui-num">{{ linha.reserva.diarias }}</span>
          </template>

          <template #celula-status="{ linha }">
            <span class="ui-selo" :class="`ui-selo--${SELO_DO_STATUS[linha.reserva.status].tom}`">
              <i class="ph" :class="SELO_DO_STATUS[linha.reserva.status].icone" aria-hidden="true" />
              {{ formato.statusDaReserva(linha.reserva.status) }}
            </span>
          </template>

          <template #celula-admissao="{ linha }">
            <span class="ui-selo" :class="`ui-selo--${SELO_DA_ADMISSAO[linha.admissao].tom}`">
              <i class="ph" :class="SELO_DA_ADMISSAO[linha.admissao].icone" aria-hidden="true" />
              {{ formato.situacaoDaExigencia(linha.admissao) }}
            </span>
          </template>

          <template #celula-saldo="{ linha }">
            <span class="dinheiro">
              <span class="ui-selo" :class="`ui-selo--${pagamento(linha.reserva).tom}`">
                <i class="ph" :class="pagamento(linha.reserva).icone" aria-hidden="true" />
                {{ pagamento(linha.reserva).rotulo }}
              </span>
              <small v-if="pagamento(linha.reserva).falta" class="dinheiro__falta ui-num">
                {{ pagamento(linha.reserva).falta }}
              </small>
            </span>
          </template>
        </ClinicDataTable>
      </section>

      <!--
        A lista de espera mora aqui, no rodapé, e não numa tela própria: ela só é consultada quando
        uma reserva cai — e nesse momento quem está olhando já está nesta página.
      -->
      <UiSecao
        v-if="reservas.espera.length > 0"
        class="espera"
        :titulo="t('hotel.reservas.tela.espera')"
        :contagem="reservas.espera.length"
        :descricao="t('hotel.reservas.tela.esperaDescricao')"
        icone="ph ph-hourglass"
      >
        <ul class="ui-folha ui-lista">
          <li v-for="item in reservas.espera" :key="item.entrada.id" class="ui-linha espera__linha">
            <PetAvatar
              :nome="item.petNome"
              :iniciais="item.petIniciais"
              :especie="item.petEspecie"
              :foto-url="item.petFotoUrl"
              tamanho="md"
            />
            <span class="ui-linha__texto">
              <span class="ui-linha__titulo">{{ item.petNome }}</span>
              <span class="ui-linha__meta">{{ item.tutorNome }}</span>
            </span>
            <span class="espera__periodo ui-num">
              {{ formato.data(item.entrada.entradaDesejada) }}
              <i class="ph ph-arrow-right" aria-hidden="true" />
              {{ formato.data(item.entrada.saidaDesejada) }}
            </span>
            <span class="ui-linha__fim">
              <span
                class="ui-selo"
                :class="item.esperandoHaDias > 7 ? 'ui-selo--atencao' : 'ui-selo--contorno'"
              >
                <i class="ph ph-hourglass" aria-hidden="true" />
                {{ formato.haDias(item.esperandoHaDias) }}
              </span>
            </span>
          </li>
        </ul>
      </UiSecao>
    </div>

    <template #sempre>
      <HotelDevPanel />

      <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
    </template>
  </UiPagina>
</template>

<style scoped>
.reservas {
  display: grid;
  gap: 36px;
}

.indicadores {
  margin: 0;
  padding: 0;
  list-style: none;
}

/* ------------------------------------------------------------------ véspera */

.vespera__linha.ui-linha {
  min-height: 68px;
  gap: 14px;
  padding-inline: 22px 18px;
}

.vespera__quando {
  display: grid;
  flex: none;
  gap: 2px;
  min-width: 9rem;
  text-align: end;
}

.vespera__quando strong {
  color: var(--risco-tinta);
  font-size: 15px;
  font-weight: 650;
}

.vespera__quando small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

.vespera__resolver {
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.vespera__linha:hover .vespera__resolver {
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* ------------------------------------------------------------------ lista */

.lista {
  display: grid;
  gap: 12px;
}

.lista__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 12px 20px;
}

.lista__filtro {
  min-width: min(100%, 26rem);
  flex: 1 1 26rem;
}

.horizonte {
  display: flex;
  min-height: 40px;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}

.horizonte__rotulo {
  color: var(--tinta-2);
  font-size: 13.5px;
}

/* O traço de risco na borda da linha da tabela: a mesma marca da véspera, com a palavra ao lado. */
.marca-travada {
  position: absolute;
  top: 10px;
  bottom: 10px;
  inset-inline-start: 0;
  width: 4px;
  border-start-end-radius: 4px;
  border-end-end-radius: 4px;
  background: var(--risco);
}

.periodo {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.periodo__datas {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 15px;
  white-space: nowrap;
}

.periodo__datas strong {
  font-weight: 650;
}

.periodo__datas span {
  color: var(--tinta-2);
  font-weight: 500;
}

.periodo__datas i {
  color: var(--tinta-3);
  font-size: 12px;
}

[dir='rtl'] .periodo__datas i,
[dir='rtl'] .espera__periodo i {
  scale: -1 1;
}

.periodo__detalhe {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.periodo__detalhe--lugar {
  color: var(--pj-lugar-tinta);
  font-weight: 550;
}

.periodo__detalhe--risco {
  color: var(--risco-tinta);
  font-weight: 600;
}

.hospede {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 12px;
}

.hospede__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.hospede__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.hospede__texto small {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hospede__origem {
  margin-inline-start: 4px;
  color: var(--tinta-3);
}

.acomodacao {
  color: var(--tinta);
  font-size: 14px;
}

.dinheiro {
  display: grid;
  justify-items: start;
  gap: 3px;
}

.dinheiro__falta {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

/* ------------------------------------------------------------------ espera */

.espera__linha {
  gap: 14px;
}

.espera__periodo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
  white-space: nowrap;
}

.espera__periodo i {
  color: var(--tinta-3);
  font-size: 12px;
}

@media (max-width: 720px) {
  /* No telefone, dois números por fileira: quatro cartões empilhados empurravam a lista para longe. */
  .indicadores.ui-indicadores {
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .indicadores .ui-indicador {
    padding: 14px 16px;
  }

  .indicadores .ui-indicador__valor {
    font-size: 24px;
  }

  .vespera__linha.ui-linha {
    flex-wrap: wrap;
    padding-block: 12px;
  }

  .vespera__quando {
    min-width: 0;
    text-align: start;
  }

  .vespera__resolver {
    display: none;
  }

  .espera__linha.ui-linha {
    flex-wrap: wrap;
    padding-block: 12px;
  }

  /* O nome fica inteiro na primeira linha; as datas e a espera descem, alinhadas com ele. */
  .espera__linha .ui-linha__texto {
    flex-basis: calc(100% - 56px);
  }

  .espera__periodo {
    margin-inline-start: 52px;
  }
}
</style>
