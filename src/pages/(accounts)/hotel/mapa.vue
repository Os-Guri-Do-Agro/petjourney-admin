<script setup lang="ts">
/**
 * Mapa de ocupação — a tela que responde "tem vaga do dia 22 ao dia 30?".
 *
 * A primeira versão desta tela era uma fileira de cartões dizendo "8 livres". É a resposta certa
 * para uma pergunta que ninguém faz: a venda de hotel é **futura**, e o que se procura não é um
 * número, é o **buraco** entre duas estadias num calendário.
 *
 * Agora a tela é o calendário. Linhas são acomodações, colunas são noites, barras são o que já
 * está vendido, e o vazio é a informação. O painel de procura no topo não filtra a lista — ele
 * **acende** as linhas que servem, deixando o resto visível e apagado: quem atende o telefone
 * precisa ver que existem outras opções quando a primeira não serve.
 */
import Button from 'primevue/button'
import DatePicker from 'primevue/datepicker'
import InputNumber from 'primevue/inputnumber'
import Select from 'primevue/select'
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'

import PartnerPageFrame from '@/components/parceiro/PartnerPageFrame.vue'
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

const { t } = useI18n()
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

onMounted(async () => {
  await carregarGrade()
  await reservas.carregarMapa()
})

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
  <PartnerPageFrame
    :title="t('hotel.mapa.titulo')"
    :subtitle="t('hotel.mapa.subtitulo')"
    tour
    @tour="tourAberto = true"
    :loading="carregandoGrade && !grade"
    :error="reservas.erro ? t(reservas.erro) : ''"
    :empty="vazio"
    :empty-title="t('hotel.mapa.vazioTitulo')"
    :empty-description="t('hotel.mapa.vazioDescricao')"
    @retry="carregarGrade"
  >
    <div class="mapa clinic-scope">
      <!--
        A procura é uma frase, não um formulário: "tenho um cão de porte grande, de tal dia a tal
        dia". Os campos estão na ordem em que a pessoa do outro lado da linha os diz.
      -->
      <section class="procura">
        <div class="procura__frase">
          <span class="procura__texto">{{ t('hotel.mapa.procuraInicio') }}</span>

          <Select
            v-model="reservas.filtro.especie"
            class="procura__campo"
            :options="ESPECIES.map((item) => ({ valor: item, rotulo: formato.especie(item) }))"
            option-label="rotulo"
            option-value="valor"
            show-clear
            size="small"
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
            size="small"
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
            size="small"
            :aria-label="t('hotel.mapa.periodo')"
          />

          <InputNumber
            v-model="reservas.filtro.ocupantes"
            class="procura__ocupantes"
            :min="1"
            :max="4"
            show-buttons
            button-layout="horizontal"
            increment-button-icon="pi pi-plus"
            decrement-button-icon="pi pi-minus"
            size="small"
            :aria-label="t('hotel.mapa.ocupantes')"
          />

          <span class="procura__texto">{{ t('hotel.mapa.procuraAnimais') }}</span>
        </div>

        <!--
          A resposta fica ao lado da pergunta, e é uma frase inteira. "8" sozinho obriga quem lê a
          lembrar do que era a pergunta; "8 acomodações servem para 3 noites" não.
        -->
        <p class="resposta" :class="servem > 0 ? 'resposta--sim' : 'resposta--nao'">
          <i :class="servem > 0 ? 'pi pi-check-circle' : 'pi pi-times-circle'" aria-hidden="true" />
          <strong>
            {{
              servem > 0
                ? t('hotel.mapa.respostaSim', { total: servem }, servem)
                : t('hotel.mapa.respostaNao', { noites }, noites)
            }}
          </strong>
          <span class="resposta__periodo">
            {{ formato.data(reservas.de) }} → {{ formato.data(reservas.ate) }}
          </span>
        </p>
      </section>

      <p v-if="procuraForaDaGrade" class="fora">
        <i class="pi pi-info-circle" aria-hidden="true" />
        {{ t('hotel.mapa.foraDaGrade') }}
      </p>

      <!-- A navegação do calendário: três semanas por vez, com volta rápida para hoje. -->
      <section class="navegacao">
        <div class="navegacao__botoes">
          <Button
            icon="pi pi-angle-left"
            severity="secondary"
            outlined
            size="small"
            :aria-label="t('hotel.mapa.semanaAnterior')"
            @click="deslocar(-7)"
          />
          <Button
            :label="t('hotel.mapa.hoje')"
            severity="secondary"
            outlined
            size="small"
            @click="voltarParaHoje"
          />
          <Button
            icon="pi pi-angle-right"
            severity="secondary"
            outlined
            size="small"
            :aria-label="t('hotel.mapa.semanaSeguinte')"
            @click="deslocar(7)"
          />
        </div>

        <span class="navegacao__periodo clinic-value">
          {{ formato.data(inicioDaGrade) }} → {{ formato.data(fimDaGrade) }}
        </span>

        <span v-if="grade" class="navegacao__livres">
          {{
            t(
              'hotel.mapa.semNenhumaReserva',
              { total: grade.totalmenteLivres },
              grade.totalmenteLivres,
            )
          }}
        </span>
      </section>

      <GradeDeOcupacao
        v-if="grade"
        :grade="grade"
        :blocos="hotelStore.blocos"
        :hoje="hoje"
        :procura="procuraForaDaGrade ? null : procura"
        @abrir-reserva="(id) => router.push(`/hotel/reserva/${id}`)"
        @reservar="abrirReservaNoDia"
      />
    </div>

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

    <template #actions>
      <span class="clinic-scope clinic-acoes">
        <Button
          :label="t('hotel.mapa.verReservas')"
          icon="pi pi-list"
          severity="secondary"
          outlined
          size="small"
          @click="router.push('/hotel/reservas')"
        />
      </span>
    </template>
  </PartnerPageFrame>
</template>

<style scoped>
.mapa {
  display: grid;
  gap: var(--clinic-space-4);
}

/* ------------------------------------------------------------------ procura */

.procura {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface);
}

.procura__frase {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.4rem;
}

.procura__texto {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.procura__campo {
  min-width: 8.5rem;
}

.procura__datas {
  min-width: 15rem;
}

.procura__ocupantes {
  max-width: 7.5rem;
}

.resposta {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid transparent;
  border-radius: var(--clinic-radius-control);
  gap: 0.5rem;
}

.resposta i {
  align-self: center;
}

.resposta--sim {
  border-color: var(--clinic-accent-soft);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.resposta--nao {
  border-color: var(--clinic-attention-line);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.resposta strong {
  font-size: var(--clinic-font-body);
  font-weight: 800;
}

.resposta__periodo {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

.fora {
  display: flex;
  align-items: center;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-2);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

/* ------------------------------------------------------------------ navegação */

.navegacao {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--clinic-space-3);
}

.navegacao__botoes {
  display: flex;
  gap: 0.3rem;
}

.navegacao__periodo {
  font-weight: 750;
}

.navegacao__livres {
  margin-inline-start: auto;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}
</style>
