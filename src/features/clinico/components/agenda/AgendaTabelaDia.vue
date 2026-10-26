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

import AgendaCartaoMarcas from './AgendaCartaoMarcas.vue'
import { ICONE_DA_ORIGEM, ICONE_DO_ALERTA, ICONE_DO_BLOQUEIO, type MarcaDaAgenda } from './agenda-icones'
import type { CardAgenda, ColunaAgenda, FaixaBloqueio } from '../../composables/useAgendaDia'
import { useAgendaDia } from '../../composables/useAgendaDia'
import type { ArrasteProposta } from '../../composables/useAgendaDrag'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type { AppointmentStatus, Pet } from '../../data/types'
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

/**
 * As marcas do cartão, na ordem em que saem por último: o risco do paciente, o aviso de choque, o
 * estado (falta, na sala, feito) e só então o que é contexto (encaixe, origem, tipo). Na coluna
 * estreita o fim da lista vira "+N" — nunca o começo.
 */
type MarcaDoCard = MarcaDaAgenda & {
  tipo: 'risco' | 'aviso' | 'falta' | 'ao-vivo' | 'feito' | 'encaixe' | 'origem' | 'tipo'
  alerta?: Pet['alertas'][number]
}

function marcasDoCard(card: CardAgenda): MarcaDoCard[] {
  const { status, encaixe, origem } = card.appointment
  const marcas: MarcaDoCard[] = alertasDeRisco(card).map((alerta) => ({
    chave: `risco-${alerta.id}`,
    rotulo: textoDoAlerta(alerta),
    tom: 'risco',
    tipo: 'risco',
    alerta,
  }))

  if (temAviso(card)) {
    marcas.push({ chave: 'aviso', rotulo: textoDosAvisos(card), tom: 'atencao', tipo: 'aviso' })
  }

  if (status === 'falta') {
    marcas.push({ chave: 'falta', rotulo: formato.status('falta'), tom: 'risco', tipo: 'falta' })
  } else if (status === 'em-atendimento') {
    marcas.push({ chave: 'ao-vivo', rotulo: formato.status(status), tipo: 'ao-vivo' })
  } else if (status === 'finalizado') {
    marcas.push({ chave: 'feito', rotulo: formato.status(status), tipo: 'feito' })
  }

  if (encaixe) {
    marcas.push({ chave: 'encaixe', rotulo: t('clinico.agenda.tabela.encaixe'), tipo: 'encaixe' })
  }

  if (ICONE_DA_ORIGEM[origem]) {
    marcas.push({ chave: 'origem', rotulo: t(`clinico.origem.${origem}`), tipo: 'origem' })
  }

  if (aparenciaDoTipo(card.tipo?.kind).icone) {
    marcas.push({ chave: 'tipo', rotulo: card.tipo?.nome ?? '', tipo: 'tipo' })
  }

  return marcas
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
 * Numa linha de altura normal, o rótulo do agora ficaria por cima da hora da linha em quase toda a
 * meia hora, e as duas apareceriam pela metade. A hora da linha sai: o rótulo do agora já diz em
 * que hora se está.
 */
function rotuloCoberto(minuto: number) {
  return ehLinhaDoAgora(minuto) && (agora.value?.fracao ?? 1) < 0.8
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

/** A última meia hora que a continuação ocupa: é ali que o bloco fecha os cantos. */
function ultimaContinuacao(card: CardAgenda, minuto: number) {
  return card.fimMin < minuto + 2 * LINHA_EM_MINUTOS
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
            <th
              v-for="coluna in colunas"
              :key="coluna.id"
              scope="col"
              class="tabela__coluna"
              :style="{ '--coluna-cor': coluna.cor }"
            >
              <span class="tabela__pessoa">
                <!-- O rosto da coluna: as iniciais na cor de quem atende (ou a porta, por sala). -->
                <span class="tabela__monograma" aria-hidden="true">
                  <i v-if="!coluna.professionalId" class="ph ph-door" />
                  <template v-else>{{ iniciais(coluna.titulo) }}</template>
                </span>
                <span class="tabela__pessoa-texto">
                  <span class="tabela__coluna-titulo" :title="coluna.titulo">{{ coluna.titulo }}</span>
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
                </span>
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
                  :class="[
                    `estado--${queContinuam(coluna, linha.minuto)[0]!.appointment.status}`,
                    {
                      'continua-fundo--fim': ultimaContinuacao(
                        queContinuam(coluna, linha.minuto)[0]!,
                        linha.minuto,
                      ),
                    },
                  ]"
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
                        {
                          'marcacao--selecionada': agenda.focoId === card.id,
                          'marcacao--com-falta': podeMarcarFalta(card),
                        },
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
                          O corpo é o nome e as marcas. Quem cede largura é o nome, com reticências;
                          as marcas que não cabem viram "+N" (com os nomes no title) — nada sai
                          cortado pela borda do cartão.
                        -->
                        <span class="marcacao__corpo">
                          <span class="marcacao__texto">
                            <!--
                              A linha da tabela já diz a hora cheia: o cartão só repete quando foge
                              dela (09:15). O encaixe mostra sempre a hora, num selo âmbar: é a marca
                              dele que cabe até na coluna estreita.
                            -->
                            <span
                              v-if="card.inicioMin !== linha.minuto || card.appointment.encaixe"
                              class="marcacao__hora ui-num"
                              :class="{ 'marcacao__hora--encaixe': card.appointment.encaixe }"
                              :title="
                                card.appointment.encaixe ? t('clinico.agenda.tabela.encaixe') : undefined
                              "
                            >
                              {{ formato.hora(card.appointment.inicio) }}
                            </span>
                            <span class="marcacao__nome">{{ card.pet?.nome }}</span>
                          </span>

                          <AgendaCartaoMarcas
                            v-slot="{ item }"
                            class="marcacao__icones"
                            :itens="marcasDoCard(card)"
                          >
                            <component
                              :is="ICONE_DO_ALERTA[item.alerta.kind]"
                              v-if="item.tipo === 'risco' && item.alerta"
                              class="marcacao__risco"
                              weight="fill"
                              :title="item.rotulo"
                            />
                            <i
                              v-else-if="item.tipo === 'aviso'"
                              class="ph ph-warning-circle marcacao__aviso"
                              :title="item.rotulo"
                            />
                            <i
                              v-else-if="item.tipo === 'falta'"
                              class="ph ph-user-minus marcacao__falta-icone"
                              :title="item.rotulo"
                            />
                            <!-- Na sala agora: um ponto que pulsa; feito: o visto apagado. -->
                            <span
                              v-else-if="item.tipo === 'ao-vivo'"
                              class="marcacao__ao-vivo"
                              :title="item.rotulo"
                            />
                            <i
                              v-else-if="item.tipo === 'feito'"
                              class="ph ph-check-circle marcacao__feito"
                              :title="item.rotulo"
                            />
                            <span v-else-if="item.tipo === 'encaixe'" class="marcacao__encaixe">
                              {{ item.rotulo }}
                            </span>
                            <!-- Marcado pelo responsável, no app ou no link: a origem à vista. -->
                            <i
                              v-else-if="item.tipo === 'origem'"
                              :class="['marcacao__origem', ICONE_DA_ORIGEM[card.appointment.origem]]"
                              :title="item.rotulo"
                            />
                            <i
                              v-else-if="item.tipo === 'tipo'"
                              :class="['marcacao__tipo', aparenciaDoTipo(card.tipo?.kind).icone]"
                              :style="{ color: aparenciaDoTipo(card.tipo?.kind).tinta }"
                              :title="item.rotulo"
                            />
                          </AgendaCartaoMarcas>
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

    <footer class="tabela__pe">
      <p class="tabela__dica">
        <i class="ph ph-hand-grabbing" aria-hidden="true" />
        {{ t('clinico.agenda.tabela.dica') }}
      </p>

      <!-- A chave das cores do estado: a mesma palavra que o painel do atendimento usa. -->
      <ul class="tabela__estados" aria-hidden="true">
        <li v-for="status in ESTADOS_DA_CHAVE" :key="status" :class="`estado--${status}`">
          <span class="tabela__amostra" />
          {{ formato.status(status) }}
        </li>
      </ul>
    </footer>
  </section>
</template>

<style scoped>
/*
 * A altura da linha acompanha a densidade escolhida no menu Exibição: a recepção que quer o dia
 * inteiro na tela escolhe "compacta"; quem prefere respiro, "confortável".
 *
 * O acabamento (20/10/2026): o cabeçalho e o rodapé num poço, a grade em papel com fios leves, e
 * cada atendimento como um cartão pequeno que flutua — o fundo e o traço da esquerda dizem o
 * estado. O que é fundo (bloqueio, continuação, horário livre) fica rente.
 */
.tabela {
  --tabela-eixo: 5rem;
  --tabela-linha: 50px;
  --tabela-coluna-minima: 8rem;
  --tabela-poco: color-mix(in oklab, var(--superficie-2) 75%, var(--superficie));
  --fio-hora: var(--linha);
  --fio-meia: color-mix(in oklab, var(--linha-suave) 80%, transparent);
  --fio-coluna: var(--linha-suave);

  display: grid;
  overflow: hidden;
  height: 100%;
  min-height: 0;
  grid-template-rows: minmax(0, 1fr) auto;
}

:root[data-clinic-density='compacta'] .tabela {
  --tabela-linha: 40px;
}

:root[data-clinic-density='confortavel'] .tabela {
  --tabela-linha: 60px;
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
  padding: 12px 14px;
  border-bottom: 1px solid var(--linha);
  background: var(--tabela-poco);
  text-align: start;
  vertical-align: middle;
}

.tabela__grade thead th + th {
  border-inline-start: 1px solid var(--fio-coluna);
}

.tabela__eixo-cabeca {
  left: 0;
  z-index: 5 !important;
  width: var(--tabela-eixo);
  border-inline-end: 1px solid var(--linha);
}

/*
 * Quem atende: o monograma na cor da coluna, o nome e, embaixo, a ocupação do dia. A coluna é o
 * contêiner — estreita (cinco profissionais com o painel aberto), o monograma sai e o nome fica.
 */
.tabela__pessoa {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
  container-type: inline-size;
}

.tabela__monograma {
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

.tabela__monograma i {
  font-size: 17px;
}

.tabela__pessoa-texto {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 6px;
}

.tabela__coluna-titulo {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.005em;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* A ocupação: barrinha e o número — a barra localiza, o número compara. */
.tabela__ocupacao {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 600;
}

.tabela__ocupacao-trilho {
  display: block;
  height: 5px;
  flex: 1;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-3);
}

/* A ocupação normal na sálvia; âmbar e vermelho só quando lota. O azul fica para quem está na sala. */
.tabela__ocupacao-trilho > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--pets);
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

@container (max-width: 8.5rem) {
  .tabela__monograma {
    display: none;
  }
}

/* ------------------------------------------------------------------------------ linhas */

.tabela__linha > * {
  border-top: 1px solid var(--fio-meia);
}

/* A hora cheia tem o fio cheio; a meia hora, o sutil. O olho acha "as 14h" sem ler cada linha. */
.tabela__linha--cheia > * {
  border-top-color: var(--fio-hora);
}

tbody > .tabela__linha:first-child > * {
  border-top-color: transparent;
}

.tabela__hora {
  position: sticky;
  left: 0;
  z-index: 3;
  padding: 7px 14px 0 8px;
  border-inline-end: 1px solid var(--linha);
  background: var(--superficie);
  text-align: end;
  vertical-align: top;
}

.tabela__hora-rotulo {
  display: block;
  color: var(--tinta-3);
  font-family: var(--font-dados);
  font-size: 12px;
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
  letter-spacing: -0.01em;
}

.tabela__celula {
  position: relative;
  min-width: 0;
  height: var(--tabela-linha);
  padding: 5px 6px;
  border-inline-start: 1px solid var(--fio-coluna);
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
  background-color: color-mix(in oklab, var(--superficie-2) 80%, var(--superficie));
  background-image: repeating-linear-gradient(
    135deg,
    transparent 0 8px,
    color-mix(in oklab, var(--linha) 75%, transparent) 8px 9px
  );
}

.tabela__faixa {
  height: 44px;
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
  padding: 0 11px 0 9px;
  overflow: hidden;
  border: 1px solid var(--linha);
  border-radius: 999px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.tabela__etiqueta i {
  flex: none;
  color: var(--tinta-3);
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
  height: 2px;
  background: var(--clinica);
  content: '';
  pointer-events: none;
  transform: translateY(-1px);
}

/* A cabeça do fio: um ponto na borda do eixo, de onde ele parte para a grade. */
.tabela__linha--atual > .tabela__hora::before {
  position: absolute;
  top: calc(var(--agora, 0) * 100%);
  right: -5px;
  z-index: 2;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--clinica);
  box-shadow: 0 0 0 3px color-mix(in oklab, var(--clinica) 22%, transparent);
  content: '';
  transform: translateY(-50%);
}

.tabela__agora-rotulo {
  position: absolute;
  top: calc(var(--agora, 0) * 100%);
  inset-inline-end: 12px;
  z-index: 3;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--clinica-tinta);
  box-shadow: 0 0 0 3px var(--superficie);
  color: var(--superficie);
  font-size: 12px;
  font-weight: 650;
  line-height: 1.35;
  transform: translateY(-50%);
}

/* A lista fica acima do fio e abaixo das etiquetas: é ela que recebe o olho. */
.tabela__lista {
  position: relative;
  z-index: 2;
  container-type: inline-size;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 5px;
  margin: 0;
  padding: 0;
  list-style: none;
}

/* --------------------------------------------------------------------- horário livre */

.tabela__marcar {
  position: absolute;
  inset: 4px;
  z-index: 1;
  display: grid;
  padding: 0;
  border: 1px dashed transparent;
  border-radius: 10px;
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
  background: color-mix(in oklab, var(--clinica-fundo) 60%, transparent);
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
 * A cor do estado num lugar só: o traço da esquerda (`--estado`), o fundo (`--estado-fundo`), a
 * borda (`--estado-borda`) e a sombra (`--estado-sombra`). O atendimento, a continuação e a
 * amostra do rodapé leem as mesmas quatro.
 *
 * A escada do dia: agendado em papel com traço cinza; confirmado na sálvia; na
 * recepção em âmbar; na sala no azul da Clínica, com brilho; feito apagado e rente; falta em
 * vermelho; cancelado só contorno, riscado. Confirmado era um azul claro ao lado do azul da sala:
 * os dois estados se confundiam e a grade inteira saía azul.
 */
.estado--agendado {
  --estado: var(--linha-forte);
  --estado-fundo: var(--superficie);
  --estado-borda: var(--linha-media);
}

.estado--confirmado {
  --estado: var(--pets);
  --estado-fundo: color-mix(in oklab, var(--pets-fundo) 60%, var(--superficie));
  --estado-borda: color-mix(in oklab, var(--pets) 32%, var(--linha));
}

.estado--aguardando {
  --estado: var(--atencao);
  --estado-fundo: color-mix(in oklab, var(--atencao-fundo) 88%, var(--superficie));
  --estado-borda: color-mix(in oklab, var(--atencao) 42%, var(--linha));
}

.estado--em-atendimento {
  --estado: var(--clinica);
  --estado-fundo: var(--clinica-fundo);
  --estado-borda: color-mix(in oklab, var(--clinica) 55%, var(--linha));
  --estado-sombra:
    0 1px 2px rgb(16 40 32 / 6%),
    0 6px 14px -8px color-mix(in oklab, var(--clinica) 75%, transparent);
}

.estado--finalizado {
  --estado: var(--linha-media);
  --estado-fundo: var(--superficie-2);
  --estado-borda: var(--linha-suave);
  --estado-sombra: none;
}

.estado--falta {
  --estado: var(--risco);
  --estado-fundo: color-mix(in oklab, var(--risco-fundo) 70%, var(--superficie));
  --estado-borda: color-mix(in oklab, var(--risco) 32%, var(--linha));
}

.estado--cancelado {
  --estado: var(--linha-media);
  --estado-fundo: transparent;
  --estado-borda: var(--linha-media);
  --estado-sombra: none;
}

/* ------------------------------------------------------------------- o atendimento */

.marcacao {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: center;
  padding-inline-start: 6px;
  border: 1px solid var(--estado-borda, var(--linha));
  border-radius: 10px;
  background: var(--estado-fundo);
  box-shadow: var(--estado-sombra, var(--sombra-xs));
  color: var(--tinta);
  cursor: grab;
  transition: box-shadow var(--pj-tempo-curto) var(--pj-curva-chega);
}

/* O traço do estado, por dentro do cartão: arredondado, longe da borda. */
.marcacao::before {
  position: absolute;
  top: 6px;
  bottom: 6px;
  inset-inline-start: 4px;
  width: 3px;
  border-radius: 3px;
  background: var(--estado);
  content: '';
}

.marcacao:hover {
  box-shadow: var(--sombra-1);
}

.marcacao__abrir {
  display: flex;
  min-width: 0;
  min-height: 36px;
  flex: 1;
  align-items: center;
  gap: 7px;
  padding: 3px 9px 3px 6px;
  border: 0;
  border-radius: 9px;
  background: transparent;
  color: inherit;
  cursor: inherit;
  font: inherit;
  overflow: hidden;
  text-align: start;
}

:root[data-clinic-density='compacta'] .marcacao__abrir {
  min-height: 30px;
}

.marcacao__abrir:hover {
  background: color-mix(in oklab, var(--tinta) 4%, transparent);
}

.marcacao__abrir:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: 2px;
}

.marcacao--selecionada {
  outline: 2px solid var(--clinica);
  outline-offset: 2px;
}

.marcacao__rosto {
  flex: none;
}

.marcacao__hora {
  flex: none;
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 600;
}

.marcacao__hora--encaixe {
  padding: 1px 6px;
  border-radius: 6px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

/*
 * O corpo do cartão: o texto (hora e nome) e as marcas. Na coluna larga, hora e nome correm numa
 * linha só (o texto não tem caixa própria); na estreita, a hora sobe para cima do nome — veja a
 * consulta de contêiner mais abaixo.
 */
.marcacao__corpo {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  align-items: center;
  gap: inherit;
}

.marcacao__texto {
  display: contents;
}

/*
 * O nome é quem cede: cresce com a sobra e, no aperto, encolhe com reticências até o mínimo que
 * ainda identifica ("Açaí N…"). Abaixo disso a largura é das marcas, que contam o resto em "+N".
 */
.marcacao__nome {
  min-width: 2.75rem;
  flex: 1 1 0;
  overflow: hidden;
  font-size: 13.5px;
  font-weight: 600;
  letter-spacing: -0.005em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.marcacao__icones {
  --marcas-vao: 6px;
  --marcas-altura: 20px;

  font-size: 15px;
}

/*
 * Coluna estreita (cinco profissionais em 1280–1440, o painel do atendimento aberto): a hora fora
 * da meia hora sobe para cima do nome, em letra menor — os dois cabem na altura do cartão e o nome
 * não divide a linha com ela. O texto passa a ter caixa e um mínimo que nunca toma o lugar do "+N":
 * até 2.75rem, mas sempre deixando a largura dele (`--marcas-reserva`) para as marcas.
 */
@container (max-width: 14rem) {
  .marcacao__texto {
    --marcas-reserva: 30px;

    display: grid;
    min-width: max(1.75rem, min(2.75rem, 100% - var(--marcas-reserva)));
    flex: 1 1 0;
    grid-template-columns: minmax(0, 1fr);
    align-content: center;
    row-gap: 1px;
    line-height: 1.2;
  }

  .marcacao__texto .marcacao__nome {
    min-width: 0;
  }

  .marcacao__texto .marcacao__hora {
    justify-self: start;
    font-size: 11px;
    line-height: 1.25;
  }

  .marcacao__texto .marcacao__hora--encaixe {
    padding: 0 5px;
  }
}

/* Na sala agora: o ponto da Clínica com um halo que respira. */
.marcacao__ao-vivo {
  position: relative;
  width: 8px;
  height: 8px;
  margin-inline: 3px;
  border-radius: 50%;
  background: var(--clinica);
}

.marcacao__ao-vivo::after {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: color-mix(in oklab, var(--clinica) 35%, transparent);
  content: '';
  animation: respira 1.8s var(--pj-curva-chega) infinite;
}

@keyframes respira {
  from {
    opacity: 0.9;
    transform: scale(0.5);
  }

  to {
    opacity: 0;
    transform: scale(1.3);
  }
}

/* `--tinta-2`, e não a 3: a marcação fica no pastel do estado, e a tinta mais clara não lia nele. */
.marcacao__feito {
  color: var(--tinta-2);
}

.marcacao__origem {
  color: var(--tinta-2);
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
  color: var(--tinta-2);
  opacity: 0.7;
}

.estado--cancelado .marcacao__nome,
.estado--cancelado .marcacao__hora {
  text-decoration: line-through;
}

.estado--falta .marcacao__nome {
  color: var(--tinta-2);
}

/*
 * Coluna estreita (o painel do atendimento aberto, cinco profissionais): o rosto encolhe e o
 * vão aperta. As marcas não somem por regra de largura: as que não cabem viram o "+N" do grupo,
 * do fim da lista para o começo (o tipo e a origem saem antes do risco e do aviso).
 */
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

  .marcacao__icones {
    --marcas-vao: 4px;
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

  /*
   * Com o botão de falta ao lado, o cartão perde mais 33 px: o rosto sai para o nome e o "+N"
   * continuarem inteiros. O nome do paciente está escrito logo ali; o rosto volta na coluna larga.
   */
  .marcacao--com-falta .marcacao__rosto {
    display: none;
  }
}

/* ------------------------------------------------------------------- a continuação */

/*
 * O horário tomado por quem começou antes: o corpo do cartão descendo pela meia hora, no mesmo
 * fundo e com o mesmo traço. Entra por baixo do cartão de cima, para os dois lerem como um bloco
 * só, e fecha os cantos na última meia hora.
 */
.continua-fundo {
  position: absolute;
  top: -7px;
  right: 6px;
  bottom: -1px;
  left: 6px;
  border: 1px solid var(--estado-borda, var(--linha));
  border-top: 0;
  border-bottom: 0;
  background: var(--estado-fundo);
  pointer-events: none;
}

.continua-fundo::before {
  position: absolute;
  top: 0;
  bottom: 0;
  inset-inline-start: 4px;
  width: 3px;
  background: var(--estado);
  content: '';
  opacity: 0.55;
}

.continua-fundo--fim {
  bottom: 5px;
  border-bottom: 1px solid var(--estado-borda, var(--linha));
  border-radius: 0 0 10px 10px;
  box-shadow: var(--estado-sombra, var(--sombra-xs));
}

.continua-fundo--fim::before {
  bottom: 6px;
  border-radius: 0 0 3px 3px;
}

/* O rótulo leva o mesmo fundo do bloco: o fio do agora passa por trás, sem riscar o nome. */
.continua {
  display: flex;
  min-width: 0;
  align-items: baseline;
  justify-self: start;
  gap: 6px;
  max-width: 100%;
  overflow: hidden;
  padding: 2px 8px 2px 12px;
  border-radius: 6px;
  background: var(--estado-fundo);
  color: var(--tinta-2);
  font-size: 12px;
  white-space: nowrap;
}

.continua__nome {
  overflow: hidden;
  color: var(--tinta-2);
  font-weight: 600;
  text-overflow: ellipsis;
}

/* ------------------------------------------------------------------------- rodapé */

.tabela__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 24px;
  padding: 10px 16px;
  border-top: 1px solid var(--linha);
  background: var(--tabela-poco);
}

.tabela__dica {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-3);
  font-size: 12.5px;
  line-height: 1.4;
}

.tabela__dica i {
  flex: none;
  font-size: 16px;
}

/* A chave do estado: uma amostra do próprio cartão, com a palavra ao lado. */
.tabela__estados {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 14px;
  margin: 0;
  padding: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
  list-style: none;
}

.tabela__estados li {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
}

.tabela__amostra {
  width: 16px;
  height: 12px;
  flex: none;
  border: 1px solid var(--estado-borda, var(--linha));
  border-radius: 4px;
  background: var(--estado-fundo);
  box-shadow: inset 3px 0 0 var(--estado);
}

.tabela__sr {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* No celular o eixo das horas encolhe: cada centímetro vai para as colunas. */
@media (max-width: 720px) {
  .tabela {
    --tabela-eixo: 3.75rem;
  }

  .tabela__hora {
    padding-inline-end: 10px;
  }

  .tabela__agora-rotulo {
    inset-inline-end: 6px;
    padding-inline: 6px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tabela__marcar-rotulo,
  .marcacao {
    transition: none;
  }

  .marcacao__ao-vivo::after {
    animation: none;
    opacity: 0.6;
  }
}
</style>
