<script setup lang="ts">
/**
 * Agenda: o "Calendar" do Prodify, com a agenda da casa.
 *
 * Uma faixa de sete dias com o selecionado cheio, setas para andar de semana em semana e, embaixo,
 * o compromisso em destaque num bloco suave — nome, dia e horário, o profissional num chip branco
 * e os rostos dos próximos animais empilhados. Hoje, o destaque é quem está em atendimento (ou o
 * próximo) e o próximo movimento do hotel; em outro dia, os primeiros horários dele.
 */
import Button from 'primevue/button'
import Skeleton from 'primevue/skeleton'
import {
  PhCalendarBlank,
  PhCaretLeft,
  PhCaretRight,
  PhHouseLine,
  PhStethoscope,
} from '@phosphor-icons/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

import {
  horaDaParede,
  compromissosDoDia,
  somarDias,
  type ContaDoDia,
  type EspecieDoDia,
  type MovimentoDoDia,
} from './linha-do-dia'
import { carregarAgendaDoDia, carregarChegadasDoDia, useDiaDaCasa } from './useLinhaDoDia'

const props = defineProps<{ clinica: boolean; hotel: boolean }>()

const { t, locale } = useI18n()
const dia = useDiaDaCasa()

const intl = computed(() => INTL_LOCALE[locale.value as Locale])

/* ------------------------------------------------------------------ semana */

const semana = ref(0)
const escolhido = ref<string | null>(null)

const hoje = computed(() => dia.hoje.value)
const selecionado = computed(() => escolhido.value ?? hoje.value)

/** Sete dias, com hoje no meio da primeira semana — como o Prodify mostra sexta a quinta. */
const dias = computed(() => {
  if (!hoje.value) return []

  return Array.from({ length: 7 }, (_, indice) =>
    somarDias(hoje.value!, semana.value * 7 + indice - 3),
  )
})

function comoData(data: string) {
  return new Date(`${data}T12:00:00Z`)
}

function diaDaSemana(data: string) {
  return comoData(data)
    .toLocaleDateString(intl.value, { weekday: 'short', timeZone: 'UTC' })
    .replace('.', '')
}

function numeroDoDia(data: string) {
  return comoData(data).toLocaleDateString(intl.value, { day: '2-digit', timeZone: 'UTC' })
}

