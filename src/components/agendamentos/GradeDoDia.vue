<script setup lang="ts">
/**
 * A grade do dia (E3-02, guia e3 2.2): uma coluna por profissional ou por sala, na ordem que a API
 * manda, com a régua de horas à esquerda.
 *
 * Atrás dos cartões, o fora do expediente do profissional, os bloqueios que valem para a coluna e
 * os horários segurados por pedido online. Clicar num vazio marca ali; arrastar um cartão move
 * (para outra hora e, se cair em outra coluna, para o profissional ou a sala dela). O horário cai
 * no passo da grade da política. O que o servidor diz do novo horário (os avisos) vem depois de
 * gravar, sem impedir.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import {
  cartoesDaColuna,
  fundoDaColuna,
  horaDe,
  janelaDoDia,
  minutosDoInstante,
  noPasso,
  severidadeMaxima,
  STATUS_RISCADOS,
  type CartaoNaGrade,
} from '@/components/agendamentos/leitura-da-agenda'
import {
  acoesDaSituacao,
  type AgendaDoDia,
  type Agendamento,
  type ColunaDaAgenda,
} from '@/service/parceiro/agenda-service'

const props = defineProps<{
  dia: AgendaDoDia
  passo: number
  podeEscrever: boolean
  ocultarRiscados: boolean
  /** Os minutos de agora na parede da clínica, quando o dia é hoje. */
  agora: number | null
  nomeDoTipo: (id: string) => string
}>()

const emit = defineEmits<{
  abrir: [agendamento: Agendamento]
  criar: [dados: { coluna: ColunaDaAgenda; inicioMin: number }]
  mover: [
    dados: {
      agendamento: Agendamento
      origem: ColunaDaAgenda
      destino: ColunaDaAgenda
      inicioMin: number
    },
  ]
}>()

const { t } = useI18n()

/** Pixels por minuto: uma hora tem 96 px (o cartão de 30 min cabe as duas linhas). */
const PX = 1.6

const janela = computed(() => janelaDoDia(props.dia))
const altura = computed(() => (janela.value.fim - janela.value.inicio) * PX)

const horas = computed(() => {
  const lista: number[] = []
  for (let minuto = janela.value.inicio; minuto < janela.value.fim; minuto += 60) lista.push(minuto)
  return lista
})

const colunas = computed(() =>
  props.dia.colunas.map((coluna) => ({
    coluna,
    cartoes: cartoesDaColuna(props.dia, coluna, { ocultarRiscados: props.ocultarRiscados }),
    fundo: fundoDaColuna(props.dia, coluna, janela.value),
    nota: notaDaColuna(coluna),
  })),
)

function notaDaColuna(coluna: ColunaDaAgenda) {
  if (coluna.tipo === 'SALA') {
    const sala = props.dia.salas.find((item) => item.id === coluna.id)
    return sala && !sala.ativa ? t('agendamentos.grade.salaDesativada') : ''
  }
  const profissional = props.dia.profissionais.find((item) => item.id === coluna.id)
  if (!profissional) return ''
  if (!profissional.trabalhaNoDia) return t('agendamentos.grade.folga')
  return profissional.faixas.map((faixa) => `${faixa.inicio}–${faixa.fim}`).join(' · ')
}

function topo(minutos: number) {
  return `${(minutos - janela.value.inicio) * PX}px`
}

function altoDe(inicio: number, fim: number) {
  return `${Math.max((fim - inicio) * PX, 20)}px`
}

function estiloDoCartao(cartao: CartaoNaGrade) {
  const largura = 100 / cartao.faixas
  return {
    top: topo(cartao.inicioMin),
    height: altoDe(cartao.inicioMin, cartao.fimMin),
    left: `calc(${cartao.faixa * largura}% + 2px)`,
    width: `calc(${largura}% - 4px)`,
  }
}

/** O aviso que pesa no cartão: só o que não é informação, e nunca no riscado. */
function avisoDo(agendamento: Agendamento) {
  if (STATUS_RISCADOS.includes(agendamento.status)) return null
  const severidade = severidadeMaxima(agendamento.conflitos.filter((c) => c.severity !== 'info'))
  return severidade
}

const ICONE_DO_STATUS: Record<Agendamento['status'], string> = {
  AGENDADO: '',
  CONFIRMADO: 'ph ph-check-circle',
  AGUARDANDO: 'ph ph-hourglass-medium',
  EM_ATENDIMENTO: 'ph ph-stethoscope',
  FINALIZADO: 'ph ph-check-square',
  FALTA: 'ph ph-user-minus',
  CANCELADO: 'ph ph-x-circle',
}

