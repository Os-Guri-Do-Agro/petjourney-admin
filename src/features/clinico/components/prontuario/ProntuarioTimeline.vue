<script setup lang="ts">
/**
 * A coluna de contexto do atendimento: a consulta anterior em destaque e o histórico do paciente.
 *
 * O retorno abre mostrando a consulta anterior porque, sem isso, o profissional relê o histórico
 * inteiro para lembrar o que prescreveu há duas semanas. O que interessa no retorno é o par: o
 * que foi dito e o que aconteceu depois.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Em cima, a consulta anterior numa folha marcada na cor do lugar — o diagnóstico em destaque, a
 * orientação dada e o que foi prescrito, com nome e dose. Embaixo, o histórico como lista do kit
 * (rosto do evento, data em algarismos de mesma largura, título e uma frase), com os filtros por
 * tipo em cima — que além de filtrar respondem "o que já foi feito neste pet" antes de qualquer
 * clique.
 *
 * Contexto, não tarefa: a coluna fecha pelo X do alto, e a página a reabre pelo "Histórico".
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, TimelineEvent, TimelineEventKind } from '../../data/types'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    eventos: TimelineEvent[]
    anterior: Encounter | null
    /**
     * Quantos eventos cabem antes de a lista virar parede. Cinco é o que uma coluna lateral
     * mostra sem empurrar o conteúdo principal para cima — o resto fica na página do paciente,
     * que existe justamente para isso.
     */
    limite?: number
    /** Rota do histórico completo. Sem ela, o "ver todos" não aparece. */
    rotaCompleta?: string
    /**
     * Tela estreita: a coluna vem **acima** da folha, e ali ela mostra só a consulta anterior e o
     * caminho para o histórico completo. A lista inteira empurraria o formulário uma tela abaixo.
     */
    compacto?: boolean
  }>(),
  { limite: 5, rotaCompleta: '', compacto: false },
)

const emit = defineEmits<{ fechar: [] }>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

/**
 * Filtro por tipo.
 *
 * A pergunta de quem abre o histórico no meio da consulta é sempre estreita: "quando foi a
 * última vacina?", "já operou?". Só aparecem os tipos que **existem neste paciente** — um filtro
 * "Internação" num pet que nunca internou é um clique que só devolve lista vazia. Seleção única:
 * a pergunta é sobre um tipo de cada vez.
 */
const filtro = ref<TimelineEventKind | null>(null)

const tiposPresentes = computed(() => {
  const contagem = new Map<TimelineEventKind, number>()

  for (const evento of props.eventos) {
    contagem.set(evento.kind, (contagem.get(evento.kind) ?? 0) + 1)
  }

  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, total]) => ({ kind, total }))
})

const filtrados = computed(() =>
  filtro.value ? props.eventos.filter((evento) => evento.kind === filtro.value) : props.eventos,
)

function alternarFiltro(kind: TimelineEventKind) {
  filtro.value = filtro.value === kind ? null : kind
}

const visiveis = computed(() => filtrados.value.slice(0, props.limite))
const restantes = computed(() => Math.max(filtrados.value.length - props.limite, 0))

const ICONE: Record<TimelineEvent['kind'], string> = {
  consulta: 'ph ph-stethoscope',
  vacina: 'ph ph-syringe',
  exame: 'ph ph-test-tube',
  cirurgia: 'ph ph-first-aid',
  internacao: 'ph ph-bed',
  prescricao: 'ph ph-pill',
  falta: 'ph ph-user-minus',
  observacao: 'ph ph-chat-circle-text',
}

/**
 * O que foi prescrito da última vez, com nome e dose legível — "17.54 mg · 8 h · 5 d", sem o
 * nome do remédio, era exatamente o que o painel existe para evitar.
 */
const prescricoesAnteriores = computed(() =>
  (props.anterior?.conduta.prescricoes ?? []).map((prescricao) => ({
    id: prescricao.id,
    nome: clinico.medicamento(prescricao.calculo.medicamentoId)?.nome ?? '',
    dose: t('clinico.prontuario.timeline.doseAnterior', {
      mg: formato.numero(prescricao.calculo.mgPorAdministracao, 1),
      frequencia: prescricao.calculo.frequenciaHoras,
      duracao: prescricao.calculo.duracaoDias,
    }),
  })),
)

const dataDaAnterior = computed(() =>
  props.anterior
    ? formato.dataCurta(
        clinicClock.dateOf(props.anterior.finalizadoEm ?? props.anterior.abertoEm),
      )
    : '',
)
</script>

