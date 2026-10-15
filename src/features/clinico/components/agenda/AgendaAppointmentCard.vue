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
 * Três faixas de altura decidem o que cabe, medidas contra o que cada linha realmente ocupa: com o
 * texto em 12,5 px, hora e nome pedem ~16 px, o tipo mais ~15, o rodapé mais ~15, e ainda o
 * padding. Os limites acompanham o texto — com 11 px a grade cabia mais e não se lia.
 */
const faixa = computed(() => {
  if (props.card.alturaPx < 30) {
    return 'minima'
  }

  if (props.card.alturaPx < 58) {
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

const alertaDeRisco = computed(
  () => props.card.pet?.alertas.find((alerta) => alerta.severidade === 'risco') ?? null,
)

/**
 * O alerta de risco escrito no card — "Alergia" —, e não só o triângulo.
 *
 * O triângulo dizia o que era apenas passando o mouse, e tablet não tem mouse: a recepção via o
 * aviso e precisava abrir o atendimento para saber se era alergia ou temperamento. A palavra é
 * curta; o detalhe (a que substância) continua na dica e no drawer.
 */
const palavraDoRisco = computed(() =>
  alertaDeRisco.value ? formato.alerta(alertaDeRisco.value.kind) : '',
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

/** Recuo de cada degrau da cascata, em % da coluna. Três degraus no máximo. */
const RECUO_DA_CASCATA = 16

/**
 * Sobreposição em cascata, e não em fatias.
 *
 * Dividir a coluna ao meio (ou em três) espremia cada card até "09:15 T…" — a hora e duas letras
 * do nome, em 60 px. Na cascata, o card que começa depois entra **por cima**, recuado um degrau:
 * como os horários de início diferem, a primeira linha de cada um (hora e nome) fica à vista no
 * próprio topo, com quase a largura inteira. O de baixo continua clicável pela faixa da esquerda.
 *
 * Quem fica por cima é quem começa depois, e isso vem da ordem dos cards (por horário), sem
 * z-index: pela faixa, o das 09:15 ficava por baixo do das 09:00 e sumia.
 */
const estilo = computed(() => {
  const recuo = Math.min(props.card.lane, 3) * RECUO_DA_CASCATA

  return {
    top: `${props.card.topPx}px`,
    height: `${props.card.alturaPx}px`,
    insetInlineStart: `calc(${recuo}% + 1px)`,
    width: `calc(${100 - recuo}% - 2px)`,
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
        'card--empilhado': card.lane > 0,
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
      <!-- Marcado pelo responsável, no app ou no link: a mesma marca da tabela do dia. -->
      <i
        v-if="appointment.origem === 'app' || appointment.origem === 'link'"
        class="ph card__icone"
        :class="appointment.origem === 'app' ? 'ph-device-mobile' : 'ph-globe-simple'"
        :title="t(`clinico.origem.${appointment.origem}`)"
      />

      <span
        v-if="alertaDeRisco"
        class="card__risco"
        :title="`${palavraDoRisco} — ${alertaDeRisco.detalhe}`"
      >
        {{ palavraDoRisco }}
      </span>
      <i
        v-if="avisosVisiveis.length > 0"
        class="ph ph-warning-circle card__icone card__icone--aviso"
        :title="avisosVisiveis.map(formato.conflito).join(' · ')"
      />
      <i
        v-if="appointment.linkedGroupId"
        class="ph ph-link card__icone"
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
      icon="ph ph-user-minus"
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
  /*
   * O bloco branco (redesenho de 30/09/2026). Saíram a faixa do tipo na borda esquerda e o fundo
   * tingido pela cor do profissional: a grade inteira era um mosaico de tons, e o que muda de
   * estado não saltava. O tipo mora no ícone colorido (`.card__tipo-icone`), o profissional na
   * coluna, e a cor do fundo ficou para o estado — em atendimento, aguardando, finalizado.
   */
  border: 1px solid var(--clinic-line);
  border-radius: 0.55rem;
  background: var(--clinic-surface);
  box-shadow: 0 1px 2px rgb(20 32 28 / 6%);
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

/* 12,5 px na primeira linha: com 11 px a agenda inteira era texto miúdo (138 trechos abaixo de 12). */
.card__hora {
  flex: 0 0 auto;
  font-size: 0.78rem;
  font-weight: 800;
}

.card__nome {
  /* O nome não cede tudo ao selo de risco: "Ni…" não identifica ninguém. */
  min-width: min(2.75rem, 40%);
  overflow: hidden;
  flex: 1;
  font-size: 0.78rem;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__icone {
  flex: 0 0 auto;
  font-size: 0.7rem;
}

/* O alerta de risco por escrito: selo coral, curto, que não cede lugar ao nome. */
.card__risco {
  flex: 0 1 auto;
  max-width: 6.5rem;
  overflow: hidden;
  padding: 0 0.3rem;
  border-radius: 4px;
  background: var(--hc-coral-fundo);
  color: var(--hc-coral-tinta);
  font-size: 0.6875rem;
  font-weight: 700;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Degrau da cascata: um respiro de sombra separa o card de cima do de baixo. */
.card--empilhado {
  box-shadow:
    -2px 0 0 var(--clinic-surface),
    0 2px 6px rgb(20 32 28 / 12%);
}

.card__icone--risco {
  color: var(--clinic-risk-text);
}

.card__icone--aviso {
  color: var(--clinic-attention-text);
}

.card__linha--secundaria {
  color: var(--clinic-muted);
  font-size: 0.72rem;
}

.card__tipo-icone {
  flex: 0 0 auto;
  color: var(--card-tipo);
  font-size: 0.68rem;
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
  font-size: 0.72rem;
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
  background: transparent;
  box-shadow: none;
  opacity: 0.62;
}

.card--liberado .card__nome,
.card--liberado .card__hora {
  text-decoration: line-through;
}

/* O estado pinta o bloco inteiro, e é a única cor de fundo da grade: o que está acontecendo salta. */
.card--falta {
  border-color: color-mix(in srgb, var(--clinic-risk-text) 45%, transparent);
}

.card--em-atendimento {
  border-color: color-mix(in srgb, var(--clinic-accent) 55%, transparent);
  background: var(--clinic-accent-tint);
}

.card--aguardando {
  border-color: color-mix(in srgb, var(--clinic-attention-text) 55%, transparent);
  background: color-mix(in srgb, var(--clinic-attention-bg) 55%, var(--clinic-surface));
}

/* Finalizado é história do dia, não tarefa: perde saturação e peso, mas continua legível. */
.card--finalizado {
  border-color: var(--clinic-line);
  background: var(--clinic-surface-soft);
  box-shadow: none;
  color: var(--clinic-muted);
}

.card--finalizado .card__nome {
  font-weight: 650;
}

/*
 * O encaixe se diz pela marca "Encaixe" (`.card__marca`), e não mais por listras no fundo: o
 * listrado competia com a cor do estado, que agora é a única cor de fundo do bloco.
 */

.card--aviso {
  border-color: color-mix(in srgb, var(--clinic-attention-text) 45%, var(--clinic-line));
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
