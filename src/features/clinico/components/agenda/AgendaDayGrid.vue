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
import { ICONE_DO_BLOQUEIO } from './agenda-icones'
import { useAgendaDia, type FaixaBloqueio } from '../../composables/useAgendaDia'
import { useAgendaDrag, type ArrasteProposta } from '../../composables/useAgendaDrag'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Appointment, AppointmentStatus } from '../../data/types'
import { minutesToClock } from '../../domain/clinic-time'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock } from '../../stores/clinico'

const emit = defineEmits<{
  abrir: [appointmentId: string]
  propor: [proposta: ArrasteProposta]
  marcarFalta: [appointmentId: string]
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

/**
 * O eixo e as linhas só nas meias horas: a hora cheia com fio e rótulo cheios, a meia hora com os
 * sutis. As marcas de 15 minutos continuam valendo para o arraste — só não são desenhadas.
 */
const marcasDeMeiaHora = computed(() => marcas.value.filter((marca) => marca.minuto % 30 === 0))

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
 * Instante em que o último gesto de ponteiro terminou.
 *
 * O `click` dispara logo depois do `pointerup` que encerra o arraste. Sem esta marca, toda
 * remarcação abriria alguma coisa por cima da confirmação — e **qual** coisa depende de onde o
 * card foi solto, porque o clique nasce no ancestral comum entre a origem e o destino do gesto:
 *
 * - solto em cima do card de origem → o clique é do card → abriria o drawer;
 * - solto em qualquer outro lugar da coluna → o clique é **da coluna** → abriria "novo
 *   atendimento" no minuto da soltura, que é justamente o caso normal de remarcar.
 *
 * Por isso as duas portas — `aoAbrir` e `aoClicarNoVazio` — consultam a mesma marca, e ela é
 * carimbada no fim de **todo** gesto: o que propôs, o que voltou ao lugar de origem e o
 * cancelado por `Esc` deixam para trás exatamente o mesmo clique.
 */
let ultimoGestoEm = 0

/** Janela em que um clique ainda é rastro do gesto que acabou, e não um clique novo. */
const RASTRO_DO_GESTO_MS = 250

/**
 * O que a coluna de destino significa, no agrupamento vigente.
 *
 * Por profissional, soltar na coluna vizinha troca quem atende e mantém a sala. Por sala, é o
 * contrário: troca a sala e mantém quem atende — e a troca é **cirúrgica**, substituindo só a
 * sala de origem na lista. Um atendimento pode ocupar duas salas (centro cirúrgico e
 * recuperação); arrastar da coluna "Recuperação" para "Consultório 2" não pode apagar o centro
 * cirúrgico junto.
 */
function destinoDaColuna(colunaId: string, appointment: Appointment) {
  if (agenda.agrupamento === 'profissional') {
    return { professionalId: colunaId, roomIds: appointment.roomIds }
  }

  const origem = colunas.value.find((coluna) =>
    coluna.cards.some((card) => card.id === appointment.id),
  )
  const salaDeOrigem = origem?.roomId ?? null

  const roomIds = salaDeOrigem
    ? appointment.roomIds.map((id) => (id === salaDeOrigem ? colunaId : id))
    : [...new Set([...appointment.roomIds, colunaId])]

  return { professionalId: appointment.professionalId, roomIds: [...new Set(roomIds)] }
}

const arraste = useAgendaDrag({
  data: () => agenda.data,
  passoMinutos: () => passoDaGrade.value,
  minutoDoPonteiro,
  colunaDoPonteiro,
  destinoDaColuna,
  aoPropor: (proposta) => emit('propor', proposta),
  aoTerminarGesto: () => {
    ultimoGestoEm = performance.now()
  },
})

/** `true` enquanto o clique que chega ainda é o rastro do gesto que acabou de terminar. */
function rastroDeGesto() {
  return performance.now() - ultimoGestoEm < RASTRO_DO_GESTO_MS
}

function aoAbrir(appointmentId: string) {
  if (rastroDeGesto()) {
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

  /**
   * Conflitos **do destino**, recalculados a cada pixel do gesto.
   *
   * Antes o fantasma herdava `conflitos` do card original, e isso mentia nas duas direções:
   * arrastar para um horário livre continuava exibindo o aviso antigo, e arrastar para cima de
   * um horário cheio não exibia nada até soltar. Quem arrasta precisa ver a sobreposição
   * **enquanto** decide — descobrir só na caixa de confirmação transforma cada tentativa num
   * diálogo para fechar.
   */
  const inicio = clinicClock.toIso(agenda.data, previa.inicioMin)
  const fim = clinicClock.toIso(agenda.data, previa.fimMin)
  const destino = destinoDaColuna(previa.colunaId, original.appointment)

  const conflitos = agenda.conflitosDe({
    id: original.appointment.id,
    petId: original.appointment.petId,
    professionalId: destino.professionalId,
    roomIds: destino.roomIds,
    typeId: original.appointment.typeId,
    inicio,
    fim,
    linkedGroupId: original.appointment.linkedGroupId,
  })

  return {
    colunaId: previa.colunaId,
    conflitos,
    /** Só aviso e impedimento acendem a faixa; `info` continua assunto do diálogo. */
    alerta: conflitos.some((conflito) => conflito.severity !== 'info'),
    card: {
      ...original,
      conflitos,
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
function aoClicarNoVazio(evento: MouseEvent, professionalId: string | null) {
  /* Por sala, a coluna não diz quem atende: marcar dali abriria o formulário sem profissional. */
  if (!professionalId || rastroDeGesto()) {
    return
  }

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
  const colunaDoCard =
    colunas.value.find((coluna) => coluna.cards.some((item) => item.id === appointmentId))?.id ??
    card.appointment.professionalId

  arraste.moverPorTeclado(
    card.appointment,
    movimento[0],
    idsDasColunas.value,
    colunaDoCard,
    movimento[1],
  )
}

/** A hora no rótulo do fio do agora: "14:37", e não só "Agora" — é a hora que se confere. */
const horaDoAgora = ref(minutesToClock(clinicClock.now().minutes))

function tique() {
  atualizarAgora()
  horaDoAgora.value = minutesToClock(clinicClock.now().minutes)
}

/** A hora do eixo que cairia por baixo do rótulo do agora some, em vez de aparecer pela metade. */
function marcaCobertaPeloAgora(topo: number) {
  return mostrarLinhaDoAgora.value && Math.abs(topo - topoDaLinhaDoAgora.value) < 14
}

/** As iniciais de quem atende, para o monograma do cabeçalho: primeiro e último nome. */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.charAt(0) ?? ''
  const ultima = partes.length > 1 ? (partes.at(-1)?.charAt(0) ?? '') : ''

  return `${primeira}${ultima}`.toLocaleUpperCase()
}

/** Os estados que a chave do rodapé explica — na ordem em que o dia anda. */
const ESTADOS_DA_CHAVE: AppointmentStatus[] = [
  'agendado',
  'confirmado',
  'aguardando',
  'em-atendimento',
  'finalizado',
  'falta',
]

/** Ocupação acima de 85% é dia apertado; acima de 100%, vendido além do expediente. */
function tomDaOcupacao(ocupacao: number) {
  if (ocupacao > 1) {
    return 'risco'
  }

  return ocupacao >= 0.85 ? 'atencao' : 'normal'
}

function tituloDoBloqueio(faixa: FaixaBloqueio) {
  const motivo = formato.motivoBloqueio(faixa.bloqueio.motivo)

  return faixa.bloqueio.detalhe ? `${motivo}: ${faixa.bloqueio.detalhe}` : motivo
}

let relogio: ReturnType<typeof setInterval> | null = null

onMounted(() => {
  medir()
  tique()
  relogio = setInterval(tique, 30_000)
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
  <div
    class="grade ui-folha clinic-scope"
    :class="{ 'grade--arrastando': arraste.arrastando.value }"
    :style="{ '--colunas': Math.max(colunas.length, 1) }"
  >
    <div ref="rolagem" class="grade__rolagem" @scroll.passive="aoRolar">
      <header class="grade__cabecalho" :style="{ '--template': template }">
        <div class="grade__canto">
          <span class="ui-num">{{ formato.dataCurta(agenda.data) }}</span>
        </div>

        <div
          v-for="coluna in colunas"
          :key="coluna.id"
          class="grade__coluna-topo"
          :style="{ '--coluna-cor': coluna.cor }"
        >
          <!-- O rosto da coluna: as iniciais na cor de quem atende (ou a porta, por sala). -->
          <span class="grade__monograma" aria-hidden="true">
            <i v-if="!coluna.professionalId" class="ph ph-door" />
            <template v-else>{{ iniciais(coluna.titulo) }}</template>
          </span>

          <span class="grade__pessoa">
            <span class="grade__nome" :title="coluna.titulo">{{ coluna.titulo }}</span>

            <!--
              A carga em proporção, e não em minutos: "62%" compara colunas de relance. Os minutos
              continuam no `title`, para quem precisa do número exato.
            -->
            <span
              class="grade__carga"
              :class="`grade__carga--${tomDaOcupacao(coluna.ocupacao)}`"
              :title="t('clinico.agenda.ocupacao', { minutos: coluna.ocupacaoMinutos })"
            >
              <span class="grade__barra" aria-hidden="true">
                <span
                  class="grade__preenchimento"
                  :style="{ width: `${Math.min(coluna.ocupacao, 1) * 100}%` }"
                />
              </span>
              <span class="ui-num">{{ formato.percentual(coluna.ocupacao) }}</span>
            </span>
          </span>
        </div>
      </header>

      <div
        ref="conteudo"
        class="grade__conteudo"
        :style="{ '--template': template, height: `${alturaTotalPx}px` }"
      >
        <!-- eixo de tempo: preso à esquerda quando a grade rola de lado -->
        <div class="eixo">
          <span
            v-for="marca in marcasDeMeiaHora"
            :key="marca.minuto"
            class="eixo__marca"
            :class="[
              marca.principal ? 'eixo__marca--principal' : 'eixo__marca--meia',
              { 'eixo__marca--coberta': marcaCobertaPeloAgora(marca.topPx) },
            ]"
            :style="{ top: `${marca.topPx}px` }"
          >
            {{ marca.rotulo }}
          </span>

          <span
            v-if="mostrarLinhaDoAgora"
            class="eixo__agora ui-num"
            :style="{ top: `${topoDaLinhaDoAgora}px` }"
          >
            <span class="grade__sr">{{ t('clinico.agenda.linhaDoAgora') }}</span>
            {{ horaDoAgora }}
          </span>
        </div>

        <!-- colunas -->
        <div
          v-for="coluna in colunas"
          :key="coluna.id"
          class="coluna"
          :data-coluna="coluna.id"
          @click.self="aoClicarNoVazio($event, coluna.professionalId)"
        >
          <span
            v-for="marca in marcasDeMeiaHora"
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
            :style="{ top: `${faixa.topPx}px`, height: `${faixa.alturaPx}px` }"
            :title="tituloDoBloqueio(faixa)"
          >
            <span class="etiqueta">
              <i :class="ICONE_DO_BLOQUEIO[faixa.bloqueio.motivo]" aria-hidden="true" />
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
            @marcar-falta="emit('marcarFalta', $event)"
            @iniciar-arraste="
              (evento, modo) => arraste.iniciar(evento, card.appointment, modo, coluna.id)
            "
            @keydown="aoTeclarNoCard($event, card.id)"
          />

          <!--
            Faixa do destino. Marca a fatia de tempo onde o cartão vai cair, atravessando a
            largura da coluna — o fantasma sozinho não mostra o alcance quando ele é estreito
            por dividir a faixa com outro atendimento. Muda de tom quando há sobreposição.
          -->
          <template v-if="previaVisual && previaVisual.colunaId === coluna.id">
            <div
              class="destino"
              :class="{ 'destino--conflito': previaVisual.alerta }"
              :style="{
                top: `${previaVisual.card.topPx}px`,
                height: `${previaVisual.card.alturaPx}px`,
              }"
              aria-hidden="true"
            />

            <AgendaAppointmentCard
              :card="previaVisual.card"
              :cor="coluna.cor"
              fantasma
              :arrastavel="false"
            />

            <!--
              O motivo, por escrito, colado no destino. "Está vermelho" não diz se o choque é
              com outro paciente, com o almoço ou com um bloqueio — e são três decisões
              diferentes. Aparece durante o gesto, antes de a confirmação existir.
            -->
            <p
              v-if="previaVisual.alerta"
              class="destino__aviso"
              :style="{ top: `${previaVisual.card.topPx + previaVisual.card.alturaPx + 4}px` }"
              role="status"
            >
              <i class="ph ph-warning-circle" aria-hidden="true" />
              <span>
                {{
                  previaVisual.conflitos
                    .filter((conflito) => conflito.severity !== 'info')
                    .map(formato.conflito)
                    .join(' · ')
                }}
              </span>
            </p>
          </template>

          <p v-if="coluna.cards.length === 0" class="coluna__vazia">
            {{ t('clinico.agenda.colunaVazia') }}
          </p>
        </div>

        <!--
          Bloqueio da clínica inteira: uma faixa só, atravessando as colunas, com o motivo numa
          etiqueta. Repetido por coluna, "Almoço" aparecia cinco vezes na mesma altura.
        -->
        <div
          v-for="faixa in faixasDaClinica"
          :key="faixa.bloqueio.id"
          class="faixa-clinica"
          :style="{ top: `${faixa.topPx}px`, height: `${faixa.alturaPx}px` }"
          :title="tituloDoBloqueio(faixa)"
          aria-hidden="true"
        >
          <span class="etiqueta">
            <i :class="ICONE_DO_BLOQUEIO[faixa.bloqueio.motivo]" />
            {{ formato.motivoBloqueio(faixa.bloqueio.motivo) }}
          </span>
        </div>

        <!-- o fio do agora, por trás dos cartões; a hora mora no eixo -->
        <div
          v-if="mostrarLinhaDoAgora"
          class="agora"
          :style="{ top: `${topoDaLinhaDoAgora}px` }"
          role="presentation"
        />
      </div>
    </div>

    <footer class="grade__pe">
      <p class="grade__dica">
        <i class="ph ph-hand-grabbing" aria-hidden="true" />
        {{ t('clinico.agenda.arrastarDica') }}
      </p>

      <!-- A chave das cores do estado: a mesma da tabela do dia. -->
      <ul class="grade__estados" aria-hidden="true">
        <li v-for="status in ESTADOS_DA_CHAVE" :key="status" :class="`grade__estado--${status}`">
          <span class="grade__amostra" />
          {{ formato.status(status) }}
        </li>
      </ul>
    </footer>
  </div>
</template>

<style scoped>
/*
 * O acabamento da linha do tempo segue o da tabela do dia: cabeçalho e rodapé num poço, a grade
 * em papel com fios leves, e os atendimentos como cartões pequenos que flutuam.
 */
.grade {
  --coluna-minima: 8rem;
  --grade-poco: color-mix(in oklab, var(--superficie-2) 75%, var(--superficie));

  display: grid;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
}

.grade--arrastando {
  cursor: grabbing;
  user-select: none;
}

.grade__rolagem {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.grade__cabecalho,
.grade__conteudo {
  display: grid;
  min-width: calc(var(--clinic-time-axis-width) + var(--colunas) * var(--coluna-minima));
  grid-template-columns: var(--template);
}

/* O cabeçalho rola junto na horizontal e fica preso no alto: colunas e nomes nunca desalinham. */
.grade__cabecalho {
  position: sticky;
  top: 0;
  z-index: 8;
  border-bottom: 1px solid var(--linha);
  background: var(--grade-poco);
}

.grade__canto {
  position: sticky;
  left: 0;
  z-index: 1;
  display: grid;
  align-items: center;
  padding: 0 10px;
  border-inline-end: 1px solid var(--linha);
  background: var(--grade-poco);
  color: var(--tinta-3);
  font-size: 12px;
  font-weight: 600;
  text-align: end;
}

/*
 * Quem atende: o monograma na cor da coluna, o nome e a ocupação embaixo. A coluna é o contêiner:
 * estreita, o monograma sai e o nome fica.
 */
.grade__coluna-topo {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  container-type: inline-size;
}

.grade__coluna-topo + .grade__coluna-topo {
  border-inline-start: 1px solid var(--linha-suave);
}

.grade__monograma {
  display: inline-grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in oklab, var(--coluna-cor) 32%, var(--superficie));
  box-shadow:
    inset 0 0 0 1px color-mix(in oklab, var(--coluna-cor) 50%, transparent),
    var(--sombra-xs);
  color: color-mix(in oklab, var(--coluna-cor) 30%, var(--tinta));
  font-family: var(--font-dados);
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.grade__monograma i {
  font-size: 17px;
}

@container (max-width: 9.5rem) {
  .grade__monograma {
    display: none;
  }
}

.grade__pessoa {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 6px;
}

.grade__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.grade__carga {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 600;
}

.grade__barra {
  display: block;
  height: 5px;
  flex: 1;
  min-width: 1.5rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-3);
}

.grade__preenchimento {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--clinica);
}

.grade__carga--atencao {
  color: var(--atencao-tinta);
}

.grade__carga--atencao .grade__preenchimento {
  background: var(--atencao);
}

.grade__carga--risco {
  color: var(--risco-tinta);
}

.grade__carga--risco .grade__preenchimento {
  background: var(--risco);
}

.grade__conteudo {
  position: relative;
}

/* ------------------------------------------------------------------------------- eixo */

.eixo {
  position: sticky;
  left: 0;
  z-index: 4;
  border-inline-end: 1px solid var(--linha);
  background: var(--superficie);
}

.eixo__marca {
  position: absolute;
  inset-inline-end: 12px;
  font-family: var(--font-dados);
  font-variant-numeric: tabular-nums;
  line-height: 1;
  transform: translateY(-50%);
}

.eixo__marca--principal {
  color: var(--tinta);
  font-size: 13px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.eixo__marca--meia {
  color: var(--tinta-3);
  font-size: 11.5px;
  font-weight: 500;
}

.eixo__marca--coberta {
  visibility: hidden;
}

/* No zoom reduzido a meia hora fica a 20 px da hora: o rótulo dela vira ruído. */
:root[data-clinic-zoom='reduzido'] .eixo__marca--meia {
  display: none;
}

/* A primeira marca não sobe metade da altura para fora da área visível. */
.eixo__marca:first-child {
  transform: translateY(2px);
}

.eixo__agora {
  position: absolute;
  inset-inline-end: 8px;
  z-index: 1;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--clinica-tinta);
  box-shadow: 0 0 0 3px var(--superficie);
  color: var(--superficie);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
  transform: translateY(-50%);
}

/* ----------------------------------------------------------------------------- colunas */

.coluna {
  position: relative;
  z-index: 1;
  min-width: 0;
}

.coluna + .coluna {
  border-inline-start: 1px solid var(--linha-suave);
}

.coluna__linha {
  position: absolute;
  inset-inline-start: 0;
  width: 100%;
  border-top: 1px solid color-mix(in oklab, var(--linha-suave) 80%, transparent);
  pointer-events: none;
}

.coluna__linha--principal {
  border-top-color: var(--linha);
}

.coluna__vazia {
  position: absolute;
  top: 40%;
  inset-inline-start: 0;
  width: 100%;
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
  pointer-events: none;
  text-align: center;
}

/* Bloqueio é fundo, não cartão: hachurado discreto, atrás, sem receber clique. */
.bloqueio,
.faixa-clinica {
  position: absolute;
  overflow: hidden;
  background-color: color-mix(in oklab, var(--superficie-2) 80%, var(--superficie));
  background-image: repeating-linear-gradient(
    135deg,
    transparent 0 8px,
    color-mix(in oklab, var(--linha) 75%, transparent) 8px 9px
  );
  pointer-events: none;
}

.bloqueio {
  inset-inline-start: 0;
  width: 100%;
  padding: 4px 6px;
}

/*
 * Faixa da clínica: atravessa as colunas, atrás dos cartões. Fica no fundo de propósito — é
 * contexto do dia, não um item da agenda.
 */
.faixa-clinica {
  inset-inline: var(--clinic-time-axis-width) 0;
  z-index: 0;
  display: flex;
  align-items: center;
  padding: 0 10px;
}

/* O motivo numa etiqueta de papel, legível por cima do hachurado. */
.etiqueta {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 11px 0 9px;
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 999px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
  white-space: nowrap;
}

.etiqueta i {
  flex: none;
  color: var(--tinta-3);
  font-size: 14px;
}

/*
 * O fio do agora: atravessa as colunas **por trás dos cartões**. Por cima, ele caía no meio da
 * segunda linha de texto de qualquer atendimento em curso e o nome aparecia riscado — a marca de
 * "cancelado" na única consulta que está acontecendo. A hora fica no eixo, acima de tudo.
 */
.agora {
  position: absolute;
  inset-inline: var(--clinic-time-axis-width) 0;
  z-index: 0;
  border-top: 2px solid var(--clinica);
  pointer-events: none;
}

.agora::before {
  position: absolute;
  top: -6px;
  inset-inline-start: -6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--clinica);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--clinica) 22%, transparent);
  content: '';
}

