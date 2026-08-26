<script setup lang="ts">
/**
 * Card de atendimento na grade do dia.
 *
 * O card muda de densidade sozinho conforme a altura disponível: uma vacina de 15 minutos com
 * zoom reduzido tem 10 px e só cabe hora e nome; uma cirurgia de duas horas cabe tudo. O que
 * nunca some é a hora e o nome do paciente.
 *
 * Falta e cancelamento **continuam visíveis** — riscados e esmaecidos. Sumir da grade é como
 * a recepção perde a informação de que o horário vagou.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CardAgenda } from '../../composables/useAgendaDia'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { severidadeMaxima } from '../../domain/conflicts'

const props = withDefaults(
  defineProps<{
    card: CardAgenda
    cor: string
    selecionado?: boolean
    /** Enquanto o gesto está em curso, o card segue o ponteiro sem gravar nada. */
    fantasma?: boolean
    arrastavel?: boolean
  }>(),
  { selecionado: false, fantasma: false, arrastavel: true },
)

const emit = defineEmits<{
  abrir: [id: string]
  iniciarArraste: [evento: PointerEvent, modo: 'mover' | 'inicio' | 'fim']
}>()

const { t } = useI18n()
const formato = useClinicFormat()

const appointment = computed(() => props.card.appointment)

/**
 * Três faixas de altura decidem o que cabe, medidas contra o que cada linha realmente ocupa:
 * hora e nome pedem ~16 px, o tipo mais ~14, o rodapé mais ~15, e ainda o padding. Os limites
 * anteriores eram otimistas e a segunda linha saía cortada ao meio.
 */
const faixa = computed(() => {
  if (props.card.alturaPx < 26) {
    return 'minima'
  }

  if (props.card.alturaPx < 54) {
    return 'media'
  }

  return 'completa'
})

const severidade = computed(() => severidadeMaxima(props.card.conflitos))

/**
 * Só aviso e impedimento marcam o card. Conflito `info` — almoço atravessado, carga do dia,
 * sala fora da indicada — continua no drawer, onde há espaço para ler. Marcar os três níveis
 * põe um ícone em quase todo card, e um ícone que aparece sempre deixa de ser lido.
 */
const avisosVisiveis = computed(() =>
  props.card.conflitos.filter((conflito) => conflito.severity !== 'info'),
)
const cancelado = computed(() => appointment.value.status === 'cancelado')
const faltou = computed(() => appointment.value.status === 'falta')

const alertaDeRisco = computed(() =>
  props.card.pet?.alertas.find((alerta) => alerta.severidade === 'risco') ?? null,
)

const rotuloAcessivel = computed(() => {
  const partes = [
    formato.intervalo(appointment.value.inicio, appointment.value.fim),
    props.card.pet?.nome ?? '',
    props.card.tipo?.nome ?? '',
    formato.status(appointment.value.status),
  ]

  if (avisosVisiveis.value.length > 0) {
    partes.push(
      t(
        'clinico.agenda.conflitosNoCard',
        { contagem: avisosVisiveis.value.length },
        avisosVisiveis.value.length,
      ),
    )
  }

  return partes.filter(Boolean).join(' · ')
})

const estilo = computed(() => {
  /** Largura por faixa de sobreposição: dois no mesmo horário dividem a coluna ao meio. */
  const largura = 100 / props.card.lanes

  return {
    top: `${props.card.topPx}px`,
    height: `${props.card.alturaPx}px`,
    left: `calc(${props.card.lane * largura}% + 1px)`,
    width: `calc(${largura}% - 2px)`,
    '--card-cor': props.cor,
  }
})
</script>

<template>
  <article
    class="card clinic-focusable"
    :class="[
      `card--${faixa}`,
      `card--${appointment.status}`,
      {
        'card--selecionado': selecionado,
        'card--fantasma': fantasma,
        'card--liberado': cancelado || faltou,
        'card--encaixe': appointment.encaixe,
        'card--aviso': severidade === 'warning' || severidade === 'blocking',
      },
    ]"
    :style="estilo"
    tabindex="0"
    role="button"
    :aria-label="rotuloAcessivel"
    :data-appointment="appointment.id"
    @click="emit('abrir', appointment.id)"
    @keydown.enter.prevent="emit('abrir', appointment.id)"
    @keydown.space.prevent="emit('abrir', appointment.id)"
    @pointerdown="arrastavel && emit('iniciarArraste', $event, 'mover')"
  >
    <!-- Alças de redimensionar: só aparecem quando o card tem altura para tanto. -->
    <span
      v-if="arrastavel && faixa !== 'minima'"
      class="card__alca card__alca--topo"
      aria-hidden="true"
      @pointerdown.stop="emit('iniciarArraste', $event, 'inicio')"
    />

    <div class="card__linha">
      <span class="card__hora clinic-value">{{ formato.hora(appointment.inicio) }}</span>
      <span class="card__nome">{{ card.pet?.nome }}</span>

      <i
        v-if="alertaDeRisco"
        class="pi pi-exclamation-triangle card__icone card__icone--risco"
        :title="`${formato.alerta(alertaDeRisco.kind)} — ${alertaDeRisco.detalhe}`"
      />
      <i
        v-if="avisosVisiveis.length > 0"
        class="pi pi-exclamation-circle card__icone card__icone--aviso"
        :title="avisosVisiveis.map(formato.conflito).join(' · ')"
      />
      <i
        v-if="appointment.linkedGroupId"
        class="pi pi-link card__icone"
        :title="t('clinico.agenda.duasSalas')"
      />
    </div>

    <div v-if="faixa !== 'minima'" class="card__linha card__linha--secundaria">
      <span class="card__tipo">{{ card.tipo?.nome }}</span>
      <span v-if="appointment.encaixe" class="card__marca">
        {{ t('clinico.agenda.encaixeMarca') }}
      </span>
    </div>

    <!--
      O rodapé mostra só a situação e a hora de término. O início já está na primeira linha, e
      repeti-lo espremia "Finalizado" em "Finaliza…".
    -->
    <div v-if="faixa === 'completa'" class="card__rodape">
      <span class="card__status">{{ formato.status(appointment.status) }}</span>
      <span class="card__duracao clinic-value">{{ formato.hora(appointment.fim) }}</span>
    </div>

    <span
      v-if="arrastavel && faixa !== 'minima'"
      class="card__alca card__alca--base"
      aria-hidden="true"
      @pointerdown.stop="emit('iniciarArraste', $event, 'fim')"
    />
  </article>