<template>
  <aside class="coluna" :aria-label="t('clinico.prontuario.nova.contexto.titulo')">
    <header class="coluna__topo">
      <h2 class="coluna__titulo">
        <span class="ui-ladrilho ui-ladrilho--p" aria-hidden="true">
          <i class="ph ph-clock-counter-clockwise" />
        </span>
        {{ t('clinico.prontuario.nova.contexto.titulo') }}
      </h2>
      <button
        type="button"
        class="coluna__fechar"
        :aria-label="t('clinico.prontuario.timeline.ocultar')"
        :title="t('clinico.prontuario.timeline.ocultar')"
        @click="emit('fechar')"
      >
        <i class="ph ph-x" aria-hidden="true" />
      </button>
    </header>

    <!-- A consulta anterior, em destaque: é o par de toda consulta de retorno. -->
    <section v-if="anterior" class="anterior ui-folha">
      <header class="anterior__topo">
        <span class="anterior__rotulo">
          <i class="ph ph-clock-counter-clockwise" aria-hidden="true" />
          {{ t('clinico.prontuario.timeline.consultaAnterior') }}
        </span>
        <span class="anterior__data ui-num">{{ dataDaAnterior }}</span>
      </header>

      <p class="anterior__titulo">
        {{ clinico.diagnosticoPrincipal(anterior) || anterior.anamnese.queixaPrincipal || '—' }}
      </p>

      <p v-if="anterior.conduta.orientacoes" class="anterior__texto">
        {{ anterior.conduta.orientacoes }}
      </p>

      <ul v-if="prescricoesAnteriores.length > 0" class="anterior__prescricoes">
        <li v-for="prescricao in prescricoesAnteriores" :key="prescricao.id">
          <i class="ph ph-pill" aria-hidden="true" />
          <span>
            <strong v-if="prescricao.nome">{{ prescricao.nome }}</strong>
            <span class="ui-num">{{ prescricao.dose }}</span>
          </span>
        </li>
      </ul>
    </section>

    <section
      v-if="!compacto"
      class="historico"
      :aria-label="t('clinico.prontuario.timeline.titulo')"
    >
      <!--
        Fichas de filtro com a contagem: além de filtrar, respondem "o que já foi feito neste pet"
        antes de qualquer clique — que é a pergunta que traz o vet a esta lista.
      -->
      <div
        v-if="tiposPresentes.length > 1"
        class="filtro"
        role="group"
        :aria-label="t('clinico.comum.filtros')"
      >
        <button
          v-for="tipo in tiposPresentes"
          :key="tipo.kind"
          type="button"
          class="filtro__ficha"
          :aria-pressed="filtro === tipo.kind"
          @click="alternarFiltro(tipo.kind)"
        >
          <i :class="ICONE[tipo.kind]" aria-hidden="true" />
          {{ t(`clinico.prontuario.timeline.kind.${tipo.kind}`) }}
          <span class="filtro__contagem ui-num">{{ tipo.total }}</span>
        </button>
      </div>

      <ol v-if="visiveis.length > 0" class="eventos ui-folha ui-lista">
        <li v-for="evento in visiveis" :key="evento.id" class="evento">
          <span class="evento__marca" :class="`evento__marca--${evento.kind}`" aria-hidden="true">
            <i :class="ICONE[evento.kind]" />
          </span>

          <span class="evento__corpo">
            <span class="evento__data ui-num">
              {{ formato.dataCurta(clinicClock.dateOf(evento.em)) }}
              <span class="evento__tipo">
                · {{ t(`clinico.prontuario.timeline.kind.${evento.kind}`) }}
              </span>
            </span>
            <strong class="evento__titulo">
              {{ evento.titulo || t(`clinico.prontuario.timeline.kind.${evento.kind}`) }}
            </strong>
            <span v-if="evento.resumo" class="evento__resumo">{{ evento.resumo }}</span>
          </span>
        </li>
      </ol>

      <p v-else class="ui-folha ui-vazio">{{ t('clinico.prontuario.timeline.vazio') }}</p>

      <!--
        Sem número: a linha do tempo daqui conta só os eventos ("Ver todos (16)"), e a vista
        Histórico conta também faltas e consultas sem diagnóstico (a aba da capa diz 30). O link
        prometia 16 e abria 30.
      -->
      <RouterLink v-if="restantes > 0 && rotaCompleta" class="ui-mais" :to="rotaCompleta">
        {{ t('clinico.paciente.verHistorico') }}
        <i class="ph ph-arrow-right" aria-hidden="true" />
      </RouterLink>
    </section>

    <RouterLink v-else-if="rotaCompleta && eventos.length > 0" class="ui-mais" :to="rotaCompleta">
      {{ t('clinico.paciente.verHistorico') }}
      <i class="ph ph-arrow-right" aria-hidden="true" />
    </RouterLink>
  </aside>
