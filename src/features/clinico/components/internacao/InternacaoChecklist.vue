<script setup lang="ts">
/**
 * O checklist de enfermagem: o que dar, a que horas, e quem deu.
 *
 * É uma **linha do tempo do plantão**: a hora à esquerda, um trilho com um nó por horário, e o
 * que se faz naquele horário à direita. Agrupado por horário, e não por medicamento, porque é
 * assim que o trabalho acontece: às 14h alguém pega três seringas e vai até o leito uma vez.
 *
 * O "agora" é um fio de verdade atravessando a linha do tempo, na cor do lugar, com a hora
 * encostada nele. Sem ele, quem chega no meio do plantão precisa comparar relógio com tela linha a
 * linha para saber onde parou o turno anterior.
 *
 * O nó de cada horário diz o estado dele de longe: cheio de vermelho quando há atraso, âmbar
 * quando é a hora, verde quando tudo foi registrado, vazio quando ainda vai chegar. A linha
 * atrasada leva também a marca na borda e o selo com a palavra — nunca só a cor.
 *
 * Três desfechos, e não um: **feita**, **recusada** e **pulada** são coisas diferentes. Gato que
 * cospe o comprimido não é dose que ninguém deu, e registrar as duas do mesmo jeito apaga
 * justamente a informação que faz o vet trocar a via.
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type {
  AdministracaoAgendada,
  PrescricaoDeInternacao,
  SituacaoDaAdministracao,
} from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { atrasoEmMinutos, atravessaAPassagem } from '../../domain/internacao'
import { useClinicoStore } from '../../stores/clinico'

type Linha = {
  administracao: AdministracaoAgendada
  prescricao: PrescricaoDeInternacao | null
  situacao: SituacaoDaAdministracao
}

const props = withDefaults(
  defineProps<{
    linhas: Linha[]
    agora: string
    salvando?: boolean
    /** Fim do plantão corrente: é o que revela as doses em cima da troca. */
    fimDoPlantao?: string | null
  }>(),
  { salvando: false, fimDoPlantao: null },
)