</template>

<style scoped>
.card {
  position: absolute;
  display: grid;
  align-content: start;
  overflow: hidden;
  padding: 2px 6px;
  border: 1px solid color-mix(in srgb, var(--card-cor) 52%, var(--clinic-line));
  border-radius: 0.5rem;
  background: color-mix(in srgb, var(--card-cor) 10%, var(--clinic-surface));
  color: var(--clinic-text);
  cursor: grab;
  touch-action: none;
  transition:
    box-shadow 120ms ease,
    transform 120ms ease;
}

.card:hover {
  box-shadow: var(--clinic-shadow-float);
  z-index: 3;
}

.card--selecionado {
  border-color: var(--clinic-accent-strong);
  box-shadow: var(--clinic-focus-ring);
  z-index: 4;
}

.card--fantasma {
  opacity: 0.75;
  pointer-events: none;
  z-index: 6;
}

.card__linha {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 0.3rem;
  line-height: 1.25;
}

.card__hora {
  flex: 0 0 auto;
  font-size: var(--clinic-font-label);
  font-weight: 800;
}

.card__nome {
  min-width: 0;
  overflow: hidden;
  flex: 1;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__icone {
  flex: 0 0 auto;
  font-size: 0.62rem;
}

.card__icone--risco {
  color: var(--clinic-risk-text);
}

.card__icone--aviso {
  color: var(--clinic-attention-text);
}

.card__linha--secundaria {
  color: var(--clinic-muted);
  font-size: calc(var(--clinic-font-label) - 0.5px);
}

.card__tipo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__marca {
  flex: 0 0 auto;
  padding: 0 0.25rem;
  border: 1px dashed var(--clinic-attention-line);
  border-radius: 0.3rem;
  color: var(--clinic-attention-text);
  font-weight: 800;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

/* Rodapé não quebra linha: "Finalizado 12:45–14:15" partido ao meio vira ruído, não dado. */
.card__rodape {
  display: flex;
  overflow: hidden;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.3rem;
  padding-top: 2px;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  white-space: nowrap;
}

.card__status {
  min-width: 0;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
}

.card__duracao {
  flex: 0 0 auto;
}

/* Alças de 6 px: alvo de mouse, não de dedo. */
.card__alca {
  position: absolute;
  left: 0;
  height: 6px;
  width: 100%;
  cursor: ns-resize;
}

.card__alca--topo {
  top: 0;
}

.card__alca--base {
  bottom: 0;
}

/*
 * Cancelado e falta: esmaecidos e riscados, mas presentes. O risco é o que sobrevive à
 * escala de cinza — a opacidade sozinha não diria "cancelado".
 */
.card--liberado {
  border-style: dashed;
  background: var(--clinic-surface);
  opacity: 0.62;
}

.card--liberado .card__nome,
.card--liberado .card__hora {
  text-decoration: line-through;
}

.card--falta {
  border-color: var(--clinic-risk-line);
}

.card--em-atendimento {
  border-color: var(--clinic-accent-strong);
  background: color-mix(in srgb, var(--card-cor) 30%, var(--clinic-surface));
}

.card--aguardando {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--clinic-attention-text) 45%, transparent);
}

/* Finalizado é história do dia, não tarefa: perde saturação e peso, mas continua legível. */
.card--finalizado {
  border-color: var(--clinic-line);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
}

.card--finalizado .card__nome {
  font-weight: 650;
}

/* Encaixe entra fora da grade e precisa parecer o que é: listrado, não igual aos demais. */
.card--encaixe {
  background-image: repeating-linear-gradient(
    135deg,
    transparent 0 6px,
    color-mix(in srgb, var(--clinic-attention-text) 12%, transparent) 6px 12px
  );
}

.card--aviso {
  border-top-color: var(--clinic-attention-text);
  border-right-color: var(--clinic-attention-text);
  border-bottom-color: var(--clinic-attention-text);
}

/*
 * A consulta de 30 min é o card mais comum da grade — 28 px no zoom médio. As entrelinhas da
 * variante média são apertadas de propósito para que ela caiba com o tipo do atendimento; sem
 * isso a segunda linha saía cortada ao meio, que é pior que não existir.
 */
.card--media {
  padding-block: 0;
}

.card--media .card__linha {
  line-height: 1.18;
}

.card--minima {
  padding-block: 0;
}

.card--minima .card__linha {
  line-height: 1.05;
}
</style>
