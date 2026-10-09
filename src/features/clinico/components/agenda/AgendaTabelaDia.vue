<script setup lang="ts">
/**
 * A agenda do dia em tabela: uma linha por meia hora, uma coluna por profissional (ou sala).
 *
 * A grade proporcional — o bloco do tamanho da duração — desenha bem um dia folgado e desmancha um
 * dia cheio: dois atendimentos no mesmo horário dividiam a coluna ou se empilhavam um sobre o
 * outro, a consulta de 15 minutos virava uma tira de 10 px com o nome cortado, e cada aviso de
 * risco escrito em vermelho em cada bloco transformava a tela numa parede de alertas. Clínica cheia
 * é o caso normal, e é para ele que esta vista existe:
 *
 * - **Cada atendimento é uma linha**, sempre da mesma altura: avatar, hora, paciente, o ícone do
 *   tipo. Dois no mesmo horário ficam um embaixo do outro e a linha da tabela cresce — nada se
 *   sobrepõe, nada é cortado.
 * - **A duração aparece onde importa.** O procedimento que atravessa a meia hora inteira seguinte
 *   continua como uma faixa clara nela ("Bento · até 15:30"): o horário está ocupado e se lê.
 * - **Risco é ícone, por categoria**, como na lista de pacientes — losango para alergia, mão para
 *   manejo —, na cor da gravidade, com a palavra no rótulo acessível. Uma vez por linha, não em
 *   letras vermelhas.
 * - **O estado pinta a linha**: chegou (pêssego), em atendimento (marca), finalizado (apagado),
 *   falta (riscado). É a única cor de fundo, e é o que muda ao longo do dia.
 * - **Horário vazio é alvo**: clicar marca ali; arrastar um atendimento para outra célula propõe a
 *   remarcação, que passa pela mesma confirmação da grade.
 *
 * Os dados são os mesmos da grade (`useAgendaDia`): filtros, agrupamento por sala, conflitos e
 * bloqueios valem igual nas duas vistas.
 */
import {
  PhBaby,
  PhHandPalm,
  PhHeartbeat,
  PhPill,
  PhShieldWarning,
  PhWallet,
  PhWarningDiamond,
} from '@phosphor-icons/vue'
import Button from 'primevue/button'
import { computed, nextTick, onMounted, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import type { CardAgenda, ColunaAgenda, FaixaBloqueio } from '../../composables/useAgendaDia'
import { useAgendaDia } from '../../composables/useAgendaDia'
import type { ArrasteProposta } from '../../composables/useAgendaDrag'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { PetAlertKind } from '../../data/types'
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
  fechada: { motivo: FaixaBloqueio['bloqueio']['motivo']; ate: string } | null
}

const linhas = computed<Linha[]>(() => {
  const inicio = Math.floor(limites.value.inicio / LINHA_EM_MINUTOS) * LINHA_EM_MINUTOS
  const fim = Math.ceil(limites.value.fim / LINHA_EM_MINUTOS) * LINHA_EM_MINUTOS
  const lista: Linha[] = []

  for (let minuto = inicio; minuto < fim; minuto += LINHA_EM_MINUTOS) {
    const bloqueio = bloqueioDaClinica(minuto)
    const anterior = lista.at(-1)

    /* Almoço das 12h às 13h é uma linha, não duas com "ALMOÇO" repetido. */
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
            ate: rotuloDoMinuto(clinicClock.minutesFrom(bloqueio.bloqueio.fim, agenda.data)),
          }
        : null,
    })
  }

  return lista
})

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

const ICONE_DO_ALERTA: Record<PetAlertKind, Component> = {
  alergia: PhWarningDiamond,
  agressivo: PhHandPalm,
  cronico: PhHeartbeat,
  'medicacao-continua': PhPill,
  imunossuprimido: PhShieldWarning,
  gestante: PhBaby,
  inadimplente: PhWallet,
}

