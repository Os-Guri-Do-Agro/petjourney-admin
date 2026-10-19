<script setup lang="ts">
/**
 * A agenda do dia em tabela: uma linha por meia hora, uma coluna por profissional (ou sala).
 *
 * A grade proporcional — o bloco do tamanho da duração — desenha bem um dia folgado e desmancha um
 * dia cheio: dois atendimentos no mesmo horário dividiam a coluna ou se empilhavam um sobre o
 * outro, a consulta de 15 minutos virava uma tira de 10 px com o nome cortado. Clínica cheia é o
 * caso normal, e é para ele que esta vista existe:
 *
 * - **Cada atendimento é uma linha**, sempre da mesma altura: rosto, nome, e os ícones de origem e
 *   de alerta à direita. Dois no mesmo horário ficam um embaixo do outro e a linha da tabela
 *   cresce — nada se sobrepõe, nada é cortado.
 * - **O estado é a faixa da esquerda e o fundo**: agendado neutro, confirmado em azul claro, na
 *   recepção em âmbar, em atendimento no azul da Clínica, finalizado esmaecido, falta em vermelho,
 *   cancelado riscado. É a única cor de fundo da tabela, e é o que muda ao longo do dia.
 * - **A duração aparece onde importa.** O procedimento que atravessa a meia hora seguinte continua
 *   como uma faixa na cor do estado ("Bento até 15:30"): o horário está ocupado e se lê.
 * - **O agora é um fio** na cor da Clínica, na altura exata do minuto, com a hora num rótulo.
 * - **Horário vazio é alvo**: clicar marca ali; arrastar um atendimento para outra célula propõe a
 *   remarcação, que passa pela mesma confirmação da linha do tempo.
 *
 * Os dados são os mesmos da linha do tempo (`useAgendaDia`): filtros, agrupamento por sala,
 * conflitos e bloqueios valem igual nas duas vistas.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import { ICONE_DA_ORIGEM, ICONE_DO_ALERTA, ICONE_DO_BLOQUEIO } from './agenda-icones'
import type { CardAgenda, ColunaAgenda, FaixaBloqueio } from '../../composables/useAgendaDia'
import { useAgendaDia } from '../../composables/useAgendaDia'
import type { ArrasteProposta } from '../../composables/useAgendaDrag'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Pet } from '../../data/types'
import { aparenciaDoTipo } from '../../domain/appointment-kind'
import { severidadeMaxima } from '../../domain/conflicts'
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

/* A tabela não virtualiza: cada linha é meia hora e o dia inteiro tem umas 25. */
const grade = useAgendaDia(ref(0), ref(0))
const { colunas, limites, faixasDaClinica, passoDaGrade } = grade

/** Meia hora por linha: o que a recepção fala ("às nove e meia") e o que cabe sem rolar demais. */
const LINHA_EM_MINUTOS = 30

type Linha = {
  minuto: number
  rotulo: string
  cheia: boolean
  /** Bloqueio da clínica inteira que cobre esta linha e as seguintes: vira uma linha só. */
  fechada: {
    motivo: FaixaBloqueio['bloqueio']['motivo']
    detalhe: string
    ate: string
  } | null
}

const linhas = computed<Linha[]>(() => {
  const inicio = Math.floor(limites.value.inicio / LINHA_EM_MINUTOS) * LINHA_EM_MINUTOS
  const fim = Math.ceil(limites.value.fim / LINHA_EM_MINUTOS) * LINHA_EM_MINUTOS
  const lista: Linha[] = []

  for (let minuto = inicio; minuto < fim; minuto += LINHA_EM_MINUTOS) {
    const bloqueio = bloqueioDaClinica(minuto)
    const anterior = lista.at(-1)

    /* Almoço das 12h às 13h é uma linha, não duas com "Almoço" repetido. */
    if (bloqueio && anterior?.fechada && anterior.fechada.motivo === bloqueio.bloqueio.motivo) {
      continue
    }

    lista.push({
      minuto,
      rotulo: rotuloDoMinuto(minuto),
      cheia: minuto % 60 === 0,
      fechada: bloqueio
        ? {
            motivo: bloqueio.bloqueio.motivo,
            detalhe: bloqueio.bloqueio.detalhe,
            ate: rotuloDoMinuto(clinicClock.minutesFrom(bloqueio.bloqueio.fim, agenda.data)),
          }
        : null,
    })
  }

  return lista
})

/** Onde a tabela termina, em minutos: o fim da última linha. */
const fimDaTabela = computed(
  () => Math.ceil(limites.value.fim / LINHA_EM_MINUTOS) * LINHA_EM_MINUTOS,
)

function rotuloDoMinuto(minuto: number) {
  return `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`
}

function minutosDaFaixa(faixa: FaixaBloqueio) {
  return {
    inicio: clinicClock.minutesFrom(faixa.bloqueio.inicio, agenda.data),
    fim: clinicClock.minutesFrom(faixa.bloqueio.fim, agenda.data),
  }
}

