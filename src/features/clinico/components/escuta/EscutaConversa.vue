<script setup lang="ts">
/**
 * A conversa, como o reconhecimento a ouviu.
 *
 * É a **prova** da revisão: cada campo proposto aponta para um pedaço daqui, e esse pedaço
 * aparece grifado. O grifo é a única cor do painel que não é estado — é a tinta de "a máquina
 * leu isto e fez um campo" —, e acende mais forte quando a pessoa passa pelo campo que ele
 * sustenta.
 *
 * Três decisões:
 *
 * - **O que atrapalhou fica escrito.** Latido, duas vozes, ruído: o trecho não some, ganha o nome
 *   do que o atrapalhou. Apagar o trecho esconderia de onde veio o erro do campo.
 * - **Quem falou, quando se sabe.** Na demonstração cada fala tem autor; ao vivo o navegador não
 *   separa vozes, e a fala sai sem rótulo em vez de com um rótulo inventado.
 * - **A conversa acompanha o fim**, como qualquer aplicativo de mensagem — a menos que a pessoa
 *   tenha rolado para cima para reler, e aí ela manda.
 *
 * `aria-live` fica desligado de propósito: um leitor de tela lendo a transcrição em voz alta,
 * durante a consulta, falaria por cima da consulta.
 */
import { PhDog, PhEar, PhSpeakerHigh, PhStethoscope, PhUser, PhUsers } from '@phosphor-icons/vue'
import { computed, nextTick, ref, watch, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import { useRotulosDaEscuta } from '../../composables/useRotulosDaEscuta'
import type { InterferenciaDaEscuta, TrechoDaConversa } from '../../data/types'
import { LIMIAR_DE_CONFIANCA } from '../../domain/escuta'

export type GrifoDaConversa = { inicio: number; fim: number; propostaId: string }

const props = defineProps<{
  trechos: TrechoDaConversa[]
  interino: string
  /** Primeiro nome do responsável: é o rótulo das falas dele. */
  responsavel: string
  grifos: ReadonlyMap<string, GrifoDaConversa[]>
  /** A proposta que a pessoa está olhando: os grifos dela acendem. */
  destacada: string | null
  ouvindo: boolean
}>()

const { t } = useI18n()
const rotulos = useRotulosDaEscuta()

const lista = ref<HTMLElement | null>(null)
const trechoEmFoco = ref<string | null>(null)

const ICONE_DA_INTERFERENCIA: Record<InterferenciaDaEscuta, Component> = {
  latido: PhDog,
  'fala-sobreposta': PhUsers,
  ruido: PhSpeakerHigh,
}

type Pedaco = { texto: string; grifo: GrifoDaConversa | null }

/** O texto partido nos grifos. Grifo sobreposto a outro é engolido pelo primeiro. */
function pedacos(trecho: TrechoDaConversa): Pedaco[] {
  const grifos = [...(props.grifos.get(trecho.id) ?? [])].sort((a, b) => a.inicio - b.inicio)
  const saida: Pedaco[] = []
  let cursor = 0

  for (const grifo of grifos) {
    if (grifo.inicio < cursor) {
      continue
    }

    if (grifo.inicio > cursor) {
      saida.push({ texto: trecho.texto.slice(cursor, grifo.inicio), grifo: null })
    }

    saida.push({ texto: trecho.texto.slice(grifo.inicio, grifo.fim), grifo })
    cursor = grifo.fim
  }

  if (cursor < trecho.texto.length) {
    saida.push({ texto: trecho.texto.slice(cursor), grifo: null })
  }

  return saida
}

function quem(trecho: TrechoDaConversa): { rotulo: string; icone: Component } | null {
  switch (trecho.falante) {
    case 'veterinario':
      return { rotulo: t('clinico.escuta.conversa.voce'), icone: PhStethoscope }
    case 'responsavel':
      return { rotulo: props.responsavel, icone: PhUser }
    case 'acompanhante':
      return { rotulo: t('clinico.escuta.conversa.acompanhante'), icone: PhUsers }
    default:
      return trecho.interferencia === 'fala-sobreposta'
        ? { rotulo: t('clinico.escuta.conversa.duasVozes'), icone: PhUsers }
        : null
  }
}

function incerto(trecho: TrechoDaConversa): boolean {
  return Boolean(trecho.texto) && trecho.confianca < LIMIAR_DE_CONFIANCA
}

/**
 * Duas vozes já é o rótulo de quem falou: repetir "falas sobrepostas" embaixo diria a mesma coisa
 * duas vezes. O rótulo leva o tom de atenção, e a linha do atrapalho fica para o resto.
 */
function duasVozes(trecho: TrechoDaConversa): boolean {
  return trecho.falante === 'nao-identificado' && trecho.interferencia === 'fala-sobreposta'
}

function atrapalhado(trecho: TrechoDaConversa): boolean {
  return !duasVozes(trecho) && (Boolean(trecho.interferencia) || incerto(trecho))
}

const vazia = computed(() => props.trechos.length === 0 && !props.interino)

// ------------------------------------------------------------------ rolagem

/** Perto o bastante do fim para continuar acompanhando. Acima disso, quem rolou está relendo. */
const FOLGA_PX = 48
let acompanhando = true

function aoRolar() {
  const elemento = lista.value

  if (elemento) {
    acompanhando = elemento.scrollHeight - elemento.scrollTop - elemento.clientHeight < FOLGA_PX
  }
}

watch(
  () => [props.trechos.length, props.interino],
  async () => {
    await nextTick()

    if (acompanhando && lista.value) {
      lista.value.scrollTop = lista.value.scrollHeight
    }
  },
  { immediate: true },
)

/**
 * Leva a fala para a vista e a marca por um instante: é a resposta a "de onde veio isto?".
 *
 * Rola **só a lista**, e não a página: `scrollIntoView` puxaria a página junto, e o campo que a
 * pessoa estava conferindo sairia de vista no exato momento em que ela quer comparar os dois.
 * A fala para um terço abaixo do topo, com o contexto de antes ainda visível.
 */
function mostrar(trechoId: string) {
  const elemento = lista.value
  const alvo = elemento?.querySelector<HTMLElement>(`[data-trecho="${trechoId}"]`)

  if (!elemento || !alvo) {
    return
  }

  acompanhando = false

  const distancia = alvo.getBoundingClientRect().top - elemento.getBoundingClientRect().top

  elemento.scrollBy({ top: distancia - elemento.clientHeight / 3, behavior: 'smooth' })
  trechoEmFoco.value = trechoId
  window.setTimeout(() => {
    if (trechoEmFoco.value === trechoId) {
      trechoEmFoco.value = null
    }
  }, 1600)
}

defineExpose({ mostrar })
</script>

<template>
  <section class="conversa" :aria-label="t('clinico.escuta.conversa.titulo')">
    <h3 class="conversa__titulo">{{ t('clinico.escuta.conversa.titulo') }}</h3>

    <ol ref="lista" class="conversa__lista" aria-live="off" @scroll.passive="aoRolar">
      <li v-if="vazia" class="conversa__vazia">
        {{ ouvindo ? t('clinico.escuta.conversa.esperando') : t('clinico.escuta.conversa.vazia') }}
      </li>

      <li
        v-for="trecho in trechos"
        :key="trecho.id"
        class="fala"
        :class="{
          'fala--som': !trecho.texto,
          'fala--foco': trechoEmFoco === trecho.id,
        }"
        :data-trecho="trecho.id"
      >
        <span class="fala__hora clinic-value">{{ rotulos.relogio(trecho.emMs) }}</span>

        <!-- Trecho só de som: o latido da recepção, sem fala por cima. -->
        <span v-if="!trecho.texto && trecho.interferencia" class="fala__som">
          <component
            :is="ICONE_DA_INTERFERENCIA[trecho.interferencia]"
            weight="duotone"
            aria-hidden="true"
          />
          {{ t(`clinico.escuta.conversa.interferencia.${trecho.interferencia}`) }}
        </span>

        <div v-else class="fala__corpo">
          <span
            v-if="quem(trecho)"
            class="fala__quem"
            :class="{
              'fala__quem--voce': trecho.falante === 'veterinario',
              'fala__quem--atrapalho': duasVozes(trecho),
            }"
          >
            <component :is="quem(trecho)!.icone" weight="duotone" aria-hidden="true" />
            {{ quem(trecho)!.rotulo }}
          </span>

          <p class="fala__texto" :class="{ 'fala__texto--incerto': incerto(trecho) }">
            <template v-for="(pedaco, indice) in pedacos(trecho)" :key="indice">
              <mark
                v-if="pedaco.grifo"
                class="grifo"
                :class="{ 'grifo--aceso': destacada === pedaco.grifo.propostaId }"
                >{{ pedaco.texto }}</mark
              >
              <template v-else>{{ pedaco.texto }}</template>
            </template>
          </p>

          <span v-if="atrapalhado(trecho)" class="fala__atrapalho">
            <component
              :is="trecho.interferencia ? ICONE_DA_INTERFERENCIA[trecho.interferencia] : PhEar"
              weight="duotone"
              aria-hidden="true"
            />
            {{
              trecho.interferencia
                ? t(`clinico.escuta.conversa.interferencia.${trecho.interferencia}`)
                : t('clinico.escuta.conversa.incerto')
            }}
          </span>
        </div>
      </li>

      <!-- O que está sendo dito agora, ainda sem ponto final. Leitor de tela não precisa disso. -->
      <li v-if="interino" class="fala fala--interina" aria-hidden="true">
        <span class="fala__hora" />
        <p class="fala__texto">{{ interino }}</p>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.conversa {
  display: grid;
  min-width: 0;
  min-height: 0;
  grid-template-rows: auto minmax(0, 1fr);
  gap: var(--clinic-space-2);
}