/** Só o que é risco vira ícone na agenda: o resto mora na ficha e no drawer. */
function alertasDeRisco(card: CardAgenda) {
  return (card.pet?.alertas ?? []).filter((alerta) => alerta.severidade === 'risco')
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

function rotuloDoCard(card: CardAgenda) {
  const partes = [
    formato.intervalo(card.appointment.inicio, card.appointment.fim),
    card.pet?.nome ?? '',
    card.tipo?.nome ?? '',
    formato.status(card.appointment.status),
    ...alertasDeRisco(card).map((alerta) =>
      alerta.detalhe
        ? `${formato.alerta(alerta.kind)}: ${alerta.detalhe}`
        : formato.alerta(alerta.kind),
    ),
  ]

  if (temAviso(card)) {
    partes.push(
      card.conflitos
        .filter((conflito) => conflito.severity !== 'info')
        .map(formato.conflito)
        .join(' · '),
    )
  }

  return partes.filter(Boolean).join(' · ')
}

/** Falta a um clique, para quem já devia ter chegado — como no card da grade. */
function podeMarcarFalta(card: CardAgenda) {
  return (
    ['agendado', 'confirmado'].includes(card.appointment.status) &&
    clinicClock.nowIso() > card.appointment.inicio
  )
}

// ------------------------------------------------------------------ agora

const agoraMinuto = ref(clinicClock.now().minutes)
const ehHoje = computed(() => agenda.data === clinicClock.today())

function ehLinhaDoAgora(minuto: number) {
  return (
    ehHoje.value && agoraMinuto.value >= minuto && agoraMinuto.value < minuto + LINHA_EM_MINUTOS
  )
}

const rolagem = ref<HTMLElement | null>(null)

/* Hoje, a tabela abre na meia hora de agora — e não às 8h, quando já são 15h. */
onMounted(async () => {
  agoraMinuto.value = clinicClock.now().minutes

  if (!ehHoje.value) {
    return
  }

  await nextTick()
  const linha = rolagem.value?.querySelector<HTMLElement>('.tabela__linha--agora')

  if (linha && rolagem.value) {
    rolagem.value.scrollTop = Math.max(linha.offsetTop - rolagem.value.clientHeight / 3, 0)
  }
})

// ------------------------------------------------------------------ marcar e remarcar

function criarEm(coluna: ColunaAgenda, minuto: number) {
  if (coluna.professionalId) {
    emit('criarEm', { professionalId: coluna.professionalId, minuto })
  }
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
</script>

<template>
  <section class="hc tabela clinic-scope" :aria-label="t('clinico.agenda.tabela.rotulo')">
    <div ref="rolagem" class="tabela__rolagem">
      <table class="tabela__grade">
        <thead>
          <tr>
            <th scope="col" class="tabela__eixo-cabeca">
              <span class="tabela__sr">{{ t('clinico.agenda.tabela.horario') }}</span>
            </th>
            <th v-for="coluna in colunas" :key="coluna.id" scope="col" class="tabela__coluna">
              <span class="tabela__coluna-nome">
                <span
                  class="tabela__coluna-cor"
                  :style="{ background: coluna.cor }"
                  aria-hidden="true"
                />
                <span class="tabela__coluna-titulo">{{ coluna.titulo }}</span>
              </span>
              <span class="tabela__ocupacao" :title="t('clinico.agenda.tabela.ocupacao')">
                <span class="tabela__ocupacao-trilho" aria-hidden="true">
                  <span :style="{ inlineSize: `${Math.min(coluna.ocupacao, 1) * 100}%` }" />
                </span>
                {{ formato.percentual(coluna.ocupacao) }}
              </span>
            </th>
          </tr>
        </thead>

        <tbody>
          <template v-for="linha in linhas" :key="linha.minuto">
            <!-- Almoço e bloqueio da clínica inteira: uma faixa só, atravessando as colunas. -->
            <tr v-if="linha.fechada" class="tabela__linha tabela__linha--fechada">
              <th scope="row" class="tabela__hora" :class="{ 'tabela__hora--cheia': linha.cheia }">
                {{ linha.rotulo }}
              </th>
              <td :colspan="colunas.length" class="tabela__faixa">
                {{ formato.motivoBloqueio(linha.fechada.motivo) }}
                <span class="tabela__faixa-ate">{{
                  t('clinico.agenda.tabela.ate', { hora: linha.fechada.ate })
                }}</span>
              </td>
            </tr>

            <tr
              v-else
              class="tabela__linha"
              :class="{
                'tabela__linha--agora': ehLinhaDoAgora(linha.minuto),
                'tabela__linha--cheia': linha.cheia,
              }"
            >
              <th scope="row" class="tabela__hora" :class="{ 'tabela__hora--cheia': linha.cheia }">
                {{ linha.rotulo }}
                <span v-if="ehLinhaDoAgora(linha.minuto)" class="tabela__agora">
                  {{ t('clinico.agenda.tabela.agora') }}
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
                <span v-if="bloqueioDaColuna(coluna, linha.minuto)" class="tabela__bloqueio">
                  {{
                    formato.motivoBloqueio(bloqueioDaColuna(coluna, linha.minuto)!.bloqueio.motivo)
                  }}
                </span>

                <ul class="tabela__lista">
                  <!-- O que vem de antes e ainda ocupa esta meia hora: faixa clara, sem repetir o card. -->
                  <!-- O nome só na primeira meia hora da continuação; nas seguintes, a faixa basta. -->
                  <li
                    v-for="card in queContinuam(coluna, linha.minuto)"
                    :key="`continua-${card.id}`"
                    class="tabela__continua"
                    :class="{ 'tabela__continua--muda': !primeiraContinuacao(card, linha.minuto) }"
                  >
                    <template v-if="primeiraContinuacao(card, linha.minuto)">
                      <span class="tabela__continua-nome">{{ card.pet?.nome }}</span>
                      {{
                        t('clinico.agenda.tabela.ate', { hora: formato.hora(card.appointment.fim) })
                      }}
                    </template>
                  </li>

                  <li v-for="card in queComecam(coluna, linha.minuto)" :key="card.id">
                    <div
                      class="atendimento"
                      :class="[
                        `atendimento--${card.appointment.status}`,
                        { 'atendimento--selecionado': agenda.focoId === card.id },
                      ]"
                      draggable="true"
                      @dragstart="aoComecarArraste($event, card)"
                      @dragend="aoTerminarArraste"
                    >
                      <Button
                        type="button"
                        class="atendimento__abrir"
                        text
                        :aria-label="rotuloDoCard(card)"
                        @click="emit('abrir', card.id)"
                      >
                        <PetAvatar
                          :nome="card.pet?.nome ?? ''"
                          :iniciais="card.pet?.iniciais ?? ''"
                          :especie="card.pet?.especie ?? null"
                          :foto-url="card.pet?.fotoUrl ?? ''"
                          tamanho="sm"
                        />
                        <!-- A linha da tabela já diz a hora cheia: o card só repete quando foge dela (09:15). -->
                        <span v-if="card.inicioMin !== linha.minuto" class="atendimento__hora">{{
                          formato.hora(card.appointment.inicio)
                        }}</span>
                        <span class="atendimento__nome">{{ card.pet?.nome }}</span>
                        <i
                          v-if="aparenciaDoTipo(card.tipo?.kind).icone"
                          :class="['atendimento__tipo', aparenciaDoTipo(card.tipo?.kind).icone]"
                          :style="{ color: aparenciaDoTipo(card.tipo?.kind).cor }"
                          :title="card.tipo?.nome"
                          aria-hidden="true"
                        />
                        <span
                          v-if="card.appointment.encaixe"
                          class="atendimento__encaixe"
                          aria-hidden="true"
                        >
                          {{ t('clinico.agenda.tabela.encaixe') }}
                        </span>
                        <component
                          :is="ICONE_DO_ALERTA[alerta.kind]"
                          v-for="alerta in alertasDeRisco(card)"
                          :key="alerta.id"
                          class="atendimento__risco"
                          weight="fill"
                          :title="
                            alerta.detalhe
                              ? `${formato.alerta(alerta.kind)}: ${alerta.detalhe}`
                              : formato.alerta(alerta.kind)
                          "
                          aria-hidden="true"
                        />
                        <i
                          v-if="temAviso(card)"
                          class="ph ph-warning-circle atendimento__aviso"
                          aria-hidden="true"
                        />
                      </Button>

                      <Button
                        v-if="podeMarcarFalta(card)"
                        type="button"
                        class="atendimento__falta"
                        icon="ph ph-user-minus"
                        severity="secondary"
                        text
                        size="small"
                        :title="t('clinico.faltas.marcar')"
                        :aria-label="`${t('clinico.faltas.marcar')} — ${card.pet?.nome ?? ''}`"
                        @click.stop="emit('marcarFalta', card.id)"
                      />
                    </div>
                  </li>
                </ul>

                <!-- Horário livre é alvo: a recepção marca clicando onde vê o vazio. -->
                <Button
                  v-if="
                    coluna.professionalId &&
                    !bloqueioDaColuna(coluna, linha.minuto) &&
                    queComecam(coluna, linha.minuto).length === 0 &&
                    queContinuam(coluna, linha.minuto).length === 0
                  "
                  type="button"
                  class="tabela__marcar"
                  icon="ph ph-plus"
                  text
                  :aria-label="
                    t('clinico.agenda.tabela.marcarAs', { hora: linha.rotulo, nome: coluna.titulo })
                  "
                  @click="criarEm(coluna, linha.minuto)"
                />
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <p class="tabela__dica">
      <i class="ph ph-arrows-out-cardinal" aria-hidden="true" />
      {{ t('clinico.agenda.tabela.dica') }}
    </p>
  </section>