/** Bloqueio da clínica inteira que cobre a meia hora toda — vira uma faixa só, de ponta a ponta. */
function bloqueioDaClinica(minuto: number) {
  return (
    faixasDaClinica.value.find((faixa) => {
      const { inicio, fim } = minutosDaFaixa(faixa)

      return inicio <= minuto && fim >= minuto + LINHA_EM_MINUTOS
    }) ?? null
  )
}

function bloqueioDaColuna(coluna: ColunaAgenda, minuto: number) {
  return (
    coluna.faixas.find((faixa) => {
      const { inicio, fim } = minutosDaFaixa(faixa)

      return inicio < minuto + LINHA_EM_MINUTOS && fim > minuto
    }) ?? null
  )
}

/**
 * O motivo do bloqueio é escrito uma vez, na meia hora em que ele começa: a folga da tarde inteira
 * repetindo "Bloqueio pessoal" em seis linhas virava parede de texto. As outras ficam só com o
 * hachurado, que já diz "fechado".
 */
function bloqueioComecaAqui(faixa: FaixaBloqueio, minuto: number) {
  const { inicio } = minutosDaFaixa(faixa)

  return inicio >= minuto || minuto === linhas.value[0]?.minuto
}

function tituloDoBloqueio(faixa: FaixaBloqueio) {
  const motivo = formato.motivoBloqueio(faixa.bloqueio.motivo)

  return faixa.bloqueio.detalhe ? `${motivo}: ${faixa.bloqueio.detalhe}` : motivo
}

/** Os atendimentos que começam nesta meia hora, nesta coluna, na ordem do horário. */
function queComecam(coluna: ColunaAgenda, minuto: number): CardAgenda[] {
  return coluna.cards.filter(
    (card) => card.inicioMin >= minuto && card.inicioMin < minuto + LINHA_EM_MINUTOS,
  )
}

/**
 * Os que vêm de antes e ocupam esta meia hora inteira: a cirurgia das 13:30 às 15:30 aparece como
 * faixa às 14:00, 14:30 e 15:00. Quem só encosta na linha (a consulta das 9:15 às 9:45) não
 * repete — a faixa existe para mostrar horário tomado, não para ecoar cada atendimento.
 */
function queContinuam(coluna: ColunaAgenda, minuto: number): CardAgenda[] {
  return coluna.cards.filter(
    (card) =>
      !card.liberouHorario && card.inicioMin < minuto && card.fimMin >= minuto + LINHA_EM_MINUTOS,
  )
}

/** A primeira meia hora depois da que o atendimento começou: é nela que a faixa diz o nome. */
function primeiraContinuacao(card: CardAgenda, minuto: number) {
  return (
    Math.floor(card.inicioMin / LINHA_EM_MINUTOS) * LINHA_EM_MINUTOS + LINHA_EM_MINUTOS === minuto
  )
}

// ------------------------------------------------------------------ a linha de cada atendimento

/** Só o que é risco vira ícone na agenda: o resto mora na ficha e no painel do atendimento. */
function alertasDeRisco(card: CardAgenda) {
  return (card.pet?.alertas ?? []).filter((alerta) => alerta.severidade === 'risco')
}

function textoDoAlerta(alerta: Pet['alertas'][number]) {
  return alerta.detalhe
    ? `${formato.alerta(alerta.kind)}: ${alerta.detalhe}`
    : formato.alerta(alerta.kind)
}

/**
 * Aviso de choque só onde ainda dá para agir: agendado, confirmado, na recepção. A sobreposição de
 * uma consulta já finalizada é história — marcada em metade dos atendimentos do dia, ela virava
 * textura e escondia o aviso que importava (o retorno das 10h que invade a manutenção da sala).
 */
const AINDA_SE_DECIDE = ['agendado', 'confirmado', 'aguardando']

function temAviso(card: CardAgenda) {
  if (!AINDA_SE_DECIDE.includes(card.appointment.status)) {
    return false
  }

  const severidade = severidadeMaxima(card.conflitos)

  return severidade === 'warning' || severidade === 'blocking'
}

function textoDosAvisos(card: CardAgenda) {
  return card.conflitos
    .filter((conflito) => conflito.severity !== 'info')
    .map(formato.conflito)
    .join(' · ')
}

function rotuloDoCard(card: CardAgenda) {
  const partes = [
    formato.intervalo(card.appointment.inicio, card.appointment.fim),
    card.pet?.nome ?? '',
    card.tipo?.nome ?? '',
    formato.status(card.appointment.status),
    card.appointment.encaixe ? t('clinico.agenda.tabela.encaixe') : '',
    ICONE_DA_ORIGEM[card.appointment.origem] ? t(`clinico.origem.${card.appointment.origem}`) : '',
    ...alertasDeRisco(card).map(textoDoAlerta),
  ]

  if (temAviso(card)) {
    partes.push(textoDosAvisos(card))
  }

  return partes.filter(Boolean).join(' · ')
}

/** Falta a um clique, para quem já devia ter chegado — como no cartão da linha do tempo. */
function podeMarcarFalta(card: CardAgenda) {
  return (
    ['agendado', 'confirmado'].includes(card.appointment.status) &&
    clinicClock.nowIso() > card.appointment.inicio
  )
}

// ------------------------------------------------------------------ agora

