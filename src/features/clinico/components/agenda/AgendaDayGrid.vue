<script setup lang="ts">
/**
 * Grade do dia: eixo de tempo à esquerda, uma coluna por profissional (ou por sala), faixas
 * de bloqueio ao fundo, cards por cima e a linha do agora atravessando tudo.
 *
 * Diferente do mobile, aqui **todas as colunas ficam visíveis**: tela larga é o argumento do
 * portal, e agenda que rola na horizontal para ver o segundo profissional obriga a decorar o
 * que ficou para trás.
 *
 * Toda a matemática de pixel↔minuto vive no `useAgendaDia`; este componente só traduz gesto
 * em proposta e devolve para quem confirma.
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import AgendaAppointmentCard from './AgendaAppointmentCard.vue'
import { useAgendaDia } from '../../composables/useAgendaDia'
import { useAgendaDrag, type ArrasteProposta } from '../../composables/useAgendaDrag'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { useAgendaStore } from '../../stores/agenda'

const emit = defineEmits<{
  abrir: [appointmentId: string]
  propor: [proposta: ArrasteProposta]
  criarEm: [payload: { professionalId: string; minuto: number }]
}>()

const { t } = useI18n()
const agenda = useAgendaStore()
const formato = useClinicFormat()

const rolagem = ref<HTMLElement | null>(null)
const conteudo = ref<HTMLElement | null>(null)
const scrollTop = ref(0)
const alturaVisivel = ref(0)

const grade = useAgendaDia(scrollTop, alturaVisivel)

const {
  alturaTotalPx,
  marcas,
  colunas,
  mostrarLinhaDoAgora,
  topoDaLinhaDoAgora,
  atualizarAgora,
  minutoDoPixel,
  passoDaGrade,
  faixasDaClinica,
} = grade

const idsDasColunas = computed(() => colunas.value.map((coluna) => coluna.id))

const template = computed(
  () => `var(--clinic-time-axis-width) repeat(${Math.max(colunas.value.length, 1)}, minmax(0, 1fr))`,
)

function minutoDoPonteiro(evento: PointerEvent) {
  const caixa = conteudo.value?.getBoundingClientRect()

  if (!caixa) {
    return 0
  }

  return minutoDoPixel(evento.clientY - caixa.top)
}

function colunaDoPonteiro(evento: PointerEvent) {
  const alvo = document.elementFromPoint(evento.clientX, evento.clientY)
  const coluna = alvo?.closest<HTMLElement>('[data-coluna]')

  return coluna?.dataset.coluna ?? null
}

/**
 * O `click` do card dispara logo depois do `pointerup` que encerra o arraste. Sem esta marca,
 * toda remarcação abriria o drawer por cima da confirmação.
 */
let ultimoArrasteEm = 0

const arraste = useAgendaDrag({
  data: () => agenda.data,
  passoMinutos: () => passoDaGrade.value,
  minutoDoPonteiro,
  colunaDoPonteiro,
  aoPropor: (proposta) => {
    ultimoArrasteEm = performance.now()
    emit('propor', proposta)
  },
})

function aoAbrir(appointmentId: string) {
  if (performance.now() - ultimoArrasteEm < 250) {
    return
  }

  emit('abrir', appointmentId)
}

/** Card em gesto: some da posição original e reaparece na prévia. */
function cardEmGesto(id: string) {
  return arraste.previa.value?.id === id
}

const previaVisual = computed(() => {
  const previa = arraste.previa.value

  if (!previa) {
    return null
  }

  const original = colunas.value
    .flatMap((coluna) => coluna.cards)
    .find((card) => card.id === previa.id)

  if (!original) {
    return null
  }

  return {
    colunaId: previa.colunaId,
    card: {
      ...original,
      inicioMin: previa.inicioMin,
      fimMin: previa.fimMin,
      topPx: grade.paraTopo(previa.inicioMin),
      alturaPx: Math.max((previa.fimMin - previa.inicioMin) * grade.pixelsPorMinuto.value, 22),
      lane: 0,
      lanes: 1,
    },
  }
})

function aoRolar() {
  scrollTop.value = rolagem.value?.scrollTop ?? 0
}

function medir() {
  alturaVisivel.value = rolagem.value?.clientHeight ?? 0
}