function dataPorExtenso(data: string) {
  return comoData(data).toLocaleDateString(intl.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
}

const mes = computed(() => {
  if (!selecionado.value) return ''

  const texto = comoData(selecionado.value).toLocaleDateString(intl.value, {
    month: 'long',
    timeZone: 'UTC',
  })

  return texto.charAt(0).toLocaleUpperCase(intl.value) + texto.slice(1)
})

function escolher(data: string) {
  escolhido.value = data === hoje.value ? null : data
}

function andar(passo: number) {
  semana.value += passo
}

/* ------------------------------------------------------------------ outro dia */

type OutroDia = {
  carga: 'carregando' | 'pronta' | 'falhou'
  fechada: boolean
  feriado: string | null
  contas: ContaDoDia[]
  chegadas: MovimentoDoDia[]
}

const outrosDias = ref(new Map<string, OutroDia>())

async function carregarOutroDia(data: string) {
  outrosDias.value.set(data, {
    carga: 'carregando',
    fechada: false,
    feriado: null,
    contas: [],
    chegadas: [],
  })

  try {
    const [agenda, chegadas] = await Promise.all([
      props.clinica ? carregarAgendaDoDia(data) : null,
      props.hotel ? carregarChegadasDoDia(data) : [],
    ])

    outrosDias.value.set(data, {
      carga: 'pronta',
      fechada: agenda?.fechada ?? false,
      feriado: agenda?.feriado ?? null,
      contas: agenda?.contas ?? [],
      chegadas,
    })
  } catch {
    outrosDias.value.set(data, { ...outrosDias.value.get(data)!, carga: 'falhou' })
  }
}

watch(escolhido, (data) => {
  if (data && !outrosDias.value.has(data)) {
    void carregarOutroDia(data)
  }
})

/* ------------------------------------------------------------------ o dia selecionado */

const ehHoje = computed(() => !escolhido.value)

const estado = computed(() => {
  if (ehHoje.value) {
    const clinicaCarregando = props.clinica && dia.clinica.value.carga === 'carregando'
    const hotelCarregando = props.hotel && dia.hotel.value.carga === 'carregando'

    return {
      carregando: clinicaCarregando || hotelCarregando,
      falhou:
        (props.clinica && dia.clinica.value.carga === 'falhou') ||
        (props.hotel && dia.hotel.value.carga === 'falhou'),
      fechada: props.clinica && dia.clinica.value.fechada,
      feriado: dia.clinica.value.feriado,
      contas: dia.clinica.value.contas,
      chegadas: dia.hotel.value.movimentos.filter((item) => item.tipo === 'chegada'),
    }
  }

  const outro = outrosDias.value.get(escolhido.value!)

  return {
    carregando: !outro || outro.carga === 'carregando',
    falhou: outro?.carga === 'falhou',
    fechada: outro?.fechada ?? false,
    feriado: outro?.feriado ?? null,
    contas: outro?.contas ?? [],
    chegadas: outro?.chegadas ?? [],
  }
})

const resumo = computed(() => {
  const partes: string[] = []

  if (props.clinica && !estado.value.fechada) {
    const total = estado.value.contas.length
    partes.push(t('inicio.dia.atendimentos', { total }, total))
  }

  if (props.hotel) {
    const total = estado.value.chegadas.length
    if (total > 0) partes.push(t('inicio.agenda.chegadas', { total }, total))
  }

  return partes.join(' · ')
})

type Evento = {
  id: string
  titulo: string
  quando: string
  chip: string
  chipIcone: 'clinica' | 'hotel'
  selo: { texto: string; cor: string } | null
  rostos: { nome: string; iniciais: string; especie: EspecieDoDia | null; fotoUrl: string }[]
  mais: number
  to: string
}

function rotuloDoDia(data: string) {
  return ehHoje.value ? t('inicio.agenda.hoje') : diaDaSemana(data)
}

function eventoDaConta(conta: ContaDoDia, seguintes: ContaDoDia[]): Evento {
  const SELOS: Partial<Record<ContaDoDia['estado'], { texto: string; cor: string }>> = {
    agora: { texto: t('inicio.dia.estadoNome.agora'), cor: 'ciano' },
    esperando: { texto: t('inicio.agenda.aguardando'), cor: 'pessego' },
    falta: { texto: t('inicio.dia.estadoNome.falta'), cor: 'coral' },
    feito: { texto: t('inicio.dia.estadoNome.feito'), cor: 'cinza' },
  }
  const outros = seguintes.filter((item) => item.id !== conta.id)

  return {
    id: conta.id,
    titulo: [conta.petNome, conta.tipo].filter(Boolean).join(' · '),
    quando: `${rotuloDoDia(conta.inicio.slice(0, 10))} · ${horaDaParede(conta.inicio)} – ${horaDaParede(conta.fim)}`,
    chip: conta.profissional,
    chipIcone: 'clinica',
    selo: SELOS[conta.estado] ?? null,
    rostos: [conta, ...outros.slice(0, 2)].map((item) => ({
      nome: item.petNome,
      iniciais: item.petIniciais,
      especie: item.petEspecie,
      fotoUrl: item.petFotoUrl,
    })),
    mais: Math.max(0, outros.length - 2),
    to: conta.rota,
  }
}

function eventoDoMovimento(movimento: MovimentoDoDia, atrasado: boolean): Evento {
  return {
    id: movimento.id,
    titulo: [
      movimento.petNome,
      t(`inicio.dia.movimento.${movimento.tipo === 'chegada' ? 'chegada' : 'saida'}`),
    ].join(' · '),
    quando: `${rotuloDoDia(movimento.quando.slice(0, 10))} · ${horaDaParede(movimento.quando)}`,
    chip: movimento.detalhe,
    chipIcone: 'hotel',
    selo: atrasado
      ? { texto: t('inicio.dia.movimento.atrasado'), cor: 'coral' }
      : movimento.travado
        ? { texto: t('inicio.agenda.pendencia'), cor: 'pessego' }
        : null,
    rostos: [
      {
        nome: movimento.petNome,
        iniciais: movimento.petIniciais,
        especie: movimento.petEspecie,
        fotoUrl: movimento.petFotoUrl,
      },
    ],
    mais: 0,
    to: movimento.rota,
  }
}

/** Os compromissos do carrossel, na ordem de `compromissosDoDia`. */
const eventos = computed<Evento[]>(() => {
  const { contas, chegadas } = estado.value
  const agora = ehHoje.value ? dia.agora.value : null
  const compromissos = compromissosDoDia(
    props.clinica ? contas : [],
    !props.hotel ? [] : agora === null ? chegadas : dia.hotel.value.movimentos,
    agora,
  )

  /* Os rostos de cada cartão são o animal dele e os que vêm depois dele na clínica. */
  const contasEmOrdem = compromissos.flatMap((item) => (item.tipo === 'conta' ? [item.conta] : []))

  return compromissos.map((item) =>
    item.tipo === 'conta'
      ? eventoDaConta(item.conta, contasEmOrdem.slice(contasEmOrdem.indexOf(item.conta) + 1))
      : eventoDoMovimento(item.movimento, item.atrasado),
  )
})

/* ------------------------------------------------------------------ carrossel */

const posicao = ref(0)

/* Outro dia, outro carrossel: volta ao primeiro. Uma reconferência só não deixa passar do fim. */
watch(selecionado, () => {
  posicao.value = 0
})

watch(
  () => eventos.value.length,
  (total) => {
    posicao.value = Math.min(posicao.value, Math.max(0, total - 1))
  },
)

function passar(passo: number) {
  posicao.value = Math.min(Math.max(0, posicao.value + passo), eventos.value.length - 1)
}

/* No toque, arrastar para o lado troca o cartão — o sentido segue a direção da escrita. */
let toqueInicial: number | null = null

function aoTocar(evento: TouchEvent) {
  toqueInicial = evento.touches[0]?.clientX ?? null
}

function aoSoltar(evento: TouchEvent) {
  const fimDoToque = evento.changedTouches[0]?.clientX

  if (toqueInicial === null || fimDoToque === undefined) return

  const distancia = fimDoToque - toqueInicial
  const sentido = document.documentElement.dir === 'rtl' ? -1 : 1
  toqueInicial = null

  if (Math.abs(distancia) > 40) {
    passar(distancia < 0 ? sentido : -sentido)
  }
}

const vazio = computed(
  () => !estado.value.carregando && !estado.value.falhou && eventos.value.length === 0,
)
</script>

<template>
  <section class="hc agenda" aria-labelledby="home-agenda-titulo">
    <header class="hc__cabeca">
      <h2 id="home-agenda-titulo" class="hc__titulo">
        <PhCalendarBlank class="hc__icone" aria-hidden="true" />
        {{ t('inicio.agenda.titulo') }}
      </h2>
      <span class="agenda__mes">{{ mes }}</span>
    </header>

    <div class="semana" role="group" :aria-label="t('inicio.agenda.semana')">
      <Button
        type="button"
        class="semana__seta"
        severity="secondary"
        text
        rounded
        :aria-label="t('inicio.agenda.anterior')"
        @click="andar(-1)"
      >
        <template #icon>
          <PhCaretLeft class="semana__seta-icone" weight="bold" aria-hidden="true" />
        </template>
      </Button>

      <ol class="semana__dias">
        <li v-for="data in dias" :key="data">
          <Button
            type="button"
            class="semana__dia"
            :class="{
              'semana__dia--escolhido': data === selecionado,
              'semana__dia--hoje': data === hoje,
            }"
            text
            :aria-pressed="data === selecionado"
            :aria-label="dataPorExtenso(data)"
            @click="escolher(data)"
          >
            <span class="semana__nome">{{ diaDaSemana(data) }}</span>
            <span class="semana__numero">{{ numeroDoDia(data) }}</span>
          </Button>
        </li>
      </ol>

      <Button
        type="button"
        class="semana__seta"
        severity="secondary"
        text
        rounded
        :aria-label="t('inicio.agenda.proxima')"
        @click="andar(1)"
      >
        <template #icon>
          <PhCaretRight class="semana__seta-icone" weight="bold" aria-hidden="true" />
        </template>
      </Button>
    </div>

    <div v-if="!estado.carregando && (resumo || eventos.length > 1)" class="agenda__barra">
      <p class="agenda__resumo">{{ resumo }}</p>

      <div v-if="eventos.length > 1" class="carrossel__controles">
        <span class="carrossel__contagem" aria-live="polite">
          {{ t('inicio.agenda.posicao', { atual: posicao + 1, total: eventos.length }) }}
        </span>
        <Button
          type="button"
          class="carrossel__botao"
          severity="secondary"
          text
          rounded
          :disabled="posicao === 0"
          :aria-label="t('inicio.agenda.compromissoAnterior')"
          @click="passar(-1)"
        >
          <template #icon>
            <PhCaretLeft class="carrossel__botao-icone" weight="bold" aria-hidden="true" />
          </template>
        </Button>
        <Button
          type="button"
          class="carrossel__botao"
          severity="secondary"
          text
          rounded
          :disabled="posicao === eventos.length - 1"
          :aria-label="t('inicio.agenda.proximoCompromisso')"
          @click="passar(1)"
        >
          <template #icon>
            <PhCaretRight class="carrossel__botao-icone" weight="bold" aria-hidden="true" />
          </template>
        </Button>
      </div>
    </div>

    <div
      v-if="estado.carregando"
      class="agenda__esqueleto"
      role="status"
      aria-busy="true"
      :aria-label="t('inicio.agenda.carregando')"
    >
      <Skeleton width="100%" height="6.5rem" border-radius="0.85rem" />
    </div>

    <p v-else-if="estado.falhou && eventos.length === 0" class="agenda__vazio">
      {{ t('inicio.agenda.falhou') }}
    </p>

    <p v-else-if="estado.fechada && eventos.length === 0" class="agenda__vazio">
      {{
        estado.feriado
          ? t('inicio.dia.feriado', { nome: estado.feriado })
          : t('inicio.agenda.fechada')
      }}
    </p>

    <p v-else-if="vazio" class="agenda__vazio">{{ t('inicio.agenda.vazio') }}</p>

    <!--
      Um compromisso por vez. Os outros ficam no trilho, fora da janela e `inert`: nem o teclado
      nem o leitor de tela entram num cartão que não está à vista.
    -->
    <div
      v-else
      class="carrossel"
      role="region"
      aria-roledescription="carrossel"
      :aria-label="t('inicio.agenda.compromissos')"
      @touchstart.passive="aoTocar"
      @touchend="aoSoltar"
    >
      <ul class="carrossel__trilho" :style="{ '--posicao': posicao }">
        <li
          v-for="(evento, indice) in eventos"
          :key="evento.id"
          class="carrossel__item"
          aria-roledescription="slide"
          :aria-label="t('inicio.agenda.posicao', { atual: indice + 1, total: eventos.length })"
          :inert="indice !== posicao || undefined"
        >
          <RouterLink class="evento" :to="evento.to">
            <span class="evento__topo">
              <span class="evento__titulo">{{ evento.titulo }}</span>
              <span v-if="evento.selo" class="hc-selo" :class="`hc--${evento.selo.cor}`">
                {{ evento.selo.texto }}
              </span>
            </span>
            <span class="evento__quando">{{ evento.quando }}</span>
            <span class="evento__base">
              <span v-if="evento.chip" class="evento__chip">
                <component
                  :is="evento.chipIcone === 'clinica' ? PhStethoscope : PhHouseLine"
                  class="evento__chip-icone"
                  weight="duotone"
                  aria-hidden="true"
                />
                {{ evento.chip }}
              </span>
              <span class="evento__rostos" aria-hidden="true">
                <PetAvatar
                  v-for="(rosto, indice) in evento.rostos"
                  :key="`${rosto.nome}-${indice}`"
                  class="evento__rosto"
                  :nome="rosto.nome"
                  :iniciais="rosto.iniciais"
                  :especie="rosto.especie"
                  :foto-url="rosto.fotoUrl"
                  tamanho="sm"
                />
                <span v-if="evento.mais > 0" class="evento__mais">+{{ evento.mais }}</span>
              </span>
            </span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </section>
