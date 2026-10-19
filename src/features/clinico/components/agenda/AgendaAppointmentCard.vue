<script setup lang="ts">
/**
 * Cartão de atendimento na linha do tempo do dia.
 *
 * O cartão muda de densidade sozinho conforme a altura disponível: uma vacina de 15 minutos com
 * zoom reduzido tem 22 px e só cabe o nome; uma cirurgia de duas horas cabe tudo. O que nunca
 * some é o paciente.
 *
 * **O estado é a faixa da esquerda e o fundo**, na mesma escada da tabela do dia: agendado neutro,
 * confirmado em azul claro, na recepção em âmbar, em atendimento no azul da Clínica, finalizado
 * esmaecido, falta em vermelho, cancelado riscado e apagado. A coluna já diz de quem é o bloco; o
 * tipo mora no ícone colorido da segunda linha.
 *
 * Falta e cancelamento **continuam visíveis**. Sumir da grade é como a recepção perde a informação
 * de que o horário vagou.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { ICONE_DA_ORIGEM, ICONE_DO_ALERTA } from './agenda-icones'
import type { CardAgenda } from '../../composables/useAgendaDia'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Pet } from '../../data/types'
import { aparenciaDoTipo } from '../../domain/appointment-kind'
import { severidadeMaxima } from '../../domain/conflicts'
import { clinicClock } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    card: CardAgenda
    cor: string
    selecionado?: boolean
    /** Enquanto o gesto está em curso, o cartão segue o ponteiro sem gravar nada. */
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
 * Três faixas de altura decidem o que cabe, medidas contra o que cada linha realmente ocupa: o
 * nome com o rosto pede ~20 px, o tipo mais ~16, o rodapé mais ~16, e ainda o recheio.
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

/** Tipo do atendimento: ícone colorido ao lado do nome do tipo, a chave que a legenda explica. */
const tipo = computed(() => aparenciaDoTipo(props.card.tipo?.kind))

/**
 * Só aviso e impedimento marcam o cartão. Conflito `info` — almoço atravessado, carga do dia,
 * sala fora da indicada — continua no painel do atendimento, onde há espaço para ler.
 */
const avisosVisiveis = computed(() =>
  props.card.conflitos.filter((conflito) => conflito.severity !== 'info'),
)
const cancelado = computed(() => appointment.value.status === 'cancelado')
const faltou = computed(() => appointment.value.status === 'falta')

/**
 * A hora de início só quando ela foge da linha da meia hora (09:15, 16:20): no cartão que começa
 * às 14:00, o eixo ao lado já diz a hora. O fantasma do arraste sempre mostra — é a hora que se
 * está escolhendo.
 */
const mostrarHora = computed(() => props.fantasma || props.card.inicioMin % 30 !== 0)

/** O rosto entra quando o cartão tem altura para ele sem cortar o nome. */
const mostrarRosto = computed(() => props.card.alturaPx >= 24)

/**
 * Marcar falta direto no cartão.
 *
 * Falta se marca em lote, no fim do turno, olhando a grade — não abrindo um atendimento de cada
 * vez. Só aparece para quem já devia ter chegado e não chegou: marcar falta de um horário que
 * ainda não passou é sempre engano.
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

/** Risco do paciente vira ícone por categoria — losango para alergia, mão para manejo. */
const alertasDeRisco = computed(
  () => props.card.pet?.alertas.filter((alerta) => alerta.severidade === 'risco') ?? [],
)

function textoDoAlerta(alerta: Pet['alertas'][number]) {
  return alerta.detalhe
    ? `${formato.alerta(alerta.kind)}: ${alerta.detalhe}`
    : formato.alerta(alerta.kind)
}

const iconeDaOrigem = computed(() => ICONE_DA_ORIGEM[appointment.value.origem] ?? '')