/**
 * Clique no vazio da coluna já sabe onde: o horário sai da posição do clique, arredondado
 * para a grade. Poupa a recepção de reescrever o que acabou de apontar.
 */
function aoClicarNoVazio(evento: MouseEvent, professionalId: string) {
  const caixa = conteudo.value?.getBoundingClientRect()

  if (!caixa) {
    return
  }

  const minuto = minutoDoPixel(evento.clientY - caixa.top)
  const passo = passoDaGrade.value

  emit('criarEm', { professionalId, minuto: Math.floor(minuto / passo) * passo })
}

function aoTeclarNoCard(evento: KeyboardEvent, appointmentId: string) {
  if (!evento.shiftKey) {
    return
  }

  const card = colunas.value
    .flatMap((coluna) => coluna.cards)
    .find((item) => item.id === appointmentId)

  if (!card) {
    return
  }

  const mapa: Record<string, [number, number]> = {
    ArrowUp: [-1, 0],
    ArrowDown: [1, 0],
    ArrowLeft: [0, -1],
    ArrowRight: [0, 1],
  }

  const movimento = mapa[evento.key]

  if (!movimento) {
    return
  }

  evento.preventDefault()
  arraste.moverPorTeclado(card.appointment, movimento[0], idsDasColunas.value, movimento[1])
}

let relogio: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  medir()
  atualizarAgora()
  relogio = setInterval(atualizarAgora, 30_000)
  window.addEventListener('resize', medir)

  /** Abre já no horário útil, não à meia-noite da grade. */
  requestAnimationFrame(() => {
    if (rolagem.value) {
      rolagem.value.scrollTop = Math.max(topoDaLinhaDoAgora.value - 120, 0)
    }
  })
})

onBeforeUnmount(() => {
  if (relogio) {
    clearInterval(relogio)
  }

  window.removeEventListener('resize', medir)
})

watch(() => agenda.data, medir)
</script>