</template>

<style scoped>
.agenda {
  gap: 0.85rem;
}

.agenda__mes {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 600;
}

/* ------------------------------------------------------------------ semana */

.semana {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.25rem;
}

.semana__seta.p-button {
  inline-size: 2rem;
  block-size: 2rem;
  color: var(--hc-tinta-2);
}

.semana__seta.p-button:not(:disabled):hover {
  background: var(--hc-linha);
  color: var(--hc-tinta);
}

.semana__seta-icone {
  width: 0.9rem;
  height: 0.9rem;
}

[dir='rtl'] .semana__seta-icone {
  scale: -1 1;
}

.semana__dias {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.semana__dia.p-button {
  display: grid;
  justify-items: center;
  gap: 0.15rem;
  inline-size: 100%;
  padding: 0.45rem 0;
  border: 0;
  border-radius: 0.7rem;
  background: transparent;
  color: var(--hc-tinta);
}

.semana__dia.p-button:not(:disabled):hover {
  background: var(--hc-linha);
  color: var(--hc-tinta);
}

.semana__dia.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 1px;
}

.semana__nome {
  color: var(--hc-tinta-3);
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: capitalize;
}

.semana__numero {
  font-size: 0.9375rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.semana__dia--hoje .semana__numero {
  color: var(--hc-marca);
}

/* O dia escolhido cheio, como o "Mon 07" do Prodify. */
.semana__dia--escolhido.p-button,
.semana__dia--escolhido.p-button:not(:disabled):hover {
  background: var(--hc-degrade-botao);
  box-shadow: 0 6px 14px -6px rgb(37 111 98 / 55%);
  color: var(--hc-sobre-marca);
}

.semana__dia--escolhido .semana__nome,
.semana__dia--escolhido .semana__numero {
  color: var(--hc-sobre-marca);
}

/* ------------------------------------------------------------------ o dia */

/* O resumo do dia à esquerda e, à direita, a posição no carrossel com as setas. */
.agenda__barra {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 0.25rem 0.75rem;
  min-height: 2rem;
  margin-block-start: -0.2rem;
}

.agenda__resumo {
  margin: 0;
  color: var(--hc-tinta-3);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.agenda__esqueleto {
  display: grid;
}

.agenda__vazio {
  margin: 0;
  padding: 0.9rem 1rem;
  border-radius: 0.85rem;
  background: var(--hc-fundo);
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.carrossel__controles {
  display: inline-flex;
  align-items: center;
  gap: 0.15rem;
  margin-inline-start: auto;
}

.carrossel__contagem {
  margin-inline-end: 0.35rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.carrossel__botao.p-button {
  inline-size: 2rem;
  block-size: 2rem;
  padding: 0;
  border: 1px solid var(--hc-borda);
  background: var(--hc-cartao);
  color: var(--hc-tinta);
}

.carrossel__botao.p-button:not(:disabled):hover {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
  color: var(--hc-tinta);
}

.carrossel__botao.p-button:disabled {
  opacity: 0.4;
}

.carrossel__botao.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 2px;
  box-shadow: none;
}

.carrossel__botao-icone {
  width: 0.85rem;
  height: 0.85rem;
}

[dir='rtl'] .carrossel__botao-icone {
  scale: -1 1;
}

/* A janela mostra um cartão; o trilho anda um cartão inteiro por vez. */
.carrossel {
  overflow: hidden;
  border-radius: 0.85rem;
  touch-action: pan-y;
}

.carrossel__trilho {
  display: flex;
  margin: 0;
  padding: 0;
  list-style: none;
  translate: calc(var(--posicao) * -100%) 0;
  transition: translate 200ms ease-out;
}

[dir='rtl'] .carrossel__trilho {
  translate: calc(var(--posicao) * 100%) 0;
}

.carrossel__item {
  display: grid;
  flex: 0 0 100%;
  min-width: 0;
}

/* O bloco do compromisso: o "Meeting with VP" do Prodify, no tom claro da marca. */
.evento {
  display: grid;
  gap: 0.3rem;
  padding: 0.9rem 1rem;
  border-radius: 0.85rem;
  background: var(--hc-marca-clara);
  color: var(--hc-tinta);
  text-decoration: none;
  transition: background-color 150ms ease-out;
}

.evento:hover {
  background: color-mix(in srgb, var(--hc-marca-clara) 82%, var(--hc-marca));
}

.evento:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: -2px;
}

.evento__topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.evento__titulo {
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evento__quando {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
}

.evento__base {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  margin-block-start: 0.35rem;
}

/* O chip branco, como o "Google Meet" do Prodify. */
.evento__chip {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.3rem 0.65rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--hc-cartao);
  box-shadow: 0 1px 2px rgb(20 32 28 / 8%);
  color: var(--hc-tinta);
  font-size: 0.75rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.evento__chip-icone {
  flex-shrink: 0;
  width: 0.95rem;
  height: 0.95rem;
  color: var(--hc-marca);
}

.evento__rostos {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
}

/*
 * Os rostos empilhados do "Meeting with VP": o primeiro por cima, cada um com um aro claro, para
 * que as iniciais de nenhum fiquem escondidas sob o vizinho.
 */
.evento__rosto {
  inline-size: 1.9rem;
  block-size: 1.9rem;
  font-size: 0.625rem;
  box-shadow: 0 0 0 2px var(--hc-cartao);
}

.evento__rosto:nth-child(1) {
  z-index: 3;
}

.evento__rosto:nth-child(2) {
  z-index: 2;
}

.evento__rosto:nth-child(3) {
  z-index: 1;
}

.evento__rosto + .evento__rosto,
.evento__mais {
  margin-inline-start: -0.4rem;
}

.evento__mais {
  display: grid;
  place-items: center;
  min-inline-size: 1.9rem;
  block-size: 1.9rem;
  padding-inline: 0.3rem;
  border-radius: 999px;
  background: var(--hc-degrade-botao);
  box-shadow: 0 0 0 2px var(--hc-cartao);
  color: var(--hc-sobre-marca);
  font-size: 0.6875rem;
  font-weight: 700;
}

@media (prefers-reduced-motion: reduce) {
  .evento,
  .carrossel__trilho {
    transition: none;
  }
}
</style>
