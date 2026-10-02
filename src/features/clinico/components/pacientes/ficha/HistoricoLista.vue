<script setup lang="ts">
/**
 * O histórico do paciente numa lista só, do mais recente para trás.
 *
 * Eram duas listas lado a lado com os mesmos acontecimentos: a tabela de atendimentos (que ainda
 * abria pelos agendamentos **futuros**) e a linha do tempo. A auditoria mediu 3,9 telas de rolagem
 * para responder "o que aconteceu com este bicho". Agora:
 *
 * - **Uma linha por acontecimento**, com o que a tabela sabia (tipo, profissional, falta,
 *   cancelamento) e o que a linha do tempo sabia (diagnóstico, resumo, exame, vacina, internação).
 *   O elo é o `appointmentId` do evento; atendimento sem evento (o cancelado, a consulta sem
 *   diagnóstico) entra pela própria data.
 * - **Agrupada por mês**, para a pessoa se localizar sem ler data por data.
 * - **O futuro sai da lista.** O próximo agendamento vira uma linha no topo, e os demais ficam
 *   recolhidos atrás dela: histórico é o que já aconteceu.
 * - **Filtro por tipo** com a contagem, que responde "já operou?" antes de qualquer clique.
 */
import {
  PhBed,
  PhCalendarPlus,
  PhCalendarX,
  PhChatText,
  PhPill,
  PhScissors,
  PhStethoscope,
  PhSyringe,
  PhTestTube,
  PhUserMinus,
} from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../../composables/useClinicFormat'
import type { Appointment, TimelineEvent, TimelineEventKind } from '../../../data/types'
import { clinicClock, useClinicoStore } from '../../../stores/clinico'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

const props = defineProps<{
  eventos: TimelineEvent[]
  atendimentos: Appointment[]
}>()

const emit = defineEmits<{
  abrir: [encounterId: string]
}>()

const { t, locale } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

type Tipo = TimelineEventKind | 'cancelado'

type Item = {
  id: string
  tipo: Tipo
  em: string
  titulo: string
  /** "Consulta · Caio Nogueira": o tipo do atendimento e quem atendeu, quando há atendimento. */
  contexto: string
  resumo: string
  encounterId: string | null
  /** Falta e cancelado ganham selo: é o desfecho que muda a leitura da linha. */
  desfecho: 'falta' | 'cancelado' | null
}

const ICONE: Record<Tipo, Component> = {
  consulta: PhStethoscope,
  vacina: PhSyringe,
  exame: PhTestTube,
  cirurgia: PhScissors,
  internacao: PhBed,
  prescricao: PhPill,
  falta: PhUserMinus,
  observacao: PhChatText,
  cancelado: PhCalendarX,
}

const ABERTO = ['agendado', 'confirmado', 'aguardando', 'em-atendimento']

function contextoDo(atendimento: Appointment | undefined) {
  if (!atendimento) {
    return ''
  }

  return [
    clinico.tipo(atendimento.typeId)?.nome,
    clinico.profissional(atendimento.professionalId)?.nome,
  ]
    .filter(Boolean)
    .join(' · ')
}

function nomeDoTipo(tipo: Tipo) {
  return tipo === 'cancelado'
    ? formato.status('cancelado')
    : t(`clinico.prontuario.timeline.kind.${tipo}`)
}

const agoraIso = computed(() => clinicClock.nowIso())