function rotuloDoCartao(agendamento: Agendamento) {
  return [
    `${agendamento.inicio.slice(11, 16)}`,
    agendamento.paciente.nome,
    props.nomeDoTipo(agendamento.tipoId),
    t(`agendamentos.status.${agendamento.status}`),
  ].join(', ')
}

/* ---------------------------------------------------------------------------- marcar */

/** O minuto onde o ponteiro está dentro da coluna, no passo da grade. */
function minutoDoPonteiro(evento: MouseEvent, elemento: HTMLElement, deslocamento = 0) {
  const caixa = elemento.getBoundingClientRect()
  const minuto = janela.value.inicio + (evento.clientY - caixa.top) / PX - deslocamento
  return noPasso(minuto, props.passo)
}

function clicarNoVazio(evento: MouseEvent, coluna: ColunaDaAgenda) {
  if (!props.podeEscrever || arrastando.value) return
  /* O clique pode vir de uma faixa de fundo: a conta é sempre pelo topo da coluna. */
  const elemento = (evento.currentTarget as HTMLElement).closest('.gd__coluna') as HTMLElement
  emit('criar', { coluna, inicioMin: minutoDoPonteiro(evento, elemento) })
}

/* ---------------------------------------------------------------------------- arrastar */

type Arraste = {
  agendamento: Agendamento
  origem: ColunaDaAgenda
  /** Onde, no cartão, a pessoa pegou (em minutos do topo): o cartão não pula para o ponteiro. */
  pegaEm: number
  duracao: number
}

const arrastando = ref<Arraste | null>(null)
const fantasma = ref<{ colunaId: string; inicioMin: number } | null>(null)

function podeArrastar(agendamento: Agendamento) {
  return props.podeEscrever && acoesDaSituacao(agendamento.status).mover
}

function comecarArraste(evento: DragEvent, cartao: CartaoNaGrade, origem: ColunaDaAgenda) {
  if (!podeArrastar(cartao.agendamento)) {
    evento.preventDefault()
    return
  }
  const caixa = (evento.currentTarget as HTMLElement).getBoundingClientRect()
  arrastando.value = {
    agendamento: cartao.agendamento,
    origem,
    pegaEm: (evento.clientY - caixa.top) / PX,
    duracao: cartao.fimMin - cartao.inicioMin,
  }
  evento.dataTransfer?.setData('text/plain', cartao.agendamento.id)
  if (evento.dataTransfer) evento.dataTransfer.effectAllowed = 'move'
}

function sobre(evento: DragEvent, coluna: ColunaDaAgenda) {
  const atual = arrastando.value
  if (!atual) return
  evento.preventDefault()
  if (evento.dataTransfer) evento.dataTransfer.dropEffect = 'move'
  fantasma.value = {
    colunaId: coluna.id,
    inicioMin: minutoDoPonteiro(evento, evento.currentTarget as HTMLElement, atual.pegaEm),
  }
}

function soltar(evento: DragEvent, coluna: ColunaDaAgenda) {
  const atual = arrastando.value
  if (!atual) return
  evento.preventDefault()
  const inicioMin = minutoDoPonteiro(evento, evento.currentTarget as HTMLElement, atual.pegaEm)
  terminarArraste()

  const mesmoLugar =
    coluna.id === atual.origem.id && inicioMin === minutosDoInstante(atual.agendamento.inicio)
  if (mesmoLugar) return

  emit('mover', {
    agendamento: atual.agendamento,
    origem: atual.origem,
    destino: coluna,
    inicioMin,
  })
}

function terminarArraste() {
  /* O clique que o navegador dispara ao soltar não pode virar "marcar aqui". */
  setTimeout(() => {
    arrastando.value = null
  }, 0)
  fantasma.value = null
}
</script>