const agoraMinuto = ref(clinicClock.now().minutes)
const ehHoje = computed(() => agenda.data === clinicClock.today())

/**
 * A linha da tabela onde o agora cai, e a que altura dela: o fio é desenhado na proporção exata
 * do minuto dentro da meia hora (ou dentro da faixa do almoço, que ocupa uma linha só).
 */
const agora = computed(() => {
  if (!ehHoje.value) {
    return null
  }

  const lista = linhas.value

  for (const [indice, linha] of lista.entries()) {
    const fim = lista[indice + 1]?.minuto ?? fimDaTabela.value

    if (agoraMinuto.value >= linha.minuto && agoraMinuto.value < fim) {
      return {
        minuto: linha.minuto,
        fracao: (agoraMinuto.value - linha.minuto) / Math.max(fim - linha.minuto, 1),
        rotulo: rotuloDoMinuto(agoraMinuto.value),
      }
    }
  }

  return null
})

function ehLinhaDoAgora(minuto: number) {
  return agora.value?.minuto === minuto
}

/**
 * Quando o agora cai no começo da meia hora, o rótulo dele ficaria por cima da hora da linha e as
 * duas apareceriam pela metade. A hora da linha sai: o rótulo do agora já diz em que hora se está.
 */
function rotuloCoberto(minuto: number) {
  return ehLinhaDoAgora(minuto) && (agora.value?.fracao ?? 1) < 0.45
}

const rolagem = ref<HTMLElement | null>(null)
let relogio: ReturnType<typeof setInterval> | null = null

/* Hoje, a tabela abre na meia hora de agora — e não às 8h, quando já são 15h. */
onMounted(async () => {
  agoraMinuto.value = clinicClock.now().minutes
  relogio = setInterval(() => {
    agoraMinuto.value = clinicClock.now().minutes
  }, 30_000)

  if (!ehHoje.value) {
    return
  }

  await nextTick()
  const linha = rolagem.value?.querySelector<HTMLElement>('.tabela__linha--atual')

  if (linha && rolagem.value) {
    rolagem.value.scrollTop = Math.max(linha.offsetTop - rolagem.value.clientHeight / 3, 0)
  }
})

onBeforeUnmount(() => {
  if (relogio) {
    clearInterval(relogio)
  }
})

// ------------------------------------------------------------------ marcar e remarcar

function criarEm(coluna: ColunaAgenda, minuto: number) {
  if (coluna.professionalId) {
    emit('criarEm', { professionalId: coluna.professionalId, minuto })
  }
}

function celulaLivre(coluna: ColunaAgenda, minuto: number) {
  return (
    Boolean(coluna.professionalId) &&
    !bloqueioDaColuna(coluna, minuto) &&
    queComecam(coluna, minuto).length === 0 &&
    queContinuam(coluna, minuto).length === 0
  )
}

const arrastando = ref<CardAgenda | null>(null)
const alvo = ref<string | null>(null)

function chaveDaCelula(coluna: ColunaAgenda, minuto: number) {
  return `${coluna.id}:${minuto}`
}

function aoComecarArraste(evento: DragEvent, card: CardAgenda) {
  arrastando.value = card
  evento.dataTransfer?.setData('text/plain', card.id)

  if (evento.dataTransfer) {
    evento.dataTransfer.effectAllowed = 'move'
  }
}

function aoTerminarArraste() {
  arrastando.value = null
  alvo.value = null
}

/**
 * Soltar numa célula propõe o horário pela altura do ponteiro dentro dela, em passos da agenda:
 * na metade de baixo da linha das 10:00, cai às 10:15. A duração continua a mesma.
 */
function aoSoltar(evento: DragEvent, coluna: ColunaAgenda, minuto: number) {
  const card = arrastando.value
  const celula = evento.currentTarget as HTMLElement | null

  aoTerminarArraste()

  if (!card || !celula) {
    return
  }

  const caixa = celula.getBoundingClientRect()
  const proporcao = caixa.height > 0 ? (evento.clientY - caixa.top) / caixa.height : 0
  const passo = passoDaGrade.value
  const deslocamento = Math.min(
    Math.floor((proporcao * LINHA_EM_MINUTOS) / passo) * passo,
    LINHA_EM_MINUTOS - passo,
  )
  const inicioMin = minuto + Math.max(deslocamento, 0)
  const duracao = card.fimMin - card.inicioMin

  if (
    inicioMin === card.inicioMin &&
    (coluna.professionalId ?? null) === card.appointment.professionalId
  ) {
    return
  }

  emit('propor', {
    appointment: card.appointment,
    inicio: clinicClock.toIso(agenda.data, inicioMin),
    fim: clinicClock.toIso(agenda.data, inicioMin + duracao),
    professionalId: coluna.professionalId ?? card.appointment.professionalId,
    roomIds: coluna.roomId ? [coluna.roomId] : card.appointment.roomIds,
    redimensionou: false,
  })
}

/** Ocupação acima de 85% é dia apertado; acima de 100%, vendido além do expediente. */
function tomDaOcupacao(ocupacao: number) {
  if (ocupacao > 1) {
    return 'risco'
  }

  return ocupacao >= 0.85 ? 'atencao' : 'normal'
}
</script>