const emit = defineEmits<{
  registrar: [administracaoId: string, status: 'feita' | 'recusada' | 'pulada']
  desfazer: [administracaoId: string]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

/** Ícone por tipo de item: medicamento, fluido e monitoramento se distinguem de relance. */
const ICONE: Record<PrescricaoDeInternacao['kind'], string> = {
  medicamento: 'ph ph-pill',
  fluido: 'ph ph-drop',
  monitoramento: 'ph ph-heartbeat',
  alimentacao: 'ph ph-bowl-food',
  procedimento: 'ph ph-first-aid-kit',
}

/** O selo da situação: a palavra e a cor andam juntas. A prevista não leva selo — só texto. */
const TOM_DA_SITUACAO: Partial<Record<SituacaoDaAdministracao, string>> = {
  atrasada: 'risco',
  'na-janela': 'atencao',
  feita: 'ok',
  recusada: 'atencao',
  pulada: 'neutro',
  suspensa: 'neutro',
}

/**
 * Só o que interessa ao turno: as horas do plantão corrente e o que vem logo em seguida.
 *
 * Mostrar as 48 horas aprazadas transformaria o checklist num calendário — e ninguém precisa ver
 * a dose de depois de amanhã enquanto segura uma seringa.
 *
 * **Seis horas para trás, e não vinte.** Com a janela larga, abrir a aba despejava dezesseis
 * horas de doses já dadas antes da primeira linha acionável: quem entrava no plantão rolava a
 * tela para achar o "agora". Seis horas cobrem o turno em curso — que é o que quem está com a
 * seringa na mão precisa conferir — sem esconder o que ainda cobra ação.
 */
const JANELA_ATRAS_MS = 6 * 3_600_000
const JANELA_FRENTE_MS = 12 * 3_600_000

const visiveis = computed(() => {
  const agoraMs = Date.parse(props.agora)

  return props.linhas.filter((linha) => {
    const previstaMs = Date.parse(linha.administracao.previstaPara)

    return previstaMs >= agoraMs - JANELA_ATRAS_MS && previstaMs <= agoraMs + JANELA_FRENTE_MS
  })
})

type EstadoDoGrupo = 'atrasado' | 'na-hora' | 'feito' | 'adiante'

type Grupo = {
  horario: string
  rotulo: string
  passado: boolean
  estado: EstadoDoGrupo
  linhas: Linha[]
}

function estadoDo(linhas: Linha[]): EstadoDoGrupo {
  if (linhas.some((linha) => linha.situacao === 'atrasada')) {
    return 'atrasado'
  }

  if (linhas.some((linha) => linha.situacao === 'na-janela')) {
    return 'na-hora'
  }

  return linhas.every((linha) => resolvida(linha.situacao) || linha.situacao === 'suspensa')
    ? 'feito'
    : 'adiante'
}

const grupos = computed<Grupo[]>(() => {
  const agoraMs = Date.parse(props.agora)
  const porHorario = new Map<string, Linha[]>()

  for (const linha of visiveis.value) {
    const chave = linha.administracao.previstaPara

    porHorario.set(chave, [...(porHorario.get(chave) ?? []), linha])
  }

  return [...porHorario.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([horario, linhas]) => ({
      horario,
      rotulo: formato.hora(horario),
      passado: Date.parse(horario) < agoraMs,
      estado: estadoDo(linhas),
      linhas,
    }))
})

/** Índice do primeiro grupo ainda por vir — é onde o fio do "agora" é desenhado. */
const indiceDoAgora = computed(() => grupos.value.findIndex((grupo) => !grupo.passado))

/**
 * O que já foi registrado antes de agora recolhe numa linha.
 *
 * Abrir o checklist às 10h despejava cinco doses da madrugada, todas feitas, antes da primeira
 * que cobra ação. O registro continua a um clique ("5 registradas desde 04:43"), e o que ficou
 * para trás **sem** registro (atrasada) nunca recolhe: é exatamente o que precisa ser visto.
 */
const passadoAberto = ref(false)

function grupoResolvido(grupo: Grupo) {
  return grupo.passado && grupo.linhas.every((linha) => resolvida(linha.situacao))
}

const resolvidasAntes = computed(() => {
  const recolhiveis = grupos.value.filter(grupoResolvido)

  return {
    total: recolhiveis.reduce((soma, grupo) => soma + grupo.linhas.length, 0),
    desde: recolhiveis[0]?.rotulo ?? '',
  }
})

function naTroca(administracao: AdministracaoAgendada): boolean {
  return props.fimDoPlantao ? atravessaAPassagem(administracao, props.fimDoPlantao) : false
}

function atraso(administracao: AdministracaoAgendada): number {
  return atrasoEmMinutos(administracao, props.agora)
}

function executor(administracao: AdministracaoAgendada): string {
  return administracao.executadaPor
    ? (clinico.profissional(administracao.executadaPor)?.nome ?? '')
    : ''
}

function resolvida(situacao: SituacaoDaAdministracao): boolean {
  return situacao === 'feita' || situacao === 'recusada' || situacao === 'pulada'
}

/**
 * "em 2 h", "há 40 min": a distância do horário até agora, para ler sem fazer conta. Passada a
 * primeira hora, arredonda para a hora cheia — "em 4 h 19 min" quebrava a coluna e não ajuda a
 * decidir nada que "em 4 h" não ajude.
 */
function distancia(horario: string): string {
  const minutos = Math.round((Date.parse(horario) - Date.parse(props.agora)) / 60_000)
  const absoluto = Math.abs(minutos)

  if (absoluto < 1) {
    return t('clinico.formato.agora')
  }

  const valor =
    absoluto < 60
      ? t('clinico.formato.minutos', { valor: absoluto })
      : t('clinico.formato.horas', { valor: Math.round(absoluto / 60) })

  return minutos < 0
    ? t('clinico.formato.haTempo', { valor })
    : t('clinico.formato.emTempo', { valor })
}

/** A dose futura cujo registro antecipado está esperando o segundo clique. */
const confirmando = ref<string | null>(null)

function registrarAntes(administracaoId: string) {
  confirmando.value = null
  emit('registrar', administracaoId, 'feita')
}
</script>

<template>
  <div class="checklist ui-folha">
    <p v-if="grupos.length === 0" class="ui-vazio checklist__vazio">
      {{ t('clinico.internacao.checklist.vazio') }}
    </p>

    <div v-if="resolvidasAntes.total > 0" class="checklist__recolhido">
      <i class="ph ph-check-circle" aria-hidden="true" />
      <span>
        {{
          t(
            'clinico.internacao.checklist.registradas',
            { total: resolvidasAntes.total, desde: resolvidasAntes.desde },
            resolvidasAntes.total,
          )
        }}
      </span>
      <Button
        type="button"
        :label="
          passadoAberto
            ? t('clinico.internacao.checklist.ocultarRegistradas')
            : t('clinico.internacao.checklist.verRegistradas')
        "
        :icon="passadoAberto ? 'ph ph-caret-up' : 'ph ph-caret-down'"
        icon-pos="right"
        severity="secondary"
        text
        size="small"
        :aria-expanded="passadoAberto"
        @click="passadoAberto = !passadoAberto"
      />
    </div>

    <ol v-if="grupos.length > 0" class="tempo">
      <template v-for="(grupo, indice) in grupos" :key="grupo.horario">
        <li v-if="indice === indiceDoAgora" class="checklist__agora">
          <span class="agora__rotulo ui-num">
            {{ t('clinico.internacao.checklist.agora', { hora: formato.hora(agora) }) }}
          </span>
          <span class="agora__fio" aria-hidden="true" />
        </li>

        <!-- v-show: o registro de quem deu cada dose continua na página, só recolhido. -->
        <li
          v-show="passadoAberto || !grupoResolvido(grupo)"
          class="grupo"
          :class="[`grupo--${grupo.estado}`, { 'grupo--passado': grupo.passado }]"
        >
          <div class="grupo__hora">
            <time class="ui-hora" :datetime="grupo.horario">{{ grupo.rotulo }}</time>
            <small>{{ distancia(grupo.horario) }}</small>
          </div>

          <span class="grupo__trilho" aria-hidden="true"><span class="grupo__no" /></span>

          <ul class="grupo__itens">
            <li
              v-for="linha in grupo.linhas"
              :key="linha.administracao.id"
              class="item"
              :class="[
                `item--${linha.situacao}`,
                {
                  'item--troca': naTroca(linha.administracao),
                  'ui-marca ui-marca--risco': linha.situacao === 'atrasada',
                  'ui-marca ui-marca--atencao': linha.situacao === 'na-janela',
                },
              ]"
            >
              <span class="item__icone" aria-hidden="true">
                <i
                  :class="
                    resolvida(linha.situacao) && linha.situacao === 'feita'
                      ? 'ph ph-check'
                      : ICONE[linha.prescricao?.kind ?? 'procedimento']
                  "
                />
              </span>

              <div class="item__corpo">
                <p class="item__descricao">
                  <strong>{{ linha.prescricao?.descricao }}</strong>
                  <span v-if="linha.prescricao?.doseTexto" class="item__dose ui-num">
                    {{ linha.prescricao.doseTexto }}
                  </span>
                  <span v-if="linha.prescricao?.via" class="item__via">
                    {{ t(`clinico.prontuario.conduta.via_.${linha.prescricao.via}`) }}
                  </span>
                </p>

                <p class="item__meta">
                  <span
                    v-if="TOM_DA_SITUACAO[linha.situacao]"
                    class="item__situacao ui-selo"
                    :class="`ui-selo--${TOM_DA_SITUACAO[linha.situacao]}`"
                  >
                    {{ t(`clinico.internacao.situacao.${linha.situacao}`) }}
                  </span>
                  <span v-else class="item__situacao item__situacao--texto">
                    {{ t(`clinico.internacao.situacao.${linha.situacao}`) }}
                  </span>

                  <span v-if="linha.situacao === 'atrasada'" class="item__atraso ui-num">
                    {{
                      t('clinico.internacao.nova.checklist.atraso', {
                        tempo: formato.duracao(atraso(linha.administracao)),
                      })
                    }}
                  </span>

                  <span v-if="executor(linha.administracao)" class="item__executor">
                    {{
                      t('clinico.internacao.checklist.por', {
                        nome: executor(linha.administracao),
                        hora: formato.hora(linha.administracao.executadaEm ?? ''),
                      })
                    }}
                  </span>

                  <span v-if="linha.prescricao?.continuo" class="item__continuo">
                    {{ t('clinico.internacao.checklist.conferencia') }}
                  </span>
                </p>

                <!--
                  A dose em cima da troca de plantão diz o que é, na linha, e não numa legenda de
                  rodapé: quem está com a seringa na mão não vai procurar legenda.
                -->
                <p v-if="naTroca(linha.administracao)" class="item__troca">
                  <i class="ph ph-arrows-left-right" aria-hidden="true" />
                  {{ t('clinico.internacao.checklist.naTroca') }}
                </p>

                <p v-if="linha.administracao.observacao" class="item__observacao">
                  {{ linha.administracao.observacao }}
                </p>
              </div>

              <div class="item__acoes">
                <template v-if="resolvida(linha.situacao)">
                  <Button
                    type="button"
                    :label="t('clinico.internacao.checklist.desfazer')"
                    icon="ph ph-arrow-counter-clockwise"
                    severity="secondary"
                    text
                    size="small"
                    :disabled="salvando"
                    @click="emit('desfazer', linha.administracao.id)"
                  />
                </template>

                <!--
                  Dose ainda por vir pede um segundo clique. Com o mesmo botão cheio da dose da vez,
                  um toque na linha errada registrava às 18h a dose das 21h — e o registro é o que o
                  próximo turno usa para não dar de novo.
                -->
                <template v-else-if="linha.situacao === 'futura'">
                  <template v-if="confirmando === linha.administracao.id">
                    <span class="item__confirmar" role="status">
                      {{
                        t('clinico.internacao.checklist.antesDaHora', {
                          hora: formato.hora(linha.administracao.previstaPara),
                        })
                      }}
                    </span>
                    <Button
                      type="button"
                      :label="t('clinico.internacao.checklist.registrarAgora')"
                      icon="ph ph-check"
                      size="small"
                      :disabled="salvando"
                      @click="registrarAntes(linha.administracao.id)"
                    />
                    <Button
                      type="button"
                      :label="t('clinico.comum.cancelar')"
                      severity="secondary"
                      text
                      size="small"
                      @click="confirmando = null"
                    />
                  </template>
                  <Button
                    v-else
                    type="button"
                    :label="t('clinico.internacao.checklist.checar')"
                    icon="ph ph-check"
                    severity="secondary"
                    outlined
                    size="small"
                    :disabled="salvando"
                    @click="confirmando = linha.administracao.id"
                  />
                </template>

                <template v-else-if="linha.situacao !== 'suspensa'">
                  <Button
                    type="button"
                    :label="t('clinico.internacao.checklist.checar')"
                    icon="ph ph-check"
                    size="small"
                    :disabled="salvando"
                    @click="emit('registrar', linha.administracao.id, 'feita')"
                  />
                  <!-- A futura já saiu no ramo de cima: aqui toda linha pode ter sido recusada. -->
                  <Button
                    type="button"
                    :label="t('clinico.internacao.checklist.recusou')"
                    icon="ph ph-hand-palm"
                    severity="secondary"
                    outlined
                    size="small"
                    :disabled="salvando"
                    @click="emit('registrar', linha.administracao.id, 'recusada')"
                  />
                </template>
              </div>
            </li>
          </ul>
        </li>
      </template>

      <!-- Tudo o que está na tela já passou: o agora fica depois do último horário. -->
      <li v-if="indiceDoAgora === -1" class="checklist__agora">
        <span class="agora__rotulo ui-num">
          {{ t('clinico.internacao.checklist.agora', { hora: formato.hora(agora) }) }}
        </span>
        <span class="agora__fio" aria-hidden="true" />
      </li>
    </ol>
  </div>