<template>
  <div class="gd" :style="{ '--gd-colunas': colunas.length }">
    <div class="gd__cabeca" aria-hidden="true">
      <span class="gd__canto" />
      <div v-for="item in colunas" :key="item.coluna.id" class="gd__nome">
        <strong
          ><bdi>{{ item.coluna.nome }}</bdi></strong
        >
        <small v-if="item.nota">{{ item.nota }}</small>
      </div>
    </div>

    <div class="gd__corpo" :style="{ height: `${altura}px` }">
      <div class="gd__regua" aria-hidden="true">
        <span
          v-for="minuto in horas"
          :key="minuto"
          class="gd__hora ui-num"
          :style="{ top: topo(minuto) }"
        >
          {{ horaDe(minuto) }}
        </span>
      </div>

      <section
        v-for="item in colunas"
        :key="item.coluna.id"
        class="gd__coluna"
        :class="{ 'gd__coluna--marca': podeEscrever }"
        :aria-label="item.coluna.nome"
        :data-coluna-id="item.coluna.id"
        @click.self="clicarNoVazio($event, item.coluna)"
        @dragover="sobre($event, item.coluna)"
        @drop="soltar($event, item.coluna)"
      >
        <div
          v-for="(faixa, indice) in item.fundo"
          :key="`f${indice}`"
          class="gd__fundo"
          :class="`gd__fundo--${faixa.tipo}`"
          :style="{ top: topo(faixa.inicioMin), height: altoDe(faixa.inicioMin, faixa.fimMin) }"
          :title="
            faixa.bloqueio
              ? [
                  t(`agenda.config.bloqueio.motivo.${faixa.bloqueio.motivo}`),
                  faixa.bloqueio.detalhe,
                ]
                  .filter(Boolean)
                  .join(' · ')
              : faixa.tipo === 'reserva'
                ? t('agendamentos.grade.segurado')
                : undefined
          "
          @click="clicarNoVazio($event, item.coluna)"
        >
          <span v-if="faixa.bloqueio" class="gd__fundo-rotulo">
            {{ t(`agenda.config.bloqueio.motivo.${faixa.bloqueio.motivo}`) }}
          </span>
          <span v-else-if="faixa.tipo === 'reserva'" class="gd__fundo-rotulo">
            {{ t('agendamentos.grade.segurado') }}
          </span>
        </div>

        <button
          v-for="cartao in item.cartoes"
          :key="cartao.agendamento.id"
          type="button"
          class="gd__cartao"
          :class="[
            `gd__cartao--${cartao.agendamento.status.toLowerCase()}`,
            { 'gd__cartao--curto': cartao.fimMin - cartao.inicioMin < 25 },
          ]"
          :style="estiloDoCartao(cartao)"
          :draggable="podeArrastar(cartao.agendamento)"
          :aria-label="rotuloDoCartao(cartao.agendamento)"
          @click.stop="emit('abrir', cartao.agendamento)"
          @dragstart="comecarArraste($event, cartao, item.coluna)"
          @dragend="terminarArraste"
        >
          <span class="gd__linha1">
            <span class="ui-num gd__inicio">{{ cartao.agendamento.inicio.slice(11, 16) }}</span>
            <strong class="gd__paciente"
              ><bdi>{{ cartao.agendamento.paciente.nome }}</bdi></strong
            >
            <i
              v-if="ICONE_DO_STATUS[cartao.agendamento.status]"
              :class="ICONE_DO_STATUS[cartao.agendamento.status]"
              class="gd__status"
              aria-hidden="true"
            />
            <i
              v-if="avisoDo(cartao.agendamento)"
              class="ph ph-warning gd__aviso"
              :class="`gd__aviso--${avisoDo(cartao.agendamento)}`"
              aria-hidden="true"
            />
          </span>
          <span class="gd__linha2">
            {{ nomeDoTipo(cartao.agendamento.tipoId) }}
            <template v-if="cartao.agendamento.encaixe">
              · {{ t('agendamentos.encaixe') }}</template
            >
          </span>
        </button>

        <div
          v-if="arrastando && fantasma?.colunaId === item.coluna.id"
          class="gd__fantasma"
          :style="{
            top: topo(fantasma.inicioMin),
            height: altoDe(fantasma.inicioMin, fantasma.inicioMin + arrastando.duracao),
          }"
          aria-hidden="true"
        >
          <span class="ui-num">{{ horaDe(fantasma.inicioMin) }}</span>
        </div>

        <div
          v-if="agora !== null && agora >= janela.inicio && agora <= janela.fim"
          class="gd__agora"
          :style="{ top: topo(agora) }"
          aria-hidden="true"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.gd {
  --gd-regua: 52px;
  --gd-coluna: minmax(12rem, 1fr);

  display: grid;
  overflow-x: auto;
  grid-template-rows: auto auto;
}

.gd__cabeca,
.gd__corpo {
  display: grid;
  min-width: calc(var(--gd-regua) + var(--gd-colunas) * 12rem);
  grid-template-columns: var(--gd-regua) repeat(var(--gd-colunas), var(--gd-coluna));
}

.gd__cabeca {
  padding-bottom: 8px;
}