<template>
  <section
    class="tabela ui-folha clinic-scope"
    :aria-label="t('clinico.agenda.tabela.rotulo')"
    :style="{ '--colunas': Math.max(colunas.length, 1) }"
  >
    <div ref="rolagem" class="tabela__rolagem">
      <table class="tabela__grade">
        <thead>
          <tr>
            <th scope="col" class="tabela__eixo-cabeca">
              <span class="tabela__sr">{{ t('clinico.agenda.tabela.horario') }}</span>
            </th>
            <th v-for="coluna in colunas" :key="coluna.id" scope="col" class="tabela__coluna">
              <span class="tabela__coluna-nome" :title="coluna.titulo">
                <span
                  class="tabela__coluna-cor"
                  :style="{ background: coluna.cor }"
                  aria-hidden="true"
                />
                <span class="tabela__coluna-titulo">{{ coluna.titulo }}</span>
              </span>
              <span
                class="tabela__ocupacao"
                :class="`tabela__ocupacao--${tomDaOcupacao(coluna.ocupacao)}`"
                :title="`${t('clinico.agenda.tabela.ocupacao')}: ${formato.percentual(coluna.ocupacao)}`"
              >
                <span class="tabela__ocupacao-trilho" aria-hidden="true">
                  <span :style="{ inlineSize: `${Math.min(coluna.ocupacao, 1) * 100}%` }" />
                </span>
                <span class="ui-num">{{ formato.percentual(coluna.ocupacao) }}</span>
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          <template v-for="linha in linhas" :key="linha.minuto">
            <!-- Almoço e bloqueio da clínica inteira: uma faixa só, atravessando as colunas. -->
            <tr
              v-if="linha.fechada"
              class="tabela__linha tabela__linha--fechada"
              :class="{
                'tabela__linha--cheia': linha.cheia,
                'tabela__linha--atual': ehLinhaDoAgora(linha.minuto),
              }"
              :style="ehLinhaDoAgora(linha.minuto) ? { '--agora': agora!.fracao } : undefined"
            >
              <th scope="row" class="tabela__hora">
                <span
                  class="tabela__hora-rotulo"
                  :class="{ 'tabela__hora-rotulo--coberto': rotuloCoberto(linha.minuto) }"
                >
                  {{ linha.rotulo }}
                </span>
                <span v-if="ehLinhaDoAgora(linha.minuto)" class="tabela__agora-rotulo ui-num">
                  <span class="tabela__sr">{{ t('clinico.agenda.tabela.agora') }}</span>
                  {{ agora!.rotulo }}
                </span>
              </th>
              <td :colspan="colunas.length" class="tabela__faixa">
                <span class="tabela__etiqueta">
                  <i :class="ICONE_DO_BLOQUEIO[linha.fechada.motivo]" aria-hidden="true" />
                  <strong>{{ formato.motivoBloqueio(linha.fechada.motivo) }}</strong>
                  <span v-if="linha.fechada.detalhe" class="tabela__etiqueta-detalhe">
                    {{ linha.fechada.detalhe }}
                  </span>
                  <span class="tabela__etiqueta-ate ui-num">
                    {{ t('clinico.agenda.tabela.ate', { hora: linha.fechada.ate }) }}
                  </span>
                </span>
              </td>
            </tr>

            <tr
              v-else
              class="tabela__linha"
              :class="{
                'tabela__linha--atual': ehLinhaDoAgora(linha.minuto),
                'tabela__linha--cheia': linha.cheia,
              }"
              :style="ehLinhaDoAgora(linha.minuto) ? { '--agora': agora!.fracao } : undefined"
            >
              <th scope="row" class="tabela__hora">
                <span
                  class="tabela__hora-rotulo"
                  :class="{ 'tabela__hora-rotulo--coberto': rotuloCoberto(linha.minuto) }"
                >
                  {{ linha.rotulo }}
                </span>
                <span v-if="ehLinhaDoAgora(linha.minuto)" class="tabela__agora-rotulo ui-num">
                  <span class="tabela__sr">{{ t('clinico.agenda.tabela.agora') }}</span>
                  {{ agora!.rotulo }}
                </span>
              </th>

              <td
                v-for="coluna in colunas"
                :key="coluna.id"
                class="tabela__celula"
                :class="{
                  'tabela__celula--bloqueada': bloqueioDaColuna(coluna, linha.minuto),
                  'tabela__celula--alvo': alvo === chaveDaCelula(coluna, linha.minuto),
                }"
                @dragover.prevent="alvo = chaveDaCelula(coluna, linha.minuto)"
                @dragleave="alvo === chaveDaCelula(coluna, linha.minuto) && (alvo = null)"
                @drop.prevent="aoSoltar($event, coluna, linha.minuto)"
              >
                <!--
                  O que vem de antes e ainda ocupa esta meia hora: a célula inteira na cor clara do
                  estado, com a faixa da esquerda — horário tomado, sem repetir o atendimento.
                -->
                <span
                  v-if="queContinuam(coluna, linha.minuto).length > 0"
                  class="continua-fundo"
                  :class="`estado--${queContinuam(coluna, linha.minuto)[0]!.appointment.status}`"
                  aria-hidden="true"
                />

                <ul class="tabela__lista">
                  <li
                    v-if="
                      bloqueioDaColuna(coluna, linha.minuto) &&
                      bloqueioComecaAqui(bloqueioDaColuna(coluna, linha.minuto)!, linha.minuto)
                    "
                    class="tabela__bloqueio"
                  >
                    <span
                      class="tabela__etiqueta"
                      :title="tituloDoBloqueio(bloqueioDaColuna(coluna, linha.minuto)!)"
                    >
                      <i
                        :class="ICONE_DO_BLOQUEIO[bloqueioDaColuna(coluna, linha.minuto)!.bloqueio.motivo]"
                        aria-hidden="true"
                      />
                      <strong>{{
                        formato.motivoBloqueio(bloqueioDaColuna(coluna, linha.minuto)!.bloqueio.motivo)
                      }}</strong>
                      <span class="tabela__etiqueta-ate ui-num">
                        {{
                          t('clinico.agenda.tabela.ate', {
                            hora: formato.hora(bloqueioDaColuna(coluna, linha.minuto)!.bloqueio.fim),
                          })
                        }}
                      </span>
                    </span>
                  </li>

                  <!-- O nome só na primeira meia hora da continuação; nas seguintes, o fundo basta. -->
                  <li
                    v-for="card in queContinuam(coluna, linha.minuto).filter((item) =>
                      primeiraContinuacao(item, linha.minuto),
                    )"
                    :key="`continua-${card.id}`"
                    class="continua"
                    :class="`estado--${card.appointment.status}`"
                  >
                    <span class="continua__nome">{{ card.pet?.nome }}</span>
                    <span class="ui-num">{{
                      t('clinico.agenda.tabela.ate', { hora: formato.hora(card.appointment.fim) })
                    }}</span>
                  </li>

                  <li v-for="card in queComecam(coluna, linha.minuto)" :key="card.id">
                    <div
                      class="marcacao"
                      :class="[
                        `estado--${card.appointment.status}`,
                        { 'marcacao--selecionada': agenda.focoId === card.id },
                      ]"
                      draggable="true"
                      @dragstart="aoComecarArraste($event, card)"
                      @dragend="aoTerminarArraste"
                    >
                      <button
                        type="button"
                        class="marcacao__abrir"
                        :aria-label="rotuloDoCard(card)"
                        :title="rotuloDoCard(card)"
                        @click="emit('abrir', card.id)"
                      >
                        <PetAvatar
                          class="marcacao__rosto"
                          :nome="card.pet?.nome ?? ''"
                          :iniciais="card.pet?.iniciais ?? ''"
                          :especie="card.pet?.especie ?? null"
                          :foto-url="card.pet?.fotoUrl ?? ''"
                          tamanho="sm"
                        />
                        <!--
                          A linha da tabela já diz a hora cheia: o cartão só repete quando foge dela
                          (09:15). O encaixe mostra sempre a hora, num selo âmbar: é a marca dele
                          que cabe até na coluna estreita.
                        -->
                        <span
                          v-if="card.inicioMin !== linha.minuto || card.appointment.encaixe"
                          class="marcacao__hora ui-num"
                          :class="{ 'marcacao__hora--encaixe': card.appointment.encaixe }"
                          :title="card.appointment.encaixe ? t('clinico.agenda.tabela.encaixe') : undefined"
                        >
                          {{ formato.hora(card.appointment.inicio) }}
                        </span>
                        <span class="marcacao__nome">{{ card.pet?.nome }}</span>

                        <!-- Os ícones em ordem de importância: o que não couber sai pela direita. -->
                        <span class="marcacao__icones" aria-hidden="true">
                          <component
                            :is="ICONE_DO_ALERTA[alerta.kind]"
                            v-for="alerta in alertasDeRisco(card)"
                            :key="alerta.id"
                            class="marcacao__risco"
                            weight="fill"
                            :title="textoDoAlerta(alerta)"
                          />
                          <i
                            v-if="temAviso(card)"
                            class="ph ph-warning-circle marcacao__aviso"
                            :title="textoDosAvisos(card)"
                          />
                          <i
                            v-if="card.appointment.status === 'falta'"
                            class="ph ph-user-minus marcacao__falta-icone"
                            :title="formato.status('falta')"
                          />
                          <span v-if="card.appointment.encaixe" class="marcacao__encaixe">
                            {{ t('clinico.agenda.tabela.encaixe') }}
                          </span>
                          <!-- Marcado pelo responsável, no app ou no link: a origem à vista. -->
                          <i
                            v-if="ICONE_DA_ORIGEM[card.appointment.origem]"
                            :class="['marcacao__origem', ICONE_DA_ORIGEM[card.appointment.origem]]"
                            :title="t(`clinico.origem.${card.appointment.origem}`)"
                          />
                          <i
                            v-if="aparenciaDoTipo(card.tipo?.kind).icone"
                            :class="['marcacao__tipo', aparenciaDoTipo(card.tipo?.kind).icone]"
                            :style="{ color: aparenciaDoTipo(card.tipo?.kind).cor }"
                            :title="card.tipo?.nome"
                          />
                        </span>
                      </button>

                      <button
                        v-if="podeMarcarFalta(card)"
                        type="button"
                        class="marcacao__falta"
                        :title="t('clinico.faltas.marcar')"
                        :aria-label="`${t('clinico.faltas.marcar')}: ${card.pet?.nome ?? ''}`"
                        @click.stop="emit('marcarFalta', card.id)"
                      >
                        <i class="ph ph-user-minus" aria-hidden="true" />
                      </button>
                    </div>
                  </li>
                </ul>

                <!-- Horário livre é alvo: a recepção marca clicando onde vê o vazio. -->
                <button
                  v-if="celulaLivre(coluna, linha.minuto)"
                  type="button"
                  class="tabela__marcar"
                  :aria-label="
                    t('clinico.agenda.tabela.marcarAs', { hora: linha.rotulo, nome: coluna.titulo })
                  "
                  @click="criarEm(coluna, linha.minuto)"
                >
                  <span class="tabela__marcar-rotulo" aria-hidden="true">
                    <i class="ph ph-plus" />
                    <span class="ui-num">{{ linha.rotulo }}</span>
                  </span>
                </button>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p class="tabela__dica">
      <i class="ph ph-hand-grabbing" aria-hidden="true" />
      {{ t('clinico.agenda.tabela.dica') }}
    </p>
  </section>