</template>

<style scoped>
/*
 * A linha do tempo: três colunas — a hora, o trilho com o nó, e o que se faz. As colunas são as
 * mesmas no fio do "agora", para ele cruzar o trilho exatamente onde os nós estão.
 */
.checklist {
  --col-hora: 76px;
  --col-trilho: 22px;
  --vao-col: 12px;

  display: grid;
  padding: 6px 18px 14px;
}

.checklist__vazio {
  padding: 22px 0;
}

.checklist__recolhido {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  padding: 10px 0;
  border-bottom: 1px solid var(--linha);
  color: var(--tinta-2);
  font-size: 14px;
}

.checklist__recolhido .ph-check-circle {
  color: var(--ok-tinta);
  font-size: 18px;
}

.tempo {
  display: grid;
  margin: 0;
  padding: 6px 0 0;
  list-style: none;
}

/* ----------------------------------------------------------------- o agora */

/*
 * O rótulo ocupa a coluna da hora e metade da do trilho, encostado à direita: o fio começa no
 * centro do trilho, com o nó exatamente onde ficam os nós dos horários.
 */
.checklist__agora {
  display: grid;
  align-items: center;
  grid-template-columns:
    calc(var(--col-hora) + var(--vao-col) + var(--col-trilho) / 2)
    minmax(0, 1fr);
  margin: 8px 0;
}