const rotuloAcessivel = computed(() => {
  const partes = [
    formato.intervalo(appointment.value.inicio, appointment.value.fim),
    props.card.pet?.nome ?? '',
    props.card.tipo?.nome ?? '',
    formato.status(appointment.value.status),
    appointment.value.encaixe ? t('clinico.agenda.encaixeMarca') : '',
    iconeDaOrigem.value ? t(`clinico.origem.${appointment.value.origem}`) : '',
    ...alertasDeRisco.value.map(textoDoAlerta),
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
 * Dividir a coluna ao meio espremia cada cartão até "09:15 T…". Na cascata, o cartão que começa
 * depois entra **por cima**, recuado um degrau: como os horários de início diferem, a primeira
 * linha de cada um fica à vista, com quase a largura inteira. Quem fica por cima vem da ordem dos
 * cartões (por horário), sem z-index.
 */
const estilo = computed(() => {
  const recuo = Math.min(props.card.lane, 3) * RECUO_DA_CASCATA

  return {
    top: `${props.card.topPx}px`,
    height: `${props.card.alturaPx}px`,
    insetInlineStart: `calc(${recuo}% + 2px)`,
    width: `calc(${100 - recuo}% - 4px)`,
    '--card-cor': props.cor,
    '--card-tipo': tipo.value.cor,
  }
})
</script>

<template>
  <article
    class="card"
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
    :title="rotuloAcessivel"
    :data-appointment="appointment.id"
    @click="emit('abrir', appointment.id)"
    @keydown.enter.prevent="emit('abrir', appointment.id)"
    @keydown.space.prevent="emit('abrir', appointment.id)"
    @pointerdown="arrastavel && emit('iniciarArraste', $event, 'mover')"
  >
    <!-- Alças de redimensionar: só aparecem quando o cartão tem altura para tanto. -->
    <span
      v-if="arrastavel && faixa !== 'minima'"
      class="card__alca card__alca--topo"
      aria-hidden="true"
      @pointerdown.stop="emit('iniciarArraste', $event, 'inicio')"
    />

    <div class="card__linha" aria-hidden="true">
      <PetAvatar
        v-if="mostrarRosto"
        class="card__rosto"
        :nome="card.pet?.nome ?? ''"
        :iniciais="card.pet?.iniciais ?? ''"
        :especie="card.pet?.especie ?? null"
        :foto-url="card.pet?.fotoUrl ?? ''"
        tamanho="xs"
      />
      <span v-if="mostrarHora" class="card__hora ui-num">{{ formato.hora(appointment.inicio) }}</span>
      <span class="card__nome">{{ card.pet?.nome }}</span>

      <span class="card__icones">
        <i
          v-if="faltou"
          class="ph ph-user-minus card__icone card__icone--falta"
          :title="formato.status('falta')"
        />
        <!-- Marcado pelo responsável, no app ou no link: a mesma marca da tabela do dia. -->
        <i
          v-if="iconeDaOrigem"
          class="card__icone card__icone--neutro"
          :class="iconeDaOrigem"
          :title="t(`clinico.origem.${appointment.origem}`)"
        />
        <component
          :is="ICONE_DO_ALERTA[alerta.kind]"
          v-for="alerta in alertasDeRisco"
          :key="alerta.id"
          class="card__risco"
          weight="fill"
          :title="textoDoAlerta(alerta)"
        />
        <i
          v-if="avisosVisiveis.length > 0"
          class="ph ph-warning-circle card__icone card__icone--aviso"
          :title="avisosVisiveis.map(formato.conflito).join(' · ')"
        />
        <i
          v-if="appointment.linkedGroupId"
          class="ph ph-link card__icone card__icone--neutro"
          :title="t('clinico.agenda.duasSalas')"
        />
      </span>
    </div>

    <div v-if="faixa !== 'minima'" class="card__linha card__linha--secundaria" aria-hidden="true">
      <!--
        Ícone do tipo antes do nome: é o par que deixa o tipo legível sem cor. Some quando o cartão
        não tem altura — o tipo continua no rótulo acessível e no painel do atendimento.
      -->
      <i v-if="tipo.icone" :class="['card__tipo-icone', tipo.icone]" />
      <span class="card__tipo">{{ card.tipo?.nome }}</span>
      <span v-if="appointment.encaixe" class="card__marca">
        {{ t('clinico.agenda.encaixeMarca') }}
      </span>
    </div>

    <!-- O rodapé diz a situação por escrito e até quando o horário está tomado. -->
    <div v-if="faixa === 'completa'" class="card__rodape" aria-hidden="true">
      <span class="card__status">{{ formato.status(appointment.status) }}</span>
      <span class="card__fim ui-num">
        {{ t('clinico.agenda.tabela.ate', { hora: formato.hora(appointment.fim) }) }}
      </span>
    </div>

    <!--
      Falta a um clique, sem abrir o atendimento. Aparece no hover e no foco; em tela de toque fica
      sempre visível, porque dedo não tem hover e a ação ficaria inalcançável.
    -->
    <Button
      v-if="podeMarcarFalta"
      class="card__falta"
      icon="ph ph-user-minus"
      severity="secondary"
      text
      size="small"
      :title="t('clinico.faltas.marcar')"
      :aria-label="`${t('clinico.faltas.marcar')}: ${card.pet?.nome ?? ''}`"
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
/*
 * A cor do estado num lugar só: a faixa da esquerda (`--estado`), o fundo (`--estado-fundo`), a
 * borda (`--estado-borda`) e a tinta da palavra do rodapé (`--estado-tinta`).
 */
.card {
  --estado: var(--linha-forte);
  --estado-fundo: var(--superficie);
  --estado-borda: var(--linha);
  --estado-tinta: var(--tinta-2);

  position: absolute;
  display: grid;
  align-content: start;
  gap: 1px;
  overflow: hidden;
  padding: 3px 6px 3px 6px;
  border: 1px solid var(--estado-borda);
  border-inline-start: 3px solid var(--estado);
  border-radius: 7px;
  background: var(--estado-fundo);
  color: var(--tinta);
  cursor: grab;
  touch-action: none;
  transition: box-shadow var(--pj-tempo-curto) var(--pj-curva-chega);
}

.card:hover {
  z-index: 3;
  box-shadow: var(--sombra-1);
}

.card:focus-visible,
.card--selecionado {
  z-index: 4;
  outline: 2px solid var(--clinica);
  outline-offset: 1px;
}

.card--fantasma {
  z-index: 6;
  box-shadow: var(--sombra-2);
  opacity: 0.85;
  pointer-events: none;
}

/* Degrau da cascata: um respiro de papel separa o cartão de cima do de baixo. */
.card--empilhado {
  box-shadow:
    -3px 0 0 var(--superficie),
    var(--sombra-1);
}

/* ------------------------------------------------------------------------- os estados */

.card--confirmado {
  --estado: color-mix(in oklab, var(--clinica) 55%, var(--superficie));
  --estado-fundo: color-mix(in oklab, var(--clinica-fundo) 45%, var(--superficie));
  --estado-tinta: var(--clinica-tinta);
}

.card--aguardando {
  --estado: var(--atencao);
  --estado-fundo: color-mix(in oklab, var(--atencao-fundo) 80%, var(--superficie));
  --estado-borda: color-mix(in oklab, var(--atencao) 35%, var(--linha));
  --estado-tinta: var(--atencao-tinta);
}

.card--em-atendimento {
  --estado: var(--clinica);
  --estado-fundo: var(--clinica-fundo);
  --estado-borda: color-mix(in oklab, var(--clinica) 40%, var(--linha));
  --estado-tinta: var(--clinica-tinta);
}

/* Finalizado é história do dia, não tarefa: perde peso, mas continua legível. */
.card--finalizado {
  --estado: var(--linha);
  --estado-fundo: var(--superficie-2);
  --estado-tinta: var(--tinta-3);

  color: var(--tinta-2);
}

.card--finalizado .card__rosto {
  opacity: 0.7;
}

.card--falta {
  --estado: var(--risco);
  --estado-fundo: color-mix(in oklab, var(--risco-fundo) 55%, var(--superficie));
  --estado-borda: color-mix(in oklab, var(--risco) 30%, var(--linha));
  --estado-tinta: var(--risco-tinta);
}

.card--falta .card__nome {
  color: var(--tinta-2);
}

/* Cancelado: riscado e apagado, mas presente. O risco é o que sobrevive à escala de cinza. */
.card--cancelado {
  --estado-fundo: transparent;
  --estado-tinta: var(--tinta-3);

  border-style: dashed;
  border-inline-start-style: solid;
  color: var(--tinta-2);
  opacity: 0.65;
}

.card--cancelado .card__nome,
.card--cancelado .card__hora {
  text-decoration: line-through;
}

/* Aviso de choque: a borda puxa para o âmbar, além do ícone. */
.card--aviso {
  --estado-borda: color-mix(in oklab, var(--atencao) 45%, var(--linha));
}

/* --------------------------------------------------------------------------- as linhas */

.card__linha {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 5px;
  line-height: 1.3;
}

.card__rosto {
  flex: none;
}

.card__hora {
  flex: none;
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 600;
}

.card__nome {
  /* O nome não cede tudo aos ícones: "Ni…" não identifica ninguém. */
  min-width: min(2.75rem, 40%);
  flex: 1;
  overflow: hidden;
  font-size: 13px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__icones {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 4px;
}

.card__icone {
  font-size: 13px;
}

.card__icone--neutro {
  color: var(--tinta-3);
}

.card__icone--aviso {
  color: var(--atencao-tinta);
}

.card__icone--falta {
  color: var(--risco-tinta);
}

.card__risco {
  width: 13px;
  height: 13px;
  flex: none;
  color: var(--risco-tinta);
}

.card__linha--secundaria {
  color: var(--tinta-2);
  font-size: 12px;
}

.card__tipo-icone {
  flex: none;
  color: var(--card-tipo);
  font-size: 13px;
}

.card__tipo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card__marca {
  flex: none;
  padding: 0 6px;
  border-radius: 6px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 11px;
  font-weight: 600;
}

/* Rodapé não quebra linha: "Finalizado até 14:15" partido ao meio vira ruído, não dado. */
.card__rodape {
  display: flex;
  overflow: hidden;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  margin-top: auto;
  padding-top: 2px;
  font-size: 12px;
  white-space: nowrap;
}

.card__status {
  min-width: 0;
  overflow: hidden;
  color: var(--estado-tinta);
  font-weight: 600;
  text-overflow: ellipsis;
}

.card__fim {
  flex: none;
  color: var(--tinta-3);
}

.card--completa {
  grid-template-rows: auto auto 1fr;
  padding-block: 5px;
}

.card--minima {
  padding-block: 1px;
}

.card--minima .card__linha {
  line-height: 1.15;
}

/*
 * Botão de falta: canto superior direito, por cima do cartão. Invisível até o hover para não
 * competir com o nome — numa grade de 40 atendimentos, 40 ícones permanentes viram textura. No
 * foco por teclado aparece igual, senão a ação existiria só para quem usa mouse.
 */
.card__falta.p-button {
  position: absolute;
  top: 2px;
  inset-inline-end: 2px;
  z-index: 5;
  width: 24px;
  height: 24px;
  padding: 0;
  border-radius: 6px;
  /* Opaco: o botão fica por cima do nome do paciente e não pode deixá-lo aparecer por baixo. */
  background: var(--superficie);
  box-shadow: var(--sombra-1);
  color: var(--atencao-tinta);
  opacity: 0;
  transition: opacity var(--pj-tempo-curto) var(--pj-curva-chega);
}

.card__falta :deep(.p-button-icon) {
  font-size: 14px;
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

/* Cartão mínimo não tem altura para o botão sem cobrir o nome. */
.card--minima .card__falta.p-button {
  display: none;
}

/* Alças de 6 px: alvo de mouse, não de dedo. */
.card__alca {
  position: absolute;
  inset-inline-start: 0;
  width: 100%;
  height: 6px;
  cursor: ns-resize;
}

.card__alca--topo {
  top: 0;
}

.card__alca--base {
  bottom: 0;
}

@media (prefers-reduced-motion: reduce) {
  .card,
  .card__falta.p-button {
    transition: none;
  }
}
</style>