</template>

<style scoped>
/*
 * A altura da linha acompanha a densidade escolhida no menu Exibição: a recepção que quer o dia
 * inteiro na tela escolhe "compacta"; quem prefere respiro, "confortável".
 */
.tabela {
  --tabela-eixo: 4.75rem;
  --tabela-linha: 46px;
  --tabela-coluna-minima: 7.5rem;
  --linha-de-meia-hora: color-mix(in oklab, var(--linha) 55%, transparent);

  display: grid;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
}

:root[data-clinic-density='compacta'] .tabela {
  --tabela-linha: 38px;
}

:root[data-clinic-density='confortavel'] .tabela {
  --tabela-linha: 56px;
}

.tabela__rolagem {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.tabela__grade {
  width: 100%;
  min-width: calc(var(--tabela-eixo) + var(--colunas) * var(--tabela-coluna-minima));
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

/* --------------------------------------------------------------------------- cabeçalho */

.tabela__grade thead th {
  position: sticky;
  top: 0;
  z-index: 4;
  padding: 14px 14px 12px;
  border-bottom: 1px solid var(--linha);
  background: var(--superficie);
  text-align: start;
  vertical-align: bottom;
}

.tabela__grade thead th + th {
  border-inline-start: 1px solid var(--linha);
}

.tabela__eixo-cabeca {
  left: 0;
  z-index: 5 !important;
  width: var(--tabela-eixo);
}

.tabela__coluna-nome {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.3;
}

.tabela__coluna-titulo {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabela__coluna-cor {
  width: 10px;
  height: 10px;
  flex: none;
  border-radius: 50%;
}

/* A ocupação: barrinha fina e o número — a barra localiza, o número compara. */
.tabela__ocupacao {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.tabela__ocupacao-trilho {
  display: block;
  height: 4px;
  flex: 1;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-3);
}

.tabela__ocupacao-trilho > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--clinica);
}

.tabela__ocupacao--atencao {
  color: var(--atencao-tinta);
}

.tabela__ocupacao--atencao .tabela__ocupacao-trilho > span {
  background: var(--atencao);
}

.tabela__ocupacao--risco {
  color: var(--risco-tinta);
}

.tabela__ocupacao--risco .tabela__ocupacao-trilho > span {
  background: var(--risco);
}

/* ------------------------------------------------------------------------------ linhas */

.tabela__linha > * {
  border-top: 1px solid var(--linha-de-meia-hora);
}

/* A hora cheia tem o fio cheio; a meia hora, o sutil. O olho acha "as 14h" sem ler cada linha. */
.tabela__linha--cheia > * {
  border-top-color: var(--linha);
}

tbody > .tabela__linha:first-child > * {
  border-top-color: transparent;
}

.tabela__hora {
  position: sticky;
  left: 0;
  z-index: 3;
  padding: 7px 10px 0 16px;
  border-inline-end: 1px solid var(--linha);
  background: var(--superficie);
  text-align: start;
  vertical-align: top;
}

.tabela__hora-rotulo {
  display: block;
  color: var(--tinta-3);
  font-family: var(--font-dados);
  font-size: 12.5px;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
  line-height: 1.2;
}

.tabela__hora-rotulo--coberto {
  visibility: hidden;
}

.tabela__linha--cheia .tabela__hora-rotulo {
  color: var(--tinta);
  font-size: 14px;
  font-weight: 650;
}

.tabela__celula {
  position: relative;
  min-width: 0;
  height: var(--tabela-linha);
  padding: 5px 6px;
  border-inline-start: 1px solid var(--linha);
  vertical-align: top;
}

.tabela__hora + .tabela__celula {
  border-inline-start: 0;
}

.tabela__celula--alvo {
  background: color-mix(in oklab, var(--clinica-fundo) 70%, transparent);
  outline: 2px dashed var(--clinica);
  outline-offset: -3px;
}

/* Bloqueio é hachurado discreto: fechado, mas sem gritar. */
.tabela__celula--bloqueada,
.tabela__faixa {
  background-color: color-mix(in oklab, var(--superficie-2) 70%, var(--superficie));
  background-image: repeating-linear-gradient(
    135deg,
    transparent 0 7px,
    color-mix(in oklab, var(--linha) 85%, transparent) 7px 8px
  );
}

.tabela__faixa {
  height: 40px;
  padding: 0 12px;
  vertical-align: middle;
}

.tabela__linha--fechada .tabela__hora {
  padding-top: 0;
  vertical-align: middle;
}

/* O motivo do bloqueio numa etiqueta de papel: legível por cima do hachurado. */
.tabela__etiqueta {
  display: inline-flex;
  max-width: 100%;
  align-items: center;
  gap: 6px;
  min-height: 26px;
  padding: 0 10px;
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 999px;
  background: var(--superficie);
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.tabela__etiqueta i {
  flex: none;
  font-size: 14px;
}

.tabela__etiqueta strong {
  color: var(--tinta);
  font-weight: 600;
}

.tabela__etiqueta-detalhe {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tabela__etiqueta-ate {
  color: var(--tinta-3);
}

.tabela__bloqueio {
  min-width: 0;
}

/* ----------------------------------------------------------------------- o agora */

/*
 * O fio do agora atravessa a linha inteira, na altura do minuto. Cada célula desenha o seu trecho
 * e, como todas têm a mesma altura, os trechos se emendam num fio só. Fica por trás dos
 * atendimentos: por cima, riscaria justamente a consulta que está acontecendo.
 */
.tabela__linha--atual > *::after {
  position: absolute;
  top: calc(var(--agora, 0) * 100%);
  right: 0;
  left: 0;
  z-index: 1;
  border-top: 2px solid var(--clinica);
  content: '';
  pointer-events: none;
}

.tabela__agora-rotulo {
  position: absolute;
  top: calc(var(--agora, 0) * 100%);
  left: 8px;
  z-index: 2;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--clinica-tinta);
  color: var(--superficie);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.3;
  transform: translateY(-50%);
}

/* A lista fica acima do fio e abaixo das etiquetas: é ela que recebe o olho. */
.tabela__lista {
  position: relative;
  z-index: 2;
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* --------------------------------------------------------------------- horário livre */

.tabela__marcar {
  position: absolute;
  inset: 3px;
  z-index: 1;
  display: grid;
  padding: 0;
  border: 1px dashed transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--clinica-tinta);
  cursor: pointer;
  font: inherit;
  place-items: center;
}

.tabela__marcar-rotulo {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12.5px;
  font-weight: 600;
  opacity: 0;
  transition: opacity var(--pj-tempo-curto) var(--pj-curva-chega);
}

.tabela__marcar:hover,
.tabela__marcar:focus-visible {
  border-color: color-mix(in oklab, var(--clinica) 55%, transparent);
  background: color-mix(in oklab, var(--clinica-fundo) 65%, transparent);
}

.tabela__marcar:hover .tabela__marcar-rotulo,
.tabela__marcar:focus-visible .tabela__marcar-rotulo {
  opacity: 1;
}

.tabela__marcar:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 0;
}

/* Dedo não tem hover: no toque, o "+" fica à vista, baixinho. */
@media (hover: none) {
  .tabela__marcar-rotulo {
    opacity: 0.5;
  }
}

/* ------------------------------------------------------------------------ o estado */

/*
 * A cor do estado num lugar só: a faixa da esquerda (`--estado`), o fundo (`--estado-fundo`) e a
 * borda (`--estado-borda`). O atendimento e a sua continuação leem as mesmas três.
 */
.estado--agendado {
  --estado: var(--linha-forte);
  --estado-fundo: var(--superficie);
}

.estado--confirmado {
  --estado: color-mix(in oklab, var(--clinica) 55%, var(--superficie));
  --estado-fundo: color-mix(in oklab, var(--clinica-fundo) 45%, var(--superficie));
}

.estado--aguardando {
  --estado: var(--atencao);
  --estado-fundo: color-mix(in oklab, var(--atencao-fundo) 80%, var(--superficie));
  --estado-borda: color-mix(in oklab, var(--atencao) 35%, var(--linha));
}

.estado--em-atendimento {
  --estado: var(--clinica);
  --estado-fundo: var(--clinica-fundo);
  --estado-borda: color-mix(in oklab, var(--clinica) 40%, var(--linha));
}

.estado--finalizado {
  --estado: var(--linha);
  --estado-fundo: var(--superficie-2);
}

.estado--falta {
  --estado: var(--risco);
  --estado-fundo: color-mix(in oklab, var(--risco-fundo) 55%, var(--superficie));
  --estado-borda: color-mix(in oklab, var(--risco) 30%, var(--linha));
}

.estado--cancelado {
  --estado: var(--linha-forte);
  --estado-fundo: transparent;
}

/* ------------------------------------------------------------------- o atendimento */

.marcacao {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  border: 1px solid var(--estado-borda, var(--linha));
  border-inline-start: 3px solid var(--estado);
  border-radius: 8px;
  background: var(--estado-fundo);
  color: var(--tinta);
  cursor: grab;
}

.marcacao__abrir {
  display: flex;
  min-width: 0;
  min-height: 34px;
  flex: 1;
  align-items: center;
  gap: 6px;
  padding: 3px 8px 3px 5px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: inherit;
  cursor: inherit;
  font: inherit;
  overflow: hidden;
  text-align: start;
}

.marcacao__abrir:hover {
  background: color-mix(in oklab, var(--tinta) 5%, transparent);
}

.marcacao__abrir:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 2px;
}