.agora__rotulo {
  justify-self: end;
  margin-inline-end: 12px;
  padding: 3px 8px;
  border-radius: 999px;
  background: var(--pj-lugar, var(--musgo));
  color: var(--superficie);
  font-size: 12.5px;
  font-weight: 650;
  white-space: nowrap;
}

.agora__fio {
  position: relative;
  height: 2px;
  border-radius: 2px;
  background: var(--pj-lugar, var(--musgo));
}

.agora__fio::before {
  position: absolute;
  top: 50%;
  left: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--pj-lugar, var(--musgo));
  box-shadow: 0 0 0 4px var(--pj-lugar-fundo, var(--musgo-fundo));
  content: '';
  transform: translate(-50%, -50%);
}

[dir='rtl'] .agora__fio::before {
  right: 0;
  left: auto;
  transform: translate(50%, -50%);
}

/* ----------------------------------------------------------------- horário */

.grupo {
  display: grid;
  column-gap: var(--vao-col);
  grid-template-columns: var(--col-hora) var(--col-trilho) minmax(0, 1fr);
}

.grupo__hora {
  display: grid;
  align-content: start;
  gap: 1px;
  padding-top: 14px;
}

.grupo__hora small {
  color: var(--tinta-3);
  font-size: 12px;
}

.grupo--passado .ui-hora {
  color: var(--tinta-2);
}

