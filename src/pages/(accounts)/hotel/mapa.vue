<script setup lang="ts">
/**
 * Mapa de ocupação — a tela que responde "onde cabe mais um, e quando".
 *
 * A primeira versão desta tela era uma fileira de cartões dizendo "8 livres". É a resposta certa
 * para uma pergunta que ninguém faz: a venda de hotel é **futura**, e o que se procura não é um
 * número, é o **buraco** entre duas estadias num calendário.
 *
 * A tela é o calendário. Linhas são acomodações, colunas são noites, barras são o que já está
 * vendido (com o rosto e o nome de quem dorme ali), e o vazio é a informação — e o convite: clicar
 * num vazio começa a reserva naquele dia. A procura no alto é a frase do telefone ("tenho um cão
 * grande, de tal dia a tal dia"); ela não filtra a lista, ela **acende** as linhas que servem e
 * deixa o resto visível e apagado, porque quem atende precisa ver que existem outras opções.
 *
 * A ação cheia, "Nova reserva", mostra onde cabe o que está sendo procurado e abre o mesmo
 * formulário que o clique num vazio abre. A navegação anda de semana em semana, com a volta para
 * hoje, e a fita dos dias no cabeçalho da grade diz de relance qual noite está cheia.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import HotelDevPanel from '@/features/hotel/components/base/HotelDevPanel.vue'
import HotelTour from '@/features/hotel/components/base/HotelTour.vue'
import type { PassoDoTour } from '@/features/hotel/components/base/tour-types'
import GradeDeOcupacao from '@/features/hotel/components/mapa/GradeDeOcupacao.vue'
import NovaReservaDialog from '@/features/hotel/components/reserva/NovaReservaDialog.vue'
import { useHotelFormat } from '@/features/hotel/composables/useHotelFormat'
import {
  reservaRepository,
  type GradeDeOcupacao as Grade,
} from '@/features/hotel/data/repositories'
import type { Acomodacao, ISODate, PetPorte, PetSpecies } from '@/features/hotel/data/types'
import { addDays, datasEntre } from '@/features/hotel/domain/hotel-time'
import { hotelClock, useHotelStore } from '@/features/hotel/stores/hotel'
import { useReservasStore } from '@/features/hotel/stores/reservas'
import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

const { t, locale } = useI18n()
const router = useRouter()
const formato = useHotelFormat()
const hotelStore = useHotelStore()
const reservas = useReservasStore()

const hoje = hotelClock.today()
const escolhida = ref<Acomodacao | null>(null)
const grade = ref<Grade | null>(null)
const carregandoGrade = ref(false)

const PORTES: PetPorte[] = ['mini', 'pequeno', 'medio', 'grande', 'gigante']
const ESPECIES: PetSpecies[] = ['canina', 'felina']

/**
 * Quantos dias a grade mostra.
 *
 * Vinte e um: três semanas cabem na largura de um monitor sem rolagem horizontal na maioria das
 * telas, e é o horizonte em que a recepção de fato vende. Um mês inteiro espremeria a coluna a
 * ponto de o nome do hóspede não caber — e barra sem nome obriga a clicar para saber quem é.
 */
const DIAS_NA_GRADE = 21

/** A grade começa ontem, não hoje: quem está hospedado precisa aparecer entrando pela esquerda. */
const inicioDaGrade = ref<ISODate>(addDays(hoje, -1))

const fimDaGrade = computed(() => addDays(inicioDaGrade.value, DIAS_NA_GRADE - 1))

const naSemanaDeHoje = computed(() => inicioDaGrade.value === addDays(hoje, -1))

/**
 * O `DatePicker` fala `Date`; o módulo fala `ISODate`.
 *
 * A conversão mora aqui e em nenhum outro lugar: um `Date` que vazasse para a store traria o
 * fuso do navegador junto, e a vaga do dia 22 apareceria como 21 para quem abrisse de Lisboa.
 */
const intervalo = ref<Date[]>([
  new Date(`${reservas.de}T12:00:00`),
  new Date(`${reservas.ate}T12:00:00`),
])