/** O que já aconteceu: os eventos, mais o atendimento passado que não virou evento. */
const itens = computed<Item[]>(() => {
  const porId = new Map(props.atendimentos.map((item) => [item.id, item]))
  const comEvento = new Set(props.eventos.map((evento) => evento.appointmentId).filter(Boolean))

  const doHistorico: Item[] = props.eventos.map((evento) => {
    const atendimento = evento.appointmentId ? porId.get(evento.appointmentId) : undefined

    return {
      id: evento.id,
      tipo: evento.kind,
      em: evento.em,
      titulo: evento.titulo || nomeDoTipo(evento.kind),
      contexto: contextoDo(atendimento),
      resumo: evento.resumo,
      encounterId: evento.encounterId,
      desfecho: evento.kind === 'falta' ? 'falta' : null,
    }
  })

  const semEvento: Item[] = props.atendimentos
    .filter(
      (atendimento) =>
        !comEvento.has(atendimento.id) &&
        atendimento.inicio <= agoraIso.value &&
        !ABERTO.includes(atendimento.status),
    )
    .map((atendimento) => {
      const tipo: Tipo =
        atendimento.status === 'cancelado'
          ? 'cancelado'
          : atendimento.status === 'falta'
            ? 'falta'
            : 'consulta'

      return {
        id: atendimento.id,
        tipo,
        em: atendimento.inicio,
        titulo: clinico.tipo(atendimento.typeId)?.nome ?? nomeDoTipo(tipo),
        contexto: clinico.profissional(atendimento.professionalId)?.nome ?? '',
        resumo: atendimento.observacao,
        encounterId: atendimento.encounterId ?? null,
        desfecho: tipo === 'falta' || tipo === 'cancelado' ? tipo : null,
      }
    })

  return [...doHistorico, ...semEvento].sort((a, b) => b.em.localeCompare(a.em))
})

/** O que ainda vai acontecer, do mais próximo ao mais distante. */
const proximos = computed(() =>
  props.atendimentos
    .filter((item) => item.inicio > agoraIso.value && ABERTO.includes(item.status))
    .sort((a, b) => a.inicio.localeCompare(b.inicio)),
)

const proximosAbertos = ref(false)

function quando(iso: string) {
  return t('clinico.ficha.historico.quando', {
    data: formato.dataCurta(clinicClock.dateOf(iso)),
    hora: formato.hora(iso),
  })
}

const filtro = ref<Tipo | null>(null)

const tiposPresentes = computed(() => {
  const contagem = new Map<Tipo, number>()

  for (const item of itens.value) {
    contagem.set(item.tipo, (contagem.get(item.tipo) ?? 0) + 1)
  }

  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([tipo, total]) => ({ tipo, total }))
})

function alternarFiltro(tipo: Tipo) {
  filtro.value = filtro.value === tipo ? null : tipo
}

const nomeDoMes = computed(
  () =>
    new Intl.DateTimeFormat(INTL_LOCALE[locale.value as Locale], {
      month: 'long',
      year: 'numeric',
    }),
)

/** Os itens filtrados, em blocos de mês. */
const meses = computed(() => {
  const blocos: { chave: string; nome: string; itens: Item[] }[] = []
  const visiveis = filtro.value
    ? itens.value.filter((item) => item.tipo === filtro.value)
    : itens.value

  for (const item of visiveis) {
    const data = clinicClock.dateOf(item.em)
    const chave = data.slice(0, 7)
    let bloco = blocos.at(-1)

    if (!bloco || bloco.chave !== chave) {
      const [ano, mes] = chave.split('-').map(Number)
      bloco = { chave, nome: nomeDoMes.value.format(new Date(ano!, mes! - 1, 1)), itens: [] }
      blocos.push(bloco)
    }

    bloco.itens.push(item)
  }

  return blocos
})
</script>