.grupo--atrasado .ui-hora,
.grupo--atrasado .grupo__hora small {
  color: var(--risco-tinta);
}

/* O trilho atravessa o horário inteiro; o nó fica na altura da hora. */
.grupo__trilho {
  position: relative;
  display: flex;
  justify-content: center;
}

.grupo__trilho::before {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  background: var(--linha);
  content: '';
}

.grupo__no {
  position: relative;
  width: 12px;
  height: 12px;
  margin-top: 19px;
  border: 2px solid var(--linha-forte);
  border-radius: 50%;
  background: var(--superficie);
}

.grupo--feito .grupo__no {
  border-color: var(--ok);
  background: var(--ok);
}

.grupo--na-hora .grupo__no {
  border-color: var(--atencao);
  background: var(--atencao);
  box-shadow: 0 0 0 4px var(--atencao-fundo);
}

.grupo--atrasado .grupo__no {
  border-color: var(--risco);
  background: var(--risco);
  box-shadow: 0 0 0 4px var(--risco-fundo);
}

.grupo__itens {
  display: grid;
  min-width: 0;
  gap: 2px;
  margin: 0;
  padding: 6px 0;
  list-style: none;
}

/* ----------------------------------------------------------------- item */

.item {
  position: relative;
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 12px;
  padding: 10px 12px 10px 14px;
  border-radius: 12px;
}