function paraIso(data: Date): ISODate {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(
    data.getDate(),
  ).padStart(2, '0')}`
}

async function carregarGrade() {
  carregandoGrade.value = true

  try {
    await hotelStore.carregar()
    grade.value = await reservaRepository.grade(inicioDaGrade.value, fimDaGrade.value)
  } finally {
    carregandoGrade.value = false
  }
}

async function carregar() {
  await carregarGrade()
  await reservas.carregarMapa()
}

onMounted(carregar)

watch(intervalo, (valor) => {
  const [inicio, fim] = valor ?? []

  if (!inicio || !fim) {
    return
  }

  reservas.definirPeriodo(paraIso(inicio), paraIso(fim))
  void reservas.carregarMapa()

  /*
   * A grade acompanha a procura quando ela sai do que está à vista. Sem isto, escolher um período
   * de dezembro em setembro pintaria nada — e a tela pareceria quebrada, não vazia.
   */
  if (reservas.de < inicioDaGrade.value || reservas.de > fimDaGrade.value) {
    inicioDaGrade.value = addDays(reservas.de, -1)
    void carregarGrade()
  }
})

watch(
  () => [reservas.filtro.porte, reservas.filtro.especie, reservas.filtro.ocupantes],
  () => void reservas.carregarMapa(),
)

watch(
  () => hotelStore.revisao,
  () => {
    void carregarGrade()
    void reservas.carregarMapa()
  },
)

function deslocar(dias: number) {
  inicioDaGrade.value = addDays(inicioDaGrade.value, dias)
  void carregarGrade()
}

function voltarParaHoje() {
  inicioDaGrade.value = addDays(hoje, -1)
  void carregarGrade()
}

/** Leva a grade até o período procurado, quando ele está fora das três semanas à vista. */
function irParaAProcura() {
  inicioDaGrade.value = addDays(reservas.de, -1)
  void carregarGrade()
}

/**
 * Quantas acomodações servem para o que está sendo procurado.
 *
 * Vem do mesmo repositório que recusa a reserva — as duas telas não podem discordar, senão a
 * recepção oferece uma baia e o sistema a recusa com o cliente na linha.
 */
const servem = computed(() => reservas.mapa?.livres ?? 0)

const noites = computed(() => reservas.noites)

/** A faixa procurada, em datas, para a grade pintar as colunas. */
const procura = computed(() => ({ de: reservas.de, ate: reservas.ate }))

/** Fora do horizonte da grade a procura não tem onde ser pintada — e a tela avisa. */
const procuraForaDaGrade = computed(
  () => !datasEntre(inicioDaGrade.value, fimDaGrade.value).includes(reservas.de),
)

function abrirReservaNoDia(payload: { acomodacaoId: string; dia: ISODate }) {
  /*
   * Clicar numa célula vazia é dizer "quero começar aqui". A tela adota aquele dia como entrada
   * e mantém a duração que já estava escolhida — é o gesto do balcão: a pessoa já disse quantas
   * noites, e está apontando quando.
   */
  reservas.definirPeriodo(payload.dia, addDays(payload.dia, Math.max(1, noites.value)))
  intervalo.value = [new Date(`${reservas.de}T12:00:00`), new Date(`${reservas.ate}T12:00:00`)]

  escolhida.value = hotelStore.acomodacao(payload.acomodacaoId)
}

async function criar(payload: Parameters<typeof reservas.criar>[0]) {
  const criada = await reservas.criar(payload)

  if (criada) {
    escolhida.value = null
    await carregarGrade()
    await router.push(`/hotel/reserva/${criada.id}`)
  }
}

const vazio = computed(() => !carregandoGrade.value && (grade.value?.linhas.length ?? 0) === 0)

// ------------------------------------------------------------------ a frase de cima

const tag = computed(() => INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE])

/** "sex., 23/10" — o dia da semana e a data, para a frase de estado. */
function diaCurto(data: ISODate) {
  const semana = new Intl.DateTimeFormat(tag.value, { weekday: 'short', timeZone: 'UTC' }).format(
    new Date(`${data}T12:00:00Z`),
  )

  return `${semana} ${formato.data(data)}`
}

/** "18 de out." — as pontas do período à vista. */
function diaEMes(data: ISODate) {
  return new Intl.DateTimeFormat(tag.value, {
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  }).format(new Date(`${data}T12:00:00Z`))
}

const periodoAVista = computed(() =>
  t('hotel.mapa.tela.intervalo', {
    de: diaEMes(inicioDaGrade.value),
    ate: diaEMes(fimDaGrade.value),
  }),
)

/**
 * Hoje, quantas estão ocupadas; e, daqui para a frente, qual a noite mais cheia à vista. É a
 * pergunta da tela em uma frase: onde ainda cabe, e quando aperta.
 */
const fraseDoResumo = computed(() => {
  const atual = grade.value

  if (!atual || atual.linhas.length === 0) {
    return ''
  }

  const indiceDeHoje = atual.dias.indexOf(hoje)
  const deHoje = indiceDeHoje >= 0 ? atual.porDia[indiceDeHoje] : null

  /* Daqui para a frente, sem hoje: o hoje já está dito na primeira metade da frase. */
  const futuras = atual.porDia.filter((dia) => dia.data > hoje && dia.operando > 0)
  const candidatas = futuras.length > 0 ? futuras : atual.porDia.filter((dia) => dia.operando > 0)
  const pico = candidatas.reduce<(typeof candidatas)[number] | null>(
    (maior, dia) => (!maior || dia.ocupadas > maior.ocupadas ? dia : maior),
    null,
  )

  let fraseDoPico = ''

  if (pico && pico.ocupadas > 0) {
    const livres = pico.operando - pico.ocupadas

    fraseDoPico =
      livres <= 0
        ? t('hotel.mapa.tela.resumoLotado', { dia: diaCurto(pico.data) })
        : t('hotel.mapa.tela.resumoPico', { dia: diaCurto(pico.data), livres }, livres)
  }

  if (!deHoje) {
    return fraseDoPico ? t('hotel.mapa.tela.resumoSemHoje', { pico: fraseDoPico }) : ''
  }

  const fraseDeHoje = t(
    'hotel.mapa.tela.resumoHoje',
    { ocupadas: deHoje.ocupadas, total: deHoje.operando },
    deHoje.operando,
  )

  return fraseDoPico
    ? t('hotel.mapa.tela.resumo', { hoje: fraseDeHoje, pico: fraseDoPico })
    : `${fraseDeHoje}.`
})

// ------------------------------------------------------------------ nova reserva

/*
 * "Nova reserva" mostra onde cabe o que a procura descreve, e a escolha abre o mesmo formulário
 * do clique num vazio da grade. O formulário precisa da acomodação; a resposta à procura é a lista
 * de onde ela cabe.
 */
const popoverDeOnde = ref<InstanceType<typeof Popover> | null>(null)

const ondeCabe = computed(() =>
  (reservas.mapa?.vagas ?? []).filter(
    (vaga) => vaga.acomodacao.ativa && vaga.impedimentos.length === 0,
  ),
)

function escolherOnde(acomodacao: Acomodacao) {
  popoverDeOnde.value?.hide()
  escolhida.value = acomodacao
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
    titulo: t('hotel.tour.mapa.pergunta.titulo'),
    texto: t('hotel.tour.mapa.pergunta.texto'),
  },
  {
    alvo: '.procura',
    titulo: t('hotel.tour.mapa.procura.titulo'),
    texto: t('hotel.tour.mapa.procura.texto'),
  },
  {
    alvo: '.resposta',
    titulo: t('hotel.tour.mapa.resposta.titulo'),
    texto: t('hotel.tour.mapa.resposta.texto'),
  },
  {
    alvo: '.grade',
    titulo: t('hotel.tour.mapa.grade.titulo'),
    texto: t('hotel.tour.mapa.grade.texto'),
  },
  {
    alvo: '.legenda',
    titulo: t('hotel.tour.mapa.legenda.titulo'),
    texto: t('hotel.tour.mapa.legenda.texto'),
  },
])
</script>

<template>
  <UiPagina
    class="tela-mapa"
    :resumo="fraseDoResumo"
    :carregando="carregandoGrade && !grade"
    :erro="reservas.erro ? t(reservas.erro) : ''"
    :vazio="vazio"
    :vazio-titulo="t('hotel.mapa.vazioTitulo')"
    :vazio-descricao="t('hotel.mapa.vazioDescricao')"
    vazio-icone="ph ph-bed"
    tour
    @tour="tourAberto = true"
    @tentar-de-novo="carregar"
  >
    <template #acoes>
      <Button
        type="button"
        icon="ph ph-calendar-plus"
        :label="t('hotel.reservas.novaNoMapa')"
        aria-haspopup="dialog"
        @click="popoverDeOnde?.toggle($event)"
      />
    </template>

    <div class="mapa">
      <!--
        A procura é uma frase, não um formulário: "tenho um cão de porte grande, de tal dia a tal
        dia". Os campos estão na ordem em que a pessoa do outro lado da linha os diz, e a resposta
        fica ao lado da pergunta.
      -->
      <section class="procura ui-folha" :aria-label="t('hotel.mapa.tela.procura')">
        <div class="procura__frase">
          <span class="procura__texto">{{ t('hotel.mapa.procuraInicio') }}</span>

          <Select
            v-model="reservas.filtro.especie"
            class="procura__campo"
            :options="ESPECIES.map((item) => ({ valor: item, rotulo: formato.especie(item) }))"
            option-label="rotulo"
            option-value="valor"
            show-clear
            :placeholder="t('hotel.mapa.qualquerEspecie')"
            :aria-label="t('hotel.mapa.especie')"
          />

          <Select
            v-model="reservas.filtro.porte"
            class="procura__campo"
            :options="PORTES.map((item) => ({ valor: item, rotulo: formato.porte(item) }))"
            option-label="rotulo"
            option-value="valor"
            show-clear
            :placeholder="t('hotel.mapa.qualquerPorte')"
            :aria-label="t('hotel.mapa.porte')"
          />

          <span class="procura__texto">{{ t('hotel.mapa.procuraDe') }}</span>

          <DatePicker
            v-model="intervalo"
            class="procura__datas"
            selection-mode="range"
            :manual-input="false"
            date-format="dd/mm/yy"
            show-icon
            icon-display="input"
            :aria-label="t('hotel.mapa.periodo')"
          />

          <InputNumber
            v-model="reservas.filtro.ocupantes"
            class="procura__ocupantes"
            :min="1"
            :max="4"
            show-buttons
            button-layout="horizontal"
            increment-button-icon="ph ph-plus"
            decrement-button-icon="ph ph-minus"
            :aria-label="t('hotel.mapa.ocupantes')"
          />

          <span class="procura__texto">{{ t('hotel.mapa.procuraAnimais') }}</span>
        </div>

        <!--
          A resposta é uma frase inteira. "8" sozinho obriga quem lê a lembrar do que era a
          pergunta; "8 acomodações servem, de 20/10 a 23/10" não.
        -->
        <p
          class="resposta"
          :class="servem > 0 ? 'resposta--sim' : 'resposta--nao'"
          aria-live="polite"
        >
          <i :class="servem > 0 ? 'ph ph-check-circle' : 'ph ph-x-circle'" aria-hidden="true" />
          <strong>
            {{
              servem > 0
                ? t('hotel.mapa.respostaSim', { total: servem }, servem)
                : t('hotel.mapa.respostaNao', { noites }, noites)
            }}
          </strong>
          <span class="resposta__periodo ui-num">
            {{
              t('hotel.mapa.tela.periodoDaProcura', {
                de: formato.data(reservas.de),
                ate: formato.data(reservas.ate),
              })
            }}
          </span>
        </p>
      </section>

      <p v-if="procuraForaDaGrade" class="fora" role="status">
        <i class="ph ph-info" aria-hidden="true" />
        <span>{{ t('hotel.mapa.tela.foraDaGrade') }}</span>
        <Button
          type="button"
          size="small"
          severity="secondary"
          outlined
          icon="ph ph-arrow-right"
          icon-pos="right"
          :label="t('hotel.mapa.tela.irParaProcura')"
          @click="irParaAProcura"
        />
      </p>

      <GradeDeOcupacao
        v-if="grade"
        :grade="grade"
        :blocos="hotelStore.blocos"
        :hoje="hoje"
        :procura="procuraForaDaGrade ? null : procura"
        @abrir-reserva="(id) => router.push(`/hotel/reserva/${id}`)"
        @reservar="abrirReservaNoDia"
      >
        <!-- O período à vista anda de semana em semana, com a volta para hoje: as setas ao lado dos dias. -->
        <template #canto>
          <span class="navegacao" role="group" :aria-label="periodoAVista">
            <Button
              type="button"
              icon="ph ph-caret-left"
              severity="secondary"
              text
              class="navegacao__seta"
              :aria-label="t('hotel.mapa.semanaAnterior')"
              :title="t('hotel.mapa.semanaAnterior')"
              @click="deslocar(-7)"
            />
            <Button
              type="button"
              icon="ph ph-caret-right"
              severity="secondary"
              text
              class="navegacao__seta"
              :aria-label="t('hotel.mapa.semanaSeguinte')"
              :title="t('hotel.mapa.semanaSeguinte')"
              @click="deslocar(7)"
            />
            <Button
              v-if="!naSemanaDeHoje"
              type="button"
              size="small"
              severity="secondary"
              outlined
              icon="ph ph-arrow-u-up-left"
              :label="t('hotel.mapa.hoje')"
              :aria-label="t('hotel.mapa.hoje')"
              class="navegacao__hoje"
              @click="voltarParaHoje"
            />
          </span>
        </template>
      </GradeDeOcupacao>
    </div>

    <template #sempre>
      <!-- Onde cabe: a resposta da procura como lista, e cada linha abre a reserva. -->
      <Popover ref="popoverDeOnde" class="clinic-overlay">
        <div class="onde">
          <p class="onde__titulo">{{ t('hotel.mapa.tela.ondeTitulo') }}</p>
          <p class="onde__periodo ui-num">
            {{
              t('hotel.mapa.tela.periodoDaProcura', {
                de: formato.data(reservas.de),
                ate: formato.data(reservas.ate),
              })
            }}
            · {{ t('hotel.reserva.diarias', { total: noites }, noites) }}
          </p>

          <ul v-if="ondeCabe.length > 0" class="onde__lista ui-lista">
            <li v-for="vaga in ondeCabe" :key="vaga.acomodacao.id">
              <button type="button" class="ui-linha onde__linha" @click="escolherOnde(vaga.acomodacao)">
                <span class="onde__icone" aria-hidden="true"><i class="ph ph-bed" /></span>
                <span class="ui-linha__texto">
                  <span class="ui-linha__titulo">{{ vaga.acomodacao.nome }}</span>
                  <span class="ui-linha__meta">
                    {{ hotelStore.tipoDeAcomodacao(vaga.acomodacao.tipoId)?.nome }} ·
                    {{ formato.porte(vaga.acomodacao.porteMaximo) }}
                  </span>
                </span>
                <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
              </button>
            </li>
          </ul>

          <p v-else class="onde__vazio">
            <i class="ph ph-calendar-x" aria-hidden="true" />
            {{ t('hotel.mapa.tela.ondeVazio') }}
          </p>

          <p class="onde__dica">
            <i class="ph ph-cursor-click" aria-hidden="true" />
            {{ t('hotel.mapa.tela.ondeDica') }}
          </p>
        </div>
      </Popover>

      <NovaReservaDialog
        :acomodacao="escolhida"
        :inicio="reservas.inicioIso"
        :fim="reservas.fimIso"
        :salvando="reservas.salvando"
        :erro="reservas.erroDeAcao"
        :comprovantes="hotelStore.comprovantes"
        :hoje="hoje"
        @fechar="escolhida = null"
        @confirmar="criar"
      />

      <HotelDevPanel />

      <HotelTour v-model:aberto="tourAberto" :passos="passosDoTour" />
    </template>
  </UiPagina>
</template>

<style scoped>
.mapa {
  display: grid;
  gap: 20px;
}

/* ------------------------------------------------------------------ procura */

/*
 * A procura é a frase do telefone, num cartão: os campos na ordem em que a pessoa os diz; no pé
 * do cartão, a resposta, na cor do que ela diz (dá, ou não dá).
 */
.procura {
  display: grid;
  align-items: center;
  gap: 14px 16px;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
  padding: 18px 24px 0;
}

.procura__frase {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.procura__texto {
  color: var(--tinta-2);
  font-size: 14px;
}

.procura__campo {
  min-width: 9.5rem;
}

.procura__datas {
  width: 15.5rem;
}

.procura__ocupantes {
  width: 8.5rem;
}

.procura__ocupantes :deep(input) {
  width: 100%;
  min-width: 0;
  font-family: var(--font-dados);
  text-align: center;
}

.resposta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  margin: 4px -20px 0;
  padding: 12px 24px;
  border-top: 1px solid var(--linha-suave);
  font-size: 14px;
  grid-column: 1 / -1;
}

.resposta i {
  font-size: 19px;
}

.resposta strong {
  font-weight: 650;
}

.resposta--sim {
  border-top-color: color-mix(in oklab, var(--ok) 20%, transparent);
  background: color-mix(in oklab, var(--ok-fundo) 70%, var(--superficie));
  color: var(--ok-tinta);
}

.resposta--nao {
  border-top-color: color-mix(in oklab, var(--atencao) 22%, transparent);
  background: color-mix(in oklab, var(--atencao-fundo) 70%, var(--superficie));
  color: var(--atencao-tinta);
}

.resposta__periodo {
  color: inherit;
  font-size: 13px;
  opacity: 0.9;
}

.fora {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--linha-suave);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 14px;
}

.fora > i {
  color: var(--pj-lugar-tinta);
  font-size: 18px;
}

.fora > span {
  flex: 1 1 18rem;
}

/* ------------------------------------------------------------------ navegação */

.navegacao {
  display: flex;
  align-items: center;
  gap: 2px;
  margin: 0 0 6px -8px;
}

.navegacao__seta.p-button {
  width: 34px;
  height: 34px;
}

[dir='rtl'] .navegacao__seta :deep(.p-button-icon),
[dir='rtl'] .navegacao__hoje :deep(.p-button-icon) {
  scale: -1 1;
}

.navegacao__hoje.p-button {
  min-height: 32px;
  margin-inline-start: 4px;
  padding-inline: 8px;
}

/* ------------------------------------------------------------------ onde cabe */

.onde {
  display: grid;
  width: min(22rem, 86vw);
  gap: 8px;
}

.onde__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.onde__periodo {
  margin: -4px 0 2px;
  color: var(--tinta-2);
  font-size: 13px;
}

.onde__lista {
  max-height: 18rem;
  overflow: auto;
  border: 1px solid var(--linha);
  border-radius: 12px;
}

.onde__linha.ui-linha {
  min-height: 50px;
  gap: 12px;
  padding: 6px 12px;
}

.onde__icone {
  display: grid;
  width: 32px;
  height: 32px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--hotel-fundo);
  color: var(--hotel-tinta);
  font-size: 17px;
}

.onde__vazio,
.onde__dica {
  display: flex;
  align-items: baseline;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.45;
}

.onde__vazio {
  padding: 12px;
  border-radius: 12px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.onde__vazio i,
.onde__dica i {
  flex: none;
  transform: translateY(2px);
}

@media (max-width: 720px) {
  .procura {
    padding-inline: 16px;
  }

  .resposta {
    margin-inline: -16px;
    padding-inline: 16px;
  }

  .procura__campo {
    min-width: 0;
    flex: 1 1 9rem;
  }

  .procura__datas {
    width: auto;
    flex: 1 1 100%;
  }

  .navegacao__hoje :deep(.p-button-label) {
    display: none;
  }
}
</style>