<template>
  <div class="historico-lista">
    <!-- O próximo agendamento numa linha; os outros recolhidos atrás dela. -->
    <div v-if="proximos.length > 0" class="proximos">
      <p class="proximos__linha">
        <PhCalendarPlus class="proximos__icone" weight="duotone" aria-hidden="true" />
        <span>
          <strong>{{ t('clinico.ficha.historico.proximo') }}</strong>
          {{ contextoDo(proximos[0]) }} · {{ quando(proximos[0]!.inicio) }}
        </span>
        <Button
          v-if="proximos.length > 1"
          type="button"
          class="proximos__alternar"
          :label="
            proximosAbertos
              ? t('clinico.ficha.historico.ocultarAgendados')
              : t('clinico.ficha.historico.verAgendados', { n: proximos.length }, proximos.length)
          "
          :icon="proximosAbertos ? 'pi pi-chevron-up' : 'pi pi-chevron-down'"
          icon-pos="right"
          severity="secondary"
          text
          size="small"
          :aria-expanded="proximosAbertos"
          aria-controls="historico-agendados"
          @click="proximosAbertos = !proximosAbertos"
        />
      </p>

      <ul v-show="proximosAbertos" id="historico-agendados" class="proximos__lista">
        <li v-for="item in proximos.slice(1)" :key="item.id">
          <span class="proximos__quando">{{ quando(item.inicio) }}</span>
          <span>{{ contextoDo(item) }}</span>
          <span class="proximos__status">{{ formato.status(item.status) }}</span>
        </li>
      </ul>
    </div>

    <div
      v-if="tiposPresentes.length > 1"
      class="historico-lista__filtro"
      role="group"
      :aria-label="t('clinico.ficha.historico.filtroAria')"
    >
      <Button
        v-for="tipo in tiposPresentes"
        :key="tipo.tipo"
        type="button"
        class="historico-lista__ficha"
        :class="{ 'historico-lista__ficha--ativa': filtro === tipo.tipo }"
        severity="secondary"
        outlined
        rounded
        size="small"
        :aria-pressed="filtro === tipo.tipo"
        @click="alternarFiltro(tipo.tipo)"
      >
        <component :is="ICONE[tipo.tipo]" class="historico-lista__ficha-icone" aria-hidden="true" />
        <span>{{ nomeDoTipo(tipo.tipo) }}</span>
        <span class="historico-lista__contagem">{{ tipo.total }}</span>
      </Button>
    </div>

    <p v-if="meses.length === 0" class="historico-lista__vazio">
      {{ t('clinico.prontuario.timeline.vazio') }}
    </p>

    <section
      v-for="mes in meses"
      :key="mes.chave"
      class="historico-lista__mes"
      :aria-label="mes.nome"
    >
      <h3 class="historico-lista__nome-do-mes">{{ mes.nome }}</h3>

      <ol class="historico-lista__itens">
        <li v-for="item in mes.itens" :key="item.id">
          <component
            :is="item.encounterId ? Button : 'div'"
            v-bind="item.encounterId ? { type: 'button' } : {}"
            class="historico-linha"
            :class="{
              'historico-linha--abre': item.encounterId,
              'historico-linha--apagada': item.desfecho === 'cancelado',
            }"
            @click="item.encounterId ? emit('abrir', item.encounterId) : undefined"
          >
            <span class="historico-linha__data">
              <strong>{{ formato.dataCurta(clinicClock.dateOf(item.em)) }}</strong>
              <span>{{ formato.hora(item.em) }}</span>
            </span>

            <span class="historico-linha__marca" :class="`historico-linha__marca--${item.tipo}`">
              <component :is="ICONE[item.tipo]" weight="duotone" aria-hidden="true" />
            </span>

            <span class="historico-linha__corpo">
              <span class="historico-linha__titulo">{{ item.titulo }}</span>
              <span v-if="item.contexto" class="historico-linha__contexto">
                {{ item.contexto }}
              </span>
              <span v-if="item.resumo" class="historico-linha__resumo">{{ item.resumo }}</span>
            </span>

            <span class="historico-linha__lado">
              <span
                v-if="item.desfecho"
                class="hc-selo"
                :class="item.desfecho === 'falta' ? 'hc--coral' : 'hc--cinza'"
              >
                {{ formato.status(item.desfecho) }}
              </span>
              <i
                v-if="item.encounterId"
                class="pi pi-chevron-right historico-linha__seta"
                aria-hidden="true"
              />
            </span>
          </component>
        </li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.historico-lista {
  display: grid;
  gap: 1rem;
}

/* ---------------------------------------------------------------- próximos */

.proximos {
  display: grid;
  gap: 0.5rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--hc-linha);
}

.proximos__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.6rem;
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.proximos__linha strong {
  color: var(--hc-tinta);
  font-weight: 650;
}

.proximos__icone {
  flex-shrink: 0;
  width: 1.15rem;
  height: 1.15rem;
  color: var(--hc-marca);
}