.marcacao--selecionada {
  outline: 2px solid var(--clinica);
  outline-offset: 1px;
}

.marcacao__rosto {
  flex: none;
}

.marcacao__hora {
  flex: none;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
}

.marcacao__hora--encaixe {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.marcacao__nome {
  min-width: 2.5rem;
  flex: 1;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.marcacao__icones {
  display: inline-flex;
  min-width: 0;
  flex: 0 1 auto;
  align-items: center;
  gap: 6px;
  overflow: hidden;
  font-size: 15px;
}

.marcacao__icones > * {
  flex: none;
}

.marcacao__origem {
  color: var(--tinta-3);
}

.marcacao__risco {
  width: 15px;
  height: 15px;
  color: var(--risco-tinta);
}

.marcacao__aviso {
  color: var(--atencao-tinta);
}

.marcacao__falta-icone {
  color: var(--risco-tinta);
}

.marcacao__encaixe {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
  font-size: 11.5px;
  font-weight: 600;
}

.marcacao__falta {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  margin-inline-end: 3px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--atencao-tinta);
  cursor: pointer;
  font-size: 16px;
  place-items: center;
}

.marcacao__falta:hover {
  background: var(--atencao-fundo);
}

.marcacao__falta:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 1px;
}

/* Finalizado é história do dia: perde peso, continua legível. */
.estado--finalizado.marcacao {
  color: var(--tinta-2);
}