.grupo__itens > .item + .item::after {
  position: absolute;
  top: -1px;
  right: 12px;
  left: 58px;
  height: 1px;
  background: var(--linha);
  content: '';
}

/* O atrasado ganha um véu de risco, além da marca e do selo: é o que não pode passar batido. */
.item--atrasada {
  background: color-mix(in oklab, var(--risco-fundo) 55%, transparent);
}

.item--na-janela {
  background: color-mix(in oklab, var(--atencao-fundo) 45%, transparent);
}

.item__icone {
  display: grid;
  width: 34px;
  height: 34px;
  flex: none;
  place-items: center;
  border-radius: 10px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 17px;
}

.item--atrasada .item__icone {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.item--na-janela .item__icone {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.item--feita .item__icone {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.item__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 4px;
}

.item__descricao {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  margin: 0;
  font-size: 14.5px;
  line-height: 1.4;
}

.item__descricao strong {
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-weight: 600;
}

.item__dose {
  color: var(--tinta);
  font-weight: 550;
}

.item__via {
  color: var(--tinta-2);
  font-size: 13px;
}

/* Registrada é história: o texto apaga, a linha continua legível. */
.item--feita .item__descricao strong,
.item--recusada .item__descricao strong,
.item--pulada .item__descricao strong,
.item--feita .item__dose,
.item--recusada .item__dose,
.item--pulada .item__dose {
  color: var(--tinta-2);
}

.item--suspensa {
  opacity: 0.65;
}

.item--suspensa .item__descricao strong {
  text-decoration: line-through;
}

.item__meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.item__situacao.ui-selo {
  height: 22px;
  padding-inline: 8px;
  font-size: 12px;
}

.item__situacao--texto {
  color: var(--tinta-3);
  font-weight: 550;
}

.item__atraso {
  color: var(--risco-tinta);
  font-weight: 600;
}

.item__continuo {
  color: var(--tinta-3);
}

.item__troca {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 2px 0 0;
  color: var(--atencao-tinta);
  font-size: 13px;
  font-weight: 600;
}

.item__observacao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.item__acoes {
  display: flex;
  flex: 0 0 auto;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  max-width: 50%;
}

/* A pergunta do registro antecipado, na cor de atenção: é o único texto da linha que pede algo. */
.item__confirmar {
  flex-basis: 100%;
  color: var(--atencao-tinta);
  font-size: 13px;
  font-weight: 600;
  text-align: end;
}

@media (width <= 640px) {
  .checklist {
    --col-hora: 48px;
    --col-trilho: 14px;
    --vao-col: 8px;

    padding-inline: 12px;
  }


  /* Estreito, o rótulo não cabe na coluna da hora: ele vem primeiro e o fio segue. */
  .checklist__agora {
    column-gap: 10px;
    grid-template-columns: max-content minmax(0, 1fr);
  }

  .agora__rotulo {
    justify-self: start;
    margin-inline-end: 0;
  }

  .item {
    flex-wrap: wrap;
  }

  .item__icone {
    display: none;
  }

  .grupo__itens > .item + .item::after {
    left: 12px;
  }

  .item__acoes {
    width: 100%;
    max-width: none;
    justify-content: flex-start;
  }

  .item__confirmar {
    text-align: start;
  }
}
</style>
