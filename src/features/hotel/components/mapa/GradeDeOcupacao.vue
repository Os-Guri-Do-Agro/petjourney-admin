<script setup lang="ts">
/**
 * A grade de ocupação — linhas são acomodações, colunas são **noites**.
 *
 * É a tela que faz um sistema de hotel fazer sentido, e a primeira versão deste módulo não a
 * tinha: havia uma fileira de cartões dizendo "8 livres", que é a resposta certa para uma
 * pergunta que ninguém faz. A pergunta do telefone é "tem vaga do dia 22 ao dia 30?", e ela não
 * se responde com um número — se responde **olhando o buraco** entre duas barras.
 *
 * Três decisões de desenho que vêm disso:
 *
 * 1. **O vazio é a informação.** As barras são o que está vendido; o que se procura é o espaço
 *    entre elas. A célula livre é um botão: o ponteiro sobre ela mostra o "+" na cor da casa, e o
 *    clique começa a reserva naquele dia, naquela acomodação.
 * 2. **A noite da saída não é ocupada.** Quem sai dia 30 ao meio-dia libera aquela noite. Pintar
 *    o dia 30 mostraria à recepção uma diária cheia que está à venda — e é assim que um hotel
 *    perde receita sem saber.
 * 3. **A barra diz de quem é.** Rosto e nome do hóspede, e a documentação pendente como um aviso
 *    âmbar na ponta: quem opera pergunta pelo nome do animal, nunca pelo número da baia.
 *
 * O cabeçalho é a fita dos dias, como a semana da Agenda: o dia da semana, o número e, embaixo,
 * quanto da casa já está vendido naquela noite. Hoje leva o ponto e a coluna tingida de lavanda.
 * A grade rola por dentro, com os dias presos em cima e as acomodações presas à esquerda.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

import { ICONE_DO_DESENHO } from '../base/icone-do-desenho'
import PetAvatar from '../base/PetAvatar.vue'
import { useHotelFormat } from '../../composables/useHotelFormat'
import type { FaixaNaGrade, GradeDeOcupacao, LinhaDaGrade } from '../../data/repositories'
import type { Bloco, ISODate } from '../../data/types'
import { useHotelStore } from '../../stores/hotel'

const props = defineProps<{
  grade: GradeDeOcupacao
  blocos: Bloco[]
  hoje: ISODate
  /** Intervalo que o usuário procura, para a grade destacar o que serve. `null` desliga o realce. */
  procura: { de: ISODate; ate: ISODate } | null
}>()

const emit = defineEmits<{
  abrirReserva: [reservaId: string]
  reservar: [payload: { acomodacaoId: string; dia: ISODate }]
}>()

const { t, locale } = useI18n()
const formato = useHotelFormat()
/* O nome do tipo é cadastro da casa, não tradução nossa: sai da store, não do formatador. */
const hotelStore = useHotelStore()

const tag = computed(() => INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE])

/** Agrupa por bloco, na ordem física da casa. */
const grupos = computed(() =>
  props.blocos
    .map((bloco) => ({
      bloco,
      linhas: props.grade.linhas.filter((linha) => linha.acomodacao.blocoId === bloco.id),
    }))
    .filter((grupo) => grupo.linhas.length > 0),
)

const colunas = computed(() => props.grade.dias.length)

/** Recorte da procura em índices de coluna, para pintar a faixa que o usuário pediu. */
const recorte = computed(() => {
  if (!props.procura) {
    return null
  }

  const de = props.grade.dias.indexOf(props.procura.de)
  const ate = props.grade.dias.indexOf(props.procura.ate)

  return de < 0 || ate < 0 ? null : { de, ate }
})

function naProcura(indice: number) {
  return recorte.value !== null && indice >= recorte.value.de && indice < recorte.value.ate
}

/**
 * A linha serve para o que se procura?
 *
 * Serve quando **todas** as noites do intervalo pedido estão livres. É o que permite a grade
 * apagar o ruído e deixar acesas só as linhas que respondem ao telefone.
 */