/* ----------------------------------------------------------------------------- arraste */

/*
 * Destino do arraste: faixa larga por trás do fantasma, atravessando a coluna inteira. Fica
 * **atrás** dos cartões de propósito — mostra contra o que o horário está batendo, sem cobrir.
 */
.destino {
  position: absolute;
  inset-inline-start: 0;
  z-index: 1;
  width: 100%;
  border: 1px dashed var(--clinica);
  border-radius: 10px;
  background: color-mix(in oklab, var(--clinica-fundo) 70%, transparent);
  pointer-events: none;
}

.destino--conflito {
  border-color: var(--atencao);
  background: color-mix(in oklab, var(--atencao-fundo) 80%, transparent);
}

/*
 * O aviso acompanha o fantasma e some com ele. Largura mínima maior que a coluna: um choque de
 * sala tem nome comprido, e cortá-lo devolve o problema de não saber contra o quê se bate.
 */
.destino__aviso {
  position: absolute;
  inset-inline-start: 0;
  z-index: 7;
  display: flex;
  align-items: flex-start;
  gap: 6px;
  min-width: max(100%, 12rem);
  max-width: 20rem;
  margin: 0;
  padding: 6px 10px;
  border: 1px solid color-mix(in oklab, var(--atencao) 45%, transparent);
  border-radius: 10px;
  background: var(--atencao-fundo);
  box-shadow: var(--sombra-2);
  color: var(--atencao-tinta);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1.35;
  pointer-events: none;
}