/* Título de área, no mesmo nível do "Prontuário proposto" ao lado: caixa normal, não versalete. */
.conversa__titulo {
  margin: 0;
  font-size: var(--clinic-font-base);
  font-weight: 750;
}

.conversa__lista {
  display: grid;
  align-content: start;
  gap: var(--clinic-space-3);
  max-height: 30rem;
  margin: 0;
  padding: 0 var(--clinic-space-2) 0 0;
  overflow-y: auto;
  list-style: none;
  overscroll-behavior: contain;
}

.conversa__vazia {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.fala {
  display: grid;
  grid-template-columns: 2.6rem minmax(0, 1fr);
  gap: var(--clinic-space-2);
  padding: 0.15rem 0.25rem;
  border-radius: var(--clinic-radius-control);
  transition: background-color 180ms ease-out;
}

/* "De onde veio isto?": a fala acende por um instante e apaga sozinha. */
.fala--foco {
  background: var(--clinic-maquina-bg);
}

.fala__hora {
  padding-top: 0.1rem;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.fala__corpo {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.fala__quem {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 750;
}

/* As falas do veterinário recuam de tom: numa anamnese, quem relata é o responsável. */
.fala__quem--atrapalho {
  color: var(--clinic-attention-text);
}

.fala__quem--voce {
  color: var(--clinic-faint);
}

.fala__texto {
  margin: 0;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

/* Ouvido com dúvida: o texto continua legível, e o sublinhado pontilhado diz "não confie cego". */
.fala__texto--incerto {
  text-decoration: underline dotted var(--clinic-attention-text);
  text-underline-offset: 3px;
}

.fala__som,
.fala__atrapalho {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.fala--interina .fala__texto {
  color: var(--clinic-faint);
}

.grifo {
  padding: 0 0.1rem;
  border-radius: 0.2rem;
  background: var(--clinic-maquina-bg);
  color: inherit;
  transition: box-shadow 150ms ease-out;
}

.grifo--aceso {
  box-shadow: 0 0 0 1.5px var(--clinic-maquina-line);
}
</style>