function serveParaAProcura(linha: LinhaDaGrade): boolean {
  const alvo = recorte.value

  if (!alvo || !linha.acomodacao.ativa) {
    return false
  }

  for (let dia = alvo.de; dia < alvo.ate; dia += 1) {
    if (linha.faixas.some((faixa) => faixa.de <= dia && dia < faixa.ate)) {
      return false
    }
  }

  return true
}

function ehFimDeSemana(data: ISODate): boolean {
  const dia = new Date(`${data}T12:00:00Z`).getUTCDay()

  return dia === 0 || dia === 6
}

function semPonto(texto: string) {
  return texto.replace(/\.$/, '')
}

/** Texto do dia no cabeçalho: `qua` em cima, `24` embaixo — no idioma de quem lê. */
function diaDaSemana(data: ISODate): string {
  return semPonto(
    new Intl.DateTimeFormat(tag.value, { weekday: 'short', timeZone: 'UTC' }).format(
      new Date(`${data}T12:00:00Z`),
    ),
  )
}

function numeroDoDia(data: ISODate): string {
  return String(Number(data.slice(8, 10)))
}

/** Primeiro dia à vista e primeiro dia de cada mês ganham o mês — a grade atravessa a virada. */
function inicioDeMes(data: ISODate, indice: number): string {
  if (indice > 0 && data.slice(8, 10) !== '01') {
    return ''
  }

  return semPonto(
    new Intl.DateTimeFormat(tag.value, { month: 'short', timeZone: 'UTC' }).format(
      new Date(`${data}T12:00:00Z`),
    ),
  )
}

