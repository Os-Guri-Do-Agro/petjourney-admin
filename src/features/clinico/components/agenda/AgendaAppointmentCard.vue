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
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { CardAgenda } from '../../composables/useAgendaDia'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { aparenciaDoTipo } from '../../domain/appointment-kind'
import { severidadeMaxima } from '../../domain/conflicts'
import { clinicClock } from '../../stores/clinico'

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
  marcarFalta: [id: string]
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
 * Tipo do atendimento: acento na borda esquerda e ícone ao lado do nome.
 *
 * A cor do card já pertence à **coluna** (o profissional, ou a sala) e não pode ser
 * requisitada pelo tipo sem desmanchar a leitura de "de quem é este bloco". Por isso o tipo
 * ganha a faixa da esquerda — território livre — e o ícone, que é o que sobrevive à escala de
 * cinza e a quem não distingue os sete pastéis.
 */
const tipo = computed(() => aparenciaDoTipo(props.card.tipo?.kind))

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

/**
 * Marcar falta direto no card.
 *
 * Antes a ação existia **só** no rodapé do drawer, atrás de dois cliques, e nada no card
 * sugeria que ela morava lá. Falta se marca em lote, no fim do turno, olhando a grade — não
 * abrindo um atendimento de cada vez.
 *
 * Só aparece para quem já devia ter chegado e não chegou: marcar falta de um horário que ainda
 * não passou é sempre engano, e um botão que só faz sentido depois das 14h não pode estar
 * disponível às 9h.
 */
const podeMarcarFalta = computed(() => {
  if (props.fantasma || !props.arrastavel) {
    return false
  }

  if (!['agendado', 'confirmado'].includes(appointment.value.status)) {
    return false
  }

  return clinicClock.nowIso() > appointment.value.inicio
})

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
    insetInlineStart: `calc(${props.card.lane * largura}% + 1px)`,
    width: `calc(${largura}% - 2px)`,
    '--card-cor': props.cor,
    '--card-tipo': tipo.value.cor,
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
      <!--
        Ícone do tipo antes do nome: junto com a faixa da esquerda, é o par que deixa o tipo
        legível sem cor. Some com o nome quando o card não tem altura — nessa faixa nada além
        de hora e paciente cabe, e o tipo continua no rótulo acessível e no drawer.
      -->
      <i v-if="tipo.icone" :class="['card__tipo-icone', tipo.icone]" aria-hidden="true" />
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

    <!--
      Falta a um clique, sem abrir o atendimento.
      Aparece no hover e no foco; em tela de toque fica sempre visível, porque dedo não tem
      hover e a ação ficaria inalcançável.
    -->
    <Button
      v-if="podeMarcarFalta"
      class="card__falta"
      icon="pi pi-user-minus"
      severity="warn"
      outlined
      size="small"
      :title="t('clinico.faltas.marcar')"
      :aria-label="`${t('clinico.faltas.marcar')} — ${card.pet?.nome ?? ''}`"
      @click.stop="emit('marcarFalta', appointment.id)"
      @pointerdown.stop
    />

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
  padding-block: 2px;
  padding-inline: 8px 6px;
  border: 1px solid color-mix(in srgb, var(--card-cor) 52%, var(--clinic-line));
  /* A faixa do tipo. Fica na borda, não em pseudo-elemento, para sobreviver ao overflow. */
  border-inline-start: 3px solid var(--card-tipo);
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
  border-block-color: var(--clinic-accent-strong);
  border-inline-end-color: var(--clinic-accent-strong);
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

.card__tipo-icone {
  flex: 0 0 auto;
  color: var(--card-tipo);
  font-size: 0.6rem;
  /* Alinhado pela linha de base do texto ao lado, não pelo centro da caixa. */
  transform: translateY(0.5px);
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

/*
 * Botão de falta: canto superior direito, por cima do card.
 *
 * Fica invisível até o hover para não competir com o nome do paciente — numa grade de 40
 * atendimentos, 40 ícones permanentes viram textura. No foco por teclado aparece igual, senão
 * a ação existiria só para quem usa mouse.
 */
.card__falta.p-button {
  position: absolute;
  top: 1px;
  inset-inline-end: 1px;
  z-index: 5;
  width: 18px;
  height: 18px;
  padding: 0;
  border-radius: 0.35rem;
  /* Opaco: o botão fica por cima do nome do paciente e não pode deixá-lo aparecer por baixo. */
  background: var(--clinic-surface);
  font-size: 0.6rem;
  opacity: 0;
  transition: opacity 120ms ease;
}

.card__falta :deep(.p-button-icon) {
  font-size: 0.6rem;
}

.card:hover .card__falta.p-button,
.card__falta.p-button:focus-visible {
  opacity: 1;
}

/* Dedo e caneta não têm hover: em toque, a ação é sempre visível. */
@media (hover: none) {
  .card__falta.p-button {
    opacity: 1;
  }
}

/* Card mínimo não tem altura para o botão sem cobrir a hora. */
.card--minima .card__falta.p-button {
  display: none;
}

/* Alças de 6 px: alvo de mouse, não de dedo. */
.card__alca {
  position: absolute;
  inset-inline-start: 0;
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
  /* A faixa do tipo continua sólida: tracejar 3 px a transforma numa coluna de pontos. */
  border-inline-start-style: solid;
  background: var(--clinic-surface);
  opacity: 0.62;
}

.card--liberado .card__nome,
.card--liberado .card__hora {
  text-decoration: line-through;
}

/*
 * Toda variante de estado repinta as bordas **menos a esquerda**: aquela é a faixa do tipo, e
 * é a única coisa no card que não muda quando o paciente falta ou o atendimento termina.
 * Perdê-la faria a legenda mentir justamente nos cards que a recepção revisita no fim do dia.
 */
.card--falta {
  border-block-color: var(--clinic-risk-line);
  border-inline-end-color: var(--clinic-risk-line);
}

.card--em-atendimento {
  border-block-color: var(--clinic-accent-strong);
  border-inline-end-color: var(--clinic-accent-strong);
  background: color-mix(in srgb, var(--card-cor) 30%, var(--clinic-surface));
}

.card--aguardando {
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--clinic-attention-text) 45%, transparent);
}

/* Finalizado é história do dia, não tarefa: perde saturação e peso, mas continua legível. */
.card--finalizado {
  border-block-color: var(--clinic-line);
  border-inline-end-color: var(--clinic-line);
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
  border-block-color: var(--clinic-attention-text);
  border-inline-end-color: var(--clinic-attention-text);
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