.proximos__alternar.p-button {
  margin-inline-start: auto;
}

.proximos__lista {
  display: grid;
  margin: 0;
  padding: 0;
  padding-inline-start: 1.75rem;
  list-style: none;
}

.proximos__lista li {
  display: grid;
  align-items: baseline;
  gap: 0.75rem;
  grid-template-columns: 9rem minmax(0, 1fr) auto;
  padding-block: 0.4rem;
  border-top: 1px solid var(--hc-linha);
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.proximos__quando {
  color: var(--hc-tinta);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.proximos__status {
  color: var(--hc-tinta-3);
}

/* ---------------------------------------------------------------- filtro */

.historico-lista__filtro {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.historico-lista__ficha.p-button {
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  font-size: 0.8125rem;
}

.historico-lista__ficha-icone {
  width: 0.95rem;
  height: 0.95rem;
}

.historico-lista__contagem {
  color: var(--hc-tinta-3);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.historico-lista__ficha--ativa.p-button,
.historico-lista__ficha--ativa.p-button:not(:disabled):hover {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
}

.historico-lista__vazio {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

/* ---------------------------------------------------------------- meses e linhas */

.historico-lista__mes {
  display: grid;
  gap: 0.15rem;
}

.historico-lista__nome-do-mes {
  margin: 0;
  padding-bottom: 0.35rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 650;
}

.historico-lista__nome-do-mes::first-letter {
  text-transform: uppercase;
}

.historico-lista__itens {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.historico-lista__itens > li + li {
  border-top: 1px solid var(--hc-linha);
}

.historico-linha {
  display: grid;
  align-items: start;
  gap: 0.85rem;
  grid-template-columns: 3.5rem 2rem minmax(0, 1fr) auto;
  width: 100%;
  padding: 0.7rem 0.35rem;
  border-radius: 0.6rem;
  color: inherit;
  text-align: start;
}

/* Linha que abre o prontuário: Button sem o visual de ação do preset. */
.historico-linha.p-button {
  border: 0;
  background: transparent;
  box-shadow: none;
  font-size: inherit;
  font-weight: inherit;
  transition: background-color 0.15s ease-out;
}

.historico-linha.p-button:not(:disabled):hover,
.historico-linha.p-button:not(:disabled):active {
  background: color-mix(in srgb, var(--hc-marca-clara) 45%, transparent);
  color: inherit;
}

.historico-linha.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: -2px;
}

/* A sombra de botão da casa não vale aqui: a linha é item de lista, não ação solta. */
.historico-lista .historico-linha.p-button,
.historico-lista .historico-linha.p-button:not(:disabled):hover,
.historico-lista .historico-linha.p-button:focus-visible {
  box-shadow: none;
}

.historico-linha__data {
  display: grid;
  gap: 0.05rem;
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.historico-linha__data strong {
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
}

.historico-linha__marca {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border-radius: 0.6rem;
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
}

.historico-linha__marca svg {
  width: 1.05rem;
  height: 1.05rem;
}

/* Falta é desfecho ruim: a cor fica no ícone, a linha continua neutra. */
.historico-linha__marca--falta {
  background: var(--hc-coral-fundo);
  color: var(--hc-coral-tinta);
}

.historico-linha__marca--cancelado {
  background: var(--hc-cinza-fundo);
  color: var(--hc-cinza-tinta);
}

.historico-linha__corpo {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.historico-linha__titulo {
  color: var(--hc-tinta);
  font-size: 0.9rem;
  font-weight: 650;
}

.historico-linha__contexto {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.historico-linha__resumo {
  display: -webkit-box;
  overflow: hidden;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  line-height: 1.45;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

.historico-linha--apagada .historico-linha__titulo {
  color: var(--hc-tinta-2);
  text-decoration: line-through;
}

.historico-linha__lado {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  align-self: center;
}

.historico-linha__seta {
  color: var(--hc-tinta-2);
  font-size: 0.78rem;
}

@media (prefers-reduced-motion: reduce) {
  .historico-linha.p-button {
    transition: none;
  }
}
</style>