<template>
  <div class="grade" :class="{ 'grade--arrastando': arraste.arrastando.value }">
    <header class="grade__cabecalho" :style="{ '--template': template }">
      <div class="grade__canto">
        <span class="clinic-label">{{ formato.dataCurta(agenda.data) }}</span>
      </div>

      <div v-for="coluna in colunas" :key="coluna.id" class="grade__coluna-topo">
        <span class="grade__titulo" :title="coluna.titulo">{{ coluna.titulo }}</span>

        <!--
          A carga era "275 min ocupados", repetido em cada coluna. O número em minutos não se
          compara de relance entre profissionais e ocupava uma linha inteira; a proporção sim.
          Os minutos continuam no `title`, para quem precisa do número exato.
        -->
        <span
          class="grade__carga"
          :title="t('clinico.agenda.ocupacao', { minutos: coluna.ocupacaoMinutos })"
        >
          <span class="grade__barra" aria-hidden="true">
            <span
              class="grade__preenchimento"
              :class="{ 'grade__preenchimento--cheio': coluna.ocupacao > 0.85 }"
              :style="{
                width: `${Math.min(coluna.ocupacao, 1) * 100}%`,
                background: coluna.cor,
              }"
            />
          </span>
          <span class="grade__percentual clinic-value">
            {{ formato.percentual(coluna.ocupacao) }}
          </span>
        </span>
      </div>
    </header>

    <div ref="rolagem" class="grade__rolagem" @scroll.passive="aoRolar">
      <div
        ref="conteudo"
        class="grade__conteudo"
        :style="{ '--template': template, height: `${alturaTotalPx}px` }"
      >
        <!-- eixo de tempo -->
        <div class="eixo">
          <span
            v-for="marca in marcas"
            :key="marca.minuto"
            class="eixo__marca"
            :class="{ 'eixo__marca--principal': marca.principal }"
            :style="{ top: `${marca.topPx}px` }"
          >
            <template v-if="marca.principal">{{ marca.rotulo }}</template>
          </span>
        </div>

        <!-- colunas -->
        <div
          v-for="coluna in colunas"
          :key="coluna.id"
          class="coluna"
          :data-coluna="coluna.id"
          @click.self="aoClicarNoVazio($event, coluna.id)"
        >
          <span
            v-for="marca in marcas"
            :key="`linha-${marca.minuto}`"
            class="coluna__linha"
            :class="{ 'coluna__linha--principal': marca.principal }"
            :style="{ top: `${marca.topPx}px` }"
            aria-hidden="true"
          />

          <div
            v-for="faixa in coluna.faixas"
            :key="faixa.bloqueio.id"
            class="bloqueio"
            :class="`bloqueio--${faixa.bloqueio.motivo}`"
            :style="{ top: `${faixa.topPx}px`, height: `${faixa.alturaPx}px` }"
            :title="`${formato.motivoBloqueio(faixa.bloqueio.motivo)}${faixa.bloqueio.detalhe ? ` — ${faixa.bloqueio.detalhe}` : ''}`"
          >
            <span class="bloqueio__rotulo">
              {{ formato.motivoBloqueio(faixa.bloqueio.motivo) }}
            </span>
          </div>

          <AgendaAppointmentCard
            v-for="card in coluna.cards"
            v-show="!cardEmGesto(card.id)"
            :key="card.id"
            :card="card"
            :cor="coluna.cor"
            :selecionado="agenda.focoId === card.id"
            @abrir="aoAbrir"
            @iniciar-arraste="
              (evento, modo) => arraste.iniciar(evento, card.appointment, modo, coluna.id)
            "
            @keydown="aoTeclarNoCard($event, card.id)"
          />

          <AgendaAppointmentCard
            v-if="previaVisual && previaVisual.colunaId === coluna.id"
            :card="previaVisual.card"
            :cor="coluna.cor"
            fantasma
            :arrastavel="false"
          />

          <p v-if="coluna.cards.length === 0" class="coluna__vazia">
            {{ t('clinico.agenda.colunaVazia') }}
          </p>
        </div>

        <!--
          Bloqueio da clínica inteira: uma faixa só, atravessando a grade, com o rótulo à
          esquerda no eixo. Repetido por coluna, "ALMOÇO" aparecia cinco vezes na mesma altura.
        -->
        <div
          v-for="faixa in faixasDaClinica"
          :key="faixa.bloqueio.id"
          class="faixa-clinica"
          :class="`faixa-clinica--${faixa.bloqueio.motivo}`"
          :style="{ top: `${faixa.topPx}px`, height: `${faixa.alturaPx}px` }"
          :title="formato.motivoBloqueio(faixa.bloqueio.motivo)"
          aria-hidden="true"
        >
          <span class="faixa-clinica__rotulo">
            {{ formato.motivoBloqueio(faixa.bloqueio.motivo) }}
          </span>
        </div>

        <!-- linha do agora -->
        <div
          v-if="mostrarLinhaDoAgora"
          class="agora"
          :style="{ top: `${topoDaLinhaDoAgora}px` }"
          role="presentation"
        >
          <span class="agora__rotulo clinic-value">{{ t('clinico.agenda.linhaDoAgora') }}</span>
        </div>
      </div>
    </div>

    <p class="grade__dica">
      <i class="pi pi-arrows-alt" aria-hidden="true" />
      {{ t('clinico.agenda.arrastarDica') }}
    </p>
  </div>
</template>