.gd__nome {
  display: grid;
  min-width: 0;
  gap: 1px;
  padding: 0 8px;
  color: var(--tinta);
  font-size: 14px;
}

.gd__nome strong {
  overflow: hidden;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gd__nome small {
  color: var(--tinta-2);
  font-size: 12px;
}

.gd__corpo {
  position: relative;
}

.gd__regua {
  position: relative;
}

.gd__hora {
  position: absolute;
  inset-inline-end: 8px;
  color: var(--tinta-2);
  font-size: 11.5px;
  transform: translateY(-50%);
}

.gd__hora:first-child {
  transform: none;
}

/* As linhas de hora e de meia hora num fundo só: a coluna não carrega um elemento por linha. */
.gd__coluna {
  position: relative;
  border-inline-start: 1px solid var(--app-regua, var(--linha-suave));
  background-image:
    linear-gradient(var(--app-regua, var(--linha-suave)) 1px, transparent 1px),
    linear-gradient(
      color-mix(in srgb, var(--app-regua, var(--linha-suave)) 45%, transparent) 1px,
      transparent 1px
    );
  background-position:
    0 0,
    0 48px;
  background-size:
    100% 96px,
    100% 96px;
}

.gd__coluna--marca {
  cursor: copy;
}

.gd__fundo {
  position: absolute;
  inset-inline: 0;
}

.gd__fundo--fora {
  background: color-mix(in srgb, var(--tinta-3) 12%, transparent);
}

.gd__fundo--bloqueio {
  background: repeating-linear-gradient(
    135deg,
    color-mix(in srgb, var(--tinta-3) 16%, transparent) 0 6px,
    transparent 6px 12px
  );
}

.gd__fundo--reserva {
  border: 1px dashed var(--atencao-tinta);
  border-radius: 8px;
  background: color-mix(in srgb, var(--atencao-fundo) 50%, transparent);
}

.gd__fundo-rotulo {
  display: block;
  padding: 2px 6px;
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 11.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gd__cartao {
  position: absolute;
  z-index: 1;
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 1px;
  padding: 4px 8px;
  overflow: hidden;
  border: 1px solid var(--app-regua, var(--linha));
  border-radius: 10px;
  background: var(--app-cartao, var(--superficie));
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
  transition: box-shadow 150ms ease-out;
}

.gd__cartao:hover {
  box-shadow: 0 2px 8px color-mix(in srgb, var(--tinta) 14%, transparent);
}

.gd__cartao:focus-visible {
  outline: 2px solid var(--tinta);
  outline-offset: 1px;
}

.gd__cartao[draggable='true'] {
  cursor: grab;
}

.gd__cartao--aguardando {
  border-color: var(--atencao-tinta);
}

.gd__cartao--em_atendimento {
  background: var(--ok-fundo);
}

.gd__cartao--finalizado {
  opacity: 0.75;
}

.gd__cartao--cancelado,
.gd__cartao--falta {
  opacity: 0.55;
}

.gd__cartao--cancelado .gd__paciente,
.gd__cartao--falta .gd__paciente {
  text-decoration: line-through;
}

.gd__linha1 {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
  font-size: 13px;
}

.gd__inicio {
  color: var(--tinta-2);
  font-size: 12px;
}

.gd__paciente {
  overflow: hidden;
  flex: 1;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gd__status {
  color: var(--tinta-2);
  font-size: 14px;
}

.gd__aviso {
  font-size: 14px;
}

.gd__aviso--warning {
  color: var(--atencao-tinta);
}

.gd__aviso--blocking {
  color: var(--risco-tinta);
}

.gd__linha2 {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.gd__cartao--curto .gd__linha2 {
  display: none;
}

.gd__fantasma {
  position: absolute;
  z-index: 2;
  inset-inline: 2px;
  padding: 2px 8px;
  border: 1.5px dashed var(--tinta);
  border-radius: 10px;
  background: color-mix(in srgb, var(--tinta) 6%, transparent);
  color: var(--tinta);
  font-size: 12px;
  font-weight: 650;
  pointer-events: none;
}

.gd__agora {
  position: absolute;
  z-index: 1;
  inset-inline: 0;
  height: 2px;
  background: var(--risco-tinta);
  pointer-events: none;
}

/* O ponto marca o começo da linha: só na primeira coluna. */
.gd__coluna:first-of-type .gd__agora::before {
  position: absolute;
  top: -3px;
  inset-inline-start: -4px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--risco-tinta);
  content: '';
}

@media (prefers-reduced-motion: reduce) {
  .gd__cartao {
    transition: none;
  }
}
</style>