.estado--finalizado .marcacao__rosto {
  opacity: 0.7;
}

/* Cancelado: riscado e apagado, mas presente — o horário vagou e isso é informação. */
.estado--cancelado.marcacao {
  border-style: dashed;
  border-inline-start-style: solid;
  color: var(--tinta-2);
  opacity: 0.65;
}

.estado--cancelado .marcacao__nome,
.estado--cancelado .marcacao__hora {
  text-decoration: line-through;
}

.estado--falta .marcacao__nome {
  color: var(--tinta-2);
}

/*
 * Coluna estreita (o painel do atendimento aberto, cinco profissionais): o nome, o risco e o aviso
 * ficam; o ícone do tipo e a marca de encaixe saem — os dois continuam no painel do atendimento.
 */
@container (max-width: 14rem) {
  .marcacao__tipo,
  .marcacao__origem,
  .marcacao__encaixe {
    display: none;
  }
}

@container (max-width: 12.5rem) {
  .marcacao .marcacao__rosto {
    width: 22px;
    height: 22px;
    font-size: 0.55rem;
  }
}

@container (max-width: 11rem) {
  .tabela__etiqueta-ate {
    display: none;
  }

  .marcacao__abrir {
    gap: 6px;
  }
}

/* Coluna bem estreita: o rosto encolhe em vez de sumir, e o "até" da continuação sai. */
@container (max-width: 9rem) {
  .marcacao .marcacao__rosto {
    width: 20px;
    height: 20px;
    font-size: 0.5rem;
  }

  .continua .ui-num {
    display: none;
  }
}