<style scoped>
.grade {
  display: grid;
  overflow: hidden;
  grid-template-rows: auto 1fr auto;
  min-height: 0;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.grade--arrastando {
  cursor: grabbing;
  user-select: none;
}

.grade__cabecalho {
  display: grid;
  grid-template-columns: var(--template);
  border-bottom: 1px solid var(--clinic-line);
  background: var(--clinic-surface-soft);
}

.grade__canto {
  display: grid;
  align-items: center;
  padding: var(--clinic-space-2);
  border-right: 1px solid var(--clinic-line);
  text-align: center;
}

.grade__coluna-topo {
  display: grid;
  min-width: 0;
  align-content: center;
  gap: 0.1rem;
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border-right: 1px solid var(--clinic-line-soft);
}

.grade__coluna-topo:last-child {
  border-right: none;
}

.grade__titulo {
  overflow: hidden;
  font-size: var(--clinic-font-base);
  font-weight: 750;
  letter-spacing: -0.01em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grade__carga {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.grade__barra {
  display: block;
  height: 4px;
  flex: 1;
  min-width: 1.5rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--clinic-line);
}

.grade__preenchimento {
  display: block;
  height: 100%;
}

.grade__preenchimento--cheio {
  background: var(--clinic-attention-text) !important;
}

.grade__percentual {
  flex: 0 0 auto;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.grade__rolagem {
  overflow: auto;
  min-height: 0;
}

.grade__conteudo {
  position: relative;
  display: grid;
  grid-template-columns: var(--template);
}

.eixo {
  position: relative;
  border-right: 1px solid var(--clinic-line);
  background: var(--clinic-surface-soft);
}

.eixo__marca {
  position: absolute;
  right: var(--clinic-space-2);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  transform: translateY(-50%);
}

.eixo__marca--principal {
  color: var(--clinic-muted);
}

/* A primeira marca não sobe metade da altura para fora da área visível. */
.eixo__marca:first-child {
  transform: none;
}

.coluna {
  position: relative;
  z-index: 1;
  min-width: 0;
  border-right: 1px solid var(--clinic-line-soft);
}

.coluna:last-child {
  border-right: none;
}

.coluna__linha {
  position: absolute;
  left: 0;
  width: 100%;
  border-top: 1px solid var(--clinic-line-soft);
  pointer-events: none;
}

.coluna__linha--principal {
  border-top-color: var(--clinic-line);
}

.coluna__vazia {
  position: absolute;
  top: 40%;
  left: 0;
  width: 100%;
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  pointer-events: none;
  text-align: center;
}

/* Bloqueio é fundo, não card: fica atrás e não recebe clique. */
.bloqueio {
  position: absolute;
  left: 0;
  width: 100%;
  overflow: hidden;
  padding: 2px 6px;
  background-image: repeating-linear-gradient(
    135deg,
    color-mix(in srgb, var(--clinic-muted) 10%, transparent) 0 5px,
    transparent 5px 10px
  );
  border-block: 1px dashed var(--clinic-line-strong);
  pointer-events: none;
}

.bloqueio__rotulo {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.bloqueio--almoco {
  background-color: color-mix(in srgb, var(--clinic-surface-sunken) 70%, transparent);
}

.bloqueio--feriado,
.bloqueio--manutencao {
  background-image: repeating-linear-gradient(
    135deg,
    color-mix(in srgb, var(--clinic-attention-text) 16%, transparent) 0 5px,
    transparent 5px 10px
  );
}

/*
 * Faixa da clínica: atravessa a grade inteira, atrás dos cards. Fica no fundo de propósito —
 * é contexto do dia, não um item da agenda.
 */
.faixa-clinica {
  position: absolute;
  left: 0;
  z-index: 0;
  display: flex;
  width: 100%;
  align-items: center;
  overflow: hidden;
  border-block: 1px dashed var(--clinic-line-strong);
  background-color: color-mix(in srgb, var(--clinic-surface-sunken) 70%, transparent);
  background-image: repeating-linear-gradient(
    135deg,
    color-mix(in srgb, var(--clinic-muted) 7%, transparent) 0 6px,
    transparent 6px 12px
  );
  pointer-events: none;
}

.faixa-clinica--feriado {
  background-image: repeating-linear-gradient(
    135deg,
    color-mix(in srgb, var(--clinic-attention-text) 14%, transparent) 0 6px,
    transparent 6px 12px
  );
}

.faixa-clinica__rotulo {
  width: var(--clinic-time-axis-width);
  padding-right: var(--clinic-space-2);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  letter-spacing: 0.08em;
  text-align: right;
  text-transform: uppercase;
}

/*
 * Linha do agora: atravessa todas as colunas, **por trás dos cards**.
 *
 * Por cima, ela caía no meio da segunda linha de texto de qualquer atendimento em curso e o
 * nome do serviço aparecia tachado — a marca de "cancelado" na única consulta que está
 * acontecendo. O selo fica no eixo, acima de tudo, e é ele que diz onde é agora.
 */
.agora {
  position: absolute;
  left: 0;
  z-index: 0;
  width: 100%;
  border-top: 2px solid var(--clinic-risk-text);
  pointer-events: none;
}

.agora__rotulo {
  position: absolute;
  z-index: 5;
  top: -0.75rem;
  left: 2px;
  padding: 0 0.3rem;
  border-radius: 0.3rem;
  background: var(--clinic-risk-text);
  color: var(--clinic-surface);
  font-size: 0.6rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.grade__dica {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-4);
  border-top: 1px solid var(--clinic-line);
  background: var(--clinic-surface-soft);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}
</style>