</template>

<style scoped>
.tabela {
  --tabela-eixo: 4.5rem;

  gap: 0;
  padding: 0;
  overflow: hidden;
}

.tabela__rolagem {
  max-height: calc(100vh - 15rem);
  min-height: 24rem;
  overflow: auto;
}

.tabela__grade {
  width: 100%;
  min-width: 40rem;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

/* ---------------------------------------------------------------- cabeçalho */

.tabela__grade thead th {
  position: sticky;
  top: 0;
  z-index: 3;
  padding: 0.7rem 0.6rem 0.55rem;
  border-bottom: 1px solid var(--hc-borda);
  background: var(--hc-cartao);
  text-align: start;
  vertical-align: bottom;
}

.tabela__eixo-cabeca {
  left: 0;
  z-index: 4 !important;
  width: var(--tabela-eixo);
}

.tabela__coluna-nome {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  overflow: hidden;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabela__coluna-titulo {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tabela__continua--muda {
  min-height: 0.6rem;
  padding-block: 0;
}

.tabela__coluna-cor {
  flex-shrink: 0;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
}

.tabela__ocupacao {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-top: 0.3rem;
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

.tabela__ocupacao-trilho {
  display: block;
  flex: 1;
  height: 0.25rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--hc-linha);
}

.tabela__ocupacao-trilho > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--hc-marca);
}

/* ---------------------------------------------------------------- linhas */

.tabela__hora {
  position: sticky;
  left: 0;
  z-index: 2;
  padding: 0.5rem 0.6rem 0.4rem 0.75rem;
  border-bottom: 1px solid var(--hc-linha);
  background: var(--hc-cartao);
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-align: start;
  vertical-align: top;
}

/* A hora cheia pesa mais que a meia: o olho acha "as 14h" sem ler cada linha. */
.tabela__hora--cheia {
  color: var(--hc-tinta);
  font-size: 0.8125rem;
}

.tabela__agora {
  display: block;
  margin-top: 0.15rem;
  color: var(--hc-coral-tinta);
  font-size: 0.6875rem;
  font-weight: 700;
}

/* A meia hora de agora ganha um fio coral na borda de cima — é onde o dia está. */
.tabela__linha--agora > * {
  border-top: 2px solid var(--hc-coral-tinta);
}

.tabela__celula {
  position: relative;
  min-width: 0;
  height: 2.5rem;
  padding: 0.25rem 0.35rem;
  border-bottom: 1px solid var(--hc-linha);
  border-inline-start: 1px solid var(--hc-linha);
  vertical-align: top;
}

.tabela__celula--alvo {
  background: var(--hc-marca-clara);
  outline: 2px dashed var(--hc-marca);
  outline-offset: -3px;
}

.tabela__celula--bloqueada {
  background: repeating-linear-gradient(
    135deg,
    transparent 0 6px,
    color-mix(in srgb, var(--hc-linha) 80%, transparent) 6px 12px
  );
}

.tabela__bloqueio {
  display: block;
  padding: 0.15rem 0.25rem;
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
}

.tabela__linha--fechada .tabela__hora {
  color: var(--hc-tinta-3);
}

.tabela__faixa-ate {
  margin-inline-start: 0.4rem;
  font-weight: 500;
  letter-spacing: 0;
  text-transform: none;
}

.tabela__faixa {
  padding: 0.4rem 0.75rem;
  border-bottom: 1px solid var(--hc-linha);
  background: repeating-linear-gradient(
    135deg,
    transparent 0 6px,
    color-mix(in srgb, var(--hc-linha) 80%, transparent) 6px 12px
  );
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-weight: 650;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

/* A lista é o contêiner das regras de coluna estreita: célula de tabela não vira contêiner. */
.tabela__lista {
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0.2rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.tabela__continua {
  overflow: hidden;
  padding: 0.2rem 0.45rem;
  border-inline-start: 3px solid var(--hc-borda);
  border-radius: 0.35rem;
  background: color-mix(in srgb, var(--hc-linha) 70%, transparent);
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tabela__continua-nome {
  color: var(--hc-tinta);
  font-weight: 600;
}

/* O "+" do horário livre: aparece ao passar o mouse; no toque, fica sempre. */
.tabela__celula .tabela__marcar.p-button {
  position: absolute;
  inset: 0;
  width: auto;
  height: auto;
  border: 0;
  border-radius: 0;
  background: transparent;
  box-shadow: none;
  color: var(--hc-marca-forte);
  opacity: 0;
  transition: opacity 0.15s ease-out;
}

.tabela__celula .tabela__marcar.p-button:not(:disabled):hover,
.tabela__celula .tabela__marcar.p-button:focus-visible {
  background: color-mix(in srgb, var(--hc-marca-clara) 60%, transparent);
  opacity: 1;
}

.tabela__celula .tabela__marcar.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: -2px;
}

@media (hover: none) {
  .tabela__celula .tabela__marcar.p-button {
    opacity: 0.45;
  }
}

/* ---------------------------------------------------------------- atendimento */

.atendimento {
  position: relative;
  display: flex;
  align-items: center;
  min-width: 0;
  overflow: hidden;
  border: 1px solid var(--hc-borda);
  border-radius: 0.55rem;
  background: var(--hc-cartao);
  box-shadow: 0 1px 2px rgb(20 32 28 / 5%);
  cursor: grab;
}

.atendimento .atendimento__abrir.p-button {
  display: flex;
  flex: 1;
  justify-content: flex-start;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
  padding: 0.18rem 0.4rem 0.18rem 0.2rem;
  border: 0;
  border-radius: inherit;
  background: transparent;
  box-shadow: none;
  color: var(--hc-tinta);
  font-size: inherit;
  font-weight: inherit;
  text-align: start;
}

.atendimento .atendimento__abrir.p-button:not(:disabled):hover {
  background: color-mix(in srgb, var(--hc-marca-clara) 40%, transparent);
  color: var(--hc-tinta);
}

.atendimento .atendimento__abrir.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: 1px;
  box-shadow: none;
}

.atendimento__hora {
  flex-shrink: 0;
  font-size: 0.8125rem;
  font-variant-numeric: tabular-nums;
  font-weight: 750;
}

.atendimento__nome {
  overflow: hidden;
  flex: 1;
  min-width: 2.5rem;
  font-size: 0.8125rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atendimento__tipo {
  flex-shrink: 0;
  font-size: 0.8rem;
}

.atendimento__encaixe {
  flex-shrink: 0;
  padding: 0 0.3rem;
  border-radius: 4px;
  background: var(--hc-pessego-fundo);
  color: var(--hc-pessego-tinta);
  font-size: 0.6875rem;
  font-weight: 700;
}

.atendimento__risco {
  flex-shrink: 0;
  width: 0.95rem;
  height: 0.95rem;
  color: var(--hc-coral-tinta);
}

.atendimento__aviso {
  flex-shrink: 0;
  color: var(--hc-pessego-tinta);
  font-size: 0.8rem;
}

.atendimento__falta.p-button {
  flex-shrink: 0;
  width: 1.75rem;
  height: 1.75rem;
  margin-inline-end: 0.15rem;
  padding: 0;
  color: var(--hc-pessego-tinta);
}

/*
 * Coluna estreita (tablet com o menu aberto, cinco profissionais): o nome e o risco ficam; o ícone
 * do tipo, o selo de encaixe e o atalho de falta saem — os três continuam no drawer do atendimento.
 */
@container (max-width: 10rem) {
  .atendimento__tipo,
  .atendimento__encaixe,
  .atendimento__aviso,
  .atendimento__falta.p-button {
    display: none;
  }

  .atendimento .atendimento__abrir.p-button {
    gap: 0.3rem;
  }
}

/* O estado pinta a linha: é a única cor de fundo da tabela, e o que muda ao longo do dia. */
.atendimento--aguardando {
  border-color: color-mix(in srgb, var(--hc-pessego-tinta) 45%, transparent);
  background: var(--hc-pessego-fundo);
}

.atendimento--em-atendimento {
  border-color: color-mix(in srgb, var(--hc-marca) 55%, transparent);
  background: var(--hc-marca-clara);
}

.atendimento--finalizado {
  background: var(--hc-cinza-fundo);
  box-shadow: none;
}

.atendimento--finalizado .atendimento__abrir.p-button {
  color: var(--hc-tinta-2);
}

.atendimento--falta,
.atendimento--cancelado {
  border-style: dashed;
  background: transparent;
  box-shadow: none;
  opacity: 0.6;
}

.atendimento--falta .atendimento__nome,
.atendimento--falta .atendimento__hora,
.atendimento--cancelado .atendimento__nome,
.atendimento--cancelado .atendimento__hora {
  text-decoration: line-through;
}

.atendimento--selecionado {
  border-color: var(--hc-marca);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--hc-marca) 35%, transparent);
}

.tabela__dica {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0;
  padding: 0.5rem 0.9rem;
  border-top: 1px solid var(--hc-linha);
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
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
  .tabela__marcar {
    transition: none;
  }
}
</style>