/* ------------------------------------------------------------------- a continuação */

/*
 * O horário tomado por quem começou antes: a célula inteira na cor clara do estado, com a faixa
 * da esquerda. Cobre também o fio da linha de cima, para as meias horas se emendarem num bloco.
 */
.continua-fundo {
  position: absolute;
  top: -1px;
  right: 6px;
  bottom: 0;
  left: 6px;
  border-inline-start: 3px solid var(--estado);
  background: color-mix(in oklab, var(--estado) 13%, var(--superficie));
  pointer-events: none;
}

/* O rótulo leva o mesmo fundo do bloco: o fio do agora passa por trás, sem riscar o nome. */
.continua {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 6px;
  overflow: hidden;
  padding: 3px 6px;
  border-radius: 4px;
  background: color-mix(in oklab, var(--estado) 13%, var(--superficie));
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.continua__nome {
  overflow: hidden;
  color: var(--tinta);
  font-weight: 600;
  text-overflow: ellipsis;
}

/* ------------------------------------------------------------------------- rodapé */

.tabela__dica {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  padding: 10px 16px;
  border-top: 1px solid var(--linha);
  color: var(--tinta-3);
  font-size: 12.5px;
  line-height: 1.4;
}

.tabela__dica i {
  flex: none;
  font-size: 16px;
}

.tabela__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

@media (prefers-reduced-motion: reduce) {
  .tabela__marcar-rotulo {
    transition: none;
  }
}
</style>