.destino__aviso i {
  margin-top: 1px;
  font-size: 15px;
}

/* ------------------------------------------------------------------------------ rodapé */

.grade__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 24px;
  padding: 10px 16px;
  border-top: 1px solid var(--linha);
  background: var(--grade-poco);
}

.grade__dica {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
  line-height: 1.4;
}

.grade__dica i {
  flex: none;
  font-size: 16px;
}

/* A chave do estado: as mesmas quatro variáveis do cartão (`AgendaAppointmentCard`). */
.grade__estados {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  list-style: none;
}

.grade__estados li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.grade__amostra {
  width: 16px;
  height: 12px;
  flex: none;
  border: 1px solid var(--estado-borda, var(--linha));
  border-radius: 4px;
  background: var(--estado-fundo);
  box-shadow: inset 3px 0 0 var(--estado);
}

.grade__estado--agendado {
  --estado: var(--linha-forte);
  --estado-fundo: var(--superficie);
  --estado-borda: var(--linha-media);
}

.grade__estado--confirmado {
  --estado: var(--clinica);
  --estado-fundo: color-mix(in oklab, var(--clinica-fundo) 60%, var(--superficie));
  --estado-borda: color-mix(in oklab, var(--clinica) 22%, var(--linha));
}

.grade__estado--aguardando {
  --estado: var(--atencao);
  --estado-fundo: color-mix(in oklab, var(--atencao-fundo) 88%, var(--superficie));
  --estado-borda: color-mix(in oklab, var(--atencao) 42%, var(--linha));
}

.grade__estado--em-atendimento {
  --estado: var(--clinica);
  --estado-fundo: var(--clinica-fundo);
  --estado-borda: color-mix(in oklab, var(--clinica) 55%, var(--linha));
}

.grade__estado--finalizado {
  --estado: var(--linha-media);
  --estado-fundo: var(--superficie-2);
  --estado-borda: var(--linha-suave);
}

.grade__estado--falta {
  --estado: var(--risco);
  --estado-fundo: color-mix(in oklab, var(--risco-fundo) 70%, var(--superficie));
  --estado-borda: color-mix(in oklab, var(--risco) 32%, var(--linha));
}

.grade__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