function dataLonga(data: ISODate): string {
  return new Intl.DateTimeFormat(tag.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${data}T12:00:00Z`))
}

/** Quanto da casa já está vendido em cada noite: a barrinha embaixo do número, como na Agenda. */
const cargaPorDia = computed(() =>
  props.grade.porDia.map((dia) => ({
    ...dia,
    fracao: dia.operando > 0 ? Math.min(1, dia.ocupadas / dia.operando) : 0,
  })),
)

function rotuloDoDia(indice: number): string {
  const dia = cargaPorDia.value[indice]
  const data = props.grade.dias[indice] ?? ''

  if (!dia) {
    return dataLonga(data)
  }

  return t('hotel.grade.tela.diaRotulo', {
    dia: dataLonga(data),
    ocupadas: dia.ocupadas,
    total: dia.operando,
  })
}

/**
 * O que cabe dentro da barra.
 *
 * A coluna tem cerca de 45 px. Numa estadia de uma noite cabe o rosto e nada mais — o nome inteiro
 * continua no rótulo da barra (leitor de tela e dica do ponteiro) e na tela da reserva. A partir
 * de quatro noites, o acompanhante entra junto do nome.
 */
function rotuloDaBarra(faixa: FaixaNaGrade): string {
  const noites = faixa.ate - faixa.de

  if (noites <= 1) {
    return ''
  }

  return faixa.acompanhanteNome && noites > 3
    ? `${faixa.petNome} + ${faixa.acompanhanteNome}`
    : faixa.petNome
}

function temAviso(faixa: FaixaNaGrade) {
  return faixa.admissao !== 'ok' && faixa.admissao !== 'dispensado'
}

function descricaoDaBarra(faixa: FaixaNaGrade): string {
  const base = t('hotel.grade.barraTitulo', {
    pet: faixa.acompanhanteNome ? `${faixa.petNome} + ${faixa.acompanhanteNome}` : faixa.petNome,
    tutor: faixa.tutorNome,
    periodo: formato.periodo(faixa.entradaPrevista, faixa.saidaPrevista),
  })

  const partes = [base, formato.statusDaReserva(faixa.status)]

  if (temAviso(faixa)) {
    partes.push(formato.situacaoDaExigencia(faixa.admissao))
  }

  return partes.join(' · ')
}
</script>

<template>
  <div class="grade">
    <div class="grade__folha ui-folha">
      <div
        class="grade__rolagem"
        role="region"
        tabindex="0"
        :aria-label="t('hotel.grade.legendaTabela')"
      >
        <table class="tabela" :style="{ '--colunas': colunas }">
          <caption class="sr-only">
            {{
              t('hotel.grade.legendaTabela')
            }}
          </caption>

          <thead>
            <tr>
              <th scope="col" class="tabela__canto">
                <!-- O canto leva a navegação do período, quando a tela a oferece: as setas ao lado dos dias. -->
                <slot name="canto" />
                <span class="tabela__canto-rotulo">{{ t('hotel.grade.acomodacao') }}</span>
              </th>

              <th
                v-for="(dia, indice) in grade.dias"
                :key="dia"
                scope="col"
                class="dia"
                :class="{
                  'dia--fim-de-semana': ehFimDeSemana(dia),
                  'dia--hoje': dia === hoje,
                  'dia--procurado': naProcura(indice),
                  'dia--cheio':
                    (cargaPorDia[indice]?.operando ?? 0) > 0 && (cargaPorDia[indice]?.fracao ?? 0) >= 1,
                }"
                :aria-label="rotuloDoDia(indice)"
              >
                <span class="dia__mes" aria-hidden="true">{{ inicioDeMes(dia, indice) }}</span>
                <span class="dia__semana" aria-hidden="true">{{ diaDaSemana(dia) }}</span>
                <span class="dia__numero ui-num" aria-hidden="true">{{ numeroDoDia(dia) }}</span>
                <span class="dia__carga" aria-hidden="true">
                  <span :style="{ width: `${Math.round((cargaPorDia[indice]?.fracao ?? 0) * 100)}%` }" />
                </span>
              </th>
            </tr>
          </thead>

          <tbody v-for="grupo in grupos" :key="grupo.bloco.id">
            <tr class="bloco">
              <th scope="colgroup" :colspan="colunas + 1">
                <span class="bloco__nome">
                  <span class="bloco__icone" aria-hidden="true">
                    <i :class="ICONE_DO_DESENHO[grupo.bloco.icone]" />
                  </span>
                  {{ grupo.bloco.nome }}
                  <span class="ui-contagem">{{ grupo.linhas.length }}</span>
                </span>
              </th>
            </tr>

            <tr
              v-for="linha in grupo.linhas"
              :key="linha.acomodacao.id"
              class="linha"
              :class="{
                'linha--parada': !linha.acomodacao.ativa,
                'linha--serve': serveParaAProcura(linha),
                'linha--apagada': recorte !== null && !serveParaAProcura(linha),
              }"
            >
              <th scope="row" class="acom">
                <span class="acom__texto">
                  <span class="acom__nome">{{ linha.acomodacao.nome }}</span>
                  <span class="acom__tipo">
                    {{ hotelStore.tipoDeAcomodacao(linha.acomodacao.tipoId)?.nome }} ·
                    {{ formato.porte(linha.acomodacao.porteMaximo) }}
                  </span>
                </span>
                <i
                  v-if="serveParaAProcura(linha)"
                  class="ph ph-check-circle acom__serve"
                  :title="t('hotel.grade.tela.serve')"
                  :aria-label="t('hotel.grade.tela.serve')"
                />
              </th>

              <!--
                Uma célula por noite, e as barras por cima com `grid-column`. Célula por dia — em vez
                de uma faixa absoluta — é o que mantém o clique no vazio significando "reservar a
                partir deste dia", que é como se vende no telefone.
              -->
              <td :colspan="colunas" class="faixa">
                <div class="faixa__grade">
                  <button
                    v-for="(dia, indice) in grade.dias"
                    :key="dia"
                    type="button"
                    class="celula"
                    :class="{
                      'celula--fim-de-semana': ehFimDeSemana(dia),
                      'celula--hoje': dia === hoje,
                      'celula--procurada': naProcura(indice),
                    }"
                    :style="{ gridColumn: `${indice + 1} / span 1` }"
                    :disabled="!linha.acomodacao.ativa"
                    :title="
                      linha.acomodacao.ativa
                        ? t('hotel.grade.reservarEm', {
                            acomodacao: linha.acomodacao.nome,
                            data: formato.data(dia),
                          })
                        : undefined
                    "
                    :aria-label="
                      t('hotel.grade.reservarEm', {
                        acomodacao: linha.acomodacao.nome,
                        data: formato.data(dia),
                      })
                    "
                    @click="emit('reservar', { acomodacaoId: linha.acomodacao.id, dia })"
                  >
                    <i class="ph ph-plus celula__mais" aria-hidden="true" />
                  </button>

                  <button
                    v-for="faixa in linha.faixas"
                    :key="faixa.reservaId"
                    type="button"
                    class="barra"
                    :class="[
                      `barra--${faixa.status}`,
                      {
                        'barra--curta': faixa.ate - faixa.de <= 1,
                        'barra--entra-antes': faixa.entraAntes,
                        'barra--sai-depois': faixa.saiDepois,
                        'barra--atencao': temAviso(faixa),
                      },
                    ]"
                    :style="{ gridColumn: `${faixa.de + 1} / ${faixa.ate + 1}` }"
                    :title="descricaoDaBarra(faixa)"
                    @click="emit('abrirReserva', faixa.reservaId)"
                  >
                    <PetAvatar
                      class="barra__rosto"
                      :nome="faixa.petNome"
                      :iniciais="faixa.petIniciais"
                      :especie="faixa.petEspecie"
                      :foto-url="faixa.petFotoUrl"
                      tamanho="sm"
                    />
                    <span v-if="rotuloDaBarra(faixa)" class="barra__nome" aria-hidden="true">
                      {{ rotuloDaBarra(faixa) }}
                    </span>
                    <span class="sr-only">{{ descricaoDaBarra(faixa) }}</span>
                    <i
                      v-if="temAviso(faixa)"
                      class="ph ph-warning barra__aviso"
                      aria-hidden="true"
                    />
                  </button>

                  <!-- Fora de operação: hachura por cima da linha inteira, sem esconder o nome. -->
                  <span
                    v-if="!linha.acomodacao.ativa"
                    class="parada"
                    :style="{ gridColumn: `1 / ${colunas + 1}` }"
                  >
                    <i class="ph ph-wrench" aria-hidden="true" />
                    {{ formato.motivoInativa(linha.acomodacao.motivoInativa ?? 'outro') }}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!--
        Legenda fixa no pé da folha. Uma grade colorida sem legenda obriga quem chega a inferir o
        significado das cores pelo contexto — e a inferir errado na primeira vez que importa.
      -->
      <ul class="legenda">
        <li>
          <span class="amostra amostra--livre" aria-hidden="true"><i class="ph ph-plus" /></span>
          {{ t('hotel.grade.legenda.livre') }}
        </li>
        <li>
          <span class="amostra amostra--hospedado" aria-hidden="true" />
          {{ t('hotel.grade.legenda.hospedado') }}
        </li>
        <li>
          <span class="amostra amostra--confirmada" aria-hidden="true" />
          {{ t('hotel.grade.legenda.confirmada') }}
        </li>
        <li>
          <span class="amostra amostra--pendente" aria-hidden="true" />
          {{ t('hotel.grade.legenda.pendente') }}
        </li>
        <li>
          <span class="amostra amostra--atencao" aria-hidden="true"><i class="ph ph-warning" /></span>
          {{ t('hotel.grade.legenda.atencao') }}
        </li>
        <li>
          <span class="amostra amostra--parada" aria-hidden="true" />
          {{ t('hotel.grade.legenda.parada') }}
        </li>
        <li>
          <span class="amostra amostra--hoje" aria-hidden="true" />
          {{ t('hotel.grade.tela.hoje') }}
        </li>
        <li class="legenda__livres">
          <i class="ph ph-sparkle" aria-hidden="true" />
          {{ t('hotel.mapa.semNenhumaReserva', { total: grade.totalmenteLivres }, grade.totalmenteLivres) }}
        </li>
      </ul>
    </div>
  </div>
</template>

<style scoped>
.grade {
  --grade-acom: 11.5rem;
  --grade-dia: 2.75rem;
  --grade-linha: 54px;
  --grade-hoje: color-mix(in oklab, var(--hotel-fundo) 58%, transparent);
  --grade-fds: color-mix(in oklab, var(--superficie-2) 75%, transparent);

  display: grid;
}

.grade__folha {
  overflow: hidden;
}

/*
 * A grade rola por dentro, nos dois sentidos: os dias ficam presos em cima e as acomodações à
 * esquerda enquanto se percorre a casa. A altura é a que sobra da janela, como na Agenda.
 */
.grade__rolagem {
  max-height: max(26rem, calc(100dvh - 25rem));
  overflow: auto;
  overscroll-behavior: contain;
}

.grade__rolagem:focus-visible {
  outline: 2px solid var(--pj-lugar);
  outline-offset: -2px;
}

.tabela {
  width: 100%;
  min-width: calc(var(--grade-acom) + var(--colunas) * var(--grade-dia));
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ------------------------------------------------------------------ a fita dos dias */

.tabela__canto-rotulo {
  display: block;
}

thead th {
  position: sticky;
  z-index: 3;
  top: 0;
  background: var(--superficie);
}

.tabela__canto {
  z-index: 5;
  width: var(--grade-acom);
  padding: 8px 12px 12px 18px;
  border-bottom: 1px solid var(--linha);
  border-inline-end: 1px solid var(--linha-suave);
  color: var(--tinta-3);
  font-size: 12.5px;
  font-weight: 600;
  inset-inline-start: 0;
  text-align: start;
  vertical-align: bottom;
}

.dia {
  padding: 10px 0 10px;
  border-bottom: 1px solid var(--linha);
  color: var(--tinta-3);
  font-weight: 500;
  line-height: 1.15;
  text-align: center;
  vertical-align: bottom;
}

.dia--fim-de-semana {
  background: color-mix(in oklab, var(--superficie-2) 80%, var(--superficie));
}

.dia__mes,
.dia__semana,
.dia__numero {
  display: block;
}

.dia__mes {
  height: 15px;
  color: var(--pj-lugar-tinta);
  font-size: 11px;
  font-weight: 650;
  white-space: nowrap;
}

.dia__semana {
  font-size: 11.5px;
}

/* O número do dia num disco: em hoje, o disco acende na cor da casa. */
.dia__numero {
  display: grid;
  width: 28px;
  height: 28px;
  margin: 2px auto 0;
  place-items: center;
  border-radius: 50%;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 650;
}

/* A barrinha de carga: quanto da casa já está vendido naquela noite. */
.dia__carga {
  display: block;
  width: 22px;
  height: 4px;
  margin: 6px auto 0;
  overflow: hidden;
  border-radius: 2px;
  background: var(--superficie-3);
}

.dia__carga span {
  display: block;
  height: 100%;
  border-radius: 2px;
  background: var(--hotel);
}

/* Noite lotada: a barrinha cheia passa para o âmbar — "aqui não cabe mais ninguém". */
.dia--cheio .dia__carga span {
  background: var(--atencao);
}

/* Hoje: a coluna tingida de lavanda e o número aceso, como o dia de hoje na semana da Agenda. */
.dia--hoje {
  background: color-mix(in oklab, var(--hotel-fundo) 62%, var(--superficie));
}

.dia--hoje .dia__semana {
  color: var(--hotel-tinta);
  font-weight: 650;
}

.dia--hoje .dia__numero {
  background: var(--hotel);
  box-shadow: 0 4px 10px -4px color-mix(in oklab, var(--hotel) 80%, transparent);
  color: #fff;
}

.app-dark .dia--hoje .dia__numero {
  color: var(--rail);
}

/* O período procurado: um traço verde na base dos dias, o mesmo verde das linhas que servem. */
.dia--procurado::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 3px;
  background: var(--ok);
  content: '';
}

/* ------------------------------------------------------------------ blocos e acomodações */

.bloco th {
  position: relative;
  z-index: 1;
  padding: 0;
  border-bottom: 1px solid var(--linha-suave);
  background: var(--superficie-2);
  text-align: start;
}

/* O nome do bloco fica preso à esquerda mesmo com a grade rolada para o fim do mês. */
.bloco__nome {
  position: sticky;
  display: inline-flex;
  align-items: center;
  gap: 9px;
  height: 42px;
  padding: 0 18px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 650;
  inset-inline-start: 0;
}

.bloco__icone {
  display: inline-grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 8px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 15px;
}

.bloco .ui-contagem {
  height: 20px;
  min-width: 22px;
  background: var(--superficie);
  font-size: 11.5px;
}

.acom {
  position: sticky;
  z-index: 2;
  height: var(--grade-linha);
  padding: 0 12px 0 18px;
  border-bottom: 1px solid var(--linha-suave);
  border-inline-end: 1px solid var(--linha);
  background: var(--superficie);
  font-weight: 400;
  inset-inline-start: 0;
  text-align: start;
}

.acom__texto {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.acom__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.25;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acom__tipo {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.3;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.acom > .acom__texto {
  display: inline-grid;
  max-width: calc(100% - 24px);
  vertical-align: middle;
}

.acom__serve {
  margin-inline-start: 6px;
  color: var(--ok-tinta);
  font-size: 17px;
  vertical-align: middle;
}

.linha--parada .acom__nome {
  color: var(--tinta-2);
}

/*
 * Apagar, e não esconder: quando há uma procura ativa, as linhas que não servem continuam
 * inteiras — só o nome da acomodação perde peso. As barras ficam com a cor delas: quem procurava
 * "tem baia grande livre?" precisa ler quem está nas outras baias, que é exatamente a informação
 * que se usa para negociar uma troca. O que acende é a linha que serve: o nome no verde de "dá",
 * com o visto, e as noites procuradas tingidas.
 */
.linha--apagada .acom__texto {
  opacity: 0.6;
}

.linha--apagada:hover .acom__texto,
.linha--apagada:focus-within .acom__texto {
  opacity: 1;
}

/* A acomodação que serve para a busca: o nome no verde de "dá", com o visto ao lado. */
.linha--serve .acom {
  background: color-mix(in oklab, var(--ok-fundo) 55%, var(--superficie));
}

.linha:hover .acom {
  background: color-mix(in oklab, var(--superficie-2) 70%, var(--superficie));
}

.linha--serve:hover .acom {
  background: color-mix(in oklab, var(--ok-fundo) 75%, var(--superficie));
}

.faixa {
  padding: 0;
  border-bottom: 1px solid var(--linha-suave);
}

.faixa__grade {
  display: grid;
  height: var(--grade-linha);
  grid-template-columns: repeat(var(--colunas), minmax(0, 1fr));
  grid-template-rows: 1fr;
}

/* ------------------------------------------------------------------ células livres */

.celula {
  display: grid;
  place-items: center;
  grid-row: 1;
  padding: 0;
  border: 0;
  border-inline-start: 1px solid var(--linha-suave);
  background: transparent;
  color: var(--hotel-tinta);
  cursor: pointer;
  transition: background-color var(--pj-tempo-curto) var(--pj-curva-chega);
}

.celula--fim-de-semana {
  background: var(--grade-fds);
}

.linha--serve .celula--procurada {
  background: color-mix(in oklab, var(--ok-fundo) 80%, transparent);
}

/* Hoje: a coluna tingida de lavanda e a agulha na borda, atravessando a casa inteira. */
.celula--hoje {
  background: var(--grade-hoje);
  box-shadow: inset 2px 0 0 color-mix(in oklab, var(--hotel) 75%, transparent);
}

[dir='rtl'] .celula--hoje {
  box-shadow: inset -2px 0 0 color-mix(in oklab, var(--hotel) 75%, transparent);
}

.celula__mais {
  display: grid;
  width: 26px;
  height: 26px;
  place-items: center;
  border-radius: 8px;
  background: var(--superficie);
  box-shadow: var(--sombra-1);
  font-size: 14px;
  opacity: 0;
  transform: scale(0.85);
  transition:
    opacity var(--pj-tempo-curto) var(--pj-curva-chega),
    transform var(--pj-tempo-curto) var(--pj-curva-chega);
}

/* O vazio convida: o ponteiro sobre ele mostra o "+", e o clique começa a reserva ali. */
.celula:not(:disabled):hover,
.celula:not(:disabled):focus-visible {
  background: color-mix(in oklab, var(--hotel-fundo) 85%, transparent);
}

.celula:not(:disabled):hover .celula__mais,
.celula:not(:disabled):focus-visible .celula__mais {
  opacity: 1;
  transform: none;
}

.celula:focus-visible {
  z-index: 1;
  outline: 2px solid var(--hotel);
  outline-offset: -2px;
}

.celula:disabled {
  cursor: default;
}

/* ------------------------------------------------------------------ barras */

/*
 * A estadia: uma pílula com o rosto na ponta. Quem está na casa ganha a cor cheia e um pouco de
 * altura (sombra rente); quem vem chegando fica no tom claro; quem não pagou, tracejado.
 */
.barra {
  position: relative;
  z-index: 1;
  display: flex;
  min-width: 0;
  overflow: hidden;
  align-items: center;
  gap: 8px;
  margin: 9px 3px;
  padding: 0 10px 0 4px;
  grid-row: 1;
  border: 1px solid transparent;
  border-radius: 999px;
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: -0.005em;
  text-align: start;
  white-space: nowrap;
  /*
   * O anel já nasce aqui, transparente: declarado só no hover, a largura iria de zero a dois e a
   * cor não teria de onde transicionar.
   */
  outline: 2px solid transparent;
  outline-offset: 2px;
  transition:
    outline-color var(--pj-tempo-curto) var(--pj-curva-chega),
    transform var(--pj-tempo-curto) var(--pj-curva-chega),
    box-shadow var(--pj-tempo-curto) var(--pj-curva-chega);
}

.barra:hover,
.barra:focus-visible {
  z-index: 2;
  outline-color: color-mix(in oklab, var(--hotel) 70%, transparent);
  transform: translateY(-1px);
}

.barra__rosto {
  flex: none;
  box-shadow: 0 0 0 2px var(--superficie);
}

.barra__nome {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Uma noite só: o rosto centrado, e o nome no rótulo. */
.barra--curta {
  justify-content: center;
  padding: 0;
}

.barra--curta .barra__aviso {
  position: absolute;
  top: 1px;
  right: 1px;
  width: 15px;
  height: 15px;
  font-size: 10px;
}

.barra--hospedado {
  background: var(--hotel);
  box-shadow:
    0 1px 2px rgb(16 40 32 / 12%),
    0 6px 14px -8px color-mix(in oklab, var(--hotel) 90%, transparent),
    inset 0 1px 0 rgb(255 255 255 / 18%);
  color: #fff;
}

.app-dark .barra--hospedado {
  box-shadow:
    0 1px 2px rgb(0 0 0 / 40%),
    inset 0 1px 0 rgb(255 255 255 / 22%);
  color: var(--rail);
}

.barra--hospedado .barra__rosto {
  box-shadow: 0 0 0 2px rgb(255 255 255 / 55%);
}

.barra--confirmada {
  border-color: color-mix(in oklab, var(--hotel) 38%, transparent);
  background: color-mix(in oklab, var(--hotel-fundo) 85%, var(--superficie));
  box-shadow: var(--sombra-xs);
  color: var(--hotel-tinta);
}

.barra--pendente {
  border: 1.5px dashed color-mix(in oklab, var(--hotel) 80%, transparent);
  background: var(--superficie);
  color: var(--hotel-tinta);
}

.barra--encerrada,
.barra--cancelada,
.barra--nao-compareceu {
  border-color: var(--linha);
  background: var(--superficie-3);
  color: var(--tinta-2);
}

/* A documentação pendente: um selinho âmbar na ponta, legível sobre qualquer das três barras. */
.barra__aviso {
  display: grid;
  flex: none;
  width: 22px;
  height: 22px;
  margin-inline-start: auto;
  margin-inline-end: -4px;
  place-items: center;
  border-radius: 50%;
  background: var(--atencao-fundo);
  box-shadow: 0 0 0 2px var(--superficie);
  color: var(--atencao-tinta);
  font-size: 12px;
}

/* A estadia continua fora do intervalo à vista: a ponta fica reta, colada na borda. */
.barra--entra-antes {
  margin-inline-start: 0;
  border-start-start-radius: 0;
  border-end-start-radius: 0;
  padding-inline-start: 8px;
}

.barra--sai-depois {
  margin-inline-end: 0;
  border-start-end-radius: 0;
  border-end-end-radius: 0;
}

.parada {
  z-index: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  margin: 9px 3px;
  border: 1px dashed var(--linha-media);
  border-radius: 999px;
  background: repeating-linear-gradient(
    -45deg,
    var(--superficie-2),
    var(--superficie-2) 6px,
    var(--superficie-3) 6px,
    var(--superficie-3) 12px
  );
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 600;
  grid-row: 1;
  pointer-events: none;
}

/* ------------------------------------------------------------------ legenda */

.legenda {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 20px;
  margin: 0;
  padding: 12px 18px;
  border-top: 1px solid var(--linha);
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 13px;
  list-style: none;
}

.legenda li {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

/* O que não tem reserva nenhuma no período à vista: a vaga mais fácil de vender, na ponta. */
.legenda__livres {
  margin-inline-start: auto;
  color: var(--tinta);
  font-weight: 550;
}

.legenda__livres i {
  color: var(--pj-lugar-tinta);
}

.amostra {
  display: inline-grid;
  width: 26px;
  height: 14px;
  place-items: center;
  border: 1px solid transparent;
  border-radius: 999px;
  font-size: 10px;
}

.amostra--livre {
  border-color: var(--linha);
  background: var(--superficie);
  color: var(--hotel-tinta);
}

.amostra--hospedado {
  background: var(--hotel);
}

.amostra--confirmada {
  border-color: color-mix(in oklab, var(--hotel) 40%, transparent);
  background: var(--hotel-fundo);
}

.amostra--pendente {
  border: 1.5px dashed var(--hotel);
  background: var(--superficie);
}

.amostra--atencao {
  width: 16px;
  height: 16px;
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.amostra--parada {
  border-color: var(--linha-media);
  background: repeating-linear-gradient(
    -45deg,
    var(--superficie-2),
    var(--superficie-2) 3px,
    var(--superficie-3) 3px,
    var(--superficie-3) 6px
  );
}

.amostra--hoje {
  width: 14px;
  border-radius: 3px;
  background: var(--hotel-fundo);
  box-shadow: inset 2px 0 0 var(--hotel);
}

@media (max-width: 900px) {
  .grade {
    --grade-acom: 8.25rem;
    --grade-dia: 2.6rem;
  }

  .acom {
    padding-inline-start: 12px;
  }

  .tabela__canto {
    padding-inline-start: 12px;
  }

  .legenda__livres {
    margin-inline-start: 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .barra,
  .celula,
  .celula__mais {
    transition: none;
  }

  .barra:hover,
  .barra:focus-visible {
    transform: none;
  }
}
</style>