</template>

<style scoped>
.coluna {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 14px;
}

.coluna__topo {
  display: flex;
  min-height: 32px;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

/* O título da coluna como o de uma seção do kit: ladrilho claro do lugar, 17 px. */
.coluna__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  color: var(--tinta);
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.015em;
}

.coluna__fechar {
  display: grid;
  width: 36px;
  height: 36px;
  place-items: center;
  border: 0;
  border-radius: 10px;
  background: none;
  color: var(--tinta-2);
  cursor: pointer;
  font-size: 17px;
}

.coluna__fechar:hover {
  background: var(--superficie-2);
  color: var(--tinta);
}

.coluna__fechar:focus-visible,
.filtro__ficha:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

/* ------------------------------------------------------------------ consulta anterior */

.anterior {
  position: relative;
  display: grid;
  gap: 8px;
  overflow: hidden;
  padding: 14px 16px 16px 18px;
  border-color: color-mix(in oklab, var(--pj-lugar) 35%, var(--linha));
  background: color-mix(in oklab, var(--pj-lugar-fundo) 60%, var(--superficie));
}

/* O traço na cor do lugar: a mesma marca das linhas que pedem leitura primeiro. */
.anterior::before {
  position: absolute;
  top: 14px;
  bottom: 14px;
  left: 0;
  width: 4px;
  border-radius: 0 4px 4px 0;
  background: var(--pj-lugar);
  content: '';
}

.anterior__topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.anterior__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--pj-lugar-tinta);
  font-size: 13px;
  font-weight: 600;
}

.anterior__rotulo .ph {
  font-size: 15px;
}

.anterior__data {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
}

.anterior__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 600;
  line-height: 1.35;
}

.anterior__texto {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.anterior__prescricoes {
  display: grid;
  gap: 8px;
  margin: 2px 0 0;
  padding: 10px 0 0;
  border-top: 1px solid color-mix(in oklab, var(--pj-lugar) 20%, var(--linha));
  list-style: none;
}

.anterior__prescricoes li {
  display: grid;
  align-items: start;
  gap: 8px;
  grid-template-columns: 16px minmax(0, 1fr);
}

.anterior__prescricoes li > .ph {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 15px;
}

.anterior__prescricoes li > span {
  display: grid;
  gap: 1px;
  line-height: 1.35;
}

.anterior__prescricoes strong {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.anterior__prescricoes .ui-num {
  color: var(--tinta-2);
  font-size: 13px;
}

/* ------------------------------------------------------------------ histórico */

.historico {
  display: grid;
  gap: 10px;
}

.filtro {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.filtro__ficha {
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  border: 1px solid var(--linha);
  border-radius: 999px;
  background: var(--superficie);
  color: var(--tinta-2);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
}

.filtro__ficha .ph {
  font-size: 14px;
}

.filtro__ficha:hover {
  border-color: var(--linha-forte);
  color: var(--tinta);
}

/* Ligado ganha contorno e fundo, não só cor: o estado sobrevive à escala de cinza. */
.filtro__ficha[aria-pressed='true'] {
  border-color: var(--pj-lugar);
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-weight: 600;
}

.filtro__contagem {
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 650;
}

.filtro__ficha[aria-pressed='true'] .filtro__contagem {
  color: inherit;
}

.evento {
  display: grid;
  align-items: start;
  gap: 12px;
  padding: 10px 14px;
  grid-template-columns: 30px minmax(0, 1fr);
}

.evento__marca {
  display: grid;
  width: 30px;
  height: 30px;
  place-items: center;
  border-radius: 9px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 15px;
}

.evento__marca--consulta {
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
}

.evento__marca--vacina {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.evento__marca--cirurgia,
.evento__marca--internacao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.evento__marca--falta {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.evento__corpo {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.evento__data {
  color: var(--tinta-3);
  font-size: 12.5px;
  font-weight: 600;
}

.evento__tipo {
  font-family: var(--font-texto);
  font-weight: 500;
}

.evento__titulo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.evento__resumo {
  display: -webkit-box;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}
</style>
